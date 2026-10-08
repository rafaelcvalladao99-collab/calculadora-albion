import { CATEGORIAS, TIERS, setItemNameCache, setItemWeightCache } from './marketConstants.js';

const ITEM_ID_SOURCE_URL =
  'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/formatted/items.json';
const ITEM_RAW_SOURCE_URL =
  'https://raw.githubusercontent.com/ao-data/ao-bin-dumps/master/items.json';
let ALL_ITEM_IDS_CACHE = null;
let CATEGORIES_CACHE = null;
let SORTED_CATS_CACHE = null;

// ─── Regras de classificação por família de arma ───
const WEAPON_FAMILY_RULES = [
  [/ARCANESTAFF/, 'Cajado Arcano'],
  [/CURSEDSTAFF/, 'Cajado Amaldiçoado'],
  [/FIRESTAFF/, 'Cajado de Fogo'],
  [/FROSTSTAFF/, 'Cajado de Gelo'],
  [/HOLYSTAFF/, 'Cajado Sagrado'],
  [/NATURESTAFF/, 'Cajado da Natureza'],
  [/SHAPESHIFTERSTAFF/, 'Cajado Metamorfo'],
  [/CROSSBOW/, 'Besta'],
  [/BOW/, 'Arco'],
  [/CLAYMORE|DUALSWORD|BROADSWORD|CARVING|SCIMITAR|SWORD/, 'Espada'],
  [/HATCHET|DUALAXE|GREATAXE|AXE/, 'Machado'],
  [/DAGGERPAIR|CLAWPAIR|DAGGER/, 'Adaga'],
  [/POLEHAMMER|HAMMER|MAUL/, 'Martelo'],
  [/KNUCKLES/, 'Luvas de Guerra'],
  [/FLAIL|MORNING|MACE/, 'Maça'],
  [/QUARTERSTAFF|IRONCLADSTAFF|DOUBLEBLADEDSTAFF|TWINSCYTHE|SOULSCYTHE|BLACKMONK/, 'Bordão'],
  [/HALBERD|GLAIVE|TRIDENT|PIKE|SPEAR/, 'Lança'],
];

function classificarArmaFamilia(restName) {
  const upper = restName.toUpperCase();
  for (const [regex, familia] of WEAPON_FAMILY_RULES) {
    if (regex.test(upper)) return familia;
  }
  if (upper.includes('STAFF')) return 'Bordão';
  return null;
}

function addToCat(cats, name, itemId) {
  if (!cats[name]) cats[name] = [];
  cats[name].push(itemId);
}

function construirMapaCategorias(allItems) {
  const cats = { Todos: [] };

  if (!Array.isArray(allItems)) {
    console.warn('[Categories] allItems não é um array!', typeof allItems);
    return cats;
  }

  console.log(`[Categories] Iniciando parse de ${allItems.length} items...`);
  let itemsComUniqueName = 0;
  let itemsComCategoria = 0;

  for (const item of allItems) {
    const uniqueName = String(item.UniqueName || '');
    if (!uniqueName) continue;

    itemsComUniqueName++;
    cats.Todos.push(uniqueName);

    const base = uniqueName.split('@')[0];
    const parts = base.split('_');
    if (parts.length < 2) continue;

    itemsComCategoria++;

    if (!/^T\d$/.test(parts[0])) {
      if (uniqueName.startsWith('UNIQUE_MOUNT')) {
        addToCat(cats, 'Montaria', uniqueName);
        continue;
      }
      if (uniqueName.startsWith('UNIQUE_FURNITUREITEM')) {
        addToCat(cats, 'Mobília', uniqueName);
        continue;
      }
      if (uniqueName.startsWith('UNIQUE_')) {
        addToCat(cats, 'Itens Únicos', uniqueName);
        continue;
      }
      if (uniqueName.startsWith('SKIN_') || uniqueName.startsWith('VANITY_')) {
        addToCat(cats, 'Vaidade', uniqueName);
        continue;
      }
      addToCat(cats, 'Outros', uniqueName);
      continue;
    }

    const isArtefact = parts[1] === 'ARTEFACT';
    let slot, rest;

    if (isArtefact && parts.length >= 3) {
      slot = parts[2];
      rest = parts.slice(3).join('_');
    } else {
      slot = parts[1];
      rest = parts.slice(2).join('_');
    }

    if (isArtefact) {
      if (['MAIN', '2H'].includes(slot)) addToCat(cats, 'Artefato - Armas', uniqueName);
      else if (['HEAD', 'ARMOR', 'SHOES'].includes(slot))
        addToCat(cats, 'Artefato - Armaduras', uniqueName);
      else if (slot === 'OFF') addToCat(cats, 'Artefato - Mão Secundária', uniqueName);
      else if (slot === 'CAPEITEM' || slot === 'CAPE')
        addToCat(cats, 'Artefato - Capas', uniqueName);
      else addToCat(cats, 'Artefato - Outros', uniqueName);
      continue;
    }

    if (rest.includes('GATHERER')) {
      if (slot === 'HEAD') addToCat(cats, 'Equipamento de Coleta - Elmos', uniqueName);
      else if (slot === 'ARMOR') addToCat(cats, 'Equipamento de Coleta - Armaduras', uniqueName);
      else if (slot === 'SHOES') addToCat(cats, 'Equipamento de Coleta - Calçados', uniqueName);
      else if (slot === 'BACKPACK') addToCat(cats, 'Equipamento de Coleta - Mochilas', uniqueName);
      else addToCat(cats, 'Equipamento de Coleta - Outros', uniqueName);
      continue;
    }
    if (
      (slot === 'MAIN' || slot === '2H') &&
      (rest.includes('TOOL') || rest.includes('TRACKING'))
    ) {
      addToCat(cats, 'Equipamento de Coleta - Ferramentas', uniqueName);
      continue;
    }

    if (slot === 'MAIN' || slot === '2H') {
      const familia = classificarArmaFamilia(rest);
      addToCat(cats, `Armas - ${familia || 'Outras'}`, uniqueName);
      continue;
    }

    if (slot === 'ARMOR') {
      if (rest.includes('CLOTH')) addToCat(cats, 'Armadura de Peitoral - Pano', uniqueName);
      else if (rest.includes('LEATHER')) addToCat(cats, 'Armadura de Peitoral - Couro', uniqueName);
      else if (rest.includes('PLATE')) addToCat(cats, 'Armadura de Peitoral - Placa', uniqueName);
      else addToCat(cats, 'Armadura de Peitoral - Outros', uniqueName);
      continue;
    }

    if (slot === 'HEAD') {
      if (rest.includes('CLOTH')) addToCat(cats, 'Armadura de Capacete - Pano', uniqueName);
      else if (rest.includes('LEATHER')) addToCat(cats, 'Armadura de Capacete - Couro', uniqueName);
      else if (rest.includes('PLATE')) addToCat(cats, 'Armadura de Capacete - Placa', uniqueName);
      else addToCat(cats, 'Armadura de Capacete - Outros', uniqueName);
      continue;
    }

    if (slot === 'SHOES') {
      if (rest.includes('CLOTH')) addToCat(cats, 'Armadura de Calçado - Pano', uniqueName);
      else if (rest.includes('LEATHER')) addToCat(cats, 'Armadura de Calçado - Couro', uniqueName);
      else if (rest.includes('PLATE')) addToCat(cats, 'Armadura de Calçado - Placa', uniqueName);
      else addToCat(cats, 'Armadura de Calçado - Outros', uniqueName);
      continue;
    }

    if (slot === 'OFF') {
      addToCat(cats, 'Mão Secundária', uniqueName);
      continue;
    }
    if (slot === 'CAPEITEM' || slot === 'CAPE') {
      addToCat(cats, 'Capas', uniqueName);
      continue;
    }
    if (slot === 'BAG') {
      addToCat(cats, 'Bolsas', uniqueName);
      continue;
    }
    if (slot === 'BACKPACK') {
      addToCat(cats, 'Bolsas - Mochilas', uniqueName);
      continue;
    }
    if (slot === 'MOUNT') {
      addToCat(cats, 'Montaria', uniqueName);
      continue;
    }
    if (slot === 'POTION') {
      addToCat(cats, 'Consumível - Poções', uniqueName);
      continue;
    }
    if (slot === 'MEAL') {
      addToCat(cats, 'Consumível - Refeições', uniqueName);
      continue;
    }
    if (slot === 'FISH') {
      addToCat(cats, 'Consumível - Peixes', uniqueName);
      continue;
    }
    if (slot === 'ALCOHOL') {
      addToCat(cats, 'Consumível - Bebidas', uniqueName);
      continue;
    }

    const fabricacao = [
      'ORE',
      'WOOD',
      'HIDE',
      'FIBER',
      'CLOTH',
      'LEATHER',
      'METALBAR',
      'PLANKS',
      'STONEBLOCK',
      'ROCK',
      'STONE',
    ];
    if (fabricacao.includes(slot)) {
      addToCat(cats, `Fabricação - ${slot}`, uniqueName);
      continue;
    }

    const cultivo = [
      'FARM',
      'SEED',
      'BEAN',
      'HERB',
      'AGARIC',
      'COMFREY',
      'FOXGLOVE',
      'MULLEIN',
      'TEASEL',
      'BURDOCK',
      'YARROW',
      'CARROT',
      'POTATO',
      'CABBAGE',
      'WHEAT',
      'TURNIP',
      'PUMPKIN',
      'CORN',
    ];
    if (cultivo.includes(slot)) {
      addToCat(cats, 'Cultivo', uniqueName);
      continue;
    }

    if (slot === 'FURNITUREITEM') {
      addToCat(cats, 'Mobília', uniqueName);
      continue;
    }
    if (slot === 'SKIN' || slot === 'VANITY' || slot === 'CLOTHING') {
      addToCat(cats, 'Vaidade', uniqueName);
      continue;
    }
    if (slot === 'JOURNAL') {
      addToCat(cats, 'Outros - Diários', uniqueName);
      continue;
    }
    if (slot === 'LABOURER') {
      addToCat(cats, 'Outros - Trabalhadores', uniqueName);
      continue;
    }
    addToCat(cats, `Outros - ${slot}`, uniqueName);
  }

  for (const cat in cats) {
    cats[cat] = [...new Set(cats[cat])];
  }

  const groupAgg = {};
  for (const cat of Object.keys(cats)) {
    if (cat === 'Todos') continue;
    const dashParts = cat.split(' - ');
    if (dashParts.length === 2) {
      const group = dashParts[0];
      if (!groupAgg[group]) groupAgg[group] = [];
      groupAgg[group].push(...cats[cat]);
    }
  }
  for (const [group, items] of Object.entries(groupAgg)) {
    if (!cats[group]) cats[group] = [...new Set(items)];
  }

  const CATEGORY_ORDER = [
    'Todos',
    'Armas',
    'Armadura de Peitoral',
    'Armadura de Capacete',
    'Armadura de Calçado',
    'Mão Secundária',
    'Capas',
    'Bolsas',
    'Montaria',
    'Consumível',
    'Equipamento de Coleta',
    'Fabricação',
    'Artefato',
    'Cultivo',
    'Mobília',
    'Vaidade',
    'Itens Únicos',
    'Outros',
  ];

  const orderIndex = (key) => {
    const mainPart = key.split(' - ')[0];
    const idx = CATEGORY_ORDER.indexOf(mainPart);
    return idx >= 0 ? idx : 999;
  };

  const sortedCats = {};
  Object.keys(cats)
    .sort((a, b) => {
      const oa = orderIndex(a);
      const ob = orderIndex(b);
      if (oa !== ob) return oa - ob;
      return a.localeCompare(b);
    })
    .forEach((key) => {
      sortedCats[key] = cats[key];
    });

  console.log(
    `[Categories] ✓ Parse completo: ${itemsComUniqueName} com UniqueName, ${itemsComCategoria} com categoria`,
  );
  console.log(`[Categories] ✓ Total de categorias criadas: ${Object.keys(sortedCats).length}`);

  return sortedCats;
}

async function carregarPesosDoJogo() {
  try {
    console.log('[Weights] Carregando pesos reais dos itens...');
    const res = await fetch(ITEM_RAW_SOURCE_URL, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`Falha ao buscar raw items (${res.status})`);
    const data = await res.json();
    const items = data?.items;
    if (!items || typeof items !== 'object') throw new Error('Formato inesperado de items.json');

    const weightMap = {};
    for (const [, val] of Object.entries(items)) {
      if (!val || typeof val !== 'object') continue;
      const arr = Array.isArray(val) ? val : [val];
      for (const it of arr) {
        const name = it['@uniquename'];
        const w = it['@weight'];
        if (name && w != null) weightMap[name] = parseFloat(w);
      }
    }
    setItemWeightCache(weightMap);
    console.log(`[Weights] ✓ ${Object.keys(weightMap).length} pesos carregados`);
  } catch (err) {
    console.error('[Weights] ❌ Erro ao carregar pesos:', err.message || err);
  }
}

// De onde veio a lista de itens: 'internet', 'arquivo-local' ou 'reserva-minima'.
let FONTE_ITENS = null;
let PROXIMA_TENTATIVA = 0;
const ITENS_LOCAIS = new URL('../data/items.json', import.meta.url);
const RETENTAR_DOWNLOAD_MS = 10 * 60_000;

export function estadoItens() {
  return { fonte: FONTE_ITENS, total: ALL_ITEM_IDS_CACHE?.length || 0 };
}

async function processarListaDeItens(data) {
  if (!Array.isArray(data) || data.length === 0) throw new Error('Lista de itens vazia ou inválida');

  const ids = [
    ...new Set(data.map((item) => String(item.UniqueName || '')).filter((id) => id.length > 0)),
  ];

  const nameCache = data.reduce((acc, item) => {
    const key = String(item.UniqueName || '');
    const ptName =
      item.LocalizedNames?.['PT-BR'] ||
      item.LocalizedNames?.['pt-BR'] ||
      item.LocalizedNames?.['pt-br'];
    if (key) acc[key] = ptName || item.LocalizedNames?.['EN-US'] || key.replace(/_/g, ' ');
    return acc;
  }, {});
  setItemNameCache(nameCache);
  CATEGORIES_CACHE = construirMapaCategorias(data);
  SORTED_CATS_CACHE = null;
  ALL_ITEM_IDS_CACHE = ids;
  return ids;
}

async function baixarLista() {
  const res = await fetch(ITEM_ID_SOURCE_URL, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`Falha ao baixar a lista de itens (HTTP ${res.status})`);
  return res.json();
}

async function lerListaLocal() {
  const { readFile } = await import('node:fs/promises');
  return JSON.parse(await readFile(ITENS_LOCAIS, 'utf-8'));
}

export async function carregarItensDoJogo() {
  const temListaBoa = ALL_ITEM_IDS_CACHE?.length > 0 && FONTE_ITENS === 'internet';
  const aguardandoRetentar = ALL_ITEM_IDS_CACHE?.length > 0 && Date.now() < PROXIMA_TENTATIVA;
  if (temListaBoa || aguardandoRetentar) return ALL_ITEM_IDS_CACHE;

  // 1) Lista mais nova, direto do repositório da comunidade
  try {
    const ids = await processarListaDeItens(await baixarLista());
    FONTE_ITENS = 'internet';
    console.log(`[Items] ✓ ${ids.length} itens carregados da internet`);
    await carregarPesosDoJogo();
    return ids;
  } catch (err) {
    console.error('[Items] ❌ Não consegui baixar a lista de itens:', err.message || err);
    PROXIMA_TENTATIVA = Date.now() + RETENTAR_DOWNLOAD_MS;
  }

  // 2) Cópia salva no projeto (backend/data/items.json)
  if (FONTE_ITENS === 'arquivo-local' && ALL_ITEM_IDS_CACHE?.length > 0) return ALL_ITEM_IDS_CACHE;
  try {
    const ids = await processarListaDeItens(await lerListaLocal());
    FONTE_ITENS = 'arquivo-local';
    console.warn(`[Items] ⚠️ Usando a cópia local da lista: ${ids.length} itens (pode estar desatualizada)`);
    return ids;
  } catch (err) {
    console.error('[Items] ❌ Cópia local da lista também falhou:', err.message || err);
  }

  // 3) Último recurso: só os itens básicos das categorias fixas
  const bases = Object.entries(CATEGORIAS)
    .filter(([cat]) => cat !== 'Todos')
    .flatMap(([, itens]) => itens);
  ALL_ITEM_IDS_CACHE = [...new Set(bases)].flatMap((b) => TIERS.map((t) => `${t}${b}`));
  FONTE_ITENS = 'reserva-minima';
  console.error(
    `[Items] ❌ Usando reserva mínima de ${ALL_ITEM_IDS_CACHE.length} itens — as buscas vão ficar incompletas`,
  );
  return ALL_ITEM_IDS_CACHE;
}

export async function gerarListaItens(categoria) {
  let lista = [];

  await carregarItensDoJogo();

  console.log(`[gerarListaItens] Solicitado: ${categoria}`);

  if (categoria === 'Todos') {
    if (CATEGORIES_CACHE && CATEGORIES_CACHE['Todos'] && CATEGORIES_CACHE['Todos'].length > 0) {
      lista = CATEGORIES_CACHE['Todos'];
      console.log(`[gerarListaItens] ✓ Usando CATEGORIES_CACHE["Todos"]: ${lista.length} itens`);
    } else {
      lista = ALL_ITEM_IDS_CACHE || [];
      console.log(`[gerarListaItens] ⚠️ Usando ALL_ITEM_IDS_CACHE: ${lista.length} itens`);
    }
  } else if (
    CATEGORIES_CACHE &&
    CATEGORIES_CACHE[categoria] &&
    CATEGORIES_CACHE[categoria].length > 0
  ) {
    lista = CATEGORIES_CACHE[categoria];
    console.log(
      `[gerarListaItens] ✓ Usando CATEGORIES_CACHE["${categoria}"]: ${lista.length} itens`,
    );
  } else {
    const bases = CATEGORIAS[categoria] || [];
    lista = bases.flatMap((b) => TIERS.map((t) => `${t}${b}`));
    console.log(
      `[gerarListaItens] ⚠️ Fallback estático para "${categoria}": ${lista.length} itens`,
    );
  }

  const result = [...new Set(lista)];
  console.log(
    `[gerarListaItens] Retornando ${result.length} items únicos para categoria "${categoria}"`,
  );
  return result;
}

export async function obterCategoriasDinamicas() {
  await carregarItensDoJogo();

  if (SORTED_CATS_CACHE) return SORTED_CATS_CACHE;

  if (CATEGORIES_CACHE && Object.keys(CATEGORIES_CACHE).length > 0) {
    // construirMapaCategorias já insere em ordem; Object.keys preserva insertion order no V8
    SORTED_CATS_CACHE = Object.keys(CATEGORIES_CACHE);
    console.log(`[Categories] ✓ Retornando ${SORTED_CATS_CACHE.length} categorias dinâmicas`);
    return SORTED_CATS_CACHE;
  }

  console.log(`[Categories] ⚠️ Usando fallback para categorias estáticas`);
  return Object.keys(CATEGORIAS);
}
