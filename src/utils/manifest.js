// Manifest numbering: each placed item gets a number like "F1-3"
// (FAV1 → "F1", item id 3). Used in PDFs, scan logs, and the global
// manifest list. FAV trucks use just the number to keep the prefix
// short (FAV1 → "1") to match field convention.
export const getTruckPrefix = (truckId) => {
  if (!truckId) return '?';
  const m = truckId.match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return truckId;
  const [, letters, num] = m;
  return letters.toUpperCase() === 'FAV' ? num : letters.charAt(0).toUpperCase() + num;
};

export const getManifestNum = (truckId, itemId) => `${getTruckPrefix(truckId)}-${itemId}`;

// Per-layer (stacking) helpers. Items can be single, double, or
// triple-stacked; each layer holds its own label, color, and case type.
export const LAYER_PLACEHOLDERS = [
  ['[LABEL]'],
  ['[LABEL]', '[LABEL]'],
  ['[LABEL]', '[LABEL]', '[LABEL]'],
];

export const LAYER_COLOR_LABELS = [
  ['Color:'],
  ['Top Color:', 'Bottom Color:'],
  ['Top Color:', 'Mid Color:', 'Bottom Color:'],
];

export const getLayerInfo = (p, li) => ({
  label:    p.layerLabels?.[li]    ?? (li === 0 ? (p.label || '') : ''),
  hex:      p.layerHex?.[li]       ?? (li === 0 ? (p.customHex || 'glass') : 'glass'),
  tc:       p.layerTc?.[li]        ?? (li === 0 ? (p.customTc  || '#fff')  : '#fff'),
  caseType: p.layerCaseTypes?.[li] ?? '',
});
