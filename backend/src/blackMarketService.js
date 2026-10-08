import {
  CIDADES_SEGURAS,
  QUALITY_NAMES,
  nomeItemEmPortugues,
  extrairInfoItem,
  obterPesoReal,
  taxaVendaDireta,
} from './marketConstants.js';
import { gerarListaItens } from './marketItems.js';
import { chunk, fetchPricesMarket, fetchHistoryMarket } from './marketPrices.js';

const BLACK_MARKET = 'Black Market';
const ITEMS_PER_CHUNK = 100;
const ALL_LOCATIONS = [...CIDADES_SEGURAS, BLACK_MARKET];

// O mercado negro só tem buy orders relevantes (buy_price_max).
// Sell orders existem mas são do jogo, não de jogadores.
// Para cidades de origem, usamos sell_price_min (ordem de venda mais barata).
// Teleporte para o BM é gratuito (fica em Caerleon, custo = 0).
export function extrairOportunidadesBM(respostaPrecos, maxIdade, agora, taxaVendaNota) {
  // bmPrices: `${itemId}|${qual}` → { buyMax, dataStr }
  const bmPrices = new Map();
  // cityPrices: `${itemId}|${cidade}|${qual}` → { sellMin, dataStr }
  const cityPrices = new Map();

  for (const p of respostaPrecos) {
    const qual = p.quality || 1;

    if (p.city === BLACK_MARKET) {
      // Usar buy_price_max_date pois BM não tem sell orders significativos
      const dateStr = p.buy_price_max_date;
      if (!dateStr || String(dateStr).startsWith('0001')) continue;
      const dataApi = new Date(String(dateStr).replace(' ', 'T')).getTime();
      if ((agora - dataApi) / 3600000 > maxIdade) continue;
      if ((p.buy_price_max || 0) <= 0) continue;

      const key = `${p.item_id}|${qual}`;
      const existing = bmPrices.get(key);
      if (!existing || p.buy_price_max > existing.buyMax) {
        bmPrices.set(key, {
          buyMax: p.buy_price_max,
          dataStr: String(dateStr).replace('T', ' ').slice(0, 16),
        });
      }
    } else {
      const dateStr = p.sell_price_min_date;
      if (!dateStr || String(dateStr).startsWith('0001')) continue;
      const dataApi = new Date(String(dateStr).replace(' ', 'T')).getTime();
      if ((agora - dataApi) / 3600000 > maxIdade) continue;
      if ((p.sell_price_min || 0) <= 0) continue;

      const key = `${p.item_id}|${p.city}|${qual}`;
      const existing = cityPrices.get(key);
      if (!existing || p.sell_price_min < existing.sellMin) {
        cityPrices.set(key, {
          sellMin: p.sell_price_min,
          dataStr: String(dateStr).replace('T', ' ').slice(0, 16),
        });
      }
    }
  }

  const oportunidades = [];

  for (const [bmKey, bmData] of bmPrices) {
    const pipeIdx = bmKey.indexOf('|');
    const itemId = bmKey.slice(0, pipeIdx);
    const qual = parseInt(bmKey.slice(pipeIdx + 1));

    const { tier, encanto } = extrairInfoItem(itemId);
    const nomeBase = nomeItemEmPortugues(itemId);
    const estado = QUALITY_NAMES[qual] || 'Normal';

    // Encontrar a cidade mais barata para este item+qualidade
    let melhorCidade = null;
    let melhorPreco = Infinity;
    let melhorDataOrig = null;

    for (const cidade of CIDADES_SEGURAS) {
      const cityKey = `${itemId}|${cidade}|${qual}`;
      const cityData = cityPrices.get(cityKey);
      if (!cityData) continue;
      if (cityData.sellMin < melhorPreco) {
        melhorPreco = cityData.sellMin;
        melhorCidade = cidade;
        melhorDataOrig = cityData.dataStr;
      }
    }

    if (!melhorCidade) continue;

    const receita = bmData.buyMax * taxaVendaNota;
    const lucroLiquido = receita - melhorPreco;
    if (lucroLiquido <= 0) continue;

    oportunidades.push({
      id: itemId,
      nomeBase,
      tier,
      encanto,
      estado,
      qualidade: qual,
      origem: melhorCidade,
      compra: melhorPreco,
      buyOrderBM: bmData.buyMax,
      lucro: lucroLiquido,
      margem: melhorPreco > 0 ? (bmData.buyMax / melhorPreco - 1) * 100 : 0,
      atualizacaoOrig: melhorDataOrig,
      atualizacaoBM: bmData.dataStr,
      peso: obterPesoReal(itemId),
    });
  }

  return oportunidades;
}

/** Taxa usada: a informada explicitamente, ou a do premium/sem premium. */
export function resolverTaxaBM({ taxaVenda, premium = true } = {}) {
  const explicita = parseFloat(taxaVenda);
  if (Number.isFinite(explicita) && explicita >= 0 && explicita < 100) return explicita;
  return taxaVendaDireta(premium);
}

export async function buscarOportunidadesBMStream(
  { maxIdadeHoras = 24, quality = 0, taxaVenda, premium = true },
  onChunk,
) {
  const itens = await gerarListaItens('Todos');

  if (!Array.isArray(itens) || itens.length === 0) {
    onChunk({ type: 'done', total: 0, processados: 0, falhas: 0 });
    return;
  }

  const maxIdade = Number(maxIdadeHoras) || 24;
  const agora = Date.now();
  const qualityNum = Number(quality) || 0;
  const taxa = resolverTaxaBM({ taxaVenda, premium });
  const taxaVendaNota = 1 - taxa / 100;

  const chunks = chunk(itens, ITEMS_PER_CHUNK);
  const totalItens = itens.length;
  let processados = 0;
  let totalOportunidades = 0;
  let falhas = 0;
  // O limitador global controla o ritmo; aqui só evitamos abrir pedidos demais de uma vez.
  const concurrency = 5;

  onChunk({ type: 'start', totalItens, totalChunks: chunks.length, taxa });

  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency);

    const batchResults = await Promise.allSettled(
      batch.map(async (chunkItems) => {
        const respostaPrecos = await fetchPricesMarket(chunkItems, ALL_LOCATIONS, qualityNum);
        return {
          ops: extrairOportunidadesBM(respostaPrecos, maxIdade, agora, taxaVendaNota),
          falhas: respostaPrecos.falhas || 0,
        };
      }),
    );

    const batchOps = [];
    batch.forEach((chunkItems, idx) => {
      processados += chunkItems.length;
      const result = batchResults[idx];
      if (result.status !== 'fulfilled') {
        falhas++;
        return;
      }
      falhas += result.value.falhas;
      batchOps.push(...result.value.ops);
    });

    if (batchOps.length > 0) {
      const uniqueIds = [...new Set(batchOps.map((op) => op.id))];
      let volumeMap = new Map();
      try {
        volumeMap = await fetchHistoryMarket(uniqueIds, BLACK_MARKET, [1, 2, 3, 4, 5]);
      } catch {
        // continua sem volume
      }

      for (const op of batchOps) {
        const dataBM = volumeMap.get(`${op.id}|${BLACK_MARKET}|${op.qualidade}`);
        op.volumeDiario = dataBM?.volume || 0;
        op.precoMedioBM = dataBM?.avgPrice || 0;
        op.desvio = op.precoMedioBM > 0 ? (op.buyOrderBM / op.precoMedioBM - 1) * 100 : null;
      }

      totalOportunidades += batchOps.length;
      onChunk({
        type: 'chunk',
        oportunidades: batchOps,
        processados: Math.min(processados, totalItens),
        totalItens,
        falhas,
      });
    } else {
      onChunk({
        type: 'progress',
        processados: Math.min(processados, totalItens),
        totalItens,
        falhas,
      });
    }
  }

  onChunk({ type: 'done', total: totalOportunidades, processados: totalItens, falhas, taxa });
}
