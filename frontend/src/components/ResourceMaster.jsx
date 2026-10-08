import { useCallback, useEffect, useMemo, useState } from 'react';
import { profitClass } from '../utils/profit.js';

const ITEM_ICON_URL = (id) => `https://render.albiononline.com/v1/item/${id}.png?quality=1`;

function avgPriceClass(current, avg) {
  if (!avg || !current) return 'tabular-nums';
  const dev = Math.abs(current - avg) / avg;
  if (dev <= 0.10) return 'tabular-nums avg-green';
  if (dev <= 0.25) return 'tabular-nums avg-yellow';
  if (dev <= 0.50) return 'tabular-nums avg-orange';
  return 'tabular-nums avg-red';
}

function parseTierItem(item) {
  const [tier, level] = String(item).split('.');
  return { tier: tier || 'T4', level: level || '0' };
}

function tAntOf(tier) {
  const tNum = parseInt(String(tier).slice(1), 10);
  return Number.isNaN(tNum) ? 'T4' : tNum > 4 ? `T${tNum - 1}` : 'T3';
}

function formatTimeAgo(isoDate) {
  if (!isoDate) return '—';
  try {
    const nowUTC = new Date();
    const nowUTC3 = new Date(nowUTC.getTime() - 3 * 60 * 60 * 1000);
    const then = new Date(isoDate);
    if (Number.isNaN(then.getTime())) return '—';
    const diffSec = Math.floor((nowUTC3 - then) / 1000);
    if (diffSec < 0) return '—';
    if (diffSec < 60) return `${diffSec}s`;
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}h`;
    return `${Math.floor(diffHour / 24)}d`;
  } catch {
    return '—';
  }
}

function stdBuildId(suffix) {
  return (tier, level) => (level === '0' ? `${tier}${suffix}` : `${tier}${suffix}_LEVEL${level}@${level}`);
}

function encBuildId(suffix) {
  return (tier, level) => (level === '0' ? `${tier}${suffix}` : `${tier}${suffix}_LEVEL${level}@${level}`);
}

const CONFIGS = {
  wood: {
    specLabels: ['T4', 'T5', 'T6', 'T7', 'T8'],
    refiningCity: 'Fort Sterling',
    storageKey: 'albion-wood-config-v1',
    cityKey: 'fortSterling',
    cityDisplay: 'Fort Sterling',
    cities: [
      { key: 'fortSterling', display: 'Fort Sterling' },
      { key: 'lymhurst', display: 'Lymhurst' },
    ],
    rawAlt: 'tronco',
    refinedAlt: 'tábua',
    rawPlaceholder: 'wood',
    refinedPlaceholder: 'plank',
    buildRawId: stdBuildId('_WOOD'),
    buildRefinedId: encBuildId('_PLANKS'),
  },
  fiber: {
    specLabels: ['T4', 'T5', 'T6', 'T7', 'T8'],
    refiningCity: 'Lymhurst',
    storageKey: 'albion-fiber-config-v1',
    cityKey: 'lymhurst',
    cityDisplay: 'Lymhurst',
    rawAlt: 'fibra',
    refinedAlt: 'tecido',
    rawPlaceholder: 'fiber',
    refinedPlaceholder: 'cloth',
    buildRawId: stdBuildId('_FIBER'),
    buildRefinedId: encBuildId('_CLOTH'),
  },
  leather: {
    specLabels: ['T4', 'T5', 'T6', 'T7', 'T8'],
    refiningCity: 'Martlock',
    storageKey: 'albion-leather-config-v1',
    cityKey: 'martlock',
    cityDisplay: 'Martlock',
    rawAlt: 'couro',
    refinedAlt: 'couro',
    rawPlaceholder: 'leather',
    refinedPlaceholder: 'leather',
    buildRawId: stdBuildId('_HIDE'),
    buildRefinedId: encBuildId('_LEATHER'),
  },
  metal: {
    specLabels: ['T4', 'T5', 'T6', 'T7', 'T8'],
    refiningCity: 'Thetford',
    storageKey: 'albion-metal-config-v1',
    cityKey: 'thetford',
    cityDisplay: 'Thetford',
    rawAlt: 'minério',
    refinedAlt: 'lingote',
    rawPlaceholder: 'metal',
    refinedPlaceholder: 'metal',
    buildRawId: stdBuildId('_ORE'),
    buildRefinedId: encBuildId('_METALBAR'),
  },
};

const SPEC_TIER_KEYS = ['t4', 't5', 't6', 't7', 't8'];

function loadConfig(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {
    spec: { t4: '0', t5: '0', t6: '0', t7: '0', t8: '0' },
    tier: 'T6',
    buyOrder: false,
    foco: false,
    dailyBonus: 0,
    taxaNpc: '800',
  };
}

// ─── Shared primitives ────────────────────────────────────────────────────

function ItemImg({ src, alt, size = 56 }) {
  return (
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      className="item-img"
      onError={(e) => { e.target.style.opacity = '0'; }}
    />
  );
}

function TierSelector({ tier, onChange }) {
  return (
    <div className="tier-seg" role="tablist">
      {['T4', 'T5', 'T6', 'T7', 'T8'].map((t) => (
        <button
          key={t}
          role="tab"
          aria-selected={t === tier}
          className={`tier-seg-opt${t === tier ? ' tier-seg-on' : ''}`}
          onClick={() => onChange(t)}
        >
          {t}
        </button>
      ))}
    </div>
  );
}

function Checkbox({ label, checked, onChange }) {
  return (
    <label className={`cb${checked ? ' cb-on' : ''}`}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="cb-box">
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
            <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </span>
      <span className="cb-label">{label}</span>
    </label>
  );
}

// ─── Collapsible panel ────────────────────────────────────────────────────

function Panel({ open, onToggle, label, summary, children }) {
  return (
    <div className={`pnl${open ? ' pnl-open' : ''}`}>
      <button className="pnl-head" onClick={onToggle} aria-expanded={open}>
        <span className="pnl-label">{label}</span>
        {summary && <span className="pnl-summary">{summary}</span>}
        <span className="pnl-chev">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M5 3l4 4-4 4" />
          </svg>
        </span>
      </button>
      {open && (
        <div className="pnl-body">
          <div className="pnl-body-inner">{children}</div>
        </div>
      )}
    </div>
  );
}

// ─── Especialização e Taxa panel ──────────────────────────────────────────

function SpecsPanel({ open, onToggle, cfg, setCfg, specKeys, onSave }) {
  const summary = `Taxa: ${cfg.taxaNpc ?? 800} · T6: ${cfg.spec.t6 ?? 0}%`;
  return (
    <Panel open={open} onToggle={onToggle} label="Especialização e Taxa" summary={summary}>
      <div className="specs-row">
        <label className="specs-field">
          <span className="specs-lbl">Taxa NPC (nutrição)</span>
          <div className="specs-input-wrap">
            <input
              type="number"
              min="0"
              value={cfg.taxaNpc ?? '800'}
              onChange={(e) => setCfg((c) => ({ ...c, taxaNpc: e.target.value }))}
            />
          </div>
        </label>
      </div>
      <div className="specs-row specs-row--stacked">
        <span className="specs-lbl">Especialização por tier</span>
        <div className="specs-tier-grid">
          {specKeys.map(({ key, label }) => (
            <label key={key} className="specs-tier-field">
              <span className="specs-tier-lbl">{label}</span>
              <input
                type="number"
                min="0"
                max="100"
                value={cfg.spec[key] ?? ''}
                onChange={(e) => setCfg((c) => ({ ...c, spec: { ...c.spec, [key]: e.target.value } }))}
              />
            </label>
          ))}
        </div>
      </div>
      <div className="specs-actions">
        <button className="btn-secondary" onClick={onSave}>Salvar e recalcular</button>
      </div>
    </Panel>
  );
}

// ─── Farm Fama panel ──────────────────────────────────────────────────────

function FarmFamaPanel({ open, onToggle, strategy, strategyLoading, cfg, rc }) {
  const [ffTier, setFfTier] = useState('T6');

  const rows = useMemo(() => {
    const allRows = strategy?.fsLocalFamaAll || strategy?.fsLocalFama || [];
    const tierRows = allRows.filter((r) => r.item.startsWith(ffTier));
    return [...tierRows].sort((a, b) => {
      const aVal = cfg.foco ? (a.famaPerPrataComFoco ?? 0) : (a.famaPerPrata ?? 0);
      const bVal = cfg.foco ? (b.famaPerPrataComFoco ?? 0) : (b.famaPerPrata ?? 0);
      return bVal - aVal;
    });
  }, [strategy, ffTier, cfg.foco]);

  const best = rows[0];
  const bestFpp = best ? (cfg.foco ? best.famaPerPrataComFoco : best.famaPerPrata) : null;
  const enc = best?.item?.split('.')[1] ?? '0';
  const summary = best
    ? `${ffTier} · .${enc} · ${bestFpp?.toFixed(4).replace('.', ',') ?? '—'} fama/prata`
    : ffTier;

  return (
    <Panel open={open} onToggle={onToggle} label="Farm Fama" summary={summary}>
      <div className="ff2-tier-wrap">
        <span className="ff2-tier-lbl">Tier</span>
        <TierSelector tier={ffTier} onChange={setFfTier} />
        <span className="ff2-hint">Todos os enchants do {ffTier}, ordenado por fama/prata.</span>
      </div>
      {strategyLoading ? (
        <p className="ff2-loading">Carregando…</p>
      ) : !rows.length ? (
        <p className="ff2-loading">Sem dados disponíveis</p>
      ) : (
        <table className="ff2-table">
          <thead>
            <tr>
              <th>Item</th>
              <th className="ff-right">Fama/Prata ↓</th>
              <th className="ff-right">Vol. 24h</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const { tier, level } = parseTierItem(r.item);
              const fpp = cfg.foco ? r.famaPerPrataComFoco : r.famaPerPrata;
              return (
                <tr key={r.item}>
                  <td>
                    <div className="ff2-item">
                      <div className="ff2-icon">
                        <ItemImg
                          src={ITEM_ICON_URL(rc.buildRefinedId(tier, level))}
                          alt={r.item}
                          size={56}
                        />
                      </div>
                      <span className="ff2-label mono">{r.item}</span>
                    </div>
                  </td>
                  <td className="ff-right mono ff2-fp">
                    {fpp != null ? fpp.toFixed(4).replace('.', ',') : '—'}
                  </td>
                  <td className="ff-right mono acc-muted">
                    {r.volume?.toLocaleString('pt-PT') ?? '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}

// ─── Accordion result row ─────────────────────────────────────────────────

function AccordionRow({ row, open, onToggle, rc }) {
  const { tier, level } = parseTierItem(row.nivel);
  const tierNum = parseInt(tier.slice(1), 10);
  const antLevel = tierNum === 4 ? '0' : level;
  const isEnc = level !== '0';

  const cities = rc.cities || [{ key: rc.cityKey, display: rc.cityDisplay }];
  const cityData = cities.map((c) => ({ ...c, cd: row[c.key] })).filter((c) => c.cd);

  const profits = cityData.map((c) => (Number.isFinite(c.cd.lucro) ? c.cd.lucro : -Infinity));
  const bestLucro = profits.length ? Math.max(...profits) : null;
  const bestVol = cityData.length ? Math.max(...cityData.map((c) => c.cd.volume24h ?? 0)) : null;

  const bestCity = cityData.reduce((b, c) =>
    !b || (c.cd.lucro ?? -Infinity) > (b.cd.lucro ?? -Infinity) ? c : b, null);
  const custo = bestCity?.cd.tabua;
  const margem = custo && bestLucro != null && bestLucro > -8e8 ? (bestLucro / custo) * 100 : null;

  const rawId = rc.buildRawId(tier, level);
  const antId = rc.buildRefinedId(tAntOf(tier), antLevel);
  const outId = rc.buildRefinedId(tier, level);

  return (
    <div className={`acc${open ? ' acc-open' : ''}`}>
      <button className="acc-head" onClick={onToggle} aria-expanded={open}>
        <span className="acc-tier mono">
          {tier}
          {isEnc && <span className={`enc-pill enc-${level}`}>.{level}</span>}
        </span>

        <div className="acc-ing-stack">
          <div className="acc-ing">
            <ItemImg src={ITEM_ICON_URL(rawId)} alt="raw" size={56} />
            <span className="ing-qty">×{row.qtTronco ?? 4}</span>
          </div>
          <div className="acc-ing acc-ing-dim">
            <ItemImg src={ITEM_ICON_URL(antId)} alt="ant" size={56} />
            <span className="ing-qty">×1</span>
          </div>
          <div className="acc-ing">
            <ItemImg src={ITEM_ICON_URL(outId)} alt="out" size={56} />
            <span className="ing-qty">×1</span>
          </div>
        </div>

        <div className="acc-stat">
          <span className="acc-stat-k">Lucro</span>
          <span className={`acc-stat-v mono ${bestLucro != null && bestLucro > -8e8 ? profitClass(bestLucro) : ''}`}>
            {bestLucro != null && bestLucro > -8e8
              ? bestLucro.toLocaleString('pt-PT', { maximumFractionDigits: 0 })
              : '—'}
          </span>
        </div>

        {margem != null && (
          <div className="acc-stat">
            <span className="acc-stat-k">Margem</span>
            <span className={`acc-stat-v mono ${profitClass(margem)}`}>{margem.toFixed(1)}%</span>
          </div>
        )}

        <div className="acc-stat">
          <span className="acc-stat-k">Vendas/dia</span>
          <span className="acc-stat-v mono acc-muted">
            {bestVol ? bestVol.toLocaleString('pt-PT') : '—'}
          </span>
        </div>

        {bestCity && cityData.length > 1 && (
          <div className="acc-stat acc-stat-cidade">
            <span className="acc-stat-k">Melhor cidade</span>
            <span className="acc-stat-v acc-muted">{bestCity.display}</span>
          </div>
        )}

        <span className="acc-chev">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M5 3l4 4-4 4" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="acc-body">
          <div className="acc-body-inner">
            <div className="acc-table-wrap">
              <table className="acc-table">
                <thead>
                  <tr>
                    <th>Cidade</th>
                    <th>
                      <div className="acc-th-imgs">
                        <div className="acc-th-img">
                          <ItemImg src={ITEM_ICON_URL(rawId)} alt="raw" size={56} />
                          <span>×{row.qtTronco ?? 4}</span>
                        </div>
                        <div className="acc-th-img">
                          <ItemImg src={ITEM_ICON_URL(antId)} alt="ant" size={56} />
                          <span>×1</span>
                        </div>
                        <div className="acc-th-img">
                          <ItemImg src={ITEM_ICON_URL(outId)} alt="out" size={56} />
                          <span>×1</span>
                        </div>
                      </div>
                    </th>
                    <th className="ff-right">Lucro</th>
                    <th className="ff-right">Vol. 24h</th>
                    <th className="ff-right">Preço Médio</th>
                  </tr>
                </thead>
                <tbody>
                  {cityData.map(({ key, display, cd }) => (
                    <tr key={key}>
                      <td className="acc-city-name">{display}</td>
                      <td>
                        <div className="acc-price-trio">
                          <span className="acc-price-cell">
                            <span className="mono">{cd.tronco?.toLocaleString('pt-PT') ?? '—'}</span>
                            <span className="acc-time">{formatTimeAgo(cd.troncoDate)}</span>
                          </span>
                          <span className="acc-price-cell">
                            <span className="mono">{cd.tabuaAnt?.toLocaleString('pt-PT') ?? '—'}</span>
                            <span className="acc-time">{formatTimeAgo(cd.tabuaAntDate)}</span>
                          </span>
                          <span className="acc-price-cell">
                            <span className="mono">{cd.tabua?.toLocaleString('pt-PT') ?? '—'}</span>
                            <span className="acc-time">{formatTimeAgo(cd.tauaDate)}</span>
                          </span>
                        </div>
                      </td>
                      <td className={`ff-right mono ${profitClass(cd.lucro)}`}>
                        {Number.isFinite(cd.lucro) && cd.lucro > -8e8
                          ? cd.lucro.toLocaleString('pt-PT', { maximumFractionDigits: 0 })
                          : '—'}
                      </td>
                      <td className="ff-right mono acc-muted">
                        {cd.volume24h?.toLocaleString('pt-PT') ?? '—'}
                      </td>
                      <td className={`ff-right ${avgPriceClass(cd.tabua, cd.avgPreco)}`}>
                        {cd.avgPreco?.toLocaleString('pt-PT', { maximumFractionDigits: 0 }) ?? '—'}
                      </td>
                    </tr>
                  ))}
                  {row.melhorPreco && (
                    <tr className="acc-best">
                      <td><span className="acc-best-tag">Melhor preço</span></td>
                      <td>
                        <div className="acc-price-trio">
                          {[row.melhorPreco.tronco, row.melhorPreco.tabuaAnt, row.melhorPreco.produto].map((mp, i) =>
                            mp ? (
                              <span key={i} className="acc-best-price">
                                <span className="mono">{mp.preco.toLocaleString('pt-PT')}</span>
                                <span className="acc-time">{mp.cidade} · {formatTimeAgo(mp.data)}</span>
                              </span>
                            ) : <span key={i} className="mono">—</span>
                          )}
                        </div>
                      </td>
                      <td className={`ff-right mono ${profitClass(row.melhorPreco.lucro)}`}>
                        {Number.isFinite(row.melhorPreco.lucro) && row.melhorPreco.lucro > -8e8
                          ? row.melhorPreco.lucro.toLocaleString('pt-PT', { maximumFractionDigits: 0 })
                          : '—'}
                      </td>
                      <td className="ff-right mono acc-muted">
                        {row.melhorPreco.volumeProduto?.toLocaleString('pt-PT') ?? '—'}
                      </td>
                      <td className={`ff-right ${avgPriceClass(row.melhorPreco.produto?.preco, row.melhorPreco.avgPreco)}`}>
                        {row.melhorPreco.avgPreco?.toLocaleString('pt-PT', { maximumFractionDigits: 0 }) ?? '—'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="acc-footer">
              <span className="acc-callout">
                Otimizado{' '}
                {(rc.cities || [{ display: rc.cityDisplay }])
                  .map((c) => c.display.split(' ').map((w) => w[0]).join(''))
                  .join('-')}
                <span className="acc-callout-v mono">
                  {' '}{Number.isFinite(row.otimizado) && row.otimizado > -8e8
                    ? `${row.otimizado.toLocaleString('pt-PT', { maximumFractionDigits: 0 })} prata`
                    : '—'}
                </span>
              </span>
              {row.foco && (
                <span className="acc-foco-line">
                  Foco: <span className="mono">{row.foco.unidades?.toFixed(1)}</span> un ·{' '}
                  <span className={`mono ${profitClass(row.foco.prataPorFoco)}`}>
                    {row.foco.prataPorFoco?.toFixed(2)} prata/foco
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Indicações aside ─────────────────────────────────────────────────────

function IndicacoesPanel({ strategy, strategyLoading, lucroMode, setLucroMode, cfg, rc }) {
  // Lucro absoluto (em prata) — já reflete "Usar foco" porque cfg.foco é
  // enviado ao backend e muda a taxa de retorno usada no custo.
  function getLucroAbs(r) {
    if (lucroMode === 'opt') return r.lucroOpt ?? r.lucro;
    if (lucroMode === 'ot') return r.lucroOT ?? r.lucro;
    return r.lucro;
  }
  // Com foco ativo, o indicador principal vira lucro por ponto de foco
  // necessário para refinar uma unidade (prata/foco), não o lucro absoluto.
  function getLucro(r) {
    const abs = getLucroAbs(r);
    if (cfg.foco) {
      return r.focoUnidades > 0 && abs > -8e8 ? abs / r.focoUnidades : -9e8;
    }
    return abs;
  }
  function getVol(r) {
    if (lucroMode === 'opt') return r.volumeOpt ?? r.volume;
    if (lucroMode === 'ot') return r.volumeOT ?? r.volume;
    return r.volume;
  }
  function getCusto(r) {
    if (lucroMode === 'opt') return r.custoOpt ?? r.custoLocal;
    if (lucroMode === 'ot') return r.custoOT ?? r.custoLocal;
    return r.custoLocal;
  }
  function getPeak(r) {
    if (lucroMode === 'opt') return r.peakHoursOpt ?? r.peakHoursLocal;
    if (lucroMode === 'ot') return r.peakHoursOT ?? r.peakHoursLocal;
    return r.peakHoursLocal;
  }

  const rows = useMemo(() => {
    const all = strategy?.fsLocalFoco || [];
    return [...all]
      .sort((a, b) => (getLucro(b) ?? -Infinity) - (getLucro(a) ?? -Infinity))
      .slice(0, 8);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strategy, lucroMode]);

  const cityAbbr = rc.cityDisplay.split(' ').map((w) => w[0]).join('');
  const modeLabel =
    lucroMode === 'opt'
      ? `Top Lucro ${rc.cities?.map((c) => c.display.split(' ').map((w) => w[0]).join('')).join('-') ?? ''}`
      : lucroMode === 'ot'
        ? 'Top Lucro OT'
        : `Top Lucro · ${cityAbbr}`;

  return (
    <aside className="ind">
      <div className="ind-head">
        <h3 className="ind-title">Indicações</h3>
        <div className="ind-sub">Top 8 com volume · todas as tiers</div>
      </div>
      <select className="ind-select" value={lucroMode} onChange={(e) => setLucroMode(e.target.value)}>
        <option value="local">Lucro {cityAbbr}</option>
        {rc.cities && rc.cities.length > 1 && (
          <option value="opt">
            Lucro {rc.cities.map((c) => c.display.split(' ').map((w) => w[0]).join('')).join('-')}
          </option>
        )}
        <option value="ot">Lucro OT</option>
      </select>
      <div className="ind-mode-bar">{modeLabel}</div>

      {strategyLoading && <p className="ind-loading">Carregando…</p>}
      {strategy?.error && <p className="error" style={{ margin: '8px 16px' }}>{strategy.error}</p>}

      {!strategyLoading && rows.length > 0 && (
        <ul className="ind-list">
          {rows.map((r) => {
            const lucro = getLucro(r);
            const lucroAbs = getLucroAbs(r);
            const vol = getVol(r);
            const custo = getCusto(r);
            const peak = getPeak(r);
            const margem =
              custo && custo > 0 && lucroAbs != null && lucroAbs > -8e8
                ? (lucroAbs / custo) * 100
                : null;
            const { tier, level } = parseTierItem(r.item);

            return (
              <li key={r.item} className="ind-item">
                <div className="ind-item-icon">
                  <ItemImg
                    src={ITEM_ICON_URL(rc.buildRefinedId(tier, level))}
                    alt={r.item}
                    size={64}
                  />
                </div>
                <div className="ind-item-mid">
                  <div className="ind-item-l1">
                    <span className="ind-item-name mono">{r.item}</span>
                    <span className={`mono ind-item-val ${lucro != null ? profitClass(lucro) : ''}`}>
                      {lucro != null && lucro > -8e8
                        ? cfg.foco
                          ? lucro.toFixed(2)
                          : Math.round(lucro).toLocaleString('pt-PT')
                        : '—'}
                    </span>
                    {cfg.foco && lucro != null && lucro > -8e8 && (
                      <span className="mono acc-muted ind-item-unit">/foco</span>
                    )}
                  </div>
                  <div className="ind-item-l2">
                    {margem != null && (
                      <span className={`mono ${profitClass(margem)}`}>{margem.toFixed(1)}%</span>
                    )}
                    <span className="ind-item-vol mono acc-muted">
                      {vol?.toLocaleString('pt-PT') ?? '—'}
                    </span>
                    {peak != null && (
                      <span className="ind-item-pico">
                        {String(peak.start).padStart(2, '0')}h–{String(peak.end).padStart(2, '0')}h
                      </span>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}

// ─── Main component ───────────────────────────────────────────────────────

export default function ResourceMaster({ resource, calculateFn, strategyFn }) {
  const rc = CONFIGS[resource];
  const specKeys = SPEC_TIER_KEYS.map((k, i) => ({ key: k, label: rc.specLabels[i] }));

  const [cfg, setCfg] = useState(() => loadConfig(rc.storageKey));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [specsOpen, setSpecsOpen] = useState(false);
  const [famaOpen, setFamaOpen] = useState(false);
  const [strategy, setStrategy] = useState(null);
  const [strategyLoading, setStrategyLoading] = useState(false);
  const [lucroMode, setLucroMode] = useState('local');
  const [openNivel, setOpenNivel] = useState(null);

  useEffect(() => {
    localStorage.setItem(rc.storageKey, JSON.stringify(cfg));
  }, [cfg, rc.storageKey]);

  const runCalculate = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await calculateFn({
        tier: cfg.tier,
        taxaNpc: cfg.taxaNpc ?? '800',
        taxaVenda: '6.5',
        spec: cfg.spec,
        buyOrder: cfg.buyOrder,
        foco: cfg.foco,
        dailyBonus: cfg.dailyBonus ?? 0,
      });
      setResult(data);
    } catch (e) {
      setErr(e.message || String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [cfg, calculateFn]);

  const runStrategy = useCallback(async () => {
    setStrategyLoading(true);
    try {
      const data = await strategyFn({
        taxaNpc: cfg.taxaNpc ?? '800',
        taxaVenda: '6.5',
        spec: cfg.spec,
        buyOrder: cfg.buyOrder,
        foco: cfg.foco,
        dailyBonus: cfg.dailyBonus ?? 0,
      });
      setStrategy(data);
    } catch (e) {
      setStrategy({ error: e.message || String(e) });
    } finally {
      setStrategyLoading(false);
    }
  }, [cfg, strategyFn]);

  const refreshAll = useCallback(async () => {
    await Promise.all([runCalculate(), runStrategy()]);
  }, [runCalculate, runStrategy]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErr(null);
    calculateFn({
      tier: cfg.tier, taxaNpc: '800', taxaVenda: '6.5',
      spec: cfg.spec, buyOrder: cfg.buyOrder, foco: cfg.foco,
      dailyBonus: cfg.dailyBonus ?? 0,
    })
      .then((data) => { if (!cancelled) setResult(data); })
      .catch((e) => { if (!cancelled) { setErr(e.message || String(e)); setResult(null); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.tier, cfg.buyOrder, cfg.foco, cfg.dailyBonus]);

  useEffect(() => {
    let cancelled = false;
    setStrategyLoading(true);
    strategyFn({
      taxaNpc: '800', taxaVenda: '6.5',
      spec: cfg.spec, buyOrder: cfg.buyOrder, foco: cfg.foco,
      dailyBonus: cfg.dailyBonus ?? 0,
    })
      .then((data) => { if (!cancelled) setStrategy(data); })
      .catch((e) => { if (!cancelled) setStrategy({ error: e.message || String(e) }); })
      .finally(() => { if (!cancelled) setStrategyLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg.buyOrder, cfg.foco, cfg.dailyBonus]);

  return (
    <div className="ref-layout">
      <div className="ref-main">

        {/* ── Config bar ── */}
        <div className="cfgbar">
          <span className="cfgbar-city">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
              <path d="M6.5 1v11M6.5 1L3 4.5h7L6.5 1z" />
            </svg>
            {rc.cityDisplay}
          </span>
          <div className="cfgbar-sep" />
          <TierSelector tier={cfg.tier} onChange={(t) => setCfg((c) => ({ ...c, tier: t }))} />
          <div className="cfgbar-sep" />
          <div className="cfgbar-checks">
            <Checkbox
              label="Buy order"
              checked={cfg.buyOrder}
              onChange={(v) => setCfg((c) => ({ ...c, buyOrder: v }))}
            />
            <Checkbox
              label="Usar foco"
              checked={cfg.foco}
              onChange={(v) => setCfg((c) => ({ ...c, foco: v }))}
            />
            <Checkbox
              label="Bônus 10%"
              checked={cfg.dailyBonus === 10}
              onChange={(v) => setCfg((c) => ({ ...c, dailyBonus: v ? 10 : 0 }))}
            />
            <Checkbox
              label="Bônus 20%"
              checked={cfg.dailyBonus === 20}
              onChange={(v) => setCfg((c) => ({ ...c, dailyBonus: v ? 20 : 0 }))}
            />
          </div>
          <div className="cfgbar-spacer" />
          <button
            className="btn-primary"
            onClick={refreshAll}
            disabled={loading || strategyLoading}
          >
            {loading || strategyLoading ? 'Carregando…' : 'Atualizar preços'}
          </button>
        </div>

        {/* ── Collapsible panels ── */}
        <div className="ref-panels">
          <SpecsPanel
            open={specsOpen}
            onToggle={() => setSpecsOpen((x) => !x)}
            cfg={cfg}
            setCfg={setCfg}
            specKeys={specKeys}
            onSave={() => { setSpecsOpen(false); refreshAll(); }}
          />
          <FarmFamaPanel
            open={famaOpen}
            onToggle={() => setFamaOpen((x) => !x)}
            strategy={strategy}
            strategyLoading={strategyLoading}
            cfg={cfg}
            rc={rc}
          />
        </div>

        {/* ── Results ── */}
        <div className="card results-card">
          <div className="results-head">
            <h2 className="results-title">Resultados</h2>
            {result && (
              <div className="results-status">
                {result.strategy && (
                  <span className="status-chip">
                    {result.strategy} · <span className="mono">{result.rrrPercent?.toFixed(1)}%</span>
                  </span>
                )}
              </div>
            )}
          </div>

          {loading && <p className="page-loading">Carregando…</p>}
          {err && <p className="error" style={{ margin: '12px 16px' }}>{err}</p>}

          {result && !loading && (
            <div className="results-list">
              {result.rows?.map((row) => (
                <AccordionRow
                  key={row.nivel}
                  row={row}
                  open={openNivel === row.nivel}
                  onToggle={() => setOpenNivel((n) => n === row.nivel ? null : row.nivel)}
                  rc={rc}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Indicações aside ── */}
      <IndicacoesPanel
        strategy={strategy}
        strategyLoading={strategyLoading}
        lucroMode={lucroMode}
        setLucroMode={setLucroMode}
        cfg={cfg}
        rc={rc}
      />
    </div>
  );
}
