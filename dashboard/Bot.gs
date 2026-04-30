
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);

    // TrailerPacker sync
    if (payload.source === 'TrailerPacker') {
      writeStatusToSheet(payload.trucks || {});
      return ContentService.createTextOutput(JSON.stringify({ ok: true }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // - TrailerPacker data load/save via Sheet --------------------
    if (payload.source === 'TrailerPackerData') {
      if (payload.action === 'load') {
        return ContentService.createTextOutput(JSON.stringify(loadPackerData_()))
          .setMimeType(ContentService.MimeType.JSON);
      }
      if (payload.action === 'save') {
        try { savePackerData_(payload.trucks || {}, payload.truckLoaded || {}); } catch(e) { Logger.log('PackData err: ' + e.message); }
        Logger.log('MANIFEST_ROWS_IN: ' + (Array.isArray(payload.manifest) ? payload.manifest.length : typeof payload.manifest));
        var _mErr=null,_mRows=-1; try { _mRows=writePackerManifest_(payload.manifest||[]); } catch(e) { _mErr=e.message; Logger.log('Manifest err: '+e.message); }
        return ContentService.createTextOutput(JSON.stringify({ ok: true, mSent: Array.isArray(payload.manifest)?payload.manifest.length:-1, mRows: _mRows, mErr: _mErr }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    // Google Workspace Add-On format
    if (payload.chat) {
      if (payload.chat.addedToSpacePayload) return respond(getGreeting());
      if (payload.chat.removedFromSpacePayload) {
// - Activity Log from Trailer Packer --------------------
if (payload.source === 'TrailerPackerLog') {
  try {
    if (payload.entry) writeLogEntry_(payload.entry);
    return ContentService.createTextOutput(JSON.stringify({ok:true}))
      .setMimeType(ContentService.MimeType.JSON);
  } catch(e) {
    return ContentService.createTextOutput(JSON.stringify({ok:false,err:e.message}))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

        return ContentService.createTextOutput('{}').setMimeType(ContentService.MimeType.JSON);
      }
      if (payload.chat.messagePayload) {
        const msg = payload.chat.messagePayload.message;
        const rawText = (msg.argumentText || msg.text || '').trim();
        const text = rawText.toLowerCase().replace(/@\S+/g, '').trim();
        return respond(processQuery(text));
      }
      return ContentService.createTextOutput('{}').setMimeType(ContentService.MimeType.JSON);
    }

    // Legacy Chat bot format
    if (payload.type === 'ADDED_TO_SPACE') return respond(getGreeting());
    if (payload.type === 'REMOVED_FROM_SPACE') {
      return ContentService.createTextOutput('{}').setMimeType(ContentService.MimeType.JSON);
    }
    const rawText = (payload.message && payload.message.text ? payload.message.text : '').trim();
    const text = rawText.toLowerCase().replace(/@\S+/g, '').trim();
    return respond(processQuery(text));

  } catch(err) {
    return respond('Error: ' + err.message);
  }
}

function getGreeting() {
  return 'Hi! I\'m CLAUDIA, your SAP26 truck status bot. Ask me:\n- "status" -- overall summary with timestamps\n- "loaded" / "pending" -- list by status\n- "recent" or "recent 20" -- last N status changes\n- "FAV24" -- status of a specific truck\n- "what\'s in FAV24" -- full manifest for a truck\n- "where is SEE11" -- find item by label\n- "where is case #40" -- find item by Case ID\n- "mark FAV24 loaded" / "mark FAV24 staged" / "mark FAV24 pending"';
}

function respond(text) {
  // Uppercase first (safe -- no emojis in text at this point, only ASCII placeholders)
  var upper = text.toUpperCase();
  // Substitute emoji placeholders AFTER uppercasing (Rhino-safe: emojis never touch .toUpperCase())
  Object.keys(EM).forEach(function(k) { upper = upper.split(k).join(EM[k]); });
  const response = {
    hostAppDataAction: {
      chatDataAction: {
        createMessageAction: { message: { text: upper } }
      }
    }
  };
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

function processQuery(text) {

  // what's in FAV24 / what is in FAV24
  const manifestMatch = text.match(/what(?:'s| is) in ([\w\d]+)/i);
  if (manifestMatch) return getTruckManifest(manifestMatch[1].toUpperCase());

  // where is case #40 / where is box 40
  const caseMatch = text.match(/where is (?:case|box)\s*#?(\d+)/i);
  if (caseMatch) return findItemByCaseId(caseMatch[1]);

  // where is SEE11 (label search)
  const whereMatch = text.match(/where is (.+)/i);
  if (whereMatch) return findItemByLabel(whereMatch[1].trim());

  // mark FAV24 loaded / mark FAV24 pending
  const markMatch = text.match(/mark\s+([\w\d]+)\s+(loaded|unloaded|backloaded|empty|staged|pending)/i);
  if (markMatch) return markTruckStatus(markMatch[1].toUpperCase(), markMatch[2].toLowerCase());

  if (text.includes('status') || text.includes('summary')) return getStatusSummary();
  if (text.includes('loaded') && !text.includes('mark')) return getByStatus('loaded');
  if (text.includes('staged') && !text.includes('mark')) return getByStatus('staged');
  if (text.includes('pending') && !text.includes('mark')) return getByStatus('pending');
  if (text.includes('help')) return getHelp();

  const favMatch = text.match(/fav\d+/i);
  if (favMatch) return getTruckStatus(favMatch[0].toUpperCase());
  // f-type stick counts
  if (text.includes('f-type') || text.includes('f type') || text.includes('ftype') ||
      (text.includes('stick') && text.includes('f'))) return getFTypeCounts();
  if ((text||'').toUpperCase().includes('LIVE COUNT')) return getLiveCounts();
  if ((text||'').toUpperCase().includes("DADDY'S HOME")) return getWakeUpSummary();

  // recent truck activity
  var recentMatch = text.match(/^recent\s*(\d+)?$/);
  if (recentMatch) return getRecentTrucks(recentMatch[1] ? parseInt(recentMatch[1]) : 10);

  return getHelp();
}

// - Status queries --------------------------------------------

function getStatusSummary() {
  var data = readTruckData();
  var loaded = data.filter(function(r) { return r[2] === 'loaded'; });
  var pending = data.filter(function(r) { return r[2] === 'pending'; });
  var lines = ['%T% SAP26 STATUS -- ' + loaded.length + '/' + data.length + ' LOADED'];
  if (loaded.length > 0) {
    var sortedLoaded = loaded.slice().sort(function(a, b) { return Number(b[3]||0) - Number(a[3]||0); });
    lines.push('');
    lines.push('%Y% LOADED (' + loaded.length + '):');
    sortedLoaded.forEach(function(r) {
      var ts = r[3] ? ' | ' + formatTimestamp(r[3]) : '';
      lines.push('  ' + String(r[0]).toUpperCase() + ts);
    });
  }
  if (pending.length > 0) {
    lines.push('');
    lines.push('%W% PENDING (' + pending.length + ') -- SAY "PENDING" TO LIST');
  }
  var loadedWithTs = loaded.filter(function(r) { return r[3]; });
  if (loadedWithTs.length > 0) {
    var latest = loadedWithTs.slice().sort(function(a, b) { return Number(b[3]) - Number(a[3]); })[0];
    lines.push('');
    lines.push('%Z% LAST ACTIVITY: ' + String(latest[0]).toUpperCase() + ' | ' + formatTimestamp(latest[3]));
  }
  return lines.join('\n');
}

function getTruckStatus(truckId) {
  var data = readTruckData();
  var row = data.find(function(r) { return String(r[0]).toUpperCase() === truckId; });
  if (!row) return '%X% Truck ' + truckId + ' not found';
  var status = row[2] || 'pending';
  var icon = status === 'loaded' ? '%Y%' : '%W%';
  var tsLine = row[3] ? '\nUpdated: ' + formatTimestamp(row[3]) : '';
  return icon + ' ' + truckId + ': ' + status.toUpperCase() + tsLine;
}

function getByStatus(status) {
  const data = readTruckData();
  const trucks = data.filter(r => r[2] === status).map(r => r[0]);
  if (trucks.length === 0) return 'No trucks currently ' + status + '.';
  var icon = status === 'loaded' ? '%Y%' : '%W%';
  return icon + ' ' + status.toUpperCase() + ' trucks (' + trucks.length + '):\n' + trucks.join(', ');
}

function markTruckStatus(truckId, newStatus) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var statusSheet = ss.getSheetByName(STATUS_SHEET);
  if (!statusSheet) return '%X% Status sheet not found.';
  var lastRow = statusSheet.getLastRow();
  if (lastRow < 2) return '%X% No truck data found.';
  var data = statusSheet.getRange(2, 1, lastRow - 1, 4).getValues();
  var rowIdx = -1;
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][0]).toUpperCase() === truckId) { rowIdx = i; break; }
  }
  if (rowIdx === -1) return '%X% Truck ' + truckId + ' not found.';
  var nowMs = Date.now();
  statusSheet.getRange(rowIdx + 2, 3, 1, 2).setValues([[newStatus, nowMs]]);
  var icon = newStatus === 'loaded' ? '%Y%' : newStatus === 'staged' ? '%Z%' : '%W%';
  return icon + ' ' + truckId + ' marked ' + newStatus.toUpperCase() + ' | ' + formatTimestamp(nowMs);
}

function getHelp() {
  return 'CLAUDIA COMMANDS:\n- "status" -- summary + loaded list with timestamps\n- "loaded" / "pending" -- full list by status\n- "recent" or "recent 20" -- last N status changes\n- "FAV24" -- specific truck status + timestamp\n- "what\'s in FAV24" -- truck manifest\n- "where is SEE11" -- find by label\n- "where is case #40" -- find by Case ID\n- "mark FAV24 loaded/staged/pending/etc"\n- "f-type" -- F-Type stick counts';
}

function formatTimestamp(ts) {
  if (!ts) return '';
  var d;
  if (ts instanceof Date) {
    d = ts;
  } else {
    var ms = Number(ts);
    d = (ms > 1000000000000) ? new Date(ms) : new Date(ts);
  }
  if (isNaN(d.getTime())) return '';
  var tz = Session.getScriptTimeZone();
  return Utilities.formatDate(d, tz, 'MMM d h:mma');
}

function getRecentTrucks(n) {
  var count = n || 10;
  var data = readTruckData();
  // Only include loaded trucks — pending trucks all share a bulk-init timestamp and cannot be meaningfully sorted.
  // Trucks marked pending via "mark" command get a fresh timestamp but status reverts to pending, so we
  // show ALL trucks sorted by timestamp but cap display to those with status=loaded OR a timestamp
  // strictly newer than the oldest loaded truck (to catch recently-marked-pending trucks).
  var loaded = data.filter(function(r) { return String(r[2]).toLowerCase() === 'loaded' && r[3]; });
  if (loaded.length === 0) return '%W% No loaded trucks found.';
  var sorted = loaded.sort(function(a, b) { return Number(b[3]) - Number(a[3]); });
  // Also grab any pending trucks whose timestamp is newer than the oldest loaded truck timestamp
  var oldestLoadedTs = Number(sorted[sorted.length - 1][3]);
  var recentPending = data.filter(function(r) {
    return String(r[2]).toLowerCase() !== 'loaded' && r[3] && Number(r[3]) > oldestLoadedTs;
  });
  var combined = sorted.concat(recentPending).sort(function(a, b) { return Number(b[3]) - Number(a[3]); });
  var top = combined.slice(0, count);
  var lines = ['%Z% RECENTLY LOADED TRUCKS (LAST ' + top.length + '):'];
  top.forEach(function(r) {
    var id = String(r[0]).toUpperCase();
    var status = String(r[2] || 'pending').toUpperCase();
    var icon = (String(r[2]).toLowerCase() === 'loaded') ? '%Y%' : 'o';
    var ts = formatTimestamp(r[3]);
    lines.push('  ' + icon + ' ' + id + ' [' + status + ']' + (ts ? ' | ' + ts : ''));
  });
  return lines.join('\n');
}

function getFTypeCounts() {
  // Use same logic as getLiveCountLines_ so F-TYPE command always matches Live Counts
  var lcLines = getLiveCountLines_();
  // Extract just the F-TYPE STICKS section from the live count output
  var inFType = false, out = [];
  for (var i = 0; i < lcLines.length; i++) {
    if (lcLines[i].indexOf('F-TYPE STICKS') >= 0) { inFType = true; }
    if (inFType) out.push(lcLines[i]);
  }
  return out.length ? out.join('\n') : 'NO F-TYPE DATA IN MANIFEST.';
}


function getTruckManifest(truckId) {
  const data = readManifestData();
  if (!data) return '%X% Manifest tab not found.';
  const items = data.filter(r => String(r[0]).toUpperCase() === truckId);
  if (items.length === 0) return '%X% No manifest data for ' + truckId + '. (Sync Trailer Packer to populate.)';
  const statusRows = readTruckData();
  const truckRow = statusRows.find(r => String(r[0]).toUpperCase() === truckId);
  const truckIsLoaded = truckRow && String(truckRow[2]).toUpperCase() === 'LOADED';
  const lines = items.map(r => {
    const label = r[5] ? r[5] + ' - ' : '';
    const item = r[1] || '';
    const size = r[2] ? ', ' + r[2] : '';
    const color = r[3] && r[3] !== 'Glass' ? ', ' + r[3] : '';
    const layer = r[6] && r[6] !== 'Base' ? ' (' + r[6] + ')' : '';
    const scanned = (truckIsLoaded || r[7] === '✓') ? ' %Y%' : ' o';
    return '-' + label + item + size + color + layer + scanned;
  });
  return '%M% ' + truckId + ' MANIFEST (' + items.length + ' item' + (items.length !== 1 ? 's' : '') + '):\n' + lines.join('\n');
}

function findItemByLabel(term) {
  var rows = readManifestData();
  var search = term.toString().replace(/[?!.,;:]+$/, '').trim().toLowerCase();
  var matches = rows.filter(function(r) {
    var lbl = (r[5] || '').toString().trim().toLowerCase();
    var itm = (r[1] || '').toString().trim().toLowerCase();
    return lbl === search || itm === search || lbl.includes(search) || itm.includes(search);
  });
  var cleanTerm = term.toString().trim().replace(/[?!.,;:]+$/, '').trim();
  if (!matches.length) {
    return '%X% "' + cleanTerm + '" not found in any truck.';
  }
  var out = '%S% Found "' + cleanTerm + '" in:\n';
  matches.forEach(function(r) {
    var layer = r[6] ? ' (' + r[6] + ')' : '';
    out += '  %T% ' + r[0] + ' - ' + r[1] + layer + '\n';
  });
  return out.trim();
}

function findItemByCaseId(caseId) {
  const data = readManifestData();
  if (!data) return '%X% Manifest tab not found.';
  const matches = data.filter(r => String(r[4]).trim() === String(caseId).trim());
  if (matches.length === 0) return '%X% Case #' + caseId + ' not found in any truck.';
  const lines = matches.map(r => {
    const label = r[5] ? r[5] + ' - ' : '';
    const item = r[1] || '';
    const size = r[2] ? ', ' + r[2] : '';
    const scanned = r[7] === '✓' ? ' %Y%' : '';
    return '  %T% ' + r[0] + ' -- ' + label + item + size + scanned;
  });
  return '%S% Case #' + caseId + ':\n' + lines.join('\n');
}

// - Sheet I/O --------------------------------------------

