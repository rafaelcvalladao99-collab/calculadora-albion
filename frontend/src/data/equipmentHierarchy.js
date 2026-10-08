import { authHeaders } from '../api.js';
/**
 * Hierarquia de equipamentos - CARREGADO DINAMICAMENTE
 * Dados são obtidos de /api/equipment/hierarchy do backend
 * que lê items.json em tempo de execução
 * 
 * Fallback com dados padrão caso o backend não responda
 */

// Dados padrão (fallback se o backend não responder)
export const EQUIPMENT_HIERARCHY_FALLBACK = {
  Arma: {
    label: 'Arma',
    types: {
      Espada: ['Espada', 'Espada Longa', 'Espada de Guerra'],
      Arco: ['Arco', 'Arco Longo', 'Arco de Guerra', 'Arco Sussurrante'],
      Besta: ['Besta', 'Besta Arcana', 'Besta de Fogo', 'Besta de Gelo'],
      Machado: ['Machado', 'Machado de Mão', 'Machado Duplo'],
      Maça: ['Maça', 'Maça de Cura'],
      Martelo: ['Martelo', 'Martelo Duplo'],
      Foice: ['Foice', 'Foice Longa'],
      Lança: ['Lança', 'Lança de Guerra'],
      'Lança/Halberd': ['Halberd', 'Pike'],
      Adaga: ['Adaga', 'Adaga Dupla'],
      Bastão: ['Bastão', 'Cetro'],
      'Bastão Sagrado': ['Bastão Sagrado'],
      'Bastão da Natureza': ['Bastão da Natureza'],
      'Bastão Amaldiçoado': ['Bastão Amaldiçoado'],
      'Bastão de Fogo': ['Bastão de Fogo'],
      'Bastão de Gelo': ['Bastão de Gelo'],
      'Bastão Arcano': ['Bastão Arcano'],
      'Luvas de Guerra': ['Luvas', 'Punhos'],
      Escudo: ['Escudo'],
      Transformação: ['Transformação'],
      Artefato: ['Artefato'],
      Tocha: ['Tocha'],
    }
  },
  Topo: {
    label: 'Topo (Capacete)',
    types: {
      Pano: ['Capuz de Pano', 'Capuz de Mago', 'Capuz de Assassino'],
      Couro: ['Capacete de Couro', 'Capuz de Caçador', 'Máscara de Couro'],
      Placa: ['Elmo de Placa', 'Elmo de Soldado', 'Coroa de Placa'],
    }
  },
  Armadura: {
    label: 'Armadura (Peitoral)',
    types: {
      Pano: ['Robe de Pano', 'Robe de Clérigo', 'Robe de Mago'],
      Couro: ['Armadura de Couro', 'Jaqueta de Couro', 'Colete de Couro'],
      Placa: ['Armadura de Placa', 'Armadura de Soldado', 'Torso de Placa'],
    }
  },
  Bota: {
    label: 'Bota (Calçado)',
    types: {
      Pano: ['Sapatos de Pano', 'Botas de Mago', 'Sapatos de Clérigo'],
      Couro: ['Botas de Couro', 'Sapatos de Caçador', 'Sapatos de Caçador Leve'],
      Placa: ['Botas de Placa', 'Botas de Soldado', 'Botas de Guardião'],
    }
  },
  Capa: {
    label: 'Capa',
    types: {
      Cidade: [
        'Capa de Bridgewatch',
        'Capa de Caerleon',
        'Capa de Fort Sterling',
        'Capa de Lymhurst',
        'Capa de Martlock',
        'Capa de Thetford',
        'Capa de Brecilien',
      ],
      Facção: [
        'Capa dos Hereges',
        'Capa dos Mortos-vivos',
        'Capa dos Protetores',
        'Capa de Morgana',
        'Capa Avaloniana',
        'Capa do Demônio',
        'Capa do Contrabandista',
      ],
      Normal: ['Capa'],
    }
  }
};

// Será preenchido dinamicamente ao carregar
export let EQUIPMENT_HIERARCHY = { ...EQUIPMENT_HIERARCHY_FALLBACK };

const LS_KEY = 'albion-equipment-hierarchy-v1';
const LS_TTL = 60 * 60 * 1000; // 1 hora

function loadFromCache() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts < LS_TTL) return data;
    localStorage.removeItem(LS_KEY);
  } catch { /* ignore */ }
  return null;
}

function saveToCache(data) {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ts: Date.now(), data })); } catch { /* ignore */ }
}

/**
 * Carrega hierarquia de equipamentos do backend (com cache localStorage de 1h)
 * Chamado ao inicializar a aplicação no App.jsx
 */
export async function loadEquipmentHierarchy() {
  const cached = loadFromCache();
  if (cached) {
    EQUIPMENT_HIERARCHY = cached;
    console.log('✓ Hierarquia de equipamentos carregada do cache local');
    return EQUIPMENT_HIERARCHY;
  }

  try {
    const raw = import.meta.env.VITE_API_BASE;
    const base = raw == null || raw === '' ? '' : String(raw).trim().replace(/\/+$/, '');
    const response = await fetch(`${base}/api/equipment/hierarchy`, { headers: authHeaders() });

    if (!response.ok) {
      console.warn(`⚠️  Erro ao carregar hierarquia (${response.status}), usando fallback`);
      return EQUIPMENT_HIERARCHY;
    }

    const data = await response.json();

    if (data.equipment && typeof data.equipment === 'object') {
      EQUIPMENT_HIERARCHY = data.equipment;
      saveToCache(data.equipment);
      console.log('✓ Hierarquia de equipamentos carregada do backend');
    } else {
      console.warn('⚠️  Formato inválido de resposta, usando fallback');
    }

    return EQUIPMENT_HIERARCHY;

  } catch (error) {
    console.error('❌ Erro ao carregar hierarquia:', error);
    return EQUIPMENT_HIERARCHY;
  }
}

/**
 * Níveis de qualidade dos itens baseado em ao-bin-dumps
 * @0 = Normal, @1 = Bom, @2 = Excepcional, @3 = Excelente, @4 = Obra-prima
 */
export const QUALITY_LEVELS = [
  { value: '0', label: 'Normal', suffix: '' },
  { value: '1', label: 'Bom', suffix: '@1' },
  { value: '2', label: 'Excepcional', suffix: '@2' },
  { value: '3', label: 'Excelente', suffix: '@3' },
  { value: '4', label: 'Obra-prima', suffix: '@4' },
];

/**
 * Mapeamento detalhado de código → nome para equipamentos
 * Usando padrões baseados em ao-bin-dumps
 */
export const EQUIPMENT_CODE_MAP = {
  // Armas - 2H
  Espada: ['SWORD', 'GREATSWORD'],
  Arco: ['BOW', 'LONGBOW'],
  Besta: ['CROSSBOW'],
  Machado: ['BATTLEAXE', 'HATCHET'],
  'Dois Machados': ['DUALAXE', 'DUALAXE_KEEPER'],
  Maça: ['MACE', 'CLUB'],
  Foice: ['SCYTHE'],
  'Lança/Halberd': ['PIKE', 'HALBERD'],
  
  // Armas - MAIN (mão primária)
  Adaga: ['DAGGER'],
  
  // Armaduras
  Pano: ['CLOTH', 'MAGEROBES', 'CLOTHROBES'],
  Couro: ['LEATHER', 'LEATHERARMOR'],
  Placa: ['PLATE', 'PLATEARMOR', 'SOLDIERARMOR'],
  
  // Capas
  Normal: ['CAPE', 'CAPEITEM'],
  'Facção FW': ['CAPEITEM_FW'],
};

/**
 * Função para obter o tipo de slot baseado no equipamento selecionado
 */
export function getSlotForEquipment(equipment) {
  const mapping = {
    Arma: ['MAIN', '2H'],
    Topo: ['HEAD'],
    Armadura: ['ARMOR'],
    Bota: ['SHOES'],
    Capa: ['CAPEITEM', 'CAPE'],
  };
  return mapping[equipment] || [];
}

/**
 * Função para obter variantes de um equipamento
 * baseadas na categoria e tipo
 */
export function getVariantsForEquipmentType(equipment, type) {
  if (!EQUIPMENT_HIERARCHY[equipment]) return [];
  return EQUIPMENT_HIERARCHY[equipment].types[type] || [];
}

/**
 * Obtém todos os tipos disponíveis para um equipamento
 */
export function getTypesForEquipment(equipment) {
  if (!EQUIPMENT_HIERARCHY[equipment]) return [];
  return Object.keys(EQUIPMENT_HIERARCHY[equipment].types);
}

/**
 * Obtém todas as categorias de equipamento
 */
export function getAllEquipmentCategories() {
  return Object.keys(EQUIPMENT_HIERARCHY);
}

/**
 * Obtém todos os níveis de qualidade disponíveis
 */
export function getAllQualityLevels() {
  return QUALITY_LEVELS;
}
