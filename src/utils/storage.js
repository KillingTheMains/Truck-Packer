// LZ-String-compressed wrappers around localStorage. Lifts the ~5 MB
// quota to a soft limit by storing UTF-16 compressed payloads. Old
// uncompressed values fall through transparently — decompress returns
// empty string, we return the raw value instead.

export const lsSet = (key, val) => {
  try {
    const str = typeof val === 'string' ? val : JSON.stringify(val);
    localStorage.setItem(key, LZString.compressToUTF16(str));
  } catch(e) {}
};

export const lsGet = (key) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    const dec = LZString.decompressFromUTF16(raw);
    return (dec !== null && dec !== '') ? dec : raw;
  } catch(e) { return null; }
};
