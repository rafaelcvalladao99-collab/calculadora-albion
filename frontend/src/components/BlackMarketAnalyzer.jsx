import { useEffect, useState, useRef } from 'react';
import { blackMarketStream } from '../api.js';
import { ICONS } from './Icons.jsx';
import { tempoDesde, classeIdade } from '../utils/tempo.js';

const ITEMS_PER_PAGE = 25;
const MAX_IDADE_HORAS = 24;
// Vender direto para a ordem de compra do Mercado Negro paga só a taxa de venda.
const TAXA_PREMIUM = 4;
const TAXA_SEM_PREMIUM = 8;

function lerPremiumSalvo() {
  try { return localStorage.getItem('albion_premium') !== 'false'; } catch { return true; }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function tierColor(tier) {
  const map = { T4: '#9f6d34', T5: '#3a84c8', T6: '#9f3fba', T7: '#d46f2e', T8: '#c41d7f' };
  return map[tier] || 'var(--text-tertiary)';
}

const timeAgo = (valor) => tempoDesde(valor);
const timeAgoClass = (valor) => classeIdade(valor);

function desvioLabel(desvio) {
  if (desvio === null || desvio === undefined) {
    return { text: 'sem hist.', cls: 'bm-desvio-none' };
  }
  const pct = (desvio >= 0 ? '+' : '') + desvio.toFixed(1) + '%';
  if (desvio > 60) return { text: pct, cls: 'neg' };
  if (desvio > 20) return { text: pct, cls: 'bm-desvio-warn' };
  return { text: pct, cls: 'pos' };
}

function volClass(vol) {
  if (!vol || vol === 0) return 'bm-vol-zero';
  if (vol >= 10) return 'pos';
  return 'bm-vol-warn';
}

// ─── CoefBar ──────────────────────────────────────────────────────────────

function CoefBar({ value, maxCoef, weight }) {
  if (!value || value <= 0) {
    return (
      <div className="coef-wrap">
        <span className="bm-coef-none">—</span>
        {weight != null && <div className="coef-weight">{weight} kg</div>}
      </div>
    );
  }
  const pct = Math.min(100, Math.max(4, (value / Math.max(maxCoef, 1)) * 100));
  const display = value >= 1e6
    ? (value / 1e6).toFixed(1).replace('.', ',') + 'M'
    : value >= 1e3
      ? Math.round(value / 1e3).toLocaleString('pt-PT') + 'k'
      : Math.round(value).toLocaleString('pt-PT');
  return (
    <div className="coef-wrap">
      <div className="coef-pill">
        <div className="coef-fill" style={{ width: `${pct}%` }} />
        <span className="coef-num">{display}</span>
      </div>
      {weight != null && <div className="coef-weight">{weight} kg</div>}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────

export default function BlackMarketAnalyzer() {
  const [loading,          setLoading]          = useState(false);
  const [scanning,         setScanning]         = useState(false);
  const [err,              setErr]              = useState(null);
  const [rows,             setRows]             = useState([]);
  const [itemsProcessados, setItemsProcessados] = useState(0);
  const [totalItens,       setTotalItens]       = useState(0);
  const [currentPage,      setCurrentPage]      = useState(1);
  const [sortCol,          setSortCol]          = useState('lucro');
  const [sortAsc,          setSortAsc]          = useState(false);
  const [volMinimo,        setVolMinimo]        = useState(0.75);
  const [volMinimoInput,   setVolMinimoInput]   = useState('0.75');
  const [filtroCidade,     setFiltroCidade]     = useState('Todos');
  const [modoCaerleon,     setModoCaerleon]     = useState(false);
  const [copiedId,         setCopiedId]         = useState(null);
  const [premium,          setPremium]          = useState(lerPremiumSalvo);
  const [falhas,           setFalhas]           = useState(0);
  const streamRef  = useRef(null);
  const scanIdRef  = useRef(0);

  useEffect(() => { return () => { streamRef.current?.abort(); }; }, []);

  const buscar = () => {
    streamRef.current?.abort();
    streamRef.current = null;
    const currentScanId = ++scanIdRef.current;

    setRows([]);
    setScanning(true);
    setLoading(true);
    setErr(null);
    setItemsProcessados(0);
    setTotalItens(0);
    setFalhas(0);
    setCurrentPage(1);
    setSortCol('lucro');
    setSortAsc(false);

    const modoAtual  = modoCaerleon;
    const dedupSet   = new Set();
    const acumulador = [];

    const stream = blackMarketStream(
      { maxIdadeHoras: MAX_IDADE_HORAS, premium: String(premium) },
      {
        onChunk: (oportunidades) => {
          if (scanIdRef.current !== currentScanId) return;
          for (const op of oportunidades) {
            if (modoAtual && op.origem !== 'Caerleon') continue;
            const chave = `${op.id}|${op.estado}`;
            if (!dedupSet.has(chave)) { dedupSet.add(chave); acumulador.push(op); }
          }
          setRows([...acumulador]);
        },
        onProgress: ({ processados, totalItens: total, falhas: f }) => {
          setItemsProcessados(processados);
          setTotalItens(total);
          setFalhas(f || 0);
        },
        onDone: (info) => {
          if (scanIdRef.current !== currentScanId) return;
          setFalhas(info?.falhas || 0);
          setScanning(false);
          setLoading(false);
        },
        onError: (msg) => { if (scanIdRef.current !== currentScanId) return; setErr(msg); setScanning(false); setLoading(false); },
      },
    );
    streamRef.current = stream;
  };

  const cancelar = () => {
    scanIdRef.current++;
    streamRef.current?.abort();
    streamRef.current = null;
    setScanning(false);
    setLoading(false);
  };

  const handleCopy = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  // ─── Derived data ──────────────────────────────────────────────────────

  const getPrecoEfetivo = (op) =>
    modoCaerleon && op.precoMedioBM > 0 ? op.precoMedioBM : op.buyOrderBM;

  const fatorTaxa = 1 - (premium ? TAXA_PREMIUM : TAXA_SEM_PREMIUM) / 100;

  // Lucro recalculado aqui, para refletir na hora a troca de premium/sem premium.
  const getLucroEfetivo = (op) => {
    const compra = Number(op.compra) || 0;
    if (modoCaerleon && op.precoMedioBM > 0) return op.precoMedioBM * fatorTaxa - compra;
    return (Number(op.buyOrderBM) || 0) * fatorTaxa - compra;
  };

  const alternarPremium = (valor) => {
    setPremium(valor);
    try { localStorage.setItem('albion_premium', String(valor)); } catch { /* sem armazenamento */ }
  };

  const validRows = rows.filter((op) => {
    if ((Number(op.volumeDiario) || 0) < volMinimo) return false;
    if (filtroCidade !== 'Todos' && op.origem !== filtroCidade) return false;
    if (modoCaerleon && (!op.precoMedioBM || op.precoMedioBM <= 0)) return false;
    if (getLucroEfetivo(op) <= 0) return false;
    return true;
  });

  const handleSort = (col) => {
    if (sortCol === col) setSortAsc(!sortAsc);
    else { setSortCol(col); setSortAsc(false); }
    setCurrentPage(1);
  };

  const sortedRows = [...validRows].sort((a, b) => {
    let va, vb;
    if (sortCol === 'lucro') {
      va = getLucroEfetivo(a); vb = getLucroEfetivo(b);
    } else if (sortCol === 'margem') {
      va = a.compra > 0 ? getPrecoEfetivo(a) / a.compra : 0;
      vb = b.compra > 0 ? getPrecoEfetivo(b) / b.compra : 0;
    } else if (sortCol === 'volume') {
      va = Number(a.volumeDiario) || 0; vb = Number(b.volumeDiario) || 0;
    } else if (sortCol === 'desvio') {
      va = a.desvio ?? 999; vb = b.desvio ?? 999;
    } else if (sortCol === 'buyOrderBM') {
      va = getPrecoEfetivo(a); vb = getPrecoEfetivo(b);
    } else if (sortCol === 'coeficiente') {
      const c = (op) => { const vol = op.volumeDiario || 0; const p = op.peso || 1; return vol > 0 ? (getLucroEfetivo(op) * vol) / p : -1; };
      va = c(a); vb = c(b);
    } else {
      va = getLucroEfetivo(a); vb = getLucroEfetivo(b);
    }
    const diff = sortAsc ? va - vb : vb - va;
    return diff !== 0 ? diff : getLucroEfetivo(b) - getLucroEfetivo(a);
  });

  const maxCoef = sortedRows.length > 0
    ? Math.max(...sortedRows.map(op => { const v = op.volumeDiario || 0; const p = op.peso || 1; return v > 0 ? (getLucroEfetivo(op) * v) / p : 0; }))
    : 1;

  const totalPages = Math.ceil(sortedRows.length / ITEMS_PER_PAGE);
  const startIdx   = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageRows   = sortedRows.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const sortInd  = (col) => sortCol === col ? (sortAsc ? ' ↑' : ' ↓') : '';
  const thClass  = (col) => `ff-right bm-sortable${sortCol === col ? ' bm-sort' : ''}`;

  const availableCities = [...new Set(rows.map(op => op.origem))].sort();
  const showEmpty = sortedRows.length === 0 && !scanning;

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div className="page-inner">

      {/* ── Header ── */}
      <div className="bm-header">
        <h2 className="bm-title">Black Market — Arbitragem para o Mercado Negro</h2>
      </div>

      {/* ── Filter bar ── */}
      <div className="bm-filters">
        <div className="bm-static">
          <span>Dados ≤ {MAX_IDADE_HORAS}h</span>
          <span className="bm-dot">·</span>
          <span>Taxa {premium ? TAXA_PREMIUM : TAXA_SEM_PREMIUM}%</span>
        </div>

        <label className={`cb${premium ? ' cb-on' : ''}`}>
          <input
            type="checkbox"
            checked={premium}
            onChange={(e) => { alternarPremium(e.target.checked); setCurrentPage(1); }}
          />
          <span className="cb-box">
            {premium && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
          <span className="cb-label">Tenho premium</span>
        </label>

        <label className="bm-field">
          <span className="bm-field-lbl">Vol. mín./dia</span>
          <input
            type="number"
            min="0"
            step="0.25"
            value={volMinimoInput}
            onChange={(e) => setVolMinimoInput(e.target.value)}
            onBlur={() => {
              const v = parseFloat(volMinimoInput);
              if (!isNaN(v) && v >= 0) { setVolMinimo(v); setCurrentPage(1); }
              else setVolMinimoInput(String(volMinimo));
            }}
            onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
            className="bm-num-input"
          />
        </label>

        <label className="bm-field">
          <span className="bm-field-lbl">Cidade</span>
          <select
            className="bm-select"
            value={filtroCidade}
            onChange={(e) => { setFiltroCidade(e.target.value); setCurrentPage(1); }}
          >
            <option value="Todos">Todas</option>
            {availableCities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>

        <label className={`cb${modoCaerleon ? ' cb-on' : ''}`}>
          <input
            type="checkbox"
            checked={modoCaerleon}
            onChange={(e) => { setModoCaerleon(e.target.checked); setCurrentPage(1); }}
          />
          <span className="cb-box">
            {modoCaerleon && (
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.8"
                      strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </span>
          <span className="cb-label">Caerleon (avg)</span>
        </label>

        <div className="bm-spacer" />

        <button
          type="button"
          className="btn-primary"
          onClick={buscar}
          disabled={loading || scanning}
        >
          {scanning && (
            <svg className="btn-icon spin" width="14" height="14" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M12 3a9 9 0 019 9" />
            </svg>
          )}
          {scanning ? 'Escaneando…' : 'Buscar'}
        </button>

        {scanning && (
          <button type="button" className="btn-secondary" onClick={cancelar}>
            Cancelar
          </button>
        )}
      </div>

      {/* ── Scan progress ── */}
      {scanning && (
        <div className="bm-progress">
          <span className="bm-progress-label">Escaneando</span>
          {totalItens > 0 && (
            <>
              <span className="bm-progress-count">{itemsProcessados}/{totalItens} itens</span>
              <span className="bm-progress-pct">{Math.round((itemsProcessados / totalItens) * 100)}%</span>
            </>
          )}
          {rows.length > 0 && (
            <span className="bm-progress-count">· {rows.length} oportunidades</span>
          )}
        </div>
      )}

      {/* ── Result count ── */}
      {!scanning && rows.length > 0 && (
        <div className="bm-count">
          <span className="bm-count-n mono">{validRows.length.toLocaleString('pt-PT')}</span>
          <span>oportunidades encontradas</span>
        </div>
      )}

      {falhas > 0 && (
        <p className="error">
          {falhas} {falhas === 1 ? 'parte da busca falhou' : 'partes da busca falharam'} (a API
          recusou ou não respondeu). Alguns itens podem estar faltando — tente buscar de novo daqui a
          pouco.
        </p>
      )}

      {err && <p className="error">{err}</p>}

      {/* ── Empty state ── */}
      {showEmpty && (
        <div className="bm-empty">
          <div className="bm-empty-icon">
            <ICONS.skull size={32} />
          </div>
          <div className="bm-empty-title">
            {rows.length > 0
              ? 'Nenhuma oportunidade encontrada'
              : 'Carregue uma pesquisa'}
          </div>
          <div className="bm-empty-body">
            {rows.length > 0
              ? 'Tente ajustar o volume mínimo ou trocar a cidade de origem.'
              : 'Ajuste os filtros e clique em Buscar para encontrar oportunidades de arbitragem.'}
          </div>
        </div>
      )}

      {/* ── Results table ── */}
      {!showEmpty && (
        <div className="card bm-table-card">
          <div className="bm-scroll">
            <table className="bm-table">
              <thead>
                <tr>
                  <th className="bm-num">#</th>
                  <th>Item</th>
                  <th className="ff-right">Compra (Cidade)</th>
                  <th className={thClass('buyOrderBM')} onClick={() => handleSort('buyOrderBM')}>
                    {modoCaerleon ? 'Preço Médio BM' : 'Buy Order BM'}{sortInd('buyOrderBM')}
                  </th>
                  <th className={thClass('lucro')} onClick={() => handleSort('lucro')}>
                    Lucro{sortInd('lucro')}
                  </th>
                  <th className={thClass('margem')} onClick={() => handleSort('margem')}>
                    %{sortInd('margem')}
                  </th>
                  <th className={thClass('volume')} onClick={() => handleSort('volume')}>
                    Vol/dia{sortInd('volume')}
                  </th>
                  <th
                    className={`${thClass('desvio')} bm-desvio`}
                    onClick={() => handleSort('desvio')}
                    title="Desvio do buy order em relação ao preço médio histórico no BM"
                  >
                    Vs. média{sortInd('desvio')}
                  </th>
                  <th
                    className={`${thClass('coeficiente')} bm-coef`}
                    onClick={() => handleSort('coeficiente')}
                    title="(Lucro × Vol/dia) ÷ Peso — maior = melhor para transportar"
                  >
                    Valor p/ viagem{sortInd('coeficiente')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((op, idx) => {
                  const precoEf  = getPrecoEfetivo(op);
                  const lucroEf  = getLucroEfetivo(op);
                  const margem   = op.compra > 0 ? ((precoEf / op.compra - 1) * 100).toFixed(1) : '0.0';
                  const isNeg    = lucroEf < 0;
                  const rowId    = `${op.id}|${op.estado}`;
                  const coef     = (() => { const v = op.volumeDiario || 0; const p = op.peso || 1; return v > 0 ? (lucroEf * v) / p : 0; })();
                  const { text: devText, cls: devCls } = desvioLabel(op.desvio);

                  return (
                    <tr
                      key={rowId}
                      className={`bm-row${isNeg ? ' bm-row-neg' : ''}`}
                      style={{ animationDelay: `${Math.min(idx, 18) * 25}ms` }}
                    >
                      {/* # */}
                      <td className="bm-num mono">{startIdx + idx + 1}</td>

                      {/* Item */}
                      <td className="bm-item">
                        <div className="bm-item-inner">
                          <div className="bm-icon">
                            <img
                              src={`https://render.albiononline.com/v1/item/${op.id}.png?quality=1`}
                              alt=""
                              loading="lazy"
                              onError={(e) => { e.target.onerror = null; e.target.style.opacity = '0'; }}
                            />
                          </div>
                          <div className="bm-item-text">
                            <div className="bm-item-l1">
                              <span className="bm-item-name">{op.nomeBase}</span>
                              <span className="bm-copy-wrap">
                                <button
                                  className="bm-copy"
                                  onClick={(e) => { e.stopPropagation(); handleCopy(op.nomeBase, rowId); }}
                                  title="Copiar nome"
                                >
                                  {copiedId === rowId ? '✓' : '⎘'}
                                </button>
                                {copiedId === rowId && <span className="bm-copy-tip">Copiado!</span>}
                              </span>
                            </div>
                            <div className="bm-item-l2">
                              <span className="bm-tag-tier mono" style={{ color: tierColor(op.tier) }}>
                                {op.tier}
                              </span>
                              {op.encanto && op.encanto !== '0' && (
                                <span className={`enc-pill enc-${op.encanto}`}>.{op.encanto}</span>
                              )}
                              {op.estado && (
                                <span className="bm-tag-quality">{op.estado}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Compra */}
                      <td className="bm-money">
                        <div className="mono bm-money-v">
                          {op.compra?.toLocaleString('pt-PT')}
                        </div>
                        <div className="bm-money-s">
                          {String(op.origem).replace(/([a-z])([A-Z])/g, '$1 $2')}
                          {' · '}
                          <span className={timeAgoClass(op.atualizacaoOrig)}>
                            {timeAgo(op.atualizacaoOrig)}
                          </span>
                        </div>
                      </td>

                      {/* BM price */}
                      <td className="bm-money">
                        <div className={`mono bm-money-v ${modoCaerleon ? 'bm-money-v-info' : 'bm-money-v-accent'}`}>
                          {precoEf?.toLocaleString('pt-PT')}
                        </div>
                        <div className="bm-money-s">
                          Black Market
                          {!modoCaerleon && (
                            <>
                              {' · '}
                              <span className={timeAgoClass(op.atualizacaoBM)}>
                                {timeAgo(op.atualizacaoBM)}
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Lucro */}
                      <td className={`bm-lucro mono${isNeg ? ' neg' : ' pos'}`}>
                        {lucroEf.toLocaleString('pt-PT', { maximumFractionDigits: 0 })}
                      </td>

                      {/* % */}
                      <td className="bm-pct mono">
                        <span className={parseFloat(margem) >= 0 ? 'pos' : 'neg'}>
                          {margem}%
                        </span>
                      </td>

                      {/* Vol/dia */}
                      <td className={`bm-vol mono ${volClass(op.volumeDiario)}`}>
                        {(op.volumeDiario || 0) > 0
                          ? Number(op.volumeDiario) % 1 === 0
                            ? op.volumeDiario.toLocaleString('pt-PT')
                            : Number(op.volumeDiario).toLocaleString('pt-PT', { maximumFractionDigits: 1 })
                          : '—'}
                      </td>

                      {/* Desvio */}
                      <td className="bm-desvio">
                        <div className={`mono ${devCls}`}>{devText}</div>
                        {op.precoMedioBM > 0 && (
                          <div className="bm-money-s mono">
                            {op.precoMedioBM.toLocaleString('pt-PT')}
                          </div>
                        )}
                      </td>

                      {/* Coef */}
                      <td className="bm-coef">
                        <CoefBar value={coef} maxCoef={maxCoef} weight={op.peso} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="bm-pagination">
              <button
                className="bm-page-btn"
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                ← Anterior
              </button>
              <span className="bm-page-info">{currentPage} / {totalPages}</span>
              <button
                className="bm-page-btn"
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Próximo →
              </button>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
