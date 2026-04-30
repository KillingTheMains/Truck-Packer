// ── Dashboard Web App ────────────────────────────────────────────────────────

function getRecentActivity_() {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('Log');
    if (!sheet || sheet.getLastRow() < 2) return [];
    var last  = sheet.getLastRow();
    var count = Math.min(8, last - 1);
    var rows  = sheet.getRange(last - count + 1, 1, count, 6).getValues();
    return rows.reverse().map(function(row) {
      return {
        ts:     row[0] ? new Date(row[0]).getTime() : 0,
        truck:  String(row[3] || '').trim().toUpperCase(),
        status: String(row[4] || '').trim().toLowerCase()
      };
    }).filter(function(r) { return r.truck; });
  } catch(e) { return []; }
}

function getManifestForTruck(truckId) {
  try {
    var ss    = SpreadsheetApp.openById(SHEET_ID);
    var sheet = ss.getSheetByName('Manifest');
    if (!sheet || sheet.getLastRow() < 2) return '[]';
    var rows  = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
    var items = rows
      .filter(function(r) { return String(r[0]||'').trim().toUpperCase() === truckId.trim().toUpperCase(); })
      .map(function(r)    { return { item: String(r[1]||'').trim(), size: String(r[2]||'').trim(), caseId: String(r[4]||'').trim() }; })
      .filter(function(r) { return r.item; });
    return JSON.stringify(items);
  } catch(e) { return '[]'; }
}

function getDashData() {
  var data = readTruckData();
  var g = { loaded:[], unloaded:[], backloaded:[], empty:[], staged:[], pending:[] };
  data.forEach(function(r) {
    var id = String(r[0]).toUpperCase();
    var st = String(r[2] || 'pending').toLowerCase();
    if (!g[st]) st = 'pending';
    g[st].push({ id: id, ts: Number(r[3] || 0) });
  });
  g.loaded.sort(function(a, b) { return b.ts - a.ts; });
  return JSON.stringify({
    loaded:     g.loaded.map(function(t)     { return t.id; }),
    unloaded:   g.unloaded.map(function(t)   { return t.id; }),
    backloaded: g.backloaded.map(function(t) { return t.id; }),
    empty:      g.empty.map(function(t)      { return t.id; }),
    staged:     g.staged.map(function(t)     { return t.id; }),
    pending:    g.pending.map(function(t)    { return t.id; }),
    total:    data.length,
    at:       Date.now(),
    activity: getRecentActivity_()
  });
}

function doGet(e) {
  var data = readTruckData();
  var g = { loaded:[], unloaded:[], backloaded:[], empty:[], staged:[], pending:[] };
  data.forEach(function(r) {
    var id = String(r[0]).toUpperCase();
    var st = String(r[2] || 'pending').toLowerCase();
    if (!g[st]) st = 'pending';
    g[st].push({ id: id, ts: Number(r[3] || 0) });
  });
  g.loaded.sort(function(a, b) { return b.ts - a.ts; });
  var sd = JSON.stringify({
    loaded:     g.loaded.map(function(t)     { return t.id; }),
    unloaded:   g.unloaded.map(function(t)   { return t.id; }),
    backloaded: g.backloaded.map(function(t) { return t.id; }),
    empty:      g.empty.map(function(t)      { return t.id; }),
    staged:     g.staged.map(function(t)     { return t.id; }),
    pending:    g.pending.map(function(t)    { return t.id; }),
    total:    data.length,
    at:       Date.now(),
    activity: getRecentActivity_()
  });
  return HtmlService.createHtmlOutput(buildDashHtml_(sd))
    .setTitle('SAP Sapphire — Truck Status')
    .setSandboxMode(HtmlService.SandboxMode.IFRAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function buildDashHtml_(sd) {
  var REFRESH_MS = 480000;
  var parsed   = JSON.parse(sd);
  var total    = parsed.total;
  var at       = new Date(parsed.at);
  var ath      = at.getHours() % 12 || 12;
  var atm      = at.getMinutes();
  var atap     = at.getHours() >= 12 ? 'PM' : 'AM';
  var updStr   = ath + ':' + (atm < 10 ? '0' + atm : atm) + ' ' + atap;
  var activity = parsed.activity || [];

  var ORDER  = ['loaded','unloaded','backloaded','empty','staged','pending'];
  var LABELS = { loaded:'LOADED', unloaded:'UNLOADED', backloaded:'BACKLOADED', empty:'EMPTY', staged:'STAGED', pending:'PENDING' };
  var ICONS  = { loaded:'✓', unloaded:'○', backloaded:'↩', empty:'✕', staged:'▶', pending:'—' };

  // JS DATA object for client-side hero switching
  var jsData = '{';
  ORDER.forEach(function(k, i) {
    var cnt = (parsed[k] || []).length;
    var p   = total > 0 ? Math.round(cnt / total * 100) : 0;
    jsData += (i ? ',' : '') + '"' + k + '":{n:' + cnt + ',p:' + p + ',lbl:"' + LABELS[k] + '"}';
  });
  jsData += '}';

  var heroCnt = (parsed.loaded || []).length;
  var heroPct = total > 0 ? Math.round(heroCnt / total * 100) : 0;

  // Selector buttons
  var selHtml = '';
  ORDER.forEach(function(k) {
    var cnt = (parsed[k] || []).length;
    var act = k === 'loaded' ? ' active' : '';
    selHtml += '<button class="hsel-btn ' + k + act + '" data-st="' + k + '" onclick="setHero(\'' + k + '\')">' + LABELS[k] + ' ' + cnt + '</button>';
  });

  // Grid cards with clickable chips
  var gridHtml = '';
  ORDER.forEach(function(k) {
    var ids   = parsed[k] || [];
    var cnt   = ids.length;
    var p     = total > 0 ? Math.round(cnt / total * 100) : 0;
    var chips = ids.map(function(id) {
      return '<span class="chip" onclick="openManifest(\'' + id + '\',\'' + k + '\')">' + id + '</span>';
    }).join('');
    gridHtml +=
      '<div class="card panel ' + k + '">' +
        '<div class="card-side"></div>' +
        '<span class="cor tl"></span><span class="cor tr"></span>' +
        '<span class="cor bl"></span><span class="cor br"></span>' +
        '<div class="card-head" onclick="setHero(\'' + k + '\')" style="cursor:pointer">' +
          '<div class="card-lbl">' + ICONS[k] + ' ' + LABELS[k] + '</div>' +
          '<div class="card-pct ' + k + '-clr" id="cpct-' + k + '">' + p + '%</div>' +
        '</div>' +
        '<div class="card-num" id="num-' + k + '" onclick="setHero(\'' + k + '\')" style="cursor:pointer">' + cnt + '</div>' +
        '<div class="card-bar-w"><div class="card-bar" id="cbar-' + k + '" style="width:' + p + '%"></div></div>' +
        '<div class="truck-list" id="list-' + k + '">' + chips + '</div>' +
      '</div>';
  });

  // Recent activity ticker
  var tickerHtml = '';
  if (activity.length > 0) {
    activity.slice(0, 6).forEach(function(a) {
      var st  = (a.status || 'pending').toLowerCase();
      var cls = ORDER.indexOf(st) >= 0 ? st : 'pending';
      tickerHtml +=
        '<div class="tick-item">' +
          '<span class="tick-dot ' + cls + '-bg"></span>' +
          '<span class="tick-truck">' + a.truck + '</span>' +
          '<span class="tick-arrow">→</span>' +
          '<span class="tick-status ' + cls + '-clr">' + st.toUpperCase() + '</span>' +
          '<span class="tick-ago" data-ts="' + a.ts + '"></span>' +
        '</div>';
    });
  } else {
    tickerHtml = '<div class="tick-dim">No recent activity</div>';
  }

  // Last change in header
  var lastHtml = '';
  if (activity.length > 0) {
    var la    = activity[0];
    var laCls = ORDER.indexOf((la.status||'').toLowerCase()) >= 0 ? la.status.toLowerCase() : 'pending';
    lastHtml =
      '<div class="meta" id="last-change">LAST ' +
        '<span style="color:#fff">' + la.truck + '</span>' +
        ' → ' +
        '<span class="' + laCls + '-clr">' + (la.status||'').toUpperCase() + '</span>' +
        ' <span class="tick-ago" data-ts="' + la.ts + '"></span>' +
      '</div>';
  }

  // Activity JSON for client
  var actJson = JSON.stringify(activity.slice(0, 8).map(function(a) {
    return { ts: a.ts, truck: a.truck, status: (a.status||'pending').toLowerCase() };
  }));

  var css =
    ':root{--bg:#060c18;--bg2:#0a1526;--border:#1a3354;' +
    '--loaded:#00e676;--unloaded:#ffd740;--backloaded:#ff9100;--empty:#ff4560;--staged:#448aff;' +
    '--pending:#546e7a;--accent:#40c4ff;--text:#cdd9e8;--dim:#4a6080;}' +
    '*{box-sizing:border-box;margin:0;padding:0;}' +
    'body{background:var(--bg);color:var(--text);font-family:"Share Tech Mono",monospace;min-height:100vh;overflow-x:hidden;}' +
    'body::before{content:"";position:fixed;inset:0;' +
      'background:repeating-linear-gradient(0deg,transparent,transparent 39px,rgba(26,51,84,.1) 40px),' +
      'repeating-linear-gradient(90deg,transparent,transparent 39px,rgba(26,51,84,.06) 40px);' +
      'pointer-events:none;z-index:0;}' +
    '#app{position:relative;z-index:1;max-width:960px;margin:0 auto;padding:16px;}' +
    '.panel{border:1px solid var(--border);background:var(--bg2);position:relative;overflow:hidden;}' +
    '.panel::after{content:"";position:absolute;top:0;left:0;right:0;height:2px;' +
      'background:linear-gradient(90deg,transparent,var(--accent),transparent);opacity:.4;pointer-events:none;}' +
    '.cor{position:absolute;width:10px;height:10px;border-color:var(--accent);border-style:solid;opacity:.35;}' +
    '.tl{top:5px;left:5px;border-width:1px 0 0 1px;}' +
    '.tr{top:5px;right:5px;border-width:1px 1px 0 0;}' +
    '.bl{bottom:5px;left:5px;border-width:0 0 1px 1px;}' +
    '.br{bottom:5px;right:5px;border-width:0 1px 1px 0;}' +
    '.loaded-clr{color:var(--loaded)}.unloaded-clr{color:var(--unloaded)}.backloaded-clr{color:var(--backloaded)}.empty-clr{color:var(--empty)}.staged-clr{color:var(--staged)}.pending-clr{color:var(--pending)}' +
    '.loaded-bg{background:var(--loaded);box-shadow:0 0 5px var(--loaded)}.unloaded-bg{background:var(--unloaded)}.backloaded-bg{background:var(--backloaded)}.empty-bg{background:var(--empty)}.staged-bg{background:var(--staged);box-shadow:0 0 5px var(--staged)}.pending-bg{background:var(--pending)}' +
    '.hdr{padding:18px 24px;margin-bottom:10px;}' +
    '.hdr-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;}' +
    '.hdr-title{font-family:"Orbitron",monospace;font-size:clamp(18px,4vw,28px);font-weight:900;letter-spacing:.1em;color:#fff;text-shadow:0 0 22px rgba(64,196,255,.55);}' +
    '.hdr-sub{font-size:13px;color:var(--dim);letter-spacing:.22em;margin-top:4px;}' +
    '.hdr-meta{display:flex;gap:16px;margin-top:12px;flex-wrap:wrap;align-items:center;}' +
    '.live-dot{width:8px;height:8px;border-radius:50%;background:var(--loaded);box-shadow:0 0 8px var(--loaded);animation:pulse 2s infinite;flex-shrink:0;}' +
    '@keyframes pulse{0%,100%{opacity:1}50%{opacity:.2}}' +
    '.meta{font-size:13px;color:var(--dim);letter-spacing:.07em;}' +
    '.meta span{color:var(--accent);}' +
    '.mode-btn{background:transparent;border:1px solid var(--border);color:var(--dim);font-family:"Share Tech Mono",monospace;font-size:11px;letter-spacing:.12em;padding:6px 12px;cursor:pointer;transition:all .2s;white-space:nowrap;flex-shrink:0;}' +
    '.mode-btn:hover,.mode-btn.active{border-color:var(--accent);color:var(--accent);}' +
    '.ticker-panel{padding:12px 20px;margin-bottom:10px;}' +
    '.ticker-title{font-size:10px;letter-spacing:.25em;color:var(--dim);margin-bottom:8px;}' +
    '.ticker-list{display:flex;flex-wrap:wrap;gap:6px 20px;}' +
    '.tick-item{display:flex;align-items:center;gap:6px;font-size:12px;}' +
    '.tick-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0;}' +
    '.tick-truck{color:#fff;letter-spacing:.05em;}' +
    '.tick-arrow{color:var(--dim);}' +
    '.tick-status{font-size:11px;}' +
    '.tick-ago{color:var(--dim);font-size:10px;}' +
    '.tick-dim{color:var(--dim);font-size:12px;}' +
    '.hero{padding:24px 24px 20px;margin-bottom:10px;text-align:center;}' +
    '.hsel{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:20px;justify-content:center;}' +
    '.hsel-btn{background:transparent;border:1px solid var(--border);color:var(--dim);font-family:"Share Tech Mono",monospace;font-size:12px;letter-spacing:.12em;padding:6px 14px;cursor:pointer;transition:all .2s;}' +
    '.hsel-btn.loaded.active{border-color:var(--loaded);color:var(--loaded);box-shadow:0 0 10px rgba(0,230,118,.2);}' +
    '.hsel-btn.unloaded.active{border-color:var(--unloaded);color:var(--unloaded);box-shadow:0 0 10px rgba(255,215,64,.2);}' +
    '.hsel-btn.backloaded.active{border-color:var(--backloaded);color:var(--backloaded);box-shadow:0 0 10px rgba(255,145,0,.2);}' +
    '.hsel-btn.empty.active{border-color:var(--empty);color:var(--empty);box-shadow:0 0 10px rgba(255,69,96,.2);}' +
    '.hsel-btn.staged.active{border-color:var(--staged);color:var(--staged);box-shadow:0 0 10px rgba(68,138,255,.2);}' +
    '.hsel-btn.pending.active{border-color:var(--pending);color:var(--pending);}' +
    '.hero-num{font-family:"Orbitron",monospace;font-size:clamp(52px,13vw,84px);font-weight:900;color:#fff;line-height:1;transition:text-shadow .3s;}' +
    '.hero-denom{font-size:clamp(24px,5vw,36px);color:var(--dim);}' +
    '.hero-lbl{font-size:15px;letter-spacing:.28em;color:var(--dim);margin-top:6px;}' +
    '.bar-wrap{height:5px;background:#09172b;border-radius:3px;overflow:hidden;margin:20px 0 8px;}' +
    '.bar{height:100%;border-radius:3px;transition:width .8s ease,background .3s,box-shadow .3s;}' +
    '.pct-lbl{font-family:"Orbitron",monospace;font-size:15px;transition:color .3s;}' +
    '.tbtn{display:inline-flex;align-items:center;gap:8px;background:transparent;border:1px solid var(--border);color:var(--accent);font-family:"Share Tech Mono",monospace;font-size:13px;letter-spacing:.14em;padding:9px 22px;cursor:pointer;transition:all .2s;margin-top:18px;}' +
    '.tbtn:hover{border-color:var(--accent);background:rgba(64,196,255,.05);box-shadow:0 0 16px rgba(64,196,255,.12);}' +
    '.arr{display:inline-block;transition:transform .3s;}' +
    '.tbtn.open .arr{transform:rotate(180deg);}' +
    '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-bottom:10px;}' +
    '.card{padding:18px 20px;cursor:pointer;min-height:120px;}' +
    '.card:hover{border-color:var(--accent)!important;}' +
    '.card::after{display:none;}' +
    '.card-side{position:absolute;top:0;left:0;bottom:0;width:3px;}' +
    '.card.loaded   .card-side{background:var(--loaded);box-shadow:0 0 10px var(--loaded);}' +
    '.card.unloaded .card-side{background:var(--unloaded);box-shadow:0 0 10px var(--unloaded);}' +
    '.card.backloaded .card-side{background:var(--backloaded);box-shadow:0 0 10px var(--backloaded);}' +
    '.card.empty   .card-side{background:var(--empty);box-shadow:0 0 10px var(--empty);}' +
    '.card.staged  .card-side{background:var(--staged);box-shadow:0 0 10px var(--staged);}' +
    '.card.pending .card-side{background:var(--pending);}' +
    '.card-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;}' +
    '.card-lbl{font-size:13px;letter-spacing:.18em;color:var(--dim);}' +
    '.card-pct{font-size:13px;}' +
    '.card-num{font-family:"Orbitron",monospace;font-size:44px;font-weight:900;color:#fff;line-height:1;}' +
    '.card.loaded    .card-num{text-shadow:0 0 14px rgba(0,230,118,.4);}' +
    '.card.unloaded  .card-num{text-shadow:0 0 14px rgba(255,215,64,.3);}' +
    '.card.backloaded .card-num{text-shadow:0 0 14px rgba(255,145,0,.3);}' +
    '.card.empty     .card-num{text-shadow:0 0 14px rgba(255,69,96,.3);}' +
    '.card.staged    .card-num{text-shadow:0 0 14px rgba(68,138,255,.3);}' +
    '.card-bar-w{margin-top:12px;height:2px;background:#09172b;border-radius:1px;overflow:hidden;}' +
    '.card-bar{height:100%;border-radius:1px;}' +
    '.card.loaded   .card-bar{background:var(--loaded);}' +
    '.card.unloaded .card-bar{background:var(--unloaded);}' +
    '.card.backloaded .card-bar{background:var(--backloaded);}' +
    '.card.empty   .card-bar{background:var(--empty);}' +
    '.card.staged  .card-bar{background:var(--staged);}' +
    '.card.pending .card-bar{background:var(--pending);}' +
    '.truck-list{margin-top:12px;display:none;line-height:2.2;}' +
    '.truck-list.show{display:block;}' +
    '.chip{display:inline-block;margin:2px 3px;padding:2px 8px;border:1px solid;border-radius:1px;font-size:11px;letter-spacing:.06em;cursor:pointer;transition:opacity .15s;}' +
    '.chip:hover{opacity:.6;}' +
    '.card.loaded   .chip{border-color:rgba(0,230,118,.3);color:rgba(0,230,118,.85);}' +
    '.card.unloaded .chip{border-color:rgba(255,215,64,.3);color:rgba(255,215,64,.85);}' +
    '.card.backloaded .chip{border-color:rgba(255,145,0,.3);color:rgba(255,145,0,.85);}' +
    '.card.empty   .chip{border-color:rgba(255,69,96,.3);color:rgba(255,69,96,.85);}' +
    '.card.staged  .chip{border-color:rgba(68,138,255,.3);color:rgba(68,138,255,.85);}' +
    '.card.pending .chip{border-color:rgba(84,110,122,.3);color:rgba(84,110,122,.85);}' +
    '@keyframes glow-pop{0%{opacity:1}25%{opacity:.3;transform:scale(1.06)}100%{opacity:1;transform:scale(1)}}' +
    '.glow-pop{animation:glow-pop .7s ease;}' +
    '.modal{position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:100;display:none;align-items:center;justify-content:center;}' +
    '.modal-box{background:var(--bg2);border:1px solid var(--border);padding:28px;max-width:520px;width:92%;max-height:80vh;overflow-y:auto;position:relative;}' +
    '.modal-box::after{display:none;}' +
    '.modal-close{position:absolute;top:14px;right:18px;background:none;border:none;color:var(--dim);font-size:18px;cursor:pointer;padding:4px 8px;font-family:"Share Tech Mono",monospace;}' +
    '.modal-close:hover{color:#fff;}' +
    '.modal-title{font-family:"Orbitron",monospace;font-size:20px;font-weight:900;margin-bottom:4px;}' +
    '.modal-sub{font-size:11px;letter-spacing:.2em;margin-bottom:20px;opacity:.7;}' +
    '.mitem{display:flex;align-items:baseline;gap:12px;padding:9px 0;border-bottom:1px solid rgba(26,51,84,.6);}' +
    '.mitem:last-child{border-bottom:none;}' +
    '.mitem-name{flex:1;color:var(--text);font-size:13px;}' +
    '.mitem-size{color:var(--dim);font-size:11px;white-space:nowrap;}' +
    '.mitem-case{color:var(--accent);font-size:11px;white-space:nowrap;}' +
    '.mloading{color:var(--dim);padding:24px 0;text-align:center;letter-spacing:.1em;}' +
    '.merr{color:var(--empty);padding:24px 0;text-align:center;}' +
    '.footer{text-align:center;font-size:11px;color:var(--dim);letter-spacing:.13em;padding:12px 0;border-top:1px solid #0c1b30;}' +
    'body.kiosk .hero-num{font-size:clamp(90px,22vw,140px);}' +
    'body.kiosk .card-num{font-size:64px;}' +
    'body.kiosk .card{min-height:160px;}' +
    'body.kiosk .ticker-panel{display:none;}' +
    'body.kiosk .footer{display:none;}' +
    'body.kiosk .hdr-title{font-size:clamp(24px,5vw,36px);}' +
    'body.kiosk .hdr-sub{font-size:15px;}' +
    'body.kiosk .meta{font-size:15px;}' +
    '@media(max-width:520px){.grid{grid-template-columns:1fr 1fr;}.hero-num{font-size:54px;}.card-num{font-size:36px;}.ticker-list{flex-direction:column;}}';

  var js = [
    'var REFRESH=' + REFRESH_MS + ';',
    'var DATA=' + jsData + ';',
    'var TOTAL=' + total + ';',
    'var CLRS={loaded:"#00e676",unloaded:"#ffd740",backloaded:"#ff9100",empty:"#ff4560",staged:"#448aff",pending:"#546e7a"};',
    'var ACTIVITY=' + actJson + ';',
    'var showIds=false,kiosk=false,t0=Date.now(),currentHero="loaded";',
    'window.setHero=function(st){',
      'var d=DATA[st],c=CLRS[st];',
      'document.getElementById("hero-num").textContent=d.n;',
      'document.getElementById("hero-num").style.textShadow="0 0 40px "+c+"99";',
      'document.getElementById("hero-denom").textContent="/ "+TOTAL;',
      'document.getElementById("hero-lbl").textContent="TRUCKS "+d.lbl;',
      'var bar=document.getElementById("hero-bar");',
      'bar.style.width=d.p+"%";',
      'bar.style.background="linear-gradient(90deg,rgba(0,0,0,.3),"+c+")";',
      'bar.style.boxShadow="0 0 10px "+c;',
      'document.getElementById("hero-pct").textContent=d.p+"%";',
      'document.getElementById("hero-pct").style.color=c;',
      'document.querySelectorAll(".hsel-btn").forEach(function(b){b.classList.toggle("active",b.getAttribute("data-st")===st);});',
      'currentHero=st;savePrefs();',
    '};',
    'window.toggleIds=function(){',
      'showIds=!showIds;',
      'document.getElementById("tbtn-lbl").textContent=showIds?"HIDE TRUCK IDs":"SHOW TRUCK IDs";',
      'document.getElementById("tbtn").classList.toggle("open",showIds);',
      'document.querySelectorAll(".truck-list").forEach(function(el){el.classList.toggle("show",showIds);});',
      'savePrefs();',
    '};',
    'window.toggleKiosk=function(){',
      'kiosk=!kiosk;',
      'document.body.classList.toggle("kiosk",kiosk);',
      'var btn=document.getElementById("mode-btn");',
      'btn.textContent=kiosk?"⊟ NORMAL":"☁ KIOSK";',
      'btn.classList.toggle("active",kiosk);',
      'savePrefs();',
    '};',
    'window.openManifest=function(id,st){',
      'var clr=CLRS[st]||"#40c4ff";',
      'document.getElementById("modal-title").textContent=id+" MANIFEST";',
      'document.getElementById("modal-title").style.color=clr;',
      'document.getElementById("modal-sub").textContent=st.toUpperCase();',
      'document.getElementById("modal-sub").style.color=clr;',
      'document.getElementById("modal-body").innerHTML=\'<div class="mloading">LOADING...</div>\';',
      'document.getElementById("modal").style.display="flex";',
      'google.script.run',
        '.withSuccessHandler(function(json){renderManifest(JSON.parse(json));})' ,
        '.withFailureHandler(function(){document.getElementById("modal-body").innerHTML=\'<div class="merr">Could not load manifest.</div>\';})' ,
        '.getManifestForTruck(id);',
    '};',
    'window.closeManifest=function(ev){',
      'if(!ev||ev.target===document.getElementById("modal"))document.getElementById("modal").style.display="none";',
    '};',
    'function renderManifest(items){',
      'var el=document.getElementById("modal-body");',
      'if(!items||!items.length){el.innerHTML=\'<div class="merr">No manifest data found.</div>\';return;}',
      'el.innerHTML=items.map(function(it){',
        'return \'<div class="mitem"><span class="mitem-name">\'+it.item+\'</span>\'',
          '+(it.size?\'<span class="mitem-size">\'+it.size+\'</span>\':\'\')',
          '+(it.caseId?\'<span class="mitem-case">#\'+it.caseId+\'</span>\':\'\')',
          '+\'</div>\';',
      '}).join(\'\');',
    '}',
    'function updateAgoTimes(){',
      'var now=Date.now();',
      'document.querySelectorAll(".tick-ago").forEach(function(el){',
        'var ts=parseInt(el.getAttribute("data-ts")||"0");',
        'if(!ts){el.textContent="";return;}',
        'var d=Math.floor((now-ts)/60000);',
        'el.textContent=d<1?"just now":d===1?"1 min ago":d<60?d+" min ago":Math.floor(d/60)+" hr ago";',
      '});',
    '}',
    'function tick(){',
      'var n=new Date(),h=n.getHours()%12||12,m=n.getMinutes(),s=n.getSeconds(),ap=n.getHours()>=12?"PM":"AM";',
      'document.getElementById("clk").textContent=h+":"+(m<10?"0"+m:m)+":"+(s<10?"0"+s:s)+" "+ap;',
      'var left=Math.max(0,REFRESH-(Date.now()-t0));',
      'var mm=Math.floor(left/60000),ss=Math.floor((left%60000)/1000);',
      'var cdEl=document.getElementById("cdown");',
      'cdEl.textContent=mm+":"+(ss<10?"0"+ss:ss);',
      'if(left<=30000)cdEl.style.color="#ff4560";',
      'else if(left<=120000)cdEl.style.color="#ffd740";',
      'else cdEl.style.color="var(--accent)";',
      'if(left<=0){t0=Date.now();google.script.run.withSuccessHandler(doRefresh).withFailureHandler(function(){}).getDashData();}',
    '}',
    'function savePrefs(){try{localStorage.setItem("sap26_prefs",JSON.stringify({hero:currentHero,kiosk:kiosk,showIds:showIds}));}catch(e){}}',
    'function loadPrefs(){try{return JSON.parse(localStorage.getItem("sap26_prefs")||"{}");}catch(e){return {};}}',
    'function renderTicker(){' +
      'var ORDER=["loaded","unloaded","backloaded","empty","staged","pending"];' +
      'var el=document.querySelector(".ticker-list");' +
      'if(!el)return;' +
      'if(!ACTIVITY.length){el.innerHTML='<div class="tick-dim">No recent activity</div>';return;}' +
      'el.innerHTML=ACTIVITY.slice(0,6).map(function(a){' +
        'var st=(a.status||"pending").toLowerCase();' +
        'var cls=ORDER.indexOf(st)>=0?st:"pending";' +
        'return '<div class="tick-item"><span class="tick-dot '+cls+'-bg"></span><span class="tick-truck">'+a.truck+'</span><span class="tick-arrow">→</span><span class="tick-status '+cls+'-clr">'+st.toUpperCase()+'</span><span class="tick-ago" data-ts="'+a.ts+'"></span></div>';' +
      '}).join("");' +
      'updateAgoTimes();' +
    '}',
    'function renderLastChange(){' +
      'var ORDER=["loaded","unloaded","backloaded","empty","staged","pending"];' +
      'var el=document.getElementById("last-change");' +
      'if(!el||!ACTIVITY.length)return;' +
      'var la=ACTIVITY[0];' +
      'var cls=ORDER.indexOf((la.status||"").toLowerCase())>=0?la.status.toLowerCase():"pending";' +
      'el.innerHTML='LAST <span style="color:#fff">'+la.truck+'</span> → <span class="'+cls+'-clr">'+la.status.toUpperCase()+'</span> <span class="tick-ago" data-ts="'+la.ts+'"></span>';' +
      'updateAgoTimes();' +
    '}',
    'function doRefresh(sd){' +
      'try{' +
        'var parsed=JSON.parse(sd);' +
        'var total=parsed.total;' +
        'TOTAL=total;' +
        '["loaded","unloaded","backloaded","empty","staged","pending"].forEach(function(k){' +
          'var ids=parsed[k]||[];' +
          'var cnt=ids.length;' +
          'var p=total>0?Math.round(cnt/total*100):0;' +
          'if(DATA[k])DATA[k]={n:cnt,p:p,lbl:DATA[k].lbl};' +
          'var numEl=document.getElementById("num-"+k);if(numEl)numEl.textContent=cnt;' +
          'var barEl=document.getElementById("cbar-"+k);if(barEl)barEl.style.width=p+"%";' +
          'var pctEl=document.getElementById("cpct-"+k);if(pctEl)pctEl.textContent=p+"%";' +
          'var listEl=document.getElementById("list-"+k);' +
          'if(listEl)listEl.innerHTML=ids.map(function(id){' +
            'return '<span class="chip" data-id="'+id+'" data-st="'+k+'" onclick="openManifest(this.dataset.id,this.dataset.st)">'+id+'</span>';' +
          '}).join("");' +
          'document.querySelectorAll('.hsel-btn[data-st="'+k+'"]').forEach(function(b){b.textContent=(DATA[k]?DATA[k].lbl:k.toUpperCase())+" "+cnt;});' +
        '});' +
        'ACTIVITY=parsed.activity||[];' +
        't0=Date.now();' +
        'setHero(currentHero);' +
        'renderTicker();renderLastChange();updateAgoTimes();' +
        'var at=new Date(parsed.at);' +
        'var h=at.getHours()%12||12,m=at.getMinutes(),ap=at.getHours()>=12?"PM":"AM";' +
        'var syncEl=document.getElementById("synced-time");' +
        'if(syncEl)syncEl.textContent=h+":"+(m<10?"0"+m:m)+" "+ap;' +
      '}catch(e){}' +
    '}',
    'setInterval(tick,1000);tick();',
    'setInterval(updateAgoTimes,30000);updateAgoTimes();',
    '(function(){',
      'var el=document.getElementById("hero-num");',
      'if(el){void el.offsetWidth;el.classList.add("glow-pop");setTimeout(function(){el.classList.remove("glow-pop");},800);}',
    '})();',
    '(function(){var p=loadPrefs();if(p.hero&&DATA[p.hero]){setHero(p.hero);}if(p.kiosk)toggleKiosk();if(p.showIds)toggleIds();})();'
  ].join('');

  return '<!DOCTYPE html><html><head>' +
    '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>SAP Sapphire — Truck Status</title>' +
    '<link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Orbitron:wght@500;900&display=swap" rel="stylesheet">' +
    '<style>' + css + '</style>' +
    '</head><body>' +
    '<div id="app">' +
      '<div class="panel hdr">' +
        '<span class="cor tl"></span><span class="cor tr"></span>' +
        '<span class="cor bl"></span><span class="cor br"></span>' +
        '<div class="hdr-top">' +
          '<div>' +
            '<div class="hdr-title">SAP SAPPHIRE 2026</div>' +
            '<div class="hdr-sub">TRUCK OPERATIONS CENTER</div>' +
          '</div>' +
          '<button class="mode-btn" id="mode-btn" onclick="toggleKiosk()">☁ KIOSK</button>' +
        '</div>' +
        '<div class="hdr-meta">' +
          '<div class="live-dot"></div>' +
          '<div class="meta">CLOCK <span id="clk">--:--:--</span></div>' +
          '<div class="meta">REFRESH <span id="cdown">8:00</span></div>' +
          '<div class="meta">SYNCED <span id="synced-time">' + updStr + '</span></div>' +
          lastHtml +
        '</div>' +
      '</div>' +
      '<div class="panel ticker-panel">' +
        '<div class="ticker-title">RECENT ACTIVITY</div>' +
        '<div class="ticker-list">' + tickerHtml + '</div>' +
      '</div>' +
      '<div class="panel hero">' +
        '<span class="cor tl"></span><span class="cor tr"></span>' +
        '<span class="cor bl"></span><span class="cor br"></span>' +
        '<div class="hsel">' + selHtml + '</div>' +
        '<div class="hero-num" id="hero-num">' + heroCnt + '</div>' +
        '<div class="hero-denom" id="hero-denom">/ ' + total + '</div>' +
        '<div class="hero-lbl" id="hero-lbl">TRUCKS LOADED</div>' +
        '<div class="bar-wrap"><div class="bar" id="hero-bar" style="width:' + heroPct + '%;background:linear-gradient(90deg,rgba(0,100,50,.4),#00e676);box-shadow:0 0 10px #00e676;"></div></div>' +
        '<div class="pct-lbl" id="hero-pct" style="color:#00e676;">' + heroPct + '%</div>' +
        '<div><button class="tbtn" id="tbtn" onclick="toggleIds()">' +
          '<span id="tbtn-lbl">SHOW TRUCK IDs</span><span class="arr">▼</span>' +
        '</button></div>' +
      '</div>' +
      '<div class="grid">' + gridHtml + '</div>' +
      '<div class="footer">SAP SAPPHIRE 2026 — DATA REFRESHES EVERY 8 MIN — LIVE</div>' +
    '</div>' +
    '<div class="modal" id="modal" onclick="closeManifest(event)">' +
      '<div class="modal-box">' +
        '<button class="modal-close" onclick="closeManifest()">✕</button>' +
        '<div class="modal-title" id="modal-title"></div>' +
        '<div class="modal-sub" id="modal-sub"></div>' +
        '<div id="modal-body"></div>' +
      '</div>' +
    '</div>' +
    '<scr'+'ipt>' + js + '<'+'/script>' +
    '</body></html>';
}
