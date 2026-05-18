// Per-category fill + text colors. Drives both the canvas item swatches
// and the library sidebar grouping. Add new categories here when an item
// references a category that isn't already mapped.

export const CAT_COLORS = {
  'General':       { hex:'#455A64', tc:'#fff' },
  'Truss':         { hex:'#90A4AE', tc:'#000' },
  'Motors':        { hex:'#1F3864', tc:'#fff' },
  'Motor Pack':    { hex:'#1F3864', tc:'#fff' }, // legacy alias for Motors
  'Road Case':     { hex:'#1E88E5', tc:'#fff' },
  'Fixtures':      { hex:'#FDD835', tc:'#000' },
  'Workbox':       { hex:'#FB8C00', tc:'#000' },
  'Dimmer/Distro': { hex:'#E53935', tc:'#fff' },
  'Cable':         { hex:'#5D4037', tc:'#fff' },
  'Rigging':       { hex:'#37474F', tc:'#fff' },
  'Audio':         { hex:'#6A1B9A', tc:'#fff' },
  'Video':         { hex:'#1565C0', tc:'#fff' },
  'Lighting':      { hex:'#F57F17', tc:'#000' },
  'Other':         { hex:'#78909C', tc:'#fff' },
};

export const DEFAULT_CAT_COLOR = { hex:'#546E7A', tc:'#fff' };

export const catColor = (cat) => CAT_COLORS[cat] || DEFAULT_CAT_COLOR;
