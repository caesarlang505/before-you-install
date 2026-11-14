const PERMISSIONS={cookies:'Can access cookies on sites covered by its host access.',history:'Can read or change browsing history.',downloads:'Can manage browser downloads.',management:'Can inspect or manage other installed extensions.',debugger:'Can attach to browser tabs using debugging APIs.',nativeMessaging:'Can communicate with a separately installed native application.',clipboardRead:'Can read clipboard content.',webRequest:'Can observe web requests within its host access.',scripting:'Can inject scripts into pages for which it has access.',tabs:'Can access sensitive tab properties such as URLs when allowed.',activeTab:'Gets temporary access to the current tab after a user action.'};
export function relevantSources(results, id, name) {
 const terms=[id,name].filter(x=>x&&!x.startsWith('__MSG_')).map(x=>x.toLocaleLowerCase());
 return results.filter(r=>terms.some(term=>`${r.title} ${r.content} ${r.url}`.toLocaleLowerCase().includes(term)));
}
export function buildReport(input,sandbox,research) {
 const m=sandbox.manifest||{}, findings=[];
 findings.push({title:sandbox.installed?'Installed in the test browser':'Browser test incomplete',evidence:sandbox.installed?`Installation verified. Method: ${sandbox.method}. Version: ${m.version||'unknown'}.`:(sandbox.error||'Installation could not be verified.'),sourceUrl:input.url});
 for(const p of m.permissions||[])findings.push({title:`Permission: ${p}`,evidence:`${PERMISSIONS[p]||'Declared browser capability.'} A permission does not prove misuse.`,sourceUrl:'https://developer.chrome.com/docs/extensions/reference/permissions-list'});
 const hosts=[...new Set([...(m.host_permissions||[]),...(m.content_scripts||[]).flatMap(s=>s.matches||[])])];
 if(hosts.length)findings.push({title:'Requested website access',evidence:hosts.join('\n')+'\nThese are requested scopes. Actual access can depend on browser grants and settings.'});
 if(sandbox.domains?.length)findings.push({title:'Domains seen during the browser test',evidence:sandbox.domains.join('\n')+'\nThese belong to the whole browser session. This test cannot attribute every request to the extension, and a request may not have succeeded.'});
 if(sandbox.installed&&!sandbox.domains?.length)findings.push({title:'No network domains captured',evidence:'This short observation does not prove that the extension never sends data. Delayed or user-triggered actions may not have run.'});
 for(const r of research.results||[])findings.push({title:`Outside source: ${r.title||new URL(r.url).hostname}`,evidence:String(r.content||'').slice(0,900)+'\nSource excerpt found by Tavily. Treat claims as evidence to review, not a verified verdict.',sourceUrl:r.url});
 const limits=['This is a short test, not a security certification. It does not cover logins, paid features, delayed behavior, every website, or future updates.'];
 if(!sandbox.installed)limits.unshift('The extension was not installed. Runtime behavior was not tested.');
 if(research.error)limits.push('Tavily search failed: '+research.error);
 if(!(research.results||[]).length)limits.push('No outside sources were returned. That does not prove trustworthiness.');
 if(sandbox.method?.includes('unpacked'))limits.push('The Store package was loaded unpacked in Chrome; this differs from a normal Chrome Web Store installation. Chrome may warn it cannot verify the source because the package was loaded this way. That warning alone is not evidence of malware.');
 if(sandbox.observation)limits.push('Browser test: '+sandbox.observation);
 return {status:'complete',...input,name:sandbox.name||m.name||'Extension report',checkedAt:new Date().toISOString(),summary:sandbox.installed?'The extension ran in an isolated browser. Review its access and the evidence below before deciding.':'The check is incomplete. Review the available evidence and the failed test before deciding.',findings,limitation:limits.join('\n'),sandbox,research};
}
