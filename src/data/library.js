import { catColor } from './categories.js';

// Default item library — seeded into Firestore /config/library on first
// run, then edited live via the in-app editor. The library is GLOBAL,
// not per-show.
//
// Dimensions are feet. w = trailer-long axis, h = trailer-cross axis.
// Vendor prefix on the name (CL, 4W, PRG, CT) drives the vendor filter
// in the library sidebar.

export const DEFAULT_LIBRARY = [
  // General utilities (no vendor prefix)
  { name: "TRUCK STRAP",                          cat: "General",       w: 0.1,  h: 8 },
  { name: "LOAD BAR",                             cat: "General",       w: 0.2,  h: 8 },
  // Christie Lites — Truss
  { name: "CL F-TYPE 4'",                         cat: "Truss",         w: 4,    h: 2 },
  { name: "CL F-TYPE 8'",                         cat: "Truss",         w: 8,    h: 2 },
  { name: "CL F-TYPE 16'",                        cat: "Truss",         w: 16,   h: 2 },
  { name: "CL F-TYPE 20'",                        cat: "Truss",         w: 20,   h: 2 },
  { name: "CL F-TYPE 24'",                        cat: "Truss",         w: 24,   h: 2 },
  { name: "CL B-TYPE DOLLY HALF",                 cat: "Truss",         w: 4,    h: 2.66 },
  { name: "CL B-TYPE DOLLY",                      cat: "Truss",         w: 8,    h: 2.66 },
  // Christie Lites — Motors
  { name: "CL MTR CUBE",                          cat: "Motors",        w: 2,    h: 2 },
  { name: "CL MTR S2W",                           cat: "Motors",        w: 4,    h: 2 },
  // Christie Lites — Road Case
  { name: "CL S2W",                               cat: "Road Case",     w: 4,    h: 2 },
  { name: "CL S3W",                               cat: "Road Case",     w: 4,    h: 2 },
  { name: "CL S4W",                               cat: "Road Case",     w: 4,    h: 2 },
  { name: "CL T2W",                               cat: "Road Case",     w: 4,    h: 2.5 },
  { name: "CL UTIL CUBE",                         cat: "Road Case",     w: 2,    h: 2 },
  { name: "CL DOLLY 5FT LAMP RACK ADJUSTABLE",    cat: "Road Case",     w: 2.5,  h: 5.08 },
  { name: "CL DOLLY 7.5FT LAMP RACK ADJUSTABLE",  cat: "Road Case",     w: 2.5,  h: 7.58 },
  { name: "CL CART PIPE",                         cat: "Road Case",     w: 2,    h: 4 },
  { name: "CL CART TRUSS BASE CART 3X3",          cat: "Road Case",     w: 2,    h: 4 },
  { name: "CL CASE BOLT",                         cat: "Road Case",     w: 0.67, h: 1.25 },
  { name: "CL CASE MA ONPC",                      cat: "Road Case",     w: 1.08, h: 2.17 },
  { name: "CL CASE MA2 FULL-SIZE CONSOLE",        cat: "Road Case",     w: 1,    h: 4.5 },
  { name: "CL CASE MA2 LIGHT/ULTRA LIGHT CONSOLE",cat: "Road Case",     w: 1,    h: 4 },
  { name: "CL CASE MA3 LIGHT CONSOLE",            cat: "Road Case",     w: 1.33, h: 3.25 },
  { name: "CL CASE MONITOR 22IN X 2",             cat: "Road Case",     w: 1,    h: 2 },
  // Christie Lites — Fixtures
  { name: "CL S2W FIXTURE CASE",                  cat: "Fixtures",      w: 4,    h: 2 },
  { name: "CL 4-WAY TALL",                        cat: "Fixtures",      w: 4,    h: 2 },
  { name: "CL 8-WAY TALL",                        cat: "Fixtures",      w: 4,    h: 2 },
  { name: "CL TALL FIXTURE CASE",                 cat: "Fixtures",      w: 4,    h: 2 },
  { name: "CL FIXTURE CART",                      cat: "Fixtures",      w: 4,    h: 2 },
  { name: "CL CF FIXTURE CASE",                   cat: "Fixtures",      w: 6,    h: 2 },
  // Christie Lites — Cable
  { name: "CL T2W CABLE",                         cat: "Cable",         w: 4,    h: 2.5 },
  { name: "CL FISH TOTE",                         cat: "Cable",         w: 3.67, h: 4 },
  // Christie Lites — Dimmer/Distro
  { name: "CL FULL DISTRO",                       cat: "Dimmer/Distro", w: 2,    h: 2.5 },
  { name: "CL HALF DISTRO",                       cat: "Dimmer/Distro", w: 2,    h: 2.5 },
  // Christie Lites — Workbox
  { name: "CL WORKBOX",                           cat: "Workbox",       w: 2,    h: 2.67 },
  // Christie Lites — Other
  { name: "CL MAC ONE CART",                      cat: "Other",         w: 21,   h: 2.66 },
  // Other vendors (no CL/4W/PRG/CT prefix)
  { name: 'RANDO 12" TRUSS CART',                 cat: "Truss",         w: 8,    h: 2 },
  { name: "VOLUX PHYSOS SMALL",                   cat: "Fixtures",      w: 2.24, h: 2.25 },
  { name: "VOLUX PHYSOS LARGE",                   cat: "Fixtures",      w: 3.5,  h: 2.17 },
].map((x) => ({ ...x, ...catColor(x.cat) }));
