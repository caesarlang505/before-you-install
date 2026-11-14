const API = 'http://127.0.0.1:8787';
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'startCheck') return;
  (async()=>{
    const response=await fetch(`${API}/check`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({url:message.url}),signal:AbortSignal.timeout(15000)});
    const body=await response.json();
    if(!response.ok)throw new Error(body.error||`Scanner returned ${response.status}.`);
    const check={jobId:body.jobId,status:'running',url:message.url,extensionId:message.extensionId};
    await chrome.storage.local.set({currentCheck:check});sendResponse({ok:true,check});
  })().catch(e=>sendResponse({ok:false,error:e.message==='Failed to fetch'?'The scanner is not running. Open the local setup page.':e.message}));
  return true;
});
