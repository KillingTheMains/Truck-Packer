function readTruckData() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(STATUS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
}

function readManifestData() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(MANIFEST_SHEET);
  if (!sheet) return null;
  if (sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, 9).getValues();
}

function writeStatusToSheet(trucksPayload) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const statusSheet = ss.getSheetByName(STATUS_SHEET);
  const lastRow = statusSheet.getLastRow();
  if (lastRow < 2) return;
  const data = statusSheet.getRange(2, 1, lastRow - 1, 4).getValues();
  const now = Date.now();
  Logger.log('trucks with manifest: ' + Object.keys(trucksPayload).filter(function(k){return trucksPayload[k].manifest&&trucksPayload[k].manifest.length>0;}).join(','));
  Logger.log('total trucks in payload: ' + Object.keys(trucksPayload).length);
  Logger.log('manifest_trucks:' + Object.keys(trucksPayload).filter(function(k){return trucksPayload[k].manifest&&trucksPayload[k].manifest.length>0;}).join(','));
  Logger.log('total:' + Object.keys(trucksPayload).length);
  Object.keys(trucksPayload).forEach(truckId => {
    const rowIdx = data.findIndex(r => String(r[0]).toUpperCase() === truckId.toUpperCase());
    if (rowIdx === -1) return;
    const truck = trucksPayload[truckId];
    statusSheet.getRange(rowIdx + 2, 3).setValue(truck.status || 'pending');
    statusSheet.getRange(rowIdx + 2, 4).setValue(truck.loadedAt || now);
    if (truck.manifest && truck.manifest.length > 0) {
      try { writeManifestForTruck(ss, truckId, truck.manifest, now); } catch(me) {}
    }
  });
}

function writeManifestForTruck(ss, truckId, items, now) {
  const sheet = ss.getSheetByName(MANIFEST_SHEET);
  if (!sheet) return;
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    const col1 = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (let i = lastRow; i >= 2; i--) {
      if (String(col1[i - 2][0]).toUpperCase() === truckId.toUpperCase()) {
        sheet.deleteRow(i);
      }
    }
  }
  const rows = items.filter(item => item != null).map(item => [
    truckId,
    item.item || '',
    item.size || '',
    item.color || '',
    item.caseId || '',
    item.label || '',
    item.layer || '',
    item.scanned ? 'Y' : 'o',
    now
  ]);
  if (rows.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
  }
}

// - Trailer Packer Data: Load from PackData tab ------------------------
function loadPackerData_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var trucks = {};
  var packSheet = ss.getSheetByName('PackData');
  if (packSheet && packSheet.getLastRow() >= 2) {
    var rows = packSheet.getRange(2, 1, packSheet.getLastRow() - 1, 2).getValues();
    rows.forEach(function(row) {
      var id = row[0], json = row[1];
      if (id && json) { try { trucks[String(id)] = JSON.parse(json); } catch(e) {} }
    });
  }
  var truckLoaded = {};
  var statusSheet = ss.getSheetByName(STATUS_SHEET);
  if (statusSheet && statusSheet.getLastRow() >= 2) {
    var sRows = statusSheet.getRange(2, 1, statusSheet.getLastRow() - 1, 4).getValues();
    sRows.forEach(function(row) {
      var id = row[0], status = row[2], updatedAt = row[3];
      if (id && status && status !== 'pending') {
        truckLoaded[String(id)] = { status: String(status), loadedAt: String(updatedAt || '') };
      if (truckLoaded[id] && row[3]) { truckLoaded[id].loadedAt = new Date(row[3]).getTime(); }
        }
    });
  }
  return { trucks: trucks, truckLoaded: truckLoaded };
}

// - Trailer Packer Data: Save to PackData tab ------------------------
function savePackerData_(trucks, truckLoaded) {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var nowMs = Date.now(); // Unix ms -- consistent format for all timestamps

  var packSheet = ss.getSheetByName('PackData');
  if (!packSheet) {
    packSheet = ss.insertSheet('PackData');
    packSheet.appendRow(['TruckID', 'Data', 'UpdatedAt']);
    packSheet.setFrozenRows(1);
    packSheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  }

  var lastRow = packSheet.getLastRow();
  var rowMap = {};
  if (lastRow >= 2) {
    var ids = packSheet.getRange(2, 1, lastRow - 1, 1).getValues();
    ids.forEach(function(row, i) { if (row[0]) rowMap[String(row[0])] = i + 2; });
  }

  Object.keys(trucks).forEach(function(id) {
    var data = trucks[id];
    var hasData = data.placed && Object.keys(data.placed).length > 0;
    if (!hasData && !rowMap[id]) return;
    var json = JSON.stringify(data);
    if (rowMap[id]) {
      packSheet.getRange(rowMap[id], 2, 1, 2).setValues([[json, nowMs]]);
    } else {
      packSheet.appendRow([id, json, nowMs]);
      rowMap[id] = packSheet.getLastRow();
    }
  });

  var statusSheet = ss.getSheetByName(STATUS_SHEET);
  if (statusSheet && statusSheet.getLastRow() >= 2) {
    var statusData = statusSheet.getRange(2, 1, statusSheet.getLastRow() - 1, 4).getValues();
    statusData.forEach(function(row, i) {
      var id = String(row[0]);
      if (!id) return;
      var loaded = truckLoaded[id] || truckLoaded[id.toUpperCase()];
      var newStatus = loaded ? (loaded.status || 'loaded') : 'pending';
      var statusChanged = String(row[2]) !== newStatus;
      // Always write loaded trucks so their individual loadedAt stays accurate;
      // only update pending trucks when status actually changes.
      if (statusChanged || loaded) {
        var newTime = loaded ? (loaded.loadedAt || nowMs) : nowMs;
        statusSheet.getRange(i + 2, 3, 1, 2).setValues([[newStatus, newTime]]);
      }
    });
  }
}

// - Write pre-computed Manifest rows to sheet ------------------------
function writePackerManifest_(rows) {
  Logger.log('WPM called, rows=' + (rows ? rows.length : 'NULL'));
  var ss = SpreadsheetApp.openById(SHEET_ID)
  var sheet = ss.getSheetByName('Manifest');
  if (!sheet) { throw new Error('NO_SHEET:'+ss.getSheets().map(function(s){return s.getName();}).join(',')); }
  var last = sheet.getLastRow();
  if (last >= 2) {
    sheet.getRange(2, 1, last - 1, sheet.getMaxColumns()).clearContent();
  }
  if (rows.length > 0) {
    sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
    SpreadsheetApp.flush();
  }
  try { writeManifestSummary_(sheet, rows); } catch(se) { Logger.log('Summary err: ' + se); }
  return rows.length;
}

function writeManifestSummary_(sheet, rows) {
  var itemCounts = {};
  var eights = 0, fours = 0;
  rows.forEach(function(row) {
    var name = (row[1] || '').toString();
    var size = (row[2] || '').toString();
    itemCounts[name] = (itemCounts[name] || 0) + 1;
    var nu = name.toUpperCase();
    if (nu.indexOf('F-TYPE') >= 0 || nu.indexOf('F TYPE') >= 0) {
      var wm = size.match(/^(\d+)[\x27]/);
      if (wm) {
        var w = parseInt(wm[1]);
        if (w === 4)        fours  += 1;
        else if (w === 8)  eights += 1;
        else if (w === 16) eights += 2;
        else if (w === 24) eights += 3;
        else if (w === 20) { eights += 2; fours += 1; }
      }
    }
  });
  var sorted = Object.keys(itemCounts).sort(function(a,b){ return itemCounts[b]-itemCounts[a]||a.localeCompare(b); });
  var sumRows = [['ITEM COUNTS', '']];
  sorted.forEach(function(n){ sumRows.push([n, itemCounts[n]]); });
  sumRows.push(['', '']);
  sumRows.push(['F-TYPE PIECES', '']);
  sumRows.push([' 8\' sticks', eights]);
  sumRows.push([' 4\' sticks', fours]);
  if (sheet.getMaxColumns() < 11) { sheet.insertColumnsAfter(sheet.getMaxColumns(), 11 - sheet.getMaxColumns()); }
  sheet.getRange(1, 10, 60, 2).clearContent();
  sheet.getRange(1, 10, sumRows.length, 2).setValues(sumRows);
}

// - FULL STATUS SUMMARY -
function getWakeUpSummary() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var tz = Session.getScriptTimeZone();
  var now = new Date();
  var dateStr = Utilities.formatDate(now, tz, "EEEE, MMMM d, yyyy") +
                " AT " + Utilities.formatDate(now, tz, "h:mm a z");
  var statusSheet = ss.getSheetByName("Status");
  var sLast = statusSheet.getLastRow();
  var sData = sLast > 1 ? statusSheet.getRange(2, 1, sLast - 1, 3).getValues() : [];
  var statusCounts = {};
  var loadedIds = {};
  sData.forEach(function(row) {
    var s = (row[2] || "").toString().trim().toUpperCase() || "UNKNOWN";
    statusCounts[s] = (statusCounts[s] || 0) + 1;
    if (s === "LOADED") loadedIds[row[0].toString().trim().toUpperCase()] = true;
  });
  var mSheet = ss.getSheetByName("Manifest");
  var caseSet = {};
  if (mSheet) {
    var mLast = mSheet.getLastRow();
    if (mLast > 1) {
      var mData = mSheet.getRange(2, 1, mLast - 1, 5).getValues();
      mData.forEach(function(row) {
        var truck = (row[0] || "").toString().trim().toUpperCase();
        var caseId = (row[4] || "").toString().trim();
        if (loadedIds[truck] && caseId) caseSet[caseId] = true;
      });
    }
  }
  var out = [];
  out.push("=== FULL STATUS SUMMARY ===");
  out.push(dateStr);
  out.push("");
  out.push("--- TRAILER STATUS ---");
  var total = sData.length;
  Object.keys(statusCounts).sort().forEach(function(s) {
    var cnt = statusCounts[s];
    var pct = total > 0 ? Math.round(cnt / total * 100) : 0;
    out.push(s + ": " + cnt + " OF " + total + " (" + pct + "%)");
  });
  var lcLines = getLiveCountLines_();
  if (lcLines.length) {
    out.push('');
    out.push('--- LIVE COUNTS ---');
    lcLines.forEach(function(l){ out.push(l); });
  }
  return out.join("\n");
}

// - Activity Log helpers ------------------------------------------------
function getOrCreateLogSheet_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('Log');
  if (!sheet) {
    sheet = ss.insertSheet('Log');
    var hdr = sheet.getRange(1, 1, 1, 7);
    hdr.setValues([['Timestamp','Date/Time','Type','Truck','Status','Details','Message']]);
    hdr.setFontWeight('bold').setBackground('#0f1b33').setFontColor('#90A4AE');
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(1, 130);
    sheet.setColumnWidth(2, 150);
    sheet.setColumnWidth(3, 110);
    sheet.setColumnWidth(4, 70);
    sheet.setColumnWidth(5, 90);
    sheet.setColumnWidth(6, 220);
    sheet.setColumnWidth(7, 400);
  }
  return sheet;
}

function writeLogEntry_(entry) {
  var sheet = getOrCreateLogSheet_();
  var tz = Session.getScriptTimeZone();
  var dt = new Date(entry.ts || Date.now());
  var formatted = Utilities.formatDate(dt, tz, 'dd MMM yyyy HH:mm:ss');
  sheet.appendRow([
    dt,
    formatted,
    entry.type   || '',
    entry.truckId || '',
    entry.status  || '',
    entry.details || '',
    entry.raw     || ''
  ]);
}

// - Live Counts (Manifest tab - counts + F-type breakdown) ----------------
function getLiveCountLines_() {
  var ss = SpreadsheetApp.openById(SHEET_ID);
  var sheet = ss.getSheetByName('Manifest');
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow()-1, 3).getValues();
  var counts = {}, eights = 0, fours = 0;
  data.forEach(function(row) {
    var item = (row[1]||'').toString().trim();
    if (!item) return;
    counts[item] = (counts[item]||0) + 1;
    var name = item.toUpperCase();
    if (name.indexOf('F-TYPE') >= 0 || name.indexOf('F TYPE') >= 0) {
      var m = name.match(/(\d+)[\x27]/);
      if (m) {
        var len = parseInt(m[1]);
        if (len===4)        fours  += 1;
        else if (len===8)  eights += 1;
        else if (len===16) eights += 2;
        else if (len===24) eights += 3;
        else if (len===20) { eights += 2; fours += 1; }
      }
    }
  });
  var sorted = Object.keys(counts).sort(function(a,b){ return counts[b]-counts[a]; });
  var total = sorted.reduce(function(s,k){ return s+counts[k]; }, 0);
  var lines = [];
  sorted.forEach(function(k){ lines.push(k + ': ' + counts[k]); });
  lines.push('TOTAL: ' + total);
  if (eights > 0 || fours > 0) {
    lines.push('');
    lines.push('F-TYPE STICKS:');
    if (eights > 0) lines.push("  8' PIECES: " + eights);
    if (fours  > 0) lines.push("  4' PIECES: " + fours);
  }
  return lines;
}

function getLiveCounts() {
  var lines = getLiveCountLines_();
  if (!lines.length) return 'NO MANIFEST DATA - PACK SOME TRUCKS FIRST.';
  return '=== LIVE COUNTS ===\n\n' + lines.join('\n');
}

// - Hourly Status Summary (DISABLED) --------------------------------------------
function sendHourlyStatus() {
  return; // DISABLED -- hourly auto-posts turned off
}

function setWebhookUrl(url) {
  PropertiesService.getScriptProperties().setProperty('CHAT_WEBHOOK_URL', url);
  Logger.log('Webhook URL saved successfully.');
}

function setupHourlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'sendHourlyStatus') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('sendHourlyStatus').timeBased().everyHours(1).create();
  Logger.log('Hourly trigger installed. CLAUDIA will post between 7am-7pm.');
}

function removeHourlyTrigger() {
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'sendHourlyStatus') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Hourly trigger removed.');
}

