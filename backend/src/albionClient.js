/**
 * Funções usadas pelo refino, poções e compra de equipamento.
 * Agora são só atalhos para o cliente único em `albionData.js`.
 */
import { buscarPrecos, buscarHistorico, agruparPorSemana } from './albionData.js';

function comFalhas(lista, resultado, rotulo) {
  if (resultado.falhas > 0) {
    if (resultado.falhas === resultado.totalPartes) {
      throw resultado.ultimoErro || new Error(`Falha ao buscar ${rotulo} na API Albion`);
    }
    console.warn(`[albion] ${resultado.falhas}/${resultado.totalPartes} partes de ${rotulo} falharam`);
  }
  // Propriedade extra: não aparece no JSON, mas quem quiser pode conferir.
  Object.defineProperty(lista, 'falhas', { value: resultado.falhas, enumerable: false });
  return lista;
}

export async function fetchPrices(itemIds, locations) {
  const r = await buscarPrecos(itemIds, locations);
  return comFalhas(r.dados, r, 'preços');
}

/**
 * `timescale`: 1 = por hora, 6 = a cada 6 h, 24 = por dia, 168 = por semana.
 * A API não tem escala semanal; nesse caso buscamos por dia e agrupamos em semanas.
 */
export async function fetchHistory(itemIds, locations, timescale = 24) {
  const semanal = Number(timescale) === 168;
  const escala = semanal ? 24 : Number(timescale);
  const r = await buscarHistorico(itemIds, locations, { escala });
  const dados = semanal ? agruparPorSemana(r.dados) : r.dados;
  return comFalhas(dados, r, 'histórico');
}
