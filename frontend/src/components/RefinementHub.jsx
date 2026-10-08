import { useEffect, useMemo, useRef, useState } from 'react';
import { strategyWood, strategyFiber, strategyLeather, strategyMetal } from '../api.js';
import { ICONS } from './Icons.jsx';
import { tempoDesde, classeIdade } from '../utils/tempo.js';

const ITEM_ICON_URL = (id) => `https://render.albiononline.com/v1/item/${id}.png?quality=1`;

const RESOURCE_INFO = {
  wood:    { label: 'Madeira', produto: 'Tábuas', suffix: '_PLANKS',   color: 'var(--wood)'    },
  fiber:   { label: 'Fibra',   produto: 'Tecido', suffix: '_CLOTH',    color: 'var(--fiber)'   },
  leather: { label: 'Couro',   produto: 'Couro',  suffix: '_LEATHER',  color: 'var(--leather)' },
  metal:   { label: 'Minério', produto: 'Barras', suffix: '_METALBAR', color: 'var(--metal)'   },
};

// Margem acima disso quase sempre é preço velho ou errado na API.
const MARGEM_SUSPEITA = 60;

const FOCO_BASE = { T4: 41, T5: 103, T6: 257, T7: 643, T8: 1607 };
const MULT_ENCHANT = [1, 1.5, 2.5, 5, 10];

const STORAGE_KEYS = {
  wood:    'albion-wood-config-v1',
  fiber:   'albion-fiber-config-v1',
  leather: 'albion-leather-config-v1',
  metal:   'albion-metal-config-v1',
};

const STRATEGY_FNS = { wood: strategyWood, fiber: strategyFiber, leather: strategyLeather, metal: strategyMetal };
const DEFAULT_SPEC = { t4: '0', t5: '0', t6: '0', t7: '0', t8: '0' };
const ALL_RESOURCES = ['wood', 'fiber', 'leather', 'metal'];

function loadAllSpecs() {
  const specs = {};
  for (const [resource, key] of Object.entries(STORAGE_KEYS)) {
    try {
      const raw = localStorage.getItem(key);
      const cfg = raw ? JSON.parse(raw) : null;
      specs[resource] = cfg?.spec ?? DEFAULT_SPEC;
    } catch {
      specs[resource] = DEFAULT_SPEC;
    }
  }
  return specs;
}

function mergeTopLists(resourceData) {
  const all = [];
  for (const [resource, result] of Object.entries(resourceData)) {
    if (!result?.fsLocalFocoAll) continue;
    for (const item of result.fsLocalFocoAll) {
      all.push({ ...item, resource, resourceLabel: RESOURCE_INFO[resource].label });
    }
  }

  const topSemFoco = [...all]
    .filter(i => i.lucro > -8e8)
    .sort((a, b) => b.lucro - a.lucro)
    .slice(0, 15);

  const maxReducaoGeral = 5 * 100 * 30;
  const maxReducaoTier = 100 * 250;
  const allMaxSpec = all.map(i => {
    const [tier, levelStr = '0'] = i.item.split('.');
    const idxN = parseInt(levelStr, 10);
    const focoUnidades = (FOCO_BASE[tier] ?? 250) * (MULT_ENCHANT[idxN] ?? 1) * 0.5 ** ((maxReducaoGeral + maxReducaoTier) / 10000);
    return { ...i, focoUnidades };
  });

  const topComFoco = [...allMaxSpec]
    .filter(i => i.lucroComFoco > -8e8 && i.focoUnidades > 0)
    .sort((a, b) => (b.lucroComFoco / b.focoUnidades) - (a.lucroComFoco / a.focoUnidades))
    .slice(0, 15);

  return { topSemFoco, topComFoco };
}

function buildId(resource, item) {
  const [tier, level = '0'] = String(item).split('.');
  const { suffix } = RESOURCE_INFO[resource];
  return level === '0' ? `${tier}${suffix}` : `${tier}${suffix}_LEVEL${level}@${level}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────

function formatPeak(p) {
  if (!p) return '—';
  return `${String(p.start).padStart(2, '0')}h–${String(p.end).padStart(2, '0')}h`;
}

function fmtProfit(v) {
  if (v <= -8e8) return '—';
  return Math.round(v).toLocaleString('pt-BR');
}

function fmtFoco(v) {
  if (v <= -8e8) return '—';
  return v.toFixed(2);
}

function fmtPct(v) {
  if (v == null) return '—';
  return (v >= 0 ? '+' : '') + v.toFixed(1) + '%';
}

function ItemCell({ resource, item, imgId }) {
  const [tier, enc = '0'] = String(item).split('.');
  const info = RESOURCE_INFO[resource];
  return (
    <div className="item-cell">
      <div className="item-icon">
        <img
          src={ITEM_ICON_URL(imgId)}
          alt=""
          loading="lazy"
          onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }}
        />
      </div>
      <div className="item-text">
        <span className="item-name">
          {info.produto} {tier}
          {enc !== '0' && <span className={`enc-pill enc-${enc}`}>.{enc}</span>}
        </span>
        <span className="item-sub" style={{ '--cor-recurso': info.color }}>{info.label}</span>
      </div>
    </div>
  );
}

function SituacaoPreco({ row, pct }) {
  if (row.estimado) {
    return (
      <span className="alerta-preco" title="Faltou preço atual de algum material; a conta usou a média da semana.">
        <ICONS.alert size={13} /> estimado
      </span>
    );
  }
  if (pct != null && pct > MARGEM_SUSPEITA) {
    return (
      <span className="alerta-preco" title="Margem alta demais: confira o preço no jogo antes de refinar.">
        <ICONS.alert size={13} /> conferir
      </span>
    );
  }
  return <span className={classeIdade(row.atualizacao)}>{tempoDesde(row.atualizacao)}</span>;
}

// ─── HubTable ──────────────────────────────────────────────────────────────
function HubTable({ title, subtitle, rows, getValue, getPercent, valueLabel, valueFormat }) {
  const [sortCol, setSortCol] = useState('value');
  const [sortAsc, setSortAsc] = useState(false);

  const sortedRows = useMemo(() => {
    if (!rows?.length) return [];
    return [...rows].sort((a, b) => {
      let va, vb;
      if (sortCol === 'value') {
        va = getValue(a) ?? -Infinity;
        vb = getValue(b) ?? -Infinity;
      } else if (sortCol === 'pct') {
        va = getPercent(a) ?? -Infinity;
        vb = getPercent(b) ?? -Infinity;
      } else {
        va = a.volume ?? 0;
        vb = b.volume ?? 0;
      }
      return sortAsc ? va - vb : vb - va;
    });
  }, [rows, sortCol, sortAsc, getValue, getPercent]);

  function handleSort(col) {
    if (sortCol === col) setSortAsc((v) => !v);
    else { setSortCol(col); setSortAsc(false); }
  }

  const SortIcon = sortAsc ? ICONS.arrowUp : ICONS.arrowDown;
  const cabecalho = (col, rotulo, cls) => (
    <th
      className={`${cls} rt-sort-header${sortCol === col ? ' rt-sort' : ''}`}
      onClick={() => handleSort(col)}
      aria-sort={sortCol === col ? (sortAsc ? 'ascending' : 'descending') : undefined}
    >
      <span className="rt-th-in">
        {rotulo}
        {sortCol === col && <SortIcon size={12} />}
      </span>
    </th>
  );

  return (
    <div className="card hub-table-card">
      <div className="hub-table-head">
        <h2 className="hub-table-title">{title}</h2>
        {subtitle && <div className="hub-table-sub">{subtitle}</div>}
      </div>
      {!rows?.length ? (
        <p className="hub-loading-hint">Sem dados ainda.</p>
      ) : (
        <div className="hub-table-scroll">
          <table className="rt">
            <thead>
              <tr>
                <th className="rt-num">#</th>
                <th className="rt-item">Item</th>
                {cabecalho('value', valueLabel, 'rt-lucro')}
                {cabecalho('pct', 'Margem', 'rt-pct')}
                {cabecalho('vol', 'Vendas/dia', 'rt-vol')}
                <th className="rt-atual">Preço</th>
                <th className="rt-pico">Hora de pico</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((r, i) => {
                const val = getValue(r);
                const pct = getPercent(r);
                const valOk = val != null && val > -8e8;
                const pctOk = pct != null;
                const suspeito = r.estimado || (pctOk && pct > MARGEM_SUSPEITA);
                return (
                  <tr key={`${r.resource}-${r.item}-${i}`} className={suspeito ? 'rt-suspeito' : ''}>
                    <td className="rt-num">{i + 1}</td>
                    <td className="rt-item">
                      <ItemCell resource={r.resource} item={r.item} imgId={buildId(r.resource, r.item)} />
                    </td>
                    <td className={`rt-lucro mono ${valOk ? (val >= 0 ? 'pos' : 'neg') : ''}`}>
                      {valueFormat(val)}
                    </td>
                    <td className={`rt-pct mono ${pctOk ? (pct >= 0 ? 'pos' : 'neg') : ''}`}>
                      {fmtPct(pct)}
                    </td>
                    <td className="rt-vol mono">
                      {r.volume != null ? r.volume.toLocaleString('pt-BR') : '—'}
                    </td>
                    <td className="rt-atual"><SituacaoPreco row={r} pct={pct} /></td>
                    <td className="rt-pico mono">{formatPeak(r.peakHoursLocal)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── RefinementHub ─────────────────────────────────────────────────────────
export default function RefinementHub() {
  const [buyOrder, setBuyOrder] = useState(false);
  const [dailyBonus, setDailyBonus] = useState(0);
  const [resourceData, setResourceData] = useState({});
  const [loadingSet, setLoadingSet] = useState(new Set());
  const [errors, setErrors] = useState({});
  const fetchIdRef = useRef(0);

  const data = useMemo(() => mergeTopLists(resourceData), [resourceData]);
  const isLoading = loadingSet.size > 0;
  const loadedCount = ALL_RESOURCES.filter(r => resourceData[r]).length;

  function fetchData({ buyOrder: bo, dailyBonus: db }) {
    const fetchId = ++fetchIdRef.current;
    const specs = loadAllSpecs();

    setResourceData({});
    setLoadingSet(new Set(ALL_RESOURCES));
    setErrors({});

    for (const resource of ALL_RESOURCES) {
      STRATEGY_FNS[resource]({
        taxaNpc: '800',
        taxaVenda: '6.5',
        spec: specs[resource] ?? {},
        buyOrder: bo,
        dailyBonus: db,
        foco: false,
      })
        .then(result => {
          if (fetchIdRef.current !== fetchId) return;
          setResourceData(prev => ({ ...prev, [resource]: result }));
          setLoadingSet(prev => { const s = new Set(prev); s.delete(resource); return s; });
        })
        .catch(err => {
          if (fetchIdRef.current !== fetchId) return;
          setErrors(prev => ({ ...prev, [resource]: err.message || String(err) }));
          setLoadingSet(prev => { const s = new Set(prev); s.delete(resource); return s; });
        });
    }
  }

  useEffect(() => {
    fetchData({ buyOrder: false, dailyBonus: 0 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleRefresh() {
    fetchData({ buyOrder, dailyBonus });
  }

  const errorList = Object.entries(errors);

  const carregando = isLoading ? `Carregando ${loadedCount}/4 recursos…` : null;

  return (
    <div className="page-inner">

      {/* Controls card */}
      <div className="card hub-controls">
        <div className="hub-checks">
          <label className={`cb ${buyOrder ? 'cb-on' : ''}`}>
            <span className="cb-box">{buyOrder && <ICONS.check size={12} />}</span>
            <input type="checkbox" checked={buyOrder} onChange={(e) => setBuyOrder(e.target.checked)} />
            <span className="cb-label">Comprar via buy order</span>
          </label>
          <label className={`cb ${dailyBonus === 10 ? 'cb-on' : ''}`}>
            <span className="cb-box">{dailyBonus === 10 && <ICONS.check size={12} />}</span>
            <input type="checkbox" checked={dailyBonus === 10} onChange={() => setDailyBonus(dailyBonus === 10 ? 0 : 10)} />
            <span className="cb-label">Bônus diário 10%</span>
          </label>
          <label className={`cb ${dailyBonus === 20 ? 'cb-on' : ''}`}>
            <span className="cb-box">{dailyBonus === 20 && <ICONS.check size={12} />}</span>
            <input type="checkbox" checked={dailyBonus === 20} onChange={() => setDailyBonus(dailyBonus === 20 ? 0 : 20)} />
            <span className="cb-label">Bônus diário 20%</span>
          </label>
        </div>
        <button
          type="button"
          className="btn-primary"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          <span className={`btn-icon ${isLoading ? 'spin' : ''}`}>
            <ICONS.refresh size={15} />
          </span>
          <span>{isLoading ? `${loadedCount}/4` : 'Atualizar'}</span>
        </button>
      </div>

      {/* Errors */}
      {errorList.length > 0 && (
        <div>
          {errorList.map(([resource, msg]) => (
            <p key={resource} className="error" style={{ margin: '0.25rem 0' }}>
              {RESOURCE_INFO[resource].label}: {msg}
            </p>
          ))}
        </div>
      )}

      {/* Initial loading hint */}
      {loadedCount === 0 && isLoading && (
        <p className="hub-loading-hint">Buscando dados de todos os recursos…</p>
      )}

      {/* As duas tabelas lado a lado quando a tela permite */}
      {loadedCount > 0 && (
        <div className="hub-tables-grid">
          <HubTable
            title="Melhor lucro sem foco"
            subtitle={carregando}
            rows={data.topSemFoco}
            getValue={(r) => r.lucro}
            getPercent={(r) => (r.custoLocal > 0 && r.lucro > -8e8) ? (r.lucro / r.custoLocal) * 100 : null}
            valueLabel="Lucro"
            valueFormat={fmtProfit}
          />
          <HubTable
            title="Melhor uso do foco"
            subtitle={carregando}
            rows={data.topComFoco}
            getValue={(r) => r.focoUnidades > 0 ? r.lucroComFoco / r.focoUnidades : -9e8}
            getPercent={(r) => (r.custoComFoco > 0 && r.lucroComFoco > -8e8) ? (r.lucroComFoco / r.custoComFoco) * 100 : null}
            valueLabel="Prata por foco"
            valueFormat={fmtFoco}
          />
        </div>
      )}

      {loadedCount === 0 && !isLoading && errorList.length === 0 && (
        <p className="hub-loading-hint">Carregando…</p>
      )}

    </div>
  );
}
