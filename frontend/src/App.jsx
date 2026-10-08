import { useEffect, lazy, Suspense, useState } from 'react';
import { Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import ResourceMaster from './components/ResourceMaster.jsx';
import LoginGate from './components/LoginGate.jsx';
import { loadEquipmentHierarchy } from './data/equipmentHierarchy.js';
import { authRequired } from './api.js';
import {
  calculateWood, strategyWood,
  calculateFiber, strategyFiber,
  calculateLeather, strategyLeather,
  calculateMetal, strategyMetal,
} from './api.js';
import { ICONS } from './components/Icons.jsx';
import './App.css';

const MarketAnalyzer  = lazy(() => import('./components/MarketAnalyzer.jsx'));
const BlackMarketAnalyzer = lazy(() => import('./components/BlackMarketAnalyzer.jsx'));
const EquipBuy        = lazy(() => import('./components/EquipBuy.jsx'));
const RefinementHub   = lazy(() => import('./components/RefinementHub.jsx'));
const PotionAnalyzer  = lazy(() => import('./components/PotionAnalyzer.jsx'));

// ─── Nav structure ────────────────────────────────────────────────────────
const NAV_TOP = [
  { id: 'hub', path: '/hub', label: 'Hub', iconKey: 'dashboard' },
];
const NAV_REFINERS = [
  { id: 'wood',    path: '/wood',    label: 'Madeira', iconKey: 'trees'  },
  { id: 'fiber',   path: '/fiber',   label: 'Tecido',  iconKey: 'ripple' },
  { id: 'leather', path: '/leather', label: 'Couro',   iconKey: 'shield' },
  { id: 'metal',   path: '/metal',   label: 'Minério', iconKey: 'hammer' },
];
const NAV_MARKET = [
  // { id: 'market',      path: '/market',      label: 'Market Analyzer', iconKey: 'candle' },
  { id: 'blackmarket', path: '/blackmarket', label: 'Black Market',    iconKey: 'skull'  },
  { id: 'equipbuy',    path: '/equipbuy',    label: 'Equip Buy',       iconKey: 'sword'  },
  { id: 'potions',     path: '/potions',     label: 'Poções',          iconKey: 'flask'  },
];

const ALL_NAV = [...NAV_TOP, ...NAV_REFINERS, ...NAV_MARKET];

function labelForPath(pathname) {
  const match = ALL_NAV.find(n => pathname === n.path || pathname.startsWith(n.path + '/'));
  return match?.label ?? 'Hub';
}

// ─── Sidebar ──────────────────────────────────────────────────────────────
function Sidebar({ expanded, onToggle }) {
  return (
    <aside className={`sb ${expanded ? 'sb-open' : 'sb-closed'}`}>
      {/* Logo block */}
      <div className="sb-logo">
        <div className="sb-logo-mark">
          {/* Diamond/anvil glyph */}
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.5"
               strokeLinecap="round" strokeLinejoin="round"
               style={{ display: 'block' }}>
            <path d="M3 9l9-6 9 6-9 12z"/>
            <path d="M3 9h18"/>
          </svg>
        </div>
        <div className="sb-logo-text" aria-hidden={!expanded}>
          <div className="sb-logo-line1">
            <span className="sb-logo-word">Calculadora</span>
            <span className="sb-logo-cinzel">Albion</span>
          </div>
          <div className="sb-logo-sub">Refino e Mercado</div>
        </div>
      </div>

      <nav className="sb-nav">
        {NAV_TOP.map(item => (
          <NavItem key={item.id} item={item} expanded={expanded} />
        ))}

        <div className="sb-divider" />
        <div className="sb-section" style={{ opacity: expanded ? 1 : 0 }}>Refino</div>
        {NAV_REFINERS.map(item => (
          <NavItem key={item.id} item={item} expanded={expanded} />
        ))}

        <div className="sb-divider" />
        <div className="sb-section" style={{ opacity: expanded ? 1 : 0 }}>Mercado</div>
        {NAV_MARKET.map(item => (
          <NavItem key={item.id} item={item} expanded={expanded} />
        ))}
      </nav>

      <div className="sb-foot">
        <button
          className="sb-toggle"
          onClick={onToggle}
          aria-label={expanded ? 'Recolher menu' : 'Expandir menu'}
          title={`${expanded ? 'Recolher' : 'Expandir'} menu (Ctrl+B)`}
        >
          {expanded
            ? <ICONS.chevronLeft size={16} />
            : <ICONS.chevronRight size={16} />}
          {expanded && <span className="sb-label">Recolher</span>}
          {expanded && <kbd className="sb-kbd">⌃ B</kbd>}
        </button>
      </div>
    </aside>
  );
}

function NavItem({ item, expanded }) {
  const Icon = ICONS[item.iconKey];
  return (
    <NavLink
      to={item.path}
      title={!expanded ? item.label : undefined}
      className={({ isActive }) =>
        ['sb-item', isActive ? 'sb-item-active sb-active-hairline' : '']
          .filter(Boolean).join(' ')
      }
    >
      <span className="sb-icon"><Icon size={18} /></span>
      <span className="sb-label">{item.label}</span>
    </NavLink>
  );
}

// ─── Top bar ──────────────────────────────────────────────────────────────
function TopBar() {
  const location = useLocation();
  const title = labelForPath(location.pathname);
  return (
    <header className="tb">
      <div className="tb-crumbs">
        <span className="tb-crumb-muted">Calculadora</span>
        <span className="tb-crumb-sep"><ICONS.slash size={14} /></span>
        <span className="tb-crumb-current">{title}</span>
      </div>
    </header>
  );
}

// ─── Suspense fallback ────────────────────────────────────────────────────
const fallback = <p className="hub-loading-hint">Carregando…</p>;

// ─── App root ─────────────────────────────────────────────────────────────
export default function App() {
  const [authenticated, setAuthenticated] = useState(
    () => sessionStorage.getItem('albion_token') != null,
  );
  const [equipmentReady, setEquipmentReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Rodando no computador sem código de acesso, o servidor avisa que não precisa de senha.
  useEffect(() => {
    if (authenticated) return;
    authRequired()
      .then((r) => { if (r && r.required === false) setAuthenticated(true); })
      .catch(() => {});
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    loadEquipmentHierarchy()
      .then(() => {
        console.log('✓ Equipamentos carregados');
        setEquipmentReady(true);
      })
      .catch(err => {
        console.error('Erro ao carregar equipamentos:', err);
        setEquipmentReady(true);
      });
  }, [authenticated]);

  // Ctrl/⌘ + B toggles sidebar
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setSidebarOpen(x => !x);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!authenticated) {
    return <LoginGate onSuccess={() => setAuthenticated(true)} />;
  }

  return (
    <div className="app">
      <Sidebar expanded={sidebarOpen} onToggle={() => setSidebarOpen(x => !x)} />
      <main className="main">
        <TopBar />
        <div className="page">
          <Suspense fallback={fallback}>
            <Routes>
              <Route path="/" element={<Navigate to="/hub" replace />} />
              <Route path="/hub" element={<RefinementHub />} />
              <Route path="/wood"    element={<ResourceMaster resource="wood"    calculateFn={calculateWood}    strategyFn={strategyWood}    />} />
              <Route path="/fiber"   element={<ResourceMaster resource="fiber"   calculateFn={calculateFiber}   strategyFn={strategyFiber}   />} />
              <Route path="/leather" element={<ResourceMaster resource="leather" calculateFn={calculateLeather} strategyFn={strategyLeather} />} />
              <Route path="/metal"   element={<ResourceMaster resource="metal"   calculateFn={calculateMetal}   strategyFn={strategyMetal}   />} />
              <Route path="/market"      element={<MarketAnalyzer />} />
              <Route path="/blackmarket" element={<BlackMarketAnalyzer />} />
              <Route
                path="/equipbuy"
                element={
                  equipmentReady
                    ? <EquipBuy />
                    : <p className="hub-loading-hint">Carregando base de dados de equipamentos…</p>
                }
              />
              <Route path="/potions" element={<PotionAnalyzer />} />
              <Route path="*" element={<Navigate to="/hub" replace />} />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  );
}
