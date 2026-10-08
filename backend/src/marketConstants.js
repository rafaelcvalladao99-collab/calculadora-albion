// Mapa de vizinhança entre cidades (true = vizinhas, custo simples)
// Anel: FS ↔ Lymhurst ↔ BW ↔ Martlock ↔ Thetford ↔ FS
// Brecilien e Caerleon nunca são vizinhas de ninguém.
export const CITY_NEIGHBORS = {
  Bridgewatch: new Set(['Lymhurst', 'Martlock']),
  FortSterling: new Set(['Thetford', 'Lymhurst']),
  Lymhurst: new Set(['FortSterling', 'Bridgewatch']),
  Martlock: new Set(['Bridgewatch', 'Thetford']),
  Thetford: new Set(['Martlock', 'FortSterling']),
  Brecilien: new Set(),
  Caerleon: new Set(),
};

// Taxa por kg de peso do item (prata por kg, para cidades vizinhas).
// Cidades não-vizinhas pagam 2× essa taxa.
const TELEPORT_RATE_PER_KG = 173.4;
const TELEPORT_MIN_NEIGHBOR = 92;
const TELEPORT_MIN_FAR = 184;

// ─── Cache de pesos reais (preenchido via setItemWeightCache) ───
let ITEM_WEIGHT_CACHE = {};

export function setItemWeightCache(map) {
  ITEM_WEIGHT_CACHE = map;
}

export function obterPesoReal(itemId) {
  // Tenta com o ID exato (inclui @enchant)
  if (ITEM_WEIGHT_CACHE[itemId] != null) return ITEM_WEIGHT_CACHE[itemId];
  // Tenta sem enchant (base weight)
  const base = itemId.split('@')[0];
  if (ITEM_WEIGHT_CACHE[base] != null) return ITEM_WEIGHT_CACHE[base];
  return 1.0; // fallback conservador
}

// ─── Taxas do mercado (em %) ───
// Vender direto para uma ordem de compra paga só a taxa de venda.
// Anunciar uma ordem de venda paga a taxa de venda + a taxa de anúncio.
export const TAXA_VENDA_PREMIUM = 4;
export const TAXA_VENDA_SEM_PREMIUM = 8;
export const TAXA_ANUNCIO = 2.5;

/** Taxa (%) para vender direto a uma ordem de compra, como no Mercado Negro. */
export function taxaVendaDireta(premium = true) {
  return premium ? TAXA_VENDA_PREMIUM : TAXA_VENDA_SEM_PREMIUM;
}

export const QUALITY_NAMES = {
  1: 'Normal',
  2: 'Bom',
  3: 'Excepcional',
  4: 'Excelente',
  5: 'Obra-prima',
};

export const CATEGORIAS = {
  Todos: [],
  Armas: [
    '_MAIN_BLOODLETTER',
    '_MAIN_DAGGER',
    '_MAIN_SWORD',
    '_MAIN_MACE',
    '_MAIN_AXE',
    '_MAIN_HAMMER',
    '_MAIN_SPEAR',
    '_MAIN_STAFF',
    '_MAIN_CURSEDSTAFF',
    '_MAIN_NATURESTAFF',
    '_MAIN_FIRESTAFF',
    '_MAIN_FROSTSTAFF',
    '_MAIN_HOLYSTAFF',
    '_2H_BOW',
    '_2H_CROSSBOW',
    '_2H_CARVINGSWORD',
    '_2H_GREATAXE',
    '_2H_MAUL',
    '_2H_HALBERD',
    '_2H_PIKE',
    '_2H_DUALAXE_KEEPER',
    '_2H_DUALAXE',
    '_2H_MACE',
    '_RANGED_BOW',
    '_RANGED_CROSSBOW',
  ],
  'Armaduras de Peitoral': [
    '_BODY_CLERICROBE',
    '_BODY_ASSASSINJACKET',
    '_BODY_SOLDIERARMOR',
    '_BODY_MAGE',
    '_BODY_CLOTHROBES',
    '_BODY_LEATHERARMOR',
    '_BODY_PLATEARMOR',
    '_BODY_CLOTH',
    '_BODY_LEATHER',
    '_BODY_PLATE',
  ],
  'Armaduras de Cabeça': [
    '_HEAD_HUNTER',
    '_HEAD_CLERICHOOD',
    '_HEAD_SOLDIERHELMET',
    '_HEAD_MAGE',
    '_HEAD_CLOTH',
    '_HEAD_LEATHER',
    '_HEAD_PLATE',
  ],
  'Armaduras de Calçado': [
    '_SHOES_SOLDIERBOOTS',
    '_SHOES_ASSASSINSHOES',
    '_SHOES_CLERICSHOES',
    '_SHOES_CLOTH',
    '_SHOES_LEATHER',
    '_SHOES_PLATE',
  ],
  'Mão Secundária': [
    '_SHIELD_TOWER',
    '_SHIELD_KITE',
    '_SHIELD_ROUND',
    '_OFF_DAGGER',
    '_OFF_SHIELD',
  ],
  Capas: [
    '_CAPE',
    '_CAPEITEM_FW_LYMHURST',
    '_CAPEITEM_FW_FORTSTERLING',
    '_CAPEITEM_FW_MARTLOCK',
    '_CAPEITEM_FW_THETFORD',
    '_CAPEITEM_FW_BRIDGEWATCH',
    '_CAPEITEM_FW_CAERLEON',
    '_CAPEITEM_FW_BRECILIEN',
    '_CAPEITEM_FW_HERETICS',
    '_CAPEITEM_FW_UNDEAD',
    '_CAPEITEM_FW_KEEPER',
    '_CAPEITEM_FW_MORGANA',
    '_CAPEITEM_AVALON',
    '_CAPEITEM_FW_DEMON',
    '_CAPEITEM_FW_SMUGGLER',
  ],
  Bolsas: ['_BAG_SMALL', '_BAG_MEDIUM', '_BAG_LARGE', '_BAG'],
  Montarias: [
    '_MOUNT_HORSE',
    '_MOUNT_OX',
    '_MOUNT_SWIFTCLAW',
    '_MOUNT_STAG',
    '_MOUNT_RAM',
    '_MOUNT_MOOSE',
  ],
  Consumível: [
    '_POTION_HEAL',
    '_POTION_ENERGY',
    '_POTION_POWER',
    '_POTION_FORCE',
    '_MEAL_STEAK',
    '_MEAL_OMELETTE',
    '_MEAL_STEW',
    '_MEAL_PIE',
    '_MEAL_BREAD',
    '_MEAL_CHEESE',
    '_DRINK_WATER',
    '_DRINK_BEER',
    '_SPICE_SUGAR',
    '_SPICE_SALT',
    '_SPICE_HERB',
  ],
  'Equipamento de Coleta': [
    '_ORE_COPPER',
    '_ORE_TIN',
    '_ORE_IRON',
    '_ORE_STEEL',
    '_ORE_TITANIUM',
    '_WOOD_BIRCH',
    '_WOOD_OAK',
    '_WOOD_ASHWOOD',
    '_WOOD_IRONWOOD',
    '_WOOD_EBONWOOD',
    '_LEATHER_THIN',
    '_LEATHER_THICK',
    '_CLOTH_LINEN',
    '_CLOTH_CLOTH',
    '_CLOTH_SILK',
  ],
  Fabricação: ['_PLANKS', '_METAL', '_HIDE', '_FABRIC', '_NAILS', '_SCREWS', '_BOLTS', '_HINGES'],
  Artefatos: [
    '_RUNE_AIR',
    '_RUNE_FIRE',
    '_RUNE_FROST',
    '_RUNE_HOLY',
    '_RUNE_NATURE',
    '_RUNE_ARCANE',
    '_SOUL_',
    '_RELIC_',
  ],
  Cultivo: ['_FISH_', '_HERB_'],
  Mobília: ['_MOBILITY_'],
  Vaidade: ['_CLOTHING_'],
  Outros: ['_BOOK_', '_SCROLL_', '_CRYSTAL_'],
};

export const CIDADES_SEGURAS = [
  'Bridgewatch',
  'Caerleon',
  'FortSterling',
  'Lymhurst',
  'Martlock',
  'Thetford',
  'Brecilien',
];

export const TIERS = ['T4', 'T5', 'T6', 'T7', 'T8'];

// ─── Helpers ───

let ITEM_NAME_PT_BR_CACHE = null;

export function setItemNameCache(cache) {
  ITEM_NAME_PT_BR_CACHE = cache;
}

export function nomeItemEmPortugues(itemId) {
  if (ITEM_NAME_PT_BR_CACHE && ITEM_NAME_PT_BR_CACHE[itemId]) {
    return ITEM_NAME_PT_BR_CACHE[itemId];
  }
  return itemId.replace(/^T[4-8]_/, '').replace(/_/g, ' ');
}

export function extrairInfoItem(itemId) {
  const tier = itemId.startsWith('T') ? itemId.slice(0, 2) : '?';
  let encanto = '0';
  if (itemId.includes('@')) {
    const parts = itemId.split('@');
    encanto = parts[parts.length - 1] || '0';
  }
  return { tier, encanto };
}

const RESOURCE_OR_JOURNAL_RE = /JOURNAL_|_ORE|_WOOD|_HIDE|_FIBER|_ROCK|_PLANKS|_METALBAR|_CLOTH|_LEATHER|_STONEBLOCK/;

function isResourceOrJournal(itemId) {
  return RESOURCE_OR_JOURNAL_RE.test(itemId.toUpperCase());
}

export function calcularCustoTeleporte(itemId, cidadeOrigem, cidadeDestino) {
  if (cidadeOrigem === 'Caerleon' || cidadeDestino === 'Caerleon') return 0;
  const peso = obterPesoReal(itemId);
  const multiplicadorCarga = isResourceOrJournal(itemId) ? 2.25 : 1;
  const pesoEfetivo = peso * multiplicadorCarga;
  const vizinha = CITY_NEIGHBORS[cidadeOrigem]?.has(cidadeDestino) ?? false;
  if (vizinha) {
    return Math.max(TELEPORT_MIN_NEIGHBOR, Math.floor(pesoEfetivo * TELEPORT_RATE_PER_KG));
  }
  return Math.max(TELEPORT_MIN_FAR, Math.floor(pesoEfetivo * TELEPORT_RATE_PER_KG * 2));
}
