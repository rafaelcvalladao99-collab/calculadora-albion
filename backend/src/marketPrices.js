/**
 * Funções usadas pela arbitragem, Mercado Negro e compra de equipamento.
 * A busca em si fica em `albionData.js`; aqui só ajustamos o formato de saída.
 */
import { buscarPrecos, buscarHistorico, dividir } from './albionData.js';

export const chunk = dividir;

function marcarFalhas(lista, falhas) {
  Object.defineProperty(lista, 'falhas', { value: falhas, enumerable: false });
  return lista;
}

export async function fetchPricesMarket(itemIds, locations, quality = 0) {
  const q = Number(quality) || 0;
  const r = await buscarPrecos(itemIds, locations, { qualidades: q > 0 ? [q] : undefined });
  if (r.falhas > 0) {
    console.warn(`[albion] ${r.falhas}/${r.totalPartes} partes de preços falharam`);
  }
  return marcarFalhas(r.dados, r.falhas);
}

/**
 * Volume médio diário (últimas 72 h) e preço médio, a partir do histórico por hora.
 * Chave: `itemId|local` ou, se `qualities` for passado, `itemId|local|qualidade`.
 */
export function calcularVolumes(entradas, porQualidade) {
  const volumeMap = new Map();

  for (const entry of entradas) {
    if (!entry.data || !Array.isArray(entry.data)) continue;
    const key = porQualidade
      ? `${entry.item_id}|${entry.location}|${entry.quality ?? 1}`
      : `${entry.item_id}|${entry.location}`;

    const sorted = [...entry.data].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // Volume por dia: soma das últimas 72 horas / 3
    const last72h = sorted.slice(-72);
    const avgVol = last72h.reduce((s, d) => s + (d.item_count || 0), 0) / 3;

    // Preço médio nas horas com vendas, em janelas cada vez maiores: 72 h → 7 d → 14 d
    let avgPrice = 0;
    for (const windowSize of [72, 168, 336]) {
      const salesHours = sorted.slice(-windowSize).filter((d) => (d.item_count || 0) > 0);
      if (salesHours.length > 0) {
        avgPrice = Math.round(
          salesHours.reduce((s, d) => s + (d.avg_price || 0), 0) / salesHours.length,
        );
        break;
      }
    }

    const prev = volumeMap.get(key);
    if (!prev || avgVol > prev.volume) volumeMap.set(key, { volume: avgVol, avgPrice });
  }

  return volumeMap;
}

export async function fetchHistoryMarket(itemIds, locations, qualities = null) {
  const porQualidade = Array.isArray(qualities) && qualities.length > 0;
  const r = await buscarHistorico(itemIds, locations, {
    escala: 1,
    qualidades: porQualidade ? qualities : undefined,
  });
  if (r.falhas > 0) {
    console.warn(`[albion] ${r.falhas}/${r.totalPartes} partes de histórico falharam`);
  }
  const mapa = calcularVolumes(r.dados, porQualidade);
  mapa.falhas = r.falhas;
  return mapa;
}
