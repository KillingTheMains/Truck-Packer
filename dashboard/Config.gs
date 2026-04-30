const SHEET_ID = '1l5_acuQFBomEIbdcaS9KGBOkIFKxr7eWluWtl_uXZCE';
const STATUS_SHEET = 'Status';
const MANIFEST_SHEET = 'Manifest';

// Emoji placeholders (ASCII) survive .toUpperCase(); replaced in respond() AFTER uppercasing (Rhino-safe)
// Values use JS \uXXXX escapes only -- source stays 100% ASCII, Rhino parses clean
var EM = {
  '%T%': '\uD83D\uDE9B',  // truck
  '%Y%': '\u2705',          // check mark / loaded
  '%W%': '\u23F3',          // hourglass / pending
  '%Z%': '\u26A1',          // bolt / activity
  '%S%': '\uD83D\uDD0D',  // search
  '%M%': '\uD83D\uDCCB',  // clipboard / manifest
  '%X%': '\u274C'           // X / error
};
