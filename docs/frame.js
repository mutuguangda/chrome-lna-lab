const $ = id => document.getElementById(id);
const parameters = new URLSearchParams(location.search);
const mode = parameters.get('mode') || 'baseline';
const parentOrigin = parameters.get('parentOrigin');
const config = { upstreamUrl: parameters.get('endpoint') || '' };
const endpoint = mode === 'gateway' ? new URL('/api/gateway', location.origin).href : config.upstreamUrl;
$('endpoint').value = endpoint;
$('title').textContent = mode === 'gateway' ? 'C · 后端网关' : mode === 'allow' ? 'B · 添加 allow 后直连' : 'A · 不加 allow 直连';

async function inspect() {
  const policy = document.permissionsPolicy || document.featurePolicy;
  const supported = policy?.features ? policy.features() : [];
  const permissions = {};
  for (const name of ['local-network-access', 'local-network']) {
    let permission;
    try { permission = (await navigator.permissions.query({ name })).state; }
    catch { permission = '当前浏览器不支持查询此名称'; }
    permissions[name] = {
      permission,
      allowedByPolicy: supported.includes(name) ? policy.allowsFeature(name) : '当前浏览器未报告此策略名称',
    };
  }
  const details = { origin: location.origin, secureContext: isSecureContext, permissions };
  $('environment').textContent = JSON.stringify(details, null, 2);
  return details;
}
$('inspect').onclick = inspect;
$('request').onclick = async () => {
  $('request').disabled = true;
  const started = performance.now();
  const address = $('endpoint').value.trim();
  let url;
  try { url = new URL(address); } catch { $('result').textContent = '请填写完整接口 URL'; $('request').disabled = false; return; }
  url.search = $('query').value.replace(/^\?/, '');
  const result = { time: new Date().toISOString(), url: url.href, method: 'GET', credentials: $('credentials').value, hasAuthorization: Boolean($('authorization').value) };
  $('result').textContent = '请求中…';
  try {
    const headers = {};
    if ($('authorization').value) headers.Authorization = $('authorization').value;
    const response = await fetch(url, { method: 'GET', credentials: $('credentials').value, headers, signal: AbortSignal.timeout(20000) });
    result.status = response.status;
    result.httpOk = response.ok;
    result.readableResponse = true;
    result.gatewayRequestId = response.headers.get('X-LNA-Gateway-Request-Id');
    result.upstreamStatus = response.headers.get('X-LNA-Upstream-Status');
    result.body = (await response.text()).slice(0, 12000);
    result.interpretation = mode === 'gateway'
      ? result.upstreamStatus ? '网关已收到上游响应，请结合 HTTP 状态和业务返回判断' : '浏览器已收到网关响应，但未确认上游请求成功'
      : '浏览器已读到直连接口响应，请结合 HTTP 状态和业务返回判断';
  } catch (error) {
    result.readableResponse = false;
    result.error = `${error.name}: ${error.message}`;
    result.interpretation = '需要看 Console 和 Network 区分 LNA、CORS、TLS、DNS 或网络故障';
  }
  result.durationMs = Math.round(performance.now() - started);
  result.environment = await inspect();
  $('result').textContent = JSON.stringify(result, null, 2);
  if (parentOrigin) parent.postMessage({ type: 'lna-result', result }, parentOrigin);
  $('request').disabled = false;
};
await inspect();
