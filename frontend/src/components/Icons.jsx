// Icons.jsx — Inline SVG icon components matching design/icons.jsx.
// Exported as named components and as an ICONS map for convenience.

const SvgBase = ({ children, size = 20 }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size}
       viewBox="0 0 24 24" fill="none" stroke="currentColor"
       strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
       style={{ display: 'block', flexShrink: 0 }}>
    {children}
  </svg>
);

export const IconDashboard = (p) => (
  <SvgBase {...p}>
    <path d="M4 4h6v8H4z"/><path d="M14 4h6v4h-6z"/>
    <path d="M14 12h6v8h-6z"/><path d="M4 16h6v4H4z"/>
  </SvgBase>
);

export const IconTrees = (p) => (
  <SvgBase {...p}>
    <path d="M12 3l4 6h-2.5l3 5H13v3h-2v-3H7.5l3-5H8z"/>
    <path d="M12 17v4"/>
    <path d="M18 12l2 3h-1l1.5 3H17v2"/>
  </SvgBase>
);

export const IconRipple = (p) => (
  <SvgBase {...p}>
    <path d="M3 7c2 -2 4 -2 6 0s4 2 6 0s4 -2 6 0"/>
    <path d="M3 12c2 -2 4 -2 6 0s4 2 6 0s4 -2 6 0"/>
    <path d="M3 17c2 -2 4 -2 6 0s4 2 6 0s4 -2 6 0"/>
  </SvgBase>
);

export const IconShield = (p) => (
  <SvgBase {...p}>
    <path d="M12 3l8 3v6c0 4.5 -3.5 7.5 -8 9c-4.5 -1.5 -8 -4.5 -8 -9V6z"/>
  </SvgBase>
);

export const IconHammer = (p) => (
  <SvgBase {...p}>
    <path d="M11.414 10l-7.383 7.418a2 2 0 0 0 2.829 2.829l7.418 -7.383"/>
    <path d="M18.121 15.293l2.586 -2.586a1 1 0 0 0 0 -1.414l-7.586 -7.586a1 1 0 0 0 -1.414 0l-2.586 2.586a1 1 0 0 0 0 1.414l7.586 7.586a1 1 0 0 0 1.414 0z"/>
  </SvgBase>
);

export const IconCandle = (p) => (
  <SvgBase {...p}>
    <path d="M6 4v3"/><path d="M6 13v7"/><rect x="4" y="7" width="4" height="6" rx="1"/>
    <path d="M14 4v5"/><path d="M14 15v5"/><rect x="12" y="9" width="4" height="6" rx="1"/>
  </SvgBase>
);

export const IconSkull = (p) => (
  <SvgBase {...p}>
    <path d="M12 3a8 8 0 0 1 8 8c0 2.5 -1 4.5 -2.5 6L17 20H7l-.5 -3C5 15.5 4 13.5 4 11a8 8 0 0 1 8 -8z"/>
    <circle cx="9" cy="12" r="1.2"/><circle cx="15" cy="12" r="1.2"/>
    <path d="M10 17l.5 -2M14 17l-.5 -2M12 15.5l0 1.5"/>
  </SvgBase>
);

export const IconSword = (p) => (
  <SvgBase {...p}>
    <path d="M14.5 17.5l4.5 4.5l2 -2l-4.5 -4.5"/>
    <path d="M12 15l-1.5 1.5l3 3L15 18"/>
    <path d="M21 3h-4l-9.5 9.5l3.5 3.5L20.5 7z"/>
    <path d="M5 13l4 4"/><path d="M3 15l4 4"/>
  </SvgBase>
);

export const IconFlask = (p) => (
  <SvgBase {...p}>
    <path d="M9 3h6"/><path d="M10 3v6.5L4.5 17.5A2 2 0 0 0 6.2 20.5h11.6a2 2 0 0 0 1.7 -3l-5.5 -8V3"/>
    <path d="M6.5 14h11"/>
  </SvgBase>
);

export const IconChevronLeft = (p) => (
  <SvgBase {...p}><path d="M15 6l-6 6l6 6"/></SvgBase>
);

export const IconChevronRight = (p) => (
  <SvgBase {...p}><path d="M9 6l6 6l-6 6"/></SvgBase>
);

export const IconChevronDown = (p) => (
  <SvgBase {...p}><path d="M6 9l6 6l6 -6"/></SvgBase>
);

export const IconMenu = (p) => (
  <SvgBase {...p}>
    <path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>
  </SvgBase>
);

export const IconAlert = (p) => (
  <SvgBase {...p}>
    <path d="M12 9v4"/><path d="M12 17h.01"/>
    <path d="M10.4 3.9L2.6 17.5A1.8 1.8 0 0 0 4.2 20h15.6a1.8 1.8 0 0 0 1.6-2.5L13.6 3.9a1.8 1.8 0 0 0-3.2 0z"/>
  </SvgBase>
);

export const IconSlash = (p) => (
  <SvgBase {...p}><path d="M16 4l-8 16"/></SvgBase>
);

export const IconSearch = (p) => (
  <SvgBase {...p}>
    <circle cx="10.5" cy="10.5" r="6.5"/><path d="M21 21l-5.6 -5.6"/>
  </SvgBase>
);

export const IconRefresh = (p) => (
  <SvgBase {...p}>
    <path d="M20 11a8 8 0 1 0 -2.5 6"/>
    <path d="M20 5v6h-6"/>
  </SvgBase>
);

export const IconCheck = (p) => (
  <SvgBase {...p}><path d="M5 12l5 5l9 -10"/></SvgBase>
);

export const IconArrowDown = (p) => (
  <SvgBase {...p}><path d="M12 5v14M6 13l6 6l6 -6"/></SvgBase>
);

export const IconArrowUp = (p) => (
  <SvgBase {...p}><path d="M12 19V5M6 11l6 -6l6 6"/></SvgBase>
);

export const IconLock = (p) => (
  <SvgBase {...p}>
    <rect x="5" y="11" width="14" height="10" rx="2"/>
    <path d="M8 11V8a4 4 0 0 1 8 0v3"/>
  </SvgBase>
);

export const IconFlag = (p) => (
  <SvgBase {...p}>
    <path d="M5 4v17"/>
    <path d="M5 4h11l-2 4l2 4H5"/>
  </SvgBase>
);

export const IconBuilding = (p) => (
  <SvgBase {...p}>
    <path d="M4 20h16"/><path d="M6 20V8l6 -4l6 4v12"/>
    <path d="M10 12h1M14 12h1M10 16h1M14 16h1"/>
  </SvgBase>
);

export const IconX = (p) => (
  <SvgBase {...p}><path d="M6 6l12 12M18 6l-12 12"/></SvgBase>
);

export const IconPlus = (p) => (
  <SvgBase {...p}><path d="M12 5v14M5 12h14"/></SvgBase>
);

export const IconInfo = (p) => (
  <SvgBase {...p}>
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 8h.01"/><path d="M11 12h1v4h1"/>
  </SvgBase>
);

export const IconBolt = (p) => (
  <SvgBase {...p}>
    <path d="M13 3L4 14h7l-1 7l9 -11h-7z"/>
  </SvgBase>
);

export const IconStar = (p) => (
  <SvgBase {...p}>
    <path d="M12 3l2.5 5.5l6 .8l-4.5 4.2l1.2 6l-5.2 -3l-5.2 3l1.2 -6l-4.5 -4.2l6 -.8z"/>
  </SvgBase>
);

export const IconHome = (p) => (
  <SvgBase {...p}>
    <path d="M5 12l-2 0l9 -9l9 9l-2 0"/>
    <path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7"/>
    <path d="M10 21v-6h4v6"/>
  </SvgBase>
);

export const IconCopy = (p) => (
  <SvgBase {...p}>
    <rect x="8" y="8" width="12" height="12" rx="2"/>
    <path d="M16 8V6a2 2 0 0 0 -2 -2H6a2 2 0 0 0 -2 2v8a2 2 0 0 0 2 2h2"/>
  </SvgBase>
);

export const IconSave = (p) => (
  <SvgBase {...p}>
    <path d="M5 4h11l3 3v13H5z"/>
    <path d="M8 4v5h7V4M8 14h8v6H8z"/>
  </SvgBase>
);

export const IconPencil = (p) => (
  <SvgBase {...p}>
    <path d="M4 20h4l10 -10a2.83 2.83 0 0 0 -4 -4l-10 10v4"/>
    <path d="M13.5 6.5l4 4"/>
  </SvgBase>
);

export const IconTrash = (p) => (
  <SvgBase {...p}>
    <path d="M4 7h16"/><path d="M10 11v6M14 11v6"/>
    <path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12"/>
    <path d="M9 7V4a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3"/>
  </SvgBase>
);

export const ICONS = {
  dashboard: IconDashboard,
  trees: IconTrees,
  ripple: IconRipple,
  shield: IconShield,
  hammer: IconHammer,
  candle: IconCandle,
  skull: IconSkull,
  sword: IconSword,
  flask: IconFlask,
  chevronLeft: IconChevronLeft,
  chevronRight: IconChevronRight,
  chevronDown: IconChevronDown,
  slash: IconSlash,
  menu: IconMenu,
  alert: IconAlert,
  search: IconSearch,
  refresh: IconRefresh,
  check: IconCheck,
  arrowDown: IconArrowDown,
  arrowUp: IconArrowUp,
  lock: IconLock,
  flag: IconFlag,
  building: IconBuilding,
  x: IconX,
  plus: IconPlus,
  info: IconInfo,
  bolt: IconBolt,
  star: IconStar,
  home: IconHome,
  copy: IconCopy,
  save: IconSave,
  pencil: IconPencil,
  trash: IconTrash,
};
