// Truck status enum + display config. The cycle order is also the order
// presented when the status pill is clicked in the packer toolbar.

export const TRUCK_STATUS_CYCLE = ['staged', 'atdock', 'loaded', 'unloaded', 'backloaded', 'empty'];

export const TRUCK_STATUS_CONFIG = {
  staged:     { label: '▶ Staged',     color: '#448aff', border: 'rgba(68,138,255,.5)',  bg: 'rgba(68,138,255,.15)',  rowBg: 'rgba(68,138,255,.07)' },
  atdock:     { label: '⬇ At Dock',    color: '#CE93D8', border: 'rgba(206,147,216,.5)', bg: 'rgba(206,147,216,.15)', rowBg: 'rgba(206,147,216,.06)' },
  loaded:     { label: '✓ Loaded',     color: '#43A047', border: 'rgba(67,160,71,.5)',   bg: 'rgba(67,160,71,.15)',   rowBg: 'rgba(67,160,71,.07)' },
  unloaded:   { label: '○ Unloaded',   color: '#e6c200', border: 'rgba(230,194,0,.5)',   bg: 'rgba(253,216,53,.12)',  rowBg: 'rgba(253,216,53,.05)' },
  backloaded: { label: '↩ Backloaded', color: '#FF9800', border: 'rgba(255,152,0,.5)',   bg: 'rgba(255,152,0,.13)',   rowBg: 'rgba(255,152,0,.06)' },
  empty:      { label: '✕ Empty',      color: '#E53935', border: 'rgba(229,57,53,.5)',   bg: 'rgba(229,57,53,.13)',   rowBg: 'rgba(229,57,53,.06)' },
};

// Read the canonical status off a truckLoaded entry, with a legacy
// .loaded -> 'loaded' translation kept for old saved data.
export const getTruckStatus = (li) => {
  if (!li) return null;
  if (li.status) return li.status;
  if (li.loaded) return 'loaded';
  return null;
};
