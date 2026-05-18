export const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const fmtDDMMMYYYY = (d) => {
  if (!d || isNaN(d.getTime())) return '';
  return `${String(d.getDate()).padStart(2,'0')}-${MONTHS_SHORT[d.getMonth()].toUpperCase()}-${d.getFullYear()}`;
};
