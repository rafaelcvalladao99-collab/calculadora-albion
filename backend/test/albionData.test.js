import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  criarLimitador,
  buscarJson,
  agruparPorSemana,
  resolverRegiao,
} from '../src/albionData.js';
import { extrairOportunidadesBM, resolverTaxaBM } from '../src/blackMarketService.js';
import { calcularVolumes } from '../src/marketPrices.js';

// ─── Limitador ───────────────────────────────────────────────────────────────

test('limitador segura o pedido que passaria do limite da janela', async () => {
  let relogio = 0;
  const esperas = [];
  const lim = criarLimitador({
    limites: [{ max: 3, janelaMs: 1000 }],
    agora: () => relogio,
    dormir: async (ms) => {
      esperas.push(ms);
      relogio += ms;
    },
  });
  for (let i = 0; i < 3; i++) await lim.aguardar();
  assert.equal(esperas.length, 0, 'os 3 primeiros passam direto');
  await lim.aguardar();
  assert.equal(esperas.length, 1, 'o 4º espera a janela abrir');
  assert.ok(relogio >= 1000);
});

test('limitador respeita as duas regras da API ao mesmo tempo', async () => {
  let relogio = 0;
  const lim = criarLimitador({
    limites: [
      { max: 2, janelaMs: 100 },
      { max: 3, janelaMs: 1000 },
    ],
    agora: () => relogio,
    dormir: async (ms) => {
      relogio += ms;
    },
  });
  for (let i = 0; i < 4; i++) await lim.aguardar();
  // 4º pedido: a regra de 100 ms já liberaria, mas a de 3/1000 ms não.
  assert.ok(relogio >= 1000, `esperou só ${relogio} ms`);
});

// ─── Novas tentativas ────────────────────────────────────────────────────────

function resposta(status, corpo = []) {
  return { ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => corpo };
}

test('buscarJson tenta de novo quando a API responde 429', async () => {
  const respostas = [resposta(429), resposta(429), resposta(200, [{ ok: 1 }])];
  let chamadas = 0;
  const dados = await buscarJson('http://x', {
    fetchFn: async () => respostas[chamadas++],
    esperar: async () => {},
    pausa: async () => {},
  });
  assert.deepEqual(dados, [{ ok: 1 }]);
  assert.equal(chamadas, 3);
});

test('buscarJson desiste na hora com erro 404', async () => {
  let chamadas = 0;
  await assert.rejects(
    buscarJson('http://x', {
      fetchFn: async () => {
        chamadas++;
        return resposta(404);
      },
      esperar: async () => {},
      pausa: async () => {},
    }),
    /HTTP 404/,
  );
  assert.equal(chamadas, 1);
});

test('buscarJson desiste depois de esgotar as tentativas', async () => {
  await assert.rejects(
    buscarJson('http://x', {
      tentativas: 3,
      fetchFn: async () => resposta(429),
      esperar: async () => {},
      pausa: async () => {},
    }),
    /HTTP 429/,
  );
});

// ─── Região ──────────────────────────────────────────────────────────────────

test('região aceita os nomes antigos e cai em Américas por padrão', () => {
  assert.equal(resolverRegiao('west'), 'americas');
  assert.equal(resolverRegiao('Europe'), 'europa');
  assert.equal(resolverRegiao('east'), 'asia');
  assert.equal(resolverRegiao(''), 'americas');
  assert.equal(resolverRegiao('marte'), 'americas');
});

// ─── Histórico semanal ───────────────────────────────────────────────────────

test('agruparPorSemana soma 7 dias e faz média ponderada pela quantidade', () => {
  const dias = [];
  for (let d = 1; d <= 14; d++) {
    dias.push({
      timestamp: `2026-10-${String(d).padStart(2, '0')}T00:00:00`,
      item_count: d <= 7 ? 1 : 3,
      avg_price: d <= 7 ? 100 : 200,
    });
  }
  const [r] = agruparPorSemana([{ item_id: 'X', location: 'Y', data: dias }]);
  assert.equal(r.data.length, 2);
  assert.deepEqual(
    r.data.map((s) => [s.item_count, s.avg_price]),
    [
      [7, 100],
      [21, 200],
    ],
  );
});

// ─── Mercado Negro ───────────────────────────────────────────────────────────

test('taxa do Mercado Negro: 4% com premium, 8% sem, ou a informada', () => {
  assert.equal(resolverTaxaBM({ premium: true }), 4);
  assert.equal(resolverTaxaBM({ premium: false }), 8);
  assert.equal(resolverTaxaBM({ taxaVenda: '5.5' }), 5.5);
  assert.equal(resolverTaxaBM({ taxaVenda: '' }), 4);
});

test('oportunidade usa a cidade mais barata e desconta a taxa', () => {
  const agora = Date.parse('2026-10-08T12:00:00Z');
  const recente = '2026-10-08T11:00:00';
  const precos = [
    { item_id: 'T6_MAIN_SWORD', city: 'Black Market', quality: 1, buy_price_max: 100_000, buy_price_max_date: recente },
    { item_id: 'T6_MAIN_SWORD', city: 'Lymhurst', quality: 1, sell_price_min: 80_000, sell_price_min_date: recente },
    { item_id: 'T6_MAIN_SWORD', city: 'Martlock', quality: 1, sell_price_min: 70_000, sell_price_min_date: recente },
  ];
  const [op] = extrairOportunidadesBM(precos, 24, agora, 0.96);
  assert.equal(op.origem, 'Martlock');
  assert.equal(op.compra, 70_000);
  assert.equal(op.lucro, 100_000 * 0.96 - 70_000);
});

test('preço velho demais é ignorado', () => {
  const agora = Date.parse('2026-10-08T12:00:00Z');
  const precos = [
    { item_id: 'T6_BAG', city: 'Black Market', quality: 1, buy_price_max: 100_000, buy_price_max_date: '2026-10-01T00:00:00' },
    { item_id: 'T6_BAG', city: 'Lymhurst', quality: 1, sell_price_min: 10_000, sell_price_min_date: '2026-10-08T11:00:00' },
  ];
  assert.equal(extrairOportunidadesBM(precos, 24, agora, 0.96).length, 0);
});

test('sem lucro depois da taxa, não vira oportunidade', () => {
  const agora = Date.parse('2026-10-08T12:00:00Z');
  const recente = '2026-10-08T11:00:00';
  const precos = [
    { item_id: 'T4_BAG', city: 'Black Market', quality: 1, buy_price_max: 10_350, buy_price_max_date: recente },
    { item_id: 'T4_BAG', city: 'Thetford', quality: 1, sell_price_min: 10_000, sell_price_min_date: recente },
  ];
  // Com 3% sobrariam 39 de lucro; com a taxa real de 4% dá prejuízo.
  assert.equal(extrairOportunidadesBM(precos, 24, agora, 0.97).length, 1);
  assert.equal(extrairOportunidadesBM(precos, 24, agora, 0.96).length, 0);
});

// ─── Volume ──────────────────────────────────────────────────────────────────

test('volume diário é a soma das últimas 72 horas dividida por 3', () => {
  const horas = Array.from({ length: 100 }, (_, i) => ({
    timestamp: new Date(Date.UTC(2026, 9, 1) + i * 3_600_000).toISOString(),
    item_count: 1,
    avg_price: 500,
  }));
  const mapa = calcularVolumes([{ item_id: 'A', location: 'Black Market', quality: 2, data: horas }], true);
  assert.deepEqual(mapa.get('A|Black Market|2'), { volume: 24, avgPrice: 500 });
});
