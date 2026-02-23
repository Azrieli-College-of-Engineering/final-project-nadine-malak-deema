/* ─── Auth Guard ─── */
const token = localStorage.getItem('auth_token');
const authUser = localStorage.getItem('auth_user') || 'student';

if (!token) {
  window.location.href = 'login.html';
}

/* ─── Populate user info ─── */
document.getElementById('displayUser').textContent = authUser;
document.getElementById('avatarLetter').textContent = authUser.charAt(0).toUpperCase();
document.getElementById('tokenShort').textContent = token ? token.substring(0, 18) + '...' : 'N/A';
document.getElementById('tokenDisplay').innerHTML =
  '<b>' + (token ? token.substring(0, 30) + '...</b><br><span style="opacity:0.5">' +
  token.substring(30, 60) + '...</span>' : 'No token found');

/* ─── EVENT LOG ─── */
const logEntries = [
  { ts: new Date().toLocaleTimeString(), lvl: 'ok', msg: 'Session token verified — user: ' + authUser },
  { ts: new Date(Date.now() - 5000).toLocaleTimeString(), lvl: 'ok', msg: 'Dashboard loaded successfully' },
  { ts: new Date(Date.now() - 12000).toLocaleTimeString(), lvl: 'warn', msg: 'CSP configured (Basic) — inline JS blocked' },
  { ts: new Date(Date.now() - 30000).toLocaleTimeString(), lvl: 'ok', msg: 'Login event: credentials accepted' },
];

function renderLog() {
  document.getElementById('eventLog').innerHTML = logEntries.map(e => `
    <div class="log-item">
      <span class="ts">${e.ts}</span>
      <span class="lvl lvl-${e.lvl}">${e.lvl.toUpperCase()}</span>
      <span class="msg">${e.msg}</span>
    </div>
  `).join('');
}

function addLog(msg, lvl = 'warn') {
  logEntries.unshift({ ts: new Date().toLocaleTimeString(), lvl, msg });
  renderLog();
}

renderLog();

/* ─── DOM-XSS: Read URL param and inject via innerHTML ─── */
function renderReportFromURL() {
  const params = new URLSearchParams(window.location.search);
  const report = params.get('report');
  if (report) {
    document.getElementById('renderZone').innerHTML = report; // vulnerable sink
    document.getElementById('reportInput').value = report;
    addLog('URL param ?report= loaded into innerHTML (UNSAFE)', 'err');
  }
}

/* ─── Simulate injection from the input field ─── */
function simulateInject() {
  const payload = document.getElementById('reportInput').value;
  if (!payload) {
    addLog('No payload entered', 'warn');
    return;
  }

  const newURL = window.location.pathname + '?report=' + encodeURIComponent(payload);
  history.pushState({}, '', newURL);

  document.getElementById('renderZone').innerHTML = payload; // vulnerable sink
  addLog('Payload injected via innerHTML: ' + payload.substring(0, 60) + (payload.length > 60 ? '...' : ''), 'err');
}

/* ─── Pre-built payload loader ─── */
function loadPayload(p) {
  const decoded = p
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');

  document.getElementById('reportInput').value = decoded;
  addLog('Pre-built payload loaded: ' + decoded.substring(0, 50), 'warn');
}

/* ─── Token Theft Simulation ─── */
function showTokenTheft() {
  const stolenToken = localStorage.getItem('auth_token');
  const stolenUser = localStorage.getItem('auth_user');

  const banner = document.getElementById('alertBanner');
  document.getElementById('alertBody').innerHTML =
    '<span style="color:#ff8fa3">User:</span> ' + stolenUser + '<br>' +
    '<span style="color:#ff8fa3">Token (first 80 chars):</span> <span style="color:#ffb830">' +
    (stolenToken ? stolenToken.substring(0, 80) + '...' : 'N/A') +
    '</span><br><br>' +
    '<span style="color:#5a5d72">In a real attack, this token would be sent to: </span>' +
    '<span style="color:#00f5c4">https://attacker.com/steal?token=' +
    (stolenToken ? stolenToken.substring(0, 20) : '') + '...</span>';

  banner.style.display = 'block';
  addLog('🚨 XSS EXPLOIT: auth_token exfiltrated from localStorage!', 'err');
}

/* ─── Logout ─── */
function logout() {
  localStorage.removeItem('auth_token');
  localStorage.removeItem('auth_user');
  localStorage.removeItem('session_start');
  window.location.href = 'login.html';
}

/* ─── Wire UI events ─── */
document.getElementById('injectBtn').addEventListener('click', simulateInject);
document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('closeBanner').addEventListener('click', () => {
  document.getElementById('alertBanner').style.display = 'none';
});

document.querySelectorAll('.payload-item').forEach(item => {
  item.addEventListener('click', () => loadPayload(item.dataset.p));
});

/* Expose this function globally so you can demonstrate it */
window.showTokenTheft = showTokenTheft;

renderReportFromURL();