import { useState, useMemo, Fragment } from 'react';
import { potionAnalyze } from '../api.js';
import { ICONS } from './Icons.jsx';

// ─── Helpers ──────────────────────────────────────────────────────────────

const CITY_SHORT = {
  Bridgewatch: 'BW', 'Fort Sterling': 'FS', Lymhurst: 'LH',
  Martlock: 'MT', Thetford: 'TF', Brecilien: 'BR', Caerleon: 'CL',
};

const ING_NAMES = {
  T2_AGARIC: 'Agárico Arcano',
  T3_COMFREY: 'Confrei',
  T4_BURDOCK: 'Bardana',
  T5_TEASEL: 'Cardona',
  T6_FOXGLOVE: 'Dedaleira',
  T7_MULLEIN: 'Verbasco',
  T8_YARROW: 'Milfolhas',
  T3_EGG: 'Ovo (T3)',
  T5_EGG: 'Ovo (T5)',
  T4_MILK: 'Leite (T4)',
  T6_MILK: 'Leite (T6)',
  T8_MILK: 'Leite (T8)',
  T6_ALCOHOL: 'Álcool (T6)',
  T7_ALCOHOL: 'Álcool (T7)',
  T8_ALCOHOL: 'Álcool (T8)',
  T4_BUTTER: 'Manteiga (T4)',
  T6_BUTTER: 'Manteiga (T6)',
  T8_BUTTER: 'Manteiga (T8)',
  T3_ALCHEMY_RARE_WEREWOLF: 'Presa de Lobisomem',
  T5_ALCHEMY_RARE_WEREWOLF: 'Presa de Lobisomem',
  T7_ALCHEMY_RARE_WEREWOLF: 'Presa de Lobisomem',
  T3_ALCHEMY_RARE_ELEMENTAL: 'Resto Elemental',
  T5_ALCHEMY_RARE_ELEMENTAL: 'Resto Elemental',
  T7_ALCHEMY_RARE_ELEMENTAL: 'Resto Elemental',
};

function fmt(n) {
  if (!Number.isFinite(n)) return '—';
  return Math.round(n).toLocaleString('pt-BR');
}

function fmtPct(n) {
  if (!Number.isFinite(n)) return '—';
  return (n >= 0 ? '+' : '') + n.toFixed(1).replace('.', ',') + '%';
}

function timeAgo(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr.replace(' ', 'T') + (dateStr.includes('Z') ? '' : 'Z'));
  if (isNaN(d.getTime())) return '?';
  const hrs = (Date.now() - d.getTime()) / 3_600_000;
  if (hrs < 1) return `${Math.round(hrs * 60)}m atrás`;
  if (hrs < 24) return `${Math.round(hrs)}h atrás`;
  return `${Math.floor(hrs / 24)}d atrás`;
}

// ─── Small components ──────────────────────────────────────────────────────

function Checkbox({ label, checked, onChange }) {
  return (
    <label className={`cb${checked ? ' cb-on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} />
      <span className="cb-box">
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <span className="cb-label">{label}</span>
    </label>
  );
}

function TierBadge({ tier }) {
  return <span className="tbadge">{tier}</span>;
}

function CityBadge({ name }) {
  const short = CITY_SHORT[name] || name.slice(0, 2).toUpperCase();
  const isBR = name === 'Brecilien';
  return (
    <span className={`poc-city${isBR ? ' poc-city-br' : ''}`}>
      {short}
      {isBR && <em className="poc-city-star">⭐</em>}
    </span>
  );
}

function ItemImg({ id, size = 56 }) {
  return (
    <div className="bm-icon" style={{ width: size, height: size, flexShrink: 0 }}>
      <img
        src={`https://render.albiononline.com/v1/item/${id}.png?quality=1`}
        alt={id}
        width={size - 4}
        height={size - 4}
        style={{ display: 'block', borderRadius: 2 }}
        onError={e => { e.target.onerror = null; e.target.style.opacity = '0'; }}
      />
    </div>
  );
}

// ─── Expandable ingredient detail row ─────────────────────────────────────

function IngDetail({ ingredientes, showCity, colSpan }) {
  return (
    <tr className="poc-detail-row">
      <td colSpan={colSpan}>
        <div className="poc-detail-inner">
          <div className="poc-detail-title">
            {showCity ? 'Onde comprar cada ingrediente' : 'Ingredientes da receita'}
          </div>
          <div className="poc-detail-list">
            {ingredientes.map(ing => (
              <div key={ing.id} className="poc-detail-item">
                <ItemImg id={ing.id} size={56} />
                <span className="poc-detail-name">
                  {ING_NAMES[ing.id] || ing.id.replace(/^T\d_/, '')}
                </span>
                <span className="poc-detail-qty mono">×{ing.qty}</span>
                {showCity && ing.city && (
                  <span className="poc-detail-city">
                    <ICONS.building size={13} />
                    {ing.city}
                  </span>
                )}
                {ing.price > 0 && (
                  <span className="poc-detail-price mono">
                    {fmt(ing.price)}
                    <span className="poc-detail-price-u">/un.</span>
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}

// ─── Mesma Cidade table ────────────────────────────────────────────────────

function SameCityTable({ rows }) {
  const [openId, setOpenId] = useState(null);
  const COLS = 10;
  return (
    <div className="card bm-table-card">
      <div className="bm-scroll">
        <table className="bm-table poc-table">
          <thead>
            <tr>
              <th>Poção</th>
              <th>Tier</th>
              <th>Cidade</th>
              <th className="poc-r">Custo ingred.</th>
              <th className="poc-r">Receita</th>
              <th className="poc-r bm-sort">
                Lucro/batch <ICONS.arrowDown size={10} />
              </th>
              <th className="poc-r">Lucro/unid.</th>
              <th className="poc-r">%</th>
              <th className="poc-r">Vol./dia</th>
              <th>Atualizado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const neg  = r.profit < 0;
              const lCls = neg ? 'neg' : 'pos';
              const rowId = r.output + r.city;
              const open  = openId === rowId;
              const canExpand = r.ingredientes?.length > 0;
              return (
                <Fragment key={rowId}>
                  <tr
                    className={[
                      canExpand && 'poc-row-clickable',
                      open      && 'poc-row-open',
                      neg       && 'poc-row-neg',
                    ].filter(Boolean).join(' ')}
                    onClick={() => canExpand && setOpenId(open ? null : rowId)}
                  >
                    <td className="poc-cell-item">
                      <div className="poc-item-inner">
                        {canExpand && (
                          <span className="poc-expand-chev">
                            <ICONS.chevronRight size={14} />
                          </span>
                        )}
                        <ItemImg id={r.output} size={60} />
                        <span className="poc-item-name">{r.potionName}</span>
                      </div>
                    </td>
                    <td><TierBadge tier={r.tier} /></td>
                    <td><CityBadge name={r.city} /></td>
                    <td className="poc-cost mono">{fmt(r.ingTotal)}</td>
                    <td className="poc-receita mono">{fmt(r.revenue)}</td>
                    <td className={`poc-lucro mono ${lCls}`}>
                      {(r.profit >= 0 ? '+' : '') + fmt(r.profit)}
                    </td>
                    <td className={`poc-unid mono ${lCls}`}>
                      {(r.profitPerUnit >= 0 ? '+' : '') + fmt(r.profitPerUnit)}
                    </td>
                    <td className={`poc-pct mono ${lCls}`}>{fmtPct(r.margin)}</td>
                    <td className="poc-vol mono">{r.volumeDiario ?? '—'}</td>
                    <td className="poc-atual">{timeAgo(r.dataPreco)}</td>
                  </tr>
                  {open && canExpand && (
                    <IngDetail ingredientes={r.ingredientes} showCity={false} colSpan={COLS} />
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Via Brecilien table ───────────────────────────────────────────────────

function BrecilienTable({ rows }) {
  const [openId, setOpenId] = useState(null);
  const COLS = 10;
  return (
    <div className="card bm-table-card">
      <div className="bm-scroll">
        <table className="bm-table poc-table">
          <thead>
            <tr>
              <th>Poção</th>
              <th>Tier</th>
              <th>Vender em</th>
              <th className="poc-r">Custo ingred.</th>
              <th className="poc-r">Teleporte</th>
              <th className="poc-r bm-sort">
                Lucro/batch <ICONS.arrowDown size={10} />
              </th>
              <th className="poc-r">Lucro/unid.</th>
              <th className="poc-r">%</th>
              <th className="poc-r">Vol./dia</th>
              <th>Atualizado</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const neg   = r.profit < 0;
              const lCls  = neg ? 'neg' : 'pos';
              const rowId = r.output + r.sellCity;
              const open  = openId === rowId;
              const canExpand = r.ingredientes?.length > 0;
              return (
                <Fragment key={rowId}>
                  <tr
                    className={[
                      canExpand && 'poc-row-clickable',
                      open      && 'poc-row-open',
                      neg       && 'poc-row-neg',
                    ].filter(Boolean).join(' ')}
                    onClick={() => canExpand && setOpenId(open ? null : rowId)}
                  >
                    <td className="poc-cell-item">
                      <div className="poc-item-inner">
                        {canExpand && (
                          <span className="poc-expand-chev">
                            <ICONS.chevronRight size={14} />
                          </span>
                        )}
                        <ItemImg id={r.output} size={60} />
                        <span className="poc-item-name">{r.potionName}</span>
                      </div>
                    </td>
                    <td><TierBadge tier={r.tier} /></td>
                    <td><CityBadge name={r.sellCity} /></td>
                    <td className="poc-cost mono">{fmt(r.ingTotal)}</td>
                    <td className="poc-r mono" style={{
                      color: r.totalTeleport > 0 ? 'var(--accent)' : 'var(--text-tertiary)',
                    }}>
                      {r.totalTeleport > 0 ? `-${fmt(r.totalTeleport)}` : '—'}
                    </td>
                    <td className={`poc-lucro mono ${lCls}`}>
                      {(r.profit >= 0 ? '+' : '') + fmt(r.profit)}
                    </td>
                    <td className={`poc-unid mono ${lCls}`}>
                      {(r.profitPerUnit >= 0 ? '+' : '') + fmt(r.profitPerUnit)}
                    </td>
                    <td className={`poc-pct mono ${lCls}`}>{fmtPct(r.margin)}</td>
                    <td className="poc-vol mono">{r.volumeDiario ?? '—'}</td>
                    <td className="poc-atual">{timeAgo(r.dataPreco)}</td>
                  </tr>
                  {open && canExpand && (
                    <IngDetail ingredientes={r.ingredientes} showCity={true} colSpan={COLS} />
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function PotionAnalyzer() {
  const [foco,         setFoco]         = useState(false);
  const [dailyBonus,   setDailyBonus]   = useState(0);
  const [taxaVenda,    setTaxaVenda]    = useState(6.5);
  const [loading,      setLoading]      = useState(false);
  const [err,          setErr]          = useState(null);
  const [data,         setData]         = useState(null);
  const [view,         setView]         = useState('samecidade');
  const [soLucrativo,  setSoLucrativo]  = useState(true);
  const [filtroCidade, setFiltroCidade] = useState('Todas');
  const [filtroPotion, setFiltroPotion] = useState('Todas');

  const handleAnalyze = async () => {
    setLoading(true);
    setErr(null);
    setData(null);
    try {
      const result = await potionAnalyze({ foco, dailyBonus, taxaVenda });
      setData(result);
    } catch (e) {
      setErr(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  const cities = useMemo(
    () => data ? [...new Set(data.sameCidade.map(r => r.city))].sort() : [],
    [data],
  );
  const potionNames = useMemo(
    () => data ? [...new Set(data.sameCidade.map(r => r.potionName))].sort() : [],
    [data],
  );

  const filteredSame = useMemo(() => {
    if (!data) return [];
    return data.sameCidade.filter(r => {
      if (soLucrativo && r.profit <= 0) return false;
      if (filtroCidade !== 'Todas' && r.city !== filtroCidade) return false;
      if (filtroPotion !== 'Todas' && r.potionName !== filtroPotion) return false;
      return true;
    });
  }, [data, soLucrativo, filtroCidade, filtroPotion]);

  const filteredBrec = useMemo(() => {
    if (!data) return [];
    return data.brecilien.filter(r => {
      if (soLucrativo && r.profit <= 0) return false;
      if (filtroPotion !== 'Todas' && r.potionName !== filtroPotion) return false;
      return true;
    });
  }, [data, soLucrativo, filtroPotion]);

  const lucSame = data ? data.sameCidade.filter(r => r.profit > 0).length : 0;
  const lucBrec = data ? data.brecilien.filter(r => r.profit > 0).length : 0;

  const filtered  = view === 'samecidade' ? filteredSame : filteredBrec;
  const ruleText  = view === 'samecidade'
    ? 'compra ingredientes e vende poções na mesma cidade.'
    : 'craft em Brecilien (bônus 15%) e venda na melhor cidade.';

  return (
    <div className="page-inner page-inner-wide">

      {/* ── Filter bar ── */}
      <div className="bm-filters">
        <span className="poc-label">Poções</span>
        <div className="cfgbar-sep" />

        <Checkbox label="Foco" checked={foco} onChange={setFoco} />

        <label className="bm-field">
          <span className="bm-field-lbl">Bônus Diário</span>
          <select
            className="bm-select"
            style={{ width: 90 }}
            value={dailyBonus}
            onChange={e => setDailyBonus(Number(e.target.value))}
          >
            <option value={0}>0%</option>
            <option value={10}>10%</option>
            <option value={20}>20%</option>
          </select>
        </label>

        <label className="bm-field">
          <span className="bm-field-lbl">Taxa Venda</span>
          <span className="poc-num-wrap">
            <input
              type="number"
              step="0.5"
              min="0"
              value={taxaVenda}
              onChange={e => setTaxaVenda(parseFloat(e.target.value) || 0)}
            />
            <span className="poc-num-suffix">%</span>
          </span>
        </label>

        <div className="bm-spacer" />

        <button
          type="button"
          className="btn-primary"
          onClick={handleAnalyze}
          disabled={loading}
        >
          {loading && (
            <svg className="btn-icon spin" width="14" height="14" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 3a9 9 0 019 9" />
            </svg>
          )}
          {loading ? 'Buscando…' : 'Analisar'}
        </button>
      </div>

      {/* ── Error ── */}
      {err && (
        <div style={{
          background: 'rgba(224,92,92,0.1)', border: '1px solid rgba(224,92,92,0.3)',
          borderRadius: 8, padding: '0.75rem 1rem', marginBottom: '1rem',
          color: 'var(--negative)', fontSize: 13,
        }}>
          {err}
        </div>
      )}

      {/* ── Empty (no analysis yet) ── */}
      {!data && !loading && (
        <div className="bm-empty">
          <div className="bm-empty-icon"><ICONS.flask size={36} /></div>
          <div className="bm-empty-title">Carregue uma análise</div>
          <div className="bm-empty-body">
            Ajuste os filtros e clique em Analisar para ver as poções lucrativas.
          </div>
        </div>
      )}

      {data && (
        <>
          {/* ── Mode tabs ── */}
          <div className="poc-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={view === 'samecidade'}
              className={`poc-tab${view === 'samecidade' ? ' poc-tab-on' : ''}`}
              onClick={() => setView('samecidade')}
            >
              Mesma Cidade
              {lucSame > 0 && <span className="poc-tab-badge mono">{lucSame}</span>}
            </button>
            <button
              role="tab"
              aria-selected={view === 'brecilien'}
              className={`poc-tab${view === 'brecilien' ? ' poc-tab-on' : ''}`}
              onClick={() => setView('brecilien')}
            >
              <span className="poc-tab-star"><ICONS.star size={13} /></span>
              Via Brecilien
              {lucBrec > 0 && <span className="poc-tab-badge mono">{lucBrec}</span>}
            </button>
          </div>

          {/* ── Secondary filters ── */}
          <div className="poc-subfilters">
            <div className="poc-count">
              <span className="poc-count-n mono">{filtered.length}</span>
              resultado(s) — {ruleText}
            </div>
            <div className="poc-subfilters-right">
              <select
                className="bm-select"
                value={filtroPotion}
                onChange={e => setFiltroPotion(e.target.value)}
              >
                <option value="Todas">Todas as poções</option>
                {potionNames.map(n => <option key={n} value={n}>{n}</option>)}
              </select>

              {view === 'samecidade' && (
                <select
                  className="bm-select"
                  value={filtroCidade}
                  onChange={e => setFiltroCidade(e.target.value)}
                >
                  <option value="Todas">Todas as cidades</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}

              <Checkbox label="Só lucrativo" checked={soLucrativo} onChange={setSoLucrativo} />
            </div>
          </div>

          {/* ── Results ── */}
          {filtered.length === 0 ? (
            <div className="bm-empty">
              <div className="bm-empty-icon"><ICONS.flask size={36} /></div>
              <div className="bm-empty-title">Nenhuma poção lucrativa encontrada</div>
              <div className="bm-empty-body">
                Ajuste os filtros, desative "Só lucrativo" ou revise a taxa de venda.
              </div>
            </div>
          ) : view === 'samecidade' ? (
            <SameCityTable rows={filteredSame} />
          ) : (
            <BrecilienTable rows={filteredBrec} />
          )}
        </>
      )}

    </div>
  );
}
