// Vendor prefixes drive both display (we strip the prefix in tight
// canvas labels) and the library sidebar's vendor filter checkboxes.
// Add a new short code here to introduce another rental house.

export const VENDORS = ['CL', '4W', 'PRG', 'CT'];

export const vendorFromName = (name) => {
  for (const v of VENDORS) if (name.startsWith(v + ' ')) return v;
  return null;
};

export const stripVendorPrefix = (name) => {
  for (const v of VENDORS) if (name.startsWith(v + ' ')) return name.slice(v.length + 1);
  return name;
};

// "General" category items (truck straps, load bars) aren't real gear —
// excluded from manifests and case counts.
export const isUtilityItem = (item) => (item?.cat || '').toLowerCase() === 'general';
