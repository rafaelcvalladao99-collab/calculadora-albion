/**
 * Cliente único da API do Albion Online Data Project.
 *
 * Tudo que busca preço ou histórico passa por aqui, para que:
 *  - o servidor do jogo (Américas, Europa ou Ásia) seja escolhido num lugar só;
 *  - o limite da API (180 pedidos/min e 300 pedidos/5 min) seja respeitado por
 *    todos os serviços juntos, e não cada um por conta própria;
 *  - pedidos recusados (429) sejam repetidos com espera, em vez de descartados;
 *  - quem chamou saiba quantas partes da busca falharam (`falhas`).
 *
 * Documentação da API: https://www.albion-online-data.com/api
 */

export const REGIOES = {
  americas: 'https://west.albion-online-data.com',
  europa: 'https://europe.albion-online-data.com',
  asia: 'https://east.albion-online-data.com',
};

const ALIASES = { west: 'americas', east: 'asia', europe: 'europa' };

export function resolverRegiao(valor) {
  const v = String(valor || '').trim().toLowerCase();
  const nome = ALIASES[v] || v;
  return REGIOES[nome] ? nome : 'americas';
}

let regiaoAtual = resolverRegiao(process.env.ALBION_REGION);

export function getRegiao() {
  return regiaoAtual;
}

export function setRegiao(valor) {
  const nova = resolverRegiao(valor);
  if (nova !== regiaoAtual) {
    regiaoAtual = nova;
    cache.clear();
  }
  return regiaoAtual;
}

function baseStats() {
  return `${REGIOES[regiaoAtual]}/api/v2/stats`;
}

// ─── Limitador de pedidos ────────────────────────────────────────────────────
// Janela deslizante com as duas regras da API, com uma pequena folga.

export function criarLimitador({
  limites = [
    { max: 170, janelaMs: 60_000 },
    { max: 290, janelaMs: 300_000 },
  ],
  agora = () => Date.now(),
  dormir = (ms) => new Promise((r) => setTimeout(r, ms)),
} = {}) {
  const maiorJanela = Math.max(...limites.map((l) => l.janelaMs));
  let marcas = [];
  let fila = Promise.resolve();

  function esperaNecessaria(t) {
    marcas = marcas.filter((m) => t - m < maiorJanela);
    let espera = 0;
    for (const { max, janelaMs } of limites) {
      const naJanela = marcas.filter((m) => t - m < janelaMs);
      if (naJanela.length >= max) {
        const maisAntiga = naJanela[naJanela.length - max];
        espera = Math.max(espera, maisAntiga + janelaMs - t + 1);
      }
    }
    return espera;
  }

  async function reservar() {
    for (;;) {
      const espera = esperaNecessaria(agora());
      if (espera <= 0) break;
      await dormir(espera);
    }
    marcas.push(agora());
  }

  return {
    /** Espera a vez de fazer um pedido. As chamadas são atendidas por ordem de chegada. */
    aguardar() {
      const vez = fila.then(reservar);
      fila = vez.catch(() => {});
      return vez;
    },
    /** Pedidos feitos no último minuto (para a tela de estado). */
    usadosUltimoMinuto() {
      const t = agora();
      return marcas.filter((m) => t - m < 60_000).length;
    },
  };
}

const limitador = criarLimitador();

export function estadoLimitador() {
  return { usadosUltimoMinuto: limitador.usadosUltimoMinuto(), limitePorMinuto: 180 };
}

// ─── Pedido com novas tentativas ─────────────────────────────────────────────

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

export async function buscarJson(
  url,
  { tentativas = 5, fetchFn = fetch, esperar = () => limitador.aguardar(), pausa = dormir } = {},
) {
  let atraso = 2_000;
  let ultimoErro = null;
  for (let i = 0; i < tentativas; i++) {
    await esperar();
    let res;
    try {
      res = await fetchFn(url, { headers: { Accept: 'application/json' } });
    } catch (err) {
      ultimoErro = err;
      await pausa(atraso);
      atraso = Math.min(atraso * 2, 30_000);
      continue;
    }
    if (res.ok) return res.json();
    if (res.status === 429 || res.status >= 500) {
      const retryAfter = parseInt(res.headers?.get?.('Retry-After') || '0', 10);
      ultimoErro = new Error(`API Albion respondeu HTTP ${res.status}`);
      await pausa(retryAfter > 0 ? retryAfter * 1000 : atraso);
      atraso = Math.min(atraso * 2, 30_000);
      continue;
    }
    throw new Error(`API Albion respondeu HTTP ${res.status}`);
  }
  throw ultimoErro || new Error('API Albion não respondeu');
}

// ─── Cache ───────────────────────────────────────────────────────────────────

const cache = new Map();
const emAndamento = new Map();
const CACHE_MAX = 2_000;

function lerCache(chave, ttl) {
  const e = cache.get(chave);
  if (!e) return null;
  if (Date.now() - e.ts > ttl) {
    cache.delete(chave);
    return null;
  }
  return e.dados;
}

function gravarCache(chave, dados) {
  cache.set(chave, { dados, ts: Date.now() });
  if (cache.size > CACHE_MAX) cache.delete(cache.keys().next().value);
}

function comCache(chave, ttl, fn) {
  const hit = lerCache(chave, ttl);
  if (hit) return Promise.resolve(hit);
  if (emAndamento.has(chave)) return emAndamento.get(chave);
  const p = fn()
    .then((dados) => {
      gravarCache(chave, dados);
      return dados;
    })
    .finally(() => emAndamento.delete(chave));
  emAndamento.set(chave, p);
  return p;
}

export function limparCache() {
  cache.clear();
}

// ─── Utilidades ──────────────────────────────────────────────────────────────

export function dividir(lista, tamanho) {
  const out = [];
  for (let i = 0; i < lista.length; i += tamanho) out.push(lista.slice(i, i + tamanho));
  return out;
}

function normalizarLista(valor) {
  if (valor == null || valor === '') return [];
  const lista = Array.isArray(valor) ? valor : String(valor).split(',');
  return [...new Set(lista.map((v) => String(v).trim()).filter(Boolean))].sort();
}

// URLs muito longas são recusadas; ~100 itens por pedido fica bem abaixo do limite.
const ITENS_POR_PEDIDO = 100;
const TTL_PRECOS = 2 * 60_000;
const TTL_HISTORICO = 10 * 60_000;

async function buscarEmPartes(ids, montarUrl, ttl, prefixo) {
  const partes = dividir(ids, ITENS_POR_PEDIDO);
  const resultados = await Promise.allSettled(
    partes.map((parte) => {
      const url = montarUrl(parte);
      return comCache(`${regiaoAtual}|${prefixo}|${url}`, ttl, () => buscarJson(url));
    }),
  );
  const dados = [];
  let falhas = 0;
  let ultimoErro = null;
  for (const r of resultados) {
    if (r.status === 'fulfilled' && Array.isArray(r.value)) dados.push(...r.value);
    else {
      falhas++;
      ultimoErro = r.reason;
    }
  }
  return { dados, falhas, totalPartes: partes.length, ultimoErro };
}

/**
 * Preços atuais (ordens de compra e venda) de vários itens em várias cidades.
 * @returns {{dados: object[], falhas: number, totalPartes: number}}
 */
export function buscarPrecos(itemIds, locais, { qualidades } = {}) {
  const ids = normalizarLista(itemIds);
  const locs = normalizarLista(locais);
  const quals = normalizarLista(qualidades);
  if (ids.length === 0) return Promise.resolve({ dados: [], falhas: 0, totalPartes: 0 });
  const extra =
    (locs.length ? `?locations=${encodeURIComponent(locs.join(','))}` : '?') +
    (quals.length ? `&qualities=${quals.join(',')}` : '');
  return buscarEmPartes(
    ids,
    (parte) => `${baseStats()}/prices/${parte.join(',')}.json${extra}`,
    TTL_PRECOS,
    'p',
  );
}

/**
 * Histórico de vendas. `escala` é 1 (por hora), 6 (a cada 6 h) ou 24 (por dia).
 * @returns {{dados: object[], falhas: number, totalPartes: number}}
 */
export function buscarHistorico(itemIds, locais, { escala = 24, qualidades } = {}) {
  if (![1, 6, 24].includes(escala)) {
    throw new Error(`Escala de histórico inválida: ${escala} (use 1, 6 ou 24)`);
  }
  const ids = normalizarLista(itemIds);
  const locs = normalizarLista(locais);
  const quals = normalizarLista(qualidades);
  if (ids.length === 0) return Promise.resolve({ dados: [], falhas: 0, totalPartes: 0 });
  const extra =
    `?time-scale=${escala}` +
    (locs.length ? `&locations=${encodeURIComponent(locs.join(','))}` : '') +
    (quals.length ? `&qualities=${quals.join(',')}` : '');
  return buscarEmPartes(
    ids,
    (parte) => `${baseStats()}/history/${parte.join(',')}.json${extra}`,
    TTL_HISTORICO,
    'h',
  );
}

/**
 * Junta pontos diários em blocos de 7 dias (do mais recente para trás).
 * O preço de cada semana é a média ponderada pela quantidade vendida.
 */
export function agruparPorSemana(entradas) {
  return entradas.map((entrada) => {
    const pontos = [...(entrada.data || [])].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
    );
    const semanas = [];
    for (let fim = pontos.length; fim > 0; fim -= 7) {
      const bloco = pontos.slice(Math.max(0, fim - 7), fim);
      const qtd = bloco.reduce((s, p) => s + (p.item_count || 0), 0);
      const soma = bloco.reduce((s, p) => s + (p.avg_price || 0) * (p.item_count || 0), 0);
      semanas.unshift({
        timestamp: bloco[0].timestamp,
        item_count: qtd,
        avg_price: qtd > 0 ? Math.round(soma / qtd) : 0,
      });
    }
    return { ...entrada, data: semanas };
  });
}
