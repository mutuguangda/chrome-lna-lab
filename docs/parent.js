const $ = id => document.getElementById(id);
const config = { frameOrigin: location.origin };
const parameters = new URLSearchParams(location.search);
const defaultOrigin = new URL(location.origin);

$('frame-origin').value = parameters.get('frameOrigin') || config.frameOrigin || defaultOrigin.origin;
$('policy').value = parameters.get('policy') || 'default';
$('scenario').value = parameters.get('scenario') || 'baseline';
const records = [];
let current;

function loadFrame() {
  const origin = new URL($('frame-origin').value).origin;

  const mode = $('scenario').value;
  const src = origin === location.origin ? new URL('./frame.html', location.href) : new URL($('frame-origin').value);
  if (src.origin !== location.origin && src.pathname === '/') src.pathname = '/frame.html';
  src.searchParams.set('mode', mode);
  src.searchParams.set('parentOrigin', location.origin);
  const frame = document.createElement('iframe');
  frame.title = 'LNA 实验 iframe';
  if (mode === 'allow') frame.setAttribute('allow', 'local-network-access; local-network');
  frame.src = src.href;
  current = { frame, origin, mode, policy: 'Pages 默认响应头' };
  $('frame-container').replaceChildren(frame);
  $('embedding').textContent = frame.outerHTML;
  $('environment').textContent = JSON.stringify({ parentOrigin: location.origin, iframeOrigin: origin, secureContext: isSecureContext, policy: current.policy, crossOriginIframe: origin !== location.origin, userAgent: navigator.userAgent }, null, 2);
}

function safeLoad() {
  try { loadFrame(); } catch (error) { $('embedding').textContent = error.message; }
}

$('load').onclick = safeLoad;
$('scenario').onchange = safeLoad;
$('apply-policy').onclick = () => {
  const url = new URL(location.href);
  url.searchParams.set('policy', $('policy').value);
  url.searchParams.set('frameOrigin', $('frame-origin').value);
  url.searchParams.set('scenario', $('scenario').value);
  location.href = url.href;
};
window.addEventListener('message', event => {
  if (!current || event.source !== current.frame.contentWindow || event.origin !== current.origin || event.data?.type !== 'lna-result') return;
  records.push({ ...event.data.result, scenario: current.mode, parentPolicy: current.policy, parentOrigin: location.origin, iframeOrigin: current.origin, flag: $('flag').value, systemProxy: $('proxy').value, sitePermission: $('grant').value, notes: $('notes').value, userAgent: navigator.userAgent });
  $('results').textContent = JSON.stringify(records, null, 2);
});
$('export').onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `lna-results-${Date.now()}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
safeLoad();
