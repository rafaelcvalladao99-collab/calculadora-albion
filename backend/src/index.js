import { buscarEquipamentoPorNivelEfetivo } from './equipBuyService.js';
import { getEquipmentData } from './equipmentService.js';
import { analyzePotions } from './potionService.js';

import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import {
  buscarOportunidades,
  buscarOportunidadesStream,
  buscarVolumeParaItens,
  CATEGORIAS,
  obterCategoriasDinamicas,
} from './marketService.js';
import { buscarOportunidadesBMStream } from './blackMarketService.js';
import { getRegiao, setRegiao, estadoLimitador, REGIOES } from './albionData.js';
import { estadoItens } from './marketItems.js';
import {
  processarWood,
  estrategiaCompleta,
  horariosUtc,
  processarFiber,
  estrategiaCompletaFiber,
  processarLeather,
  estrategiaCompletaLeather,
  processarMetal,
  estrategiaCompletaMetal,
  hubStrategy,
} from './refiningService.js';

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : null;

app.use(
  cors({
    origin: ALLOWED_ORIGINS || 'http://localhost:5173',
  }),
);
app.use(express.json());

// Código de acesso: obrigatório só quando o app roda como site público.
// Rodando no seu computador, deixe ACCESS_TOKEN vazio e não haverá tela de senha.
const ACCESS_TOKEN = (process.env.ACCESS_TOKEN || '').trim();
const AUTH_ATIVA = ACCESS_TOKEN.length > 0;
if (!AUTH_ATIVA) {
  console.warn('[auth] ACCESS_TOKEN não definido: acesso livre (ok para uso local).');
}

const ROTAS_PUBLICAS = new Set(['/api/health', '/api/auth/validate', '/api/auth/required']);

app.use((req, res, next) => {
  if (!AUTH_ATIVA || !req.path.startsWith('/api/') || ROTAS_PUBLICAS.has(req.path)) return next();
  // EventSource/stream também manda o código pela query, por isso aceitamos os dois.
  const token = req.get('X-Access-Token') || req.query.token;
  if (token === ACCESS_TOKEN) return next();
  res.status(401).json({ error: 'Código de acesso inválido ou ausente' });
});

/** Wrapper: try/catch + log + 500 automático */
const wrap = (fn) => async (req, res) => {
  try {
    const data = await fn(req, res);
    if (data !== undefined) res.json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e.message || e) });
  }
};

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'calculadora-albion-api' });
});

app.get('/api/auth/required', (_req, res) => {
  res.json({ required: AUTH_ATIVA });
});

/** Validação de token de acesso */
app.post('/api/auth/validate', (req, res) => {
  const { token } = req.body || {};
  if (!AUTH_ATIVA || (typeof token === 'string' && token === ACCESS_TOKEN)) {
    return res.json({ valid: true });
  }
  res.status(401).json({ valid: false, error: 'Token inválido' });
});

/** Estado do app: servidor do jogo, origem da lista de itens e uso da API. */
app.get('/api/status', (_req, res) => {
  res.json({
    regiao: getRegiao(),
    regioesDisponiveis: Object.keys(REGIOES),
    itens: estadoItens(),
    api: estadoLimitador(),
  });
});

/** Troca o servidor do jogo (americas, europa, asia). */
app.post('/api/status/regiao', (req, res) => {
  res.json({ regiao: setRegiao(req.body?.regiao) });
});

// ─── Rotas de refino (calculate + strategy) ───

const refiningRoutes = [
  { path: 'wood', calcFn: processarWood, stratFn: estrategiaCompleta },
  { path: 'fiber', calcFn: processarFiber, stratFn: estrategiaCompletaFiber },
  { path: 'leather', calcFn: processarLeather, stratFn: estrategiaCompletaLeather },
  { path: 'metal', calcFn: processarMetal, stratFn: estrategiaCompletaMetal },
];

for (const { path, calcFn, stratFn } of refiningRoutes) {
  app.post(
    `/api/${path}/calculate`,
    wrap((req) => calcFn(req.body || {})),
  );
  app.post(
    `/api/${path}/strategy`,
    wrap((req) => stratFn(req.body || {})),
  );
}

/** Hub: top materiais de refino de todos os recursos */
app.post('/api/hub/strategy', wrap((req) => hubStrategy(req.body || {})));

/** Análise de lucro de poções por cidade */
app.post('/api/potions/analyze', wrap((req) => analyzePotions(req.body || {})));

/** Últimas atualizações UTC por item (tier selecionado) — só wood por enquanto */
app.get(
  '/api/wood/schedule/:tier',
  wrap((req) => horariosUtc(req.params.tier)),
);

/** Categorias disponíveis para o analisador de mercado */
app.get('/api/market/categories', async (_req, res) => {
  try {
    const categories = await obterCategoriasDinamicas();
    res.json({ categories });
  } catch (e) {
    const staticCats = Object.keys(CATEGORIAS);
    res.json({ categories: staticCats });
  }
});

/** Arbitragem entre cidades seguras */
app.post(
  '/api/market/opportunities',
  wrap(async (req) => {
    const {
      categoria = 'Consumível',
      offset = 0,
      step = 1500,
      maxIdadeHoras = 168,
      quality = 0,
      usarBuyOrder = false,
      taxaVenda = 6.5,
      tier = 'Todos',
      enchantment = 'Todos',
    } = req.body;

    const resultados = await buscarOportunidades({
      categoria,
      offset,
      step,
      maxIdadeHoras,
      quality,
      usarBuyOrder,
      taxaVenda,
      maxItensProcessar: 999999,
      tier,
      enchantment,
    });
    return { oportunidades: resultados };
  }),
);

/** SSE Streaming de oportunidades de arbitragem */
app.get('/api/market/opportunities/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const {
    categoria = 'Consumível',
    tier = 'Todos',
    enchantment = 'Todos',
    quality = '0',
    maxIdadeHoras = '168',
    taxaVenda = '3',
  } = req.query;

  console.log(
    `[SSE] Stream iniciado: categoria="${categoria}", tier="${tier}", enchantment="${enchantment}"`,
  );

  let closed = false;
  req.on('close', () => {
    closed = true;
  });

  try {
    await buscarOportunidadesStream(
      {
        categoria,
        tier,
        enchantment,
        quality: parseInt(quality) || 0,
        maxIdadeHoras: parseInt(maxIdadeHoras) || 168,
        taxaVenda: parseFloat(taxaVenda) || 6.5,
      },
      (event) => {
        if (closed) return;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
    );
  } catch (err) {
    if (!closed) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    }
    console.error('[SSE] Erro:', err);
  }

  if (!closed) res.end();
});

/** Busca volume diário para uma lista de itens (lazy) */
app.post(
  '/api/market/volume',
  wrap(async (req) => {
    const { itemIds } = req.body || {};
    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return { volumes: {} };
    }
    const ids = itemIds.slice(0, 500);
    const volumes = await buscarVolumeParaItens(ids);
    return { volumes };
  }),
);

/** SSE Streaming de oportunidades para o Mercado Negro */
app.get('/api/blackmarket/opportunities/stream', async (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const { quality = '0', maxIdadeHoras = '24', taxaVenda, premium = 'true' } = req.query;

  console.log('[SSE BM] Stream iniciado');

  let closed = false;
  req.on('close', () => { closed = true; });

  try {
    await buscarOportunidadesBMStream(
      {
        quality: parseInt(quality) || 0,
        maxIdadeHoras: parseInt(maxIdadeHoras) || 24,
        taxaVenda,
        premium: premium !== 'false',
      },
      (event) => {
        if (closed) return;
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      },
    );
  } catch (err) {
    if (!closed) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    }
    console.error('[SSE BM] Erro:', err);
  }

  if (!closed) res.end();
});

/** Melhor opção de compra de equipamento (procura em todas as cidades com custo de teleporte) */
app.post(
  '/api/equipbuy/options',
  wrap(async (req) => {
    const { equipamentoNome, nivelEfetivo, qualidade, cidadeDestino } = req.body || {};
    console.log('[/api/equipbuy/options] Parâmetros:', { equipamentoNome, nivelEfetivo, qualidade, cidadeDestino });
    const resultado = await buscarEquipamentoPorNivelEfetivo({ equipamentoNome, nivelEfetivo, qualidade, cidadeDestino });
    console.log(`[/api/equipbuy/options] direto=${resultado.direto?.length}, encantando=${resultado.encantando?.length}`);
    return resultado;
  }),
);

/** Hierarquia de equipamentos - dados dinâmicos do items.json */
app.get(
  '/api/equipment/hierarchy',
  wrap((_req) => {
    const equipment = getEquipmentData();
    return { equipment };
  }),
);

// ─── Tela do app (quando a pasta frontend/dist já foi gerada) ───
// Assim, rodando no computador, um único programa entrega a tela e os dados.
const PASTA_TELA = fileURLToPath(new URL('../../frontend/dist', import.meta.url));
if (fs.existsSync(path.join(PASTA_TELA, 'index.html'))) {
  app.use(express.static(PASTA_TELA));
  app.get(/^(?!\/api\/).*/, (_req, res) => res.sendFile(path.join(PASTA_TELA, 'index.html')));
}

// Sem código de acesso, só o próprio computador consegue abrir o app.
const HOST = process.env.HOST || (AUTH_ATIVA ? '0.0.0.0' : '127.0.0.1');

app.listen(PORT, HOST, () => {
  console.log('');
  console.log('  Calculadora Albion rodando!');
  console.log(`  Abra no navegador: http://localhost:${PORT}`);
  console.log('  Para fechar, feche esta janela.');
  console.log('');
});
