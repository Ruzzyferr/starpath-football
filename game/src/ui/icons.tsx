/**
 * Inline icon set, Phosphor-"bold"-style: 24px grid, 2px round strokes,
 * currentColor. Hand-drawn here (no external pack) so it stays tiny and
 * tree-shake-free. Usage: <Icon name="trophy" size={20} />
 */
import type { JSX } from 'preact'

const I = {
  // navigation
  home: '<path d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  career: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8.5 7V5.5A1.5 1.5 0 0 1 10 4h4a1.5 1.5 0 0 1 1.5 1.5V7M3 12.5h18"/>',
  life: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  world: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.5 3.8 5.5 3.8 9s-1.2 6.5-3.8 9c-2.6-2.5-3.8-5.5-3.8-9S9.4 5.5 12 3z"/>',
  menu: '<path d="M4 6.5h16M4 12h16M4 17.5h16"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  'arrow-left': '<path d="M20 12H4M10 6l-6 6 6 6"/>',
  'arrow-right': '<path d="M4 12h16M14 6l6 6-6 6"/>',
  'chevron-left': '<path d="M15 5l-7 7 7 7"/>',
  'chevron-right': '<path d="M9 5l7 7-7 7"/>',
  'chevron-down': '<path d="M5 9l7 7 7-7"/>',
  'chevron-up': '<path d="M5 15l7-7 7 7"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  check: '<path d="M4.5 12.5l5 5L19.5 7"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L20 20"/>',
  'sign-out': '<path d="M10 4H5a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1h5M15 8l4 4-4 4M9 12h10"/>',
  // status
  coins: '<ellipse cx="9" cy="8" rx="6" ry="3"/><path d="M3 8v4c0 1.7 2.7 3 6 3s6-1.3 6-3V8"/><path d="M9 15v1.5c0 1.7 2.7 3 6 3s6-1.3 6-3V12c0-1.6-2.4-2.9-5.6-3"/>',
  wallet: '<path d="M4 7.5V18a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1H6a2 2 0 0 1-2-2 2 2 0 0 1 2-2h11"/><circle cx="16" cy="14" r="1.2" fill="currentColor"/>',
  energy: '<path d="M13.5 3L5 13.5h6L10 21l9-11h-6.2z"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8.2 14.2a4.5 4.5 0 0 0 7.6 0"/><circle cx="9" cy="10" r=".6" fill="currentColor"/><circle cx="15" cy="10" r=".6" fill="currentColor"/>',
  frown: '<circle cx="12" cy="12" r="9"/><path d="M8.2 16.2a4.5 4.5 0 0 1 7.6 0"/><circle cx="9" cy="10" r=".6" fill="currentColor"/><circle cx="15" cy="10" r=".6" fill="currentColor"/>',
  heartbeat: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/><path d="M3 12.5h5l1.5-2.5 2.5 5 1.5-2.5H21"/>',
  brain: '<path d="M9 4.5a3 3 0 0 0-3 3 3 3 0 0 0-2 5 3 3 0 0 0 2 5 3 3 0 0 0 3 2.5 3 3 0 0 0 3-3V7a2.5 2.5 0 0 0-3-2.5zM15 4.5a3 3 0 0 1 3 3 3 3 0 0 1 2 5 3 3 0 0 1-2 5 3 3 0 0 1-3 2.5 3 3 0 0 1-3-3"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.8-3.3 8.3-7.5 9.5-4.2-1.2-7.5-4.7-7.5-9.5V6z"/>',
  'shield-check': '<path d="M12 3l7.5 3v5.5c0 4.8-3.3 8.3-7.5 9.5-4.2-1.2-7.5-4.7-7.5-9.5V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.8z"/>',
  'star-fill': '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8L3.5 9.7l5.9-.8z" fill="currentColor"/>',
  sparkle: '<path d="M12 3l1.8 5.7L19.5 10.5l-5.7 1.8L12 18l-1.8-5.7L4.5 10.5l5.7-1.8z"/><path d="M19 3v4M17 5h4"/>',
  fire: '<path d="M12 21c-4 0-6.5-2.7-6.5-6.3 0-4.3 4-6.2 4.5-10.7 3 1.6 5 4.4 5.3 7.2.9-.6 1.6-1.7 1.9-2.8 1.4 1.5 2.3 3.8 2.3 6.3C19.5 18.3 16 21 12 21z"/>',
  // calendar & time
  calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9.5h16M8.5 3v4M15.5 3v4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
  stopwatch: '<circle cx="12" cy="13.5" r="7.5"/><path d="M12 13.5L15 10.5M10 2.5h4M12 2.5V6"/>',
  sunrise: '<path d="M4 18h16M7 18a5 5 0 0 1 10 0M12 4v4M5.2 9.2l1.6 1.6M18.8 9.2l-1.6 1.6M3 14h1.5M19.5 14H21"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  'fast-forward': '<path d="M3.5 6.5v11l7.5-5.5zM12.5 6.5v11L20 12z"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<rect x="6.5" y="5" width="3.5" height="14" rx="1"/><rect x="14" y="5" width="3.5" height="14" rx="1"/>',
  skip: '<path d="M5 5v14l10-7zM19 5v14"/>',
  // football
  ball: '<circle cx="12" cy="12" r="9"/><path d="M12 7.5l4 2.9-1.5 4.7h-5L8 10.4z"/><path d="M12 3v4.5M16 10.4l4.4-1.6M14.5 15.1l2.8 3.9M9.5 15.1l-2.8 3.9M8 10.4L3.6 8.8"/>',
  whistle: '<path d="M2.5 9.5h9l3.5-3h4.5v3.5l-3 2a6 6 0 1 1-11.4 2.6"/><circle cx="9" cy="15" r="1.5"/>',
  shirt: '<path d="M8 4L3.5 6.5l1.8 4.3 2.7-1.2V20h8V9.6l2.7 1.2 1.8-4.3L16 4a4 4 0 0 1-8 0z"/>',
  boot: '<path d="M4 6h6l1 5 8.2 2.2a2.5 2.5 0 0 1 1.8 2.4V17H4zM4 17v2M8 17v2M12 17v2M16 17v2"/>',
  pitch: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M12 5v14"/><circle cx="12" cy="12" r="2.5"/><path d="M3 9h3v6H3M21 9h-3v6h3"/>',
  goal: '<path d="M3 19V6h18v13M3 10h18M3 14h18M8 6v13M12 6v13M16 6v13"/>',
  trophy: '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5v1.5A3 3 0 0 0 7.5 10.5M17 6h2.5v1.5a3 3 0 0 1-3 3M12 14v3M8 20.5h8M9.5 17h5l.5 3.5h-6z"/>',
  medal: '<circle cx="12" cy="15" r="5.5"/><path d="M8.5 10.7L5.5 3.5h4l2.5 5M15.5 10.7l3-7.2h-4l-2.5 5"/><path d="M12 12.5l.8 1.6 1.7.2-1.2 1.2.3 1.7-1.6-.8-1.6.8.3-1.7-1.2-1.2 1.7-.2z"/>',
  crown: '<path d="M4 18L3 7.5l5 4 4-6 4 6 5-4L20 18z"/><path d="M4.5 21h15"/>',
  card: '<rect x="5.5" y="3" width="13" height="18" rx="2"/><path d="M9 8h6M9 16h6"/>',
  'yellow-card': '<rect x="6" y="3" width="12" height="18" rx="2" fill="currentColor" fill-opacity=".35"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  radar: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 12l6-6"/>',
  tactics: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8" cy="9" r="1.5"/><circle cx="8" cy="15" r="1.5"/><path d="M14 8l3 3M17 8l-3 3M11 15h3.5l2-3"/>',
  barbell: '<path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11"/>',
  run: '<circle cx="14.5" cy="4.5" r="1.8"/><path d="M6 20l3.5-4.5 3 1.5 1.5-5 3 3H20M8.5 9.5l3-2.5 3.5 1.5-1.5 4.5"/>',
  // roles (owner feedback): a header, a slalom with the ball, a run in behind the line
  'head-ball': '<circle cx="16.5" cy="5" r="2.6"/><circle cx="10" cy="12.5" r="3.2"/><path d="M3.5 21.5c.9-3 3.5-4.6 6.5-4.6s5.6 1.6 6.5 4.6M12.6 9.6l1.8-2"/>',
  slalom: '<circle cx="19" cy="18.5" r="2.2"/><path d="M4 4c5 0 5 5 0 7.5s0 7.5 5 7.5h7"/><path d="M14 5.5v3M10 12.5v3" stroke-dasharray="1.5 2"/>',
  'run-in-behind': '<path d="M14 3v18" stroke-dasharray="2 2.5"/><path d="M3 12h15M15 8.5l4 3.5-4 3.5"/><circle cx="6" cy="7" r="1.6"/>',
  // people
  user: '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c1-3.8 4-6 7.5-6s6.5 2.2 7.5 6"/>',
  users: '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 19.5c.8-3.3 3.4-5 6.5-5s5.7 1.7 6.5 5M15 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.6c2 .6 3.4 2.3 4 4.9"/>',
  handshake: '<path d="M2.5 11l3.5-4 4 1.5 2.5-1.5 3 .5 6 3.5M2.5 11l2 2 5.5 5.5c.8.8 1.8.4 2-.4M8 15l3 3M10.5 12.5l4 4c.8.8 2 .2 2-.8M13.5 10.5l3.5 3.5 2-2"/>',
  chat: '<path d="M4 18.5V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H7.5z"/><path d="M8 9h8M8 12.5h5"/>',
  phone: '<path d="M8.5 3.5H6a2 2 0 0 0-2 2.2A16 16 0 0 0 18.3 20a2 2 0 0 0 2.2-2v-2.5l-4-1.5-2 2a11 11 0 0 1-4.5-4.5l2-2z"/>',
  megaphone: '<path d="M4 9.5v5h3l9 4.5v-14L7 9.5zM7 14.5l1.5 5.5h2.5l-1-5M19 9.5a3 3 0 0 1 0 5"/>',
  newspaper: '<path d="M4 5h13v13a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2zM17 9h3v9a2 2 0 0 1-2 2"/><path d="M7.5 8.5h6M7.5 12h6M7.5 15.5h4"/>',
  bell: '<path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15zM10 20.5a2.2 2.2 0 0 0 4 0"/>',
  camera: '<rect x="3" y="7" width="18" height="13" rx="2.5"/><path d="M8.5 7l1.5-2.5h4L15.5 7"/><circle cx="12" cy="13.5" r="3.5"/>',
  'thumbs-up': '<path d="M7.5 10.5v9.5H4.5v-9.5zM7.5 10.5l4-7c1.6 0 2.7 1.3 2.4 2.9L13.3 9.5h5.3a2 2 0 0 1 2 2.4l-1.3 6.5a2 2 0 0 1-2 1.6H7.5"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/>',
  'heart-fill': '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="currentColor"/>',
  'heart-break': '<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"/><path d="M12 7.3l-1.5 4 3 1.5-1.5 3.5"/>',
  'hand-heart': '<path d="M3 14.5h3.5l4 2.5h3.5a1.5 1.5 0 0 1 0 3H9M6.5 21v-6.5M14 17l5.2-2a1.6 1.6 0 0 1 1.3 2.8L14 21H6.5"/><path d="M15 11.5s-4-2.4-4-5.2a2.2 2.2 0 0 1 4-1.3 2.2 2.2 0 0 1 4 1.3c0 2.8-4 5.2-4 5.2z"/>',
  gift: '<rect x="3.5" y="8" width="17" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5.5-4-5.5-1.5S10 8 12 8zM12 8c1.5-3 5.5-4 5.5-1.5S14 8 12 8z"/>',
  party: '<path d="M4 20l4.5-12 7.5 7.5zM14 4.5c.5 1.5 0 3-1.5 3.5M18 9c1.5-.5 2.5 0 3 1M16.5 4l.5-1.5M20 7l1.5-.5"/>',
  'fork-knife': '<path d="M7 3v7a2 2 0 0 0 2 2v9M11 3v7a2 2 0 0 1-2 2M9 3v6M17 21V3c-2 1.5-3 4-3 8h3"/>',
  bed: '<path d="M3 18V6M3 14h18v4M21 14v-2.5a3 3 0 0 0-3-3h-7.5V14"/><circle cx="7" cy="11" r="2"/>',
  'first-aid': '<rect x="3.5" y="6" width="17" height="14" rx="2"/><path d="M9 6V4.5h6V6M12 10v6M9 13h6"/>',
  bandage: '<rect x="2.5" y="8.5" width="19" height="7" rx="3.5" transform="rotate(-45 12 12)"/><path d="M10.5 10.5h.01M13.5 13.5h.01M10.5 13.5h.01M13.5 10.5h.01"/>',
  // money / life
  bank: '<path d="M3 9.5L12 4l9 5.5zM5 10v7M9.7 10v7M14.3 10v7M19 10v7M3 20.5h18"/>',
  piggy: '<path d="M18 9.5c1.5.5 2.5 1.8 2.5 3.5V15h-2l-1 3h-2.5v-1.5h-4V18H8.5L7 15c-1.5-.8-2.5-2.3-2.5-4 0-3 3-5.5 7-5.5 1.8 0 3.5.5 4.7 1.3L19 5.5z"/><circle cx="15.5" cy="10.5" r=".6" fill="currentColor"/><path d="M10 8.5h3"/>',
  'trend-up': '<path d="M3 17.5l6-6 4 4 8-8M15 7.5h6v6"/>',
  'trend-down': '<path d="M3 6.5l6 6 4-4 8 8M15 16.5h6v-6"/>',
  'chart-line': '<path d="M3.5 3.5v17h17M7 15l4-4.5 3.5 3 5-6"/>',
  'chart-bar': '<path d="M3.5 20.5h17M6 20.5v-6M10.5 20.5V8M15 20.5V12M19.5 20.5V5"/>',
  receipt: '<path d="M5 3.5v17l2.3-1.5 2.3 1.5 2.4-1.5 2.3 1.5 2.4-1.5 2.3 1.5v-17zM8.5 8.5h7M8.5 12h7M8.5 15.5h4"/>',
  'shopping-bag': '<path d="M5 7.5h14l-1 13H6zM9 10V6.5a3 3 0 0 1 6 0V10"/>',
  storefront: '<path d="M4 9.5V20h16V9.5M3 9.5L4.5 4h15L21 9.5a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0zM9.5 20v-5h5v5"/>',
  house: '<path d="M3.5 11L12 4l8.5 7M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"/>',
  car: '<path d="M3 15.5v-3l2-5a2 2 0 0 1 1.8-1.3h10.4A2 2 0 0 1 19 7.5l2 5v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1zM3 12.5h18"/><circle cx="7.5" cy="16.5" r="2" fill="var(--surface-1)"/><circle cx="16.5" cy="16.5" r="2" fill="var(--surface-1)"/>',
  watch: '<circle cx="12" cy="12" r="5.5"/><path d="M12 9.5V12l1.5 1.5M8.5 7.5L9.5 3h5l1 4.5M8.5 16.5l1 4.5h5l1-4.5"/>',
  hanger: '<path d="M12 7.5a2 2 0 1 1 2-2c0 1.2-2 1.5-2 3l9 6.5a1 1 0 0 1-.6 1.8H3.6A1 1 0 0 1 3 15z"/>',
  laptop: '<rect x="4.5" y="5" width="15" height="10" rx="1.5"/><path d="M2.5 18.5h19"/>',
  paw: '<circle cx="6" cy="10.5" r="2"/><circle cx="9.5" cy="6" r="2"/><circle cx="14.5" cy="6" r="2"/><circle cx="18" cy="10.5" r="2"/><path d="M8 17.5c0-3 2-5.5 4-5.5s4 2.5 4 5.5a2.5 2.5 0 0 1-4 2 2.5 2.5 0 0 1-4-2z"/>',
  boat: '<path d="M3 15.5h18l-2.5 4.5h-13zM12 3v12.5M12 4l6.5 9H12M12 6.5L7 13h5"/>',
  airplane: '<path d="M12 3c1 0 1.5 1 1.5 2.5v4l7.5 4.5v2l-7.5-2v4l2.5 2v1.5L12 20.5 8 21.5V20l2.5-2v-4L3 16v-2l7.5-4.5v-4C10.5 4 11 3 12 3z"/>',
  palette: '<path d="M12 3.5a8.5 8.5 0 1 0 0 17c1.4 0 2-.9 2-1.8 0-1.4-1.5-1.6-1.5-3 0-1 .8-1.7 1.8-1.7h2.2A4 4 0 0 0 20.5 10C20.5 6.4 16.7 3.5 12 3.5z"/><circle cx="8" cy="10" r="1" fill="currentColor"/><circle cx="11" cy="7" r="1" fill="currentColor"/><circle cx="15.5" cy="7.5" r="1" fill="currentColor"/>',
  palm: '<path d="M12.5 21c0-5 .3-9 .5-11.5M13 9.5c-1.5-3-5-4-8-2.5 3 0 5 1 6 3M13 9.5c1-3 4.5-4.5 7.5-3.5-3 .5-5 2-6 4M13 9.5c-3.5-1-6.5 1-7.5 4 2-1.5 4.5-2.5 7.5-3.5M13 9.5c3 0 5.5 2 6 5-1.5-2-3.5-3.5-6-4.5M5 21h15"/>',
  building: '<path d="M4 20.5V4.5h10v16M14 9h6v11.5M2.5 20.5h19M7.5 8h3M7.5 11.5h3M7.5 15h3M17 12.5h.01M17 16h.01"/>',
  // casino
  dice: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="8.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="15.5" cy="15.5" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="15.5" cy="8.5" r="1.2" fill="currentColor"/><circle cx="8.5" cy="15.5" r="1.2" fill="currentColor"/>',
  cards: '<rect x="3" y="6" width="11" height="15" rx="1.8" transform="rotate(-10 8.5 13.5)"/><rect x="10" y="3.5" width="11" height="15" rx="1.8"/><path d="M15.5 8.5l1.8 2.5-1.8 2.5-1.8-2.5z"/>',
  roulette: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><path d="M12 3v5M12 16v5M3 12h5M16 12h5M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M5.6 18.4l3.6-3.6M14.8 9.2l3.6-3.6"/>',
  cherries: '<circle cx="7.5" cy="16.5" r="3.5"/><circle cx="16" cy="17" r="3.5"/><path d="M7.5 13c1-4.5 3.5-8 7-9.5M16 13.5c-.5-4-1-7-1.5-10M14.5 3.5c2 0 4 1 5 3-2.5.5-4.5-.5-5-3z"/>',
  horse: '<path d="M7 21v-5.5L5 13l1-6 4-3.5 1.5 2 3.5.5 4 5-1.5 1.5-3-1.5-1 3L16 21"/><circle cx="12.5" cy="7.5" r=".6" fill="currentColor"/>',
  chip: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  // ui
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8l1.6 2.3 2.7-.6.6 2.7 2.3 1.6-1.3 2.4 1.3 2.4-2.3 1.6-.6 2.7-2.7-.6L12 21.2l-1.6-2.3-2.7.6-.6-2.7-2.3-1.6 1.3-2.4-1.3-2.4 2.3-1.6.6-2.7 2.7.6z"/>',
  sliders: '<path d="M5 4v16M12 4v16M19 4v16"/><circle cx="5" cy="14" r="2" fill="var(--surface-1)"/><circle cx="12" cy="8" r="2" fill="var(--surface-1)"/><circle cx="19" cy="16" r="2" fill="var(--surface-1)"/>',
  floppy: '<path d="M4 5a1 1 0 0 1 1-1h11.5L20 7.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M7.5 20v-6h9v6M8 4v4h7V4"/>',
  upload: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M4 14.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4.5"/>',
  download: '<path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4 14.5V19a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4.5"/>',
  trash: '<path d="M4.5 6.5h15M9.5 6.5V4h5v2.5M6.5 6.5l1 14h9l1-14M10 10.5v6M14 10.5v6"/>',
  lock: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
  'lock-open': '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 7.8-1.2"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r=".8" fill="currentColor"/>',
  warning: '<path d="M12 4l9 15.5H3z"/><path d="M12 10v4.5"/><circle cx="12" cy="17" r=".8" fill="currentColor"/>',
  question: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.6v.6"/><circle cx="12" cy="17" r=".8" fill="currentColor"/>',
  eye: '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  shuffle: '<path d="M3 7h3.5c4 0 7 10 11 10H21M3 17h3.5c1.5 0 2.8-1.4 3.9-3.2M13.6 10.2C14.7 8.4 16 7 17.5 7H21M18.5 4.5L21 7l-2.5 2.5M18.5 14.5L21 17l-2.5 2.5"/>',
  speaker: '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>',
  'speaker-off': '<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM16 9.5l5 5M21 9.5l-5 5"/>',
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  vibrate: '<rect x="7.5" y="4" width="9" height="16" rx="1.5"/><path d="M4.5 8.5v7M19.5 8.5v7M2 10.5v3M22 10.5v3"/>',
  'text-aa': '<path d="M3 18.5L8 5.5l5 13M4.8 14h6.4M15 11.5a2.8 2.8 0 0 1 5 1.5v5.5M20 15.5c-3-.6-5 .3-5 1.6 0 1 .8 1.6 2 1.6 1.6 0 3-1 3-3"/>',
  contrast: '<circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor"/>',
  language: '<path d="M4 5.5h9M8.5 3.5v2M11 5.5c-1 4.5-3.5 7.5-6.5 9M6.5 9c1 2.5 3 4.5 5.5 5.5M12.5 20.5l4-9.5 4 9.5M14 17h5"/>',
  keyboard: '<rect x="2.5" y="6" width="19" height="12" rx="2"/><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7 14.5h10"/>',
  crosshair: '<circle cx="12" cy="12" r="8"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  hourglass: '<path d="M6.5 3.5h11M6.5 20.5h11M7.5 3.5c0 5 4.5 6 4.5 8.5S7.5 15.5 7.5 20.5M16.5 3.5c0 5-4.5 6-4.5 8.5s4.5 3.5 4.5 8.5"/>',
  rocket: '<path d="M14 4.5c3-1.5 5.5-1 5.5-1s.5 2.5-1 5.5L13 14.5 9.5 11zM9.5 11L6 10.5l3-3.5h4.5M13 14.5l.5 3.5 3.5-3v-4.5M8.5 15.5c-1.5.5-3 2-3.5 4.5 2.5-.5 4-2 4.5-3.5"/>',
  flag: '<path d="M5 21V4M5 4.5c5-3 9 2.5 14 0v9c-5 2.5-9-3-14 0"/>',
  'map-pin': '<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.5"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 1 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 1 0 5.7 5.7l1-1"/>',
  // weather
  'cloud-rain': '<path d="M7 15.5a4.5 4.5 0 1 1 1.3-8.8A5.5 5.5 0 0 1 18.5 9a3.3 3.3 0 0 1-.5 6.5zM8 18.5l-1 2M12 18.5l-1 2M16 18.5l-1 2"/>',
  snowflake: '<path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 6.5l2.5-2M9.5 19.5l2.5-2 2.5 2"/>',
  wind: '<path d="M3 9.5h11a2.5 2.5 0 1 0-2.5-2.5M3 14.5h15a2.5 2.5 0 1 1-2.5 2.5M3 12h7"/>',
  thermometer: '<path d="M10 14.5V5a2 2 0 0 1 4 0v9.5a4 4 0 1 1-4 0z"/><path d="M12 9v7"/>',
  // misc
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17" cy="7" r=".9" fill="currentColor"/>',
  hashtag: '<path d="M9.5 4l-2 16M16.5 4l-2 16M4.5 9h16M3.5 15h16"/>',
  verified: '<path d="M12 2.8l2.4 1.8 3-.2.8 2.9 2.5 1.7-1 2.9 1 2.9-2.5 1.7-.8 2.9-3-.2L12 21.2l-2.4-1.8-3 .2-.8-2.9L3.3 15l1-2.9-1-2.9 2.5-1.7.8-2.9 3 .2z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  history: '<path d="M4 12a8 8 0 1 0 2.4-5.7L4 8.5M4 4v4.5h4.5M12 8v4.5l3 1.5"/>',
  list: '<path d="M9 6.5h11M9 12h11M9 17.5h11"/><circle cx="4.5" cy="6.5" r="1" fill="currentColor"/><circle cx="4.5" cy="12" r="1" fill="currentColor"/><circle cx="4.5" cy="17.5" r="1" fill="currentColor"/>',
  scales: '<path d="M12 4v16.5M7 20.5h10M4.5 7.5h15M12 4.5l-7.5 3M12 4.5l7.5 3M4.5 7.5L2 14a2.8 2.8 0 0 0 5 0zM19.5 7.5L17 14a2.8 2.8 0 0 0 5 0z"/>',
  gavel: '<path d="M13.5 4.5l6 6M11 7l6 6M12.5 5.5l-4 4 6 6 4-4M10.5 11.5l-7 7a1.4 1.4 0 0 0 2 2l7-7M13 20.5h8"/>',
  mask: '<path d="M3 6.5c3 1.5 6 1.5 9 0 3 1.5 6 1.5 9 0v5c0 5-4 8.5-9 8.5s-9-3.5-9-8.5z"/><path d="M7 12c1-1 2.5-1 3.5 0M13.5 12c1-1 2.5-1 3.5 0M9 16c2 1.5 4 1.5 6 0"/>',
  spotlight: '<path d="M9 3l3 3-5 5-3-3zM12 6l3.5 3.5M8.5 10.5L20 21M11 13h10"/>',
  confetti: '<path d="M4 20l4.5-12 7.5 7.5z"/><path d="M14 4.5c.5 1.5 0 3-1.5 3.5M18 9c1.5-.5 2.5 0 3 1M16.5 4l.5-1.5M20 7l1.5-.5M19 13l1 1"/>',
} as const

export type IconName = keyof typeof I
export const ICON_NAMES = Object.keys(I) as IconName[]

export function isIconName(n: string): n is IconName {
  return n in I
}

export interface IconProps {
  name: IconName | string
  size?: number | string
  /** Stroke weight, default 2 (Phosphor "bold" look). */
  weight?: number
  class?: string
  title?: string
  style?: JSX.CSSProperties
}

export function Icon({ name, size = 22, weight = 2, class: cls, title, style }: IconProps) {
  const body = (I as Record<string, string>)[name] ?? I.question
  return (
    <svg
      class={'icon' + (cls ? ' ' + cls : '')}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={weight}
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : undefined}
      aria-label={title}
      style={style}
      dangerouslySetInnerHTML={{ __html: body }}
    />
  )
}
