// Blend a hex color toward white by `amount` (0..1). Used for soft
// row/cell tints derived from a category color. Returns a CSS-ready
// rgb() string; falls back to a translucent white for 'glass' or
// invalid input.
export const lightenHex = (hex, amount = 0.52) => {
  if (!hex || hex === 'glass') return 'rgba(255,255,255,0.55)';
  try {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgb(${Math.round(r + (255 - r) * amount)},${Math.round(g + (255 - g) * amount)},${Math.round(b + (255 - b) * amount)})`;
  } catch(e) {
    return 'rgba(255,255,255,0.55)';
  }
};
