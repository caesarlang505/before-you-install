const form = document.querySelector('#check-form');
const input = document.querySelector('#store-url');
const button = document.querySelector('#check-button');
const status = document.querySelector('.status');
const statusText = document.querySelector('#status-text');
const report = document.querySelector('#report');
const reportId = document.querySelector('#report-id');
const reportSummary = document.querySelector('#report-summary');
const findings = document.querySelector('#findings');
const limits = document.querySelector('#limits');
let poll;

function storeId(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' || url.hostname !== 'chromewebstore.google.com' || !url.pathname.startsWith('/detail/')) return null;
    return url.pathname.match(/(?:^|\/)([a-p]{32})(?:\/|$)/)?.[1] ?? null;
  } catch { return null; }
}

function setStatus(message, tone = 'idle') {
  status.dataset.tone = tone;
  statusText.textContent = message;
}

function showReport(data) {
  report.hidden = false;
  reportId.textContent = data.extensionId ?? '';
  reportSummary.textContent = data.summary || 'The check finished without a summary.';
  chrome.storage.local.get('currentCheck').then(({currentCheck})=>{if(currentCheck?.jobId)document.querySelector('#full-report').href=`http://127.0.0.1:8787/?job=${encodeURIComponent(currentCheck.jobId)}`;});
  findings.replaceChildren();
  for (const item of Array.isArray(data.findings) ? data.findings : []) {
    const li = document.createElement('li');
    li.className = 'finding';
    const title = document.createElement('strong');
    title.textContent = item.title || 'Finding';
    const evidence = document.createElement('p');
    evidence.textContent = item.evidence || '';
    li.append(title, evidence);
    if (item.sourceUrl) {
      try {
        const url = new URL(item.sourceUrl);
        if (url.protocol === 'https:') {
          const link = document.createElement('a');
          link.href = url.href;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          link.textContent = 'View source ↗';
          li.append(link);
        }
      } catch { /* Omit invalid source URL. */ }
    }
    findings.append(li);
  }
  limits.hidden = !data.limitation;
  limits.textContent = data.limitation || '';
}

function refresh(data) {
  button.disabled = data?.status === 'running';
  if (!data) return;
  if (data.url && !input.value) input.value = data.url;
  if (data.status === 'running') setStatus(data.stage || 'Checking in the remote sandbox…', 'busy');
  else if (data.status === 'error') { report.hidden = true; setStatus(data.error || 'The check failed.', 'error'); }
  else if (data.status === 'complete') { showReport(data.report || {}); setStatus('Check complete. Review the evidence below.'); }
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const url = input.value.trim();
  const id = storeId(url);
  if (!id) { report.hidden = true; setStatus('Paste a valid Chrome Web Store extension link.', 'error'); return; }
  report.hidden = true;
  setStatus('Connecting to the local scanner…', 'busy');
  button.disabled = true;
  try {
    const response = await chrome.runtime.sendMessage({ type: 'startCheck', url, extensionId: id });
    if (!response?.ok) throw new Error(response?.error || 'Could not start the check.');
    watch(response.check);
  } catch (error) {
    button.disabled = false;
    setStatus(error.message || 'Could not start the check.', 'error');
  }
});

async function watch(check) {
  clearTimeout(poll);
  try {
    const response=await fetch(`http://127.0.0.1:8787/checks/${check.jobId}`,{signal:AbortSignal.timeout(10000)});
    const result=await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not read the check.');
    const current={...check,...result};
    await chrome.storage.local.set({currentCheck:current});
    refresh(current);
    if(result.status==='running')poll=setTimeout(()=>watch(check),1500);
  } catch(error) {refresh({...check,status:'error',error:error.message});}
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.currentCheck) refresh(changes.currentCheck.newValue);
});

async function init() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url && storeId(tab.url)) input.value = tab.url;
  } catch { /* Manual paste remains available. */ }
  const saved = await chrome.storage.local.get('currentCheck');
  if (saved.currentCheck?.url === input.value || !input.value) {
    refresh(saved.currentCheck);
    if(saved.currentCheck?.jobId)watch(saved.currentCheck);
  }
}

init();
