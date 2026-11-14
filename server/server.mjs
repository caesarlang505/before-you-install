import http from 'node:http';
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {parseStoreUrl} from './validation.mjs';
import {loadConfig,saveConfig,publicConfig} from './config.mjs';

const port=Number(process.env.PORT || 8787), origin=`http://127.0.0.1:${port}`;
const jobs=new Map();
const staticFiles = {'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css']};
const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
async function body(req) {
  if(!req.headers['content-type']?.startsWith('application/json')) throw new Error('Use JSON.');
  let value='';for await(const chunk of req){value+=chunk;if(value.length>16000)throw new Error('Request too large.');}
  return JSON.parse(value);
}
export const server=http.createServer(async(req,res)=>{
  try {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; frame-ancestors 'none'; form-action 'self'");
    if(req.headers.host!==`127.0.0.1:${port}`) return json(res,403,{error:'Use the local app address.'});
    const requestOrigin=req.headers.origin;
    const allowed=!requestOrigin || requestOrigin===origin || /^chrome-extension:\/\/[a-p]{32}$/.test(requestOrigin);
    if(!allowed) return json(res,403,{error:'Origin not allowed.'});
    if(requestOrigin)res.setHeader('Access-Control-Allow-Origin',requestOrigin);
    res.setHeader('Vary','Origin');
    if(req.method==='OPTIONS'){res.writeHead(204,{'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type'});return res.end();}
    const path=new URL(req.url,origin).pathname;
    if(req.method==='GET' && path==='/health')return json(res,200,{ok:true,...publicConfig(await loadConfig())});
    if(req.method==='POST' && path==='/setup'){
      if(requestOrigin!==origin)return json(res,403,{error:'Save keys from the local setup screen.'});
      await saveConfig(await body(req));return json(res,200,{ok:true,...publicConfig(await loadConfig())});
    }
    if(req.method==='POST' && path==='/check'){
      const {url}=await body(req);const input=parseStoreUrl(url);
      const config=await loadConfig();
      if(!config.DAYTONA_API_KEY || !config.TAVILY_API_KEY)return json(res,409,{error:'Add your Daytona and Tavily API keys on the setup screen first.'});
      if([...jobs.values()].some(j=>j.status==='running'))return json(res,409,{error:'A check is already running. Wait for it to finish.'});
      const id=randomUUID(), job={jobId:id,status:'running',stage:'Starting checks',...input,startedAt:new Date().toISOString()};
      jobs.set(id,job);json(res,202,{jobId:id});
      (async()=>{
        try{
          const {scan}=await import('./scanner.mjs');
          job.report=await scan(input,config,{jobId:id,progress:stage=>{job.stage=stage;}});
          job.status='complete';job.stage='Report ready';
        }catch(e){job.status='error';job.error=redact(e.message,config);job.stage='Check stopped';}
        job.finishedAt=new Date().toISOString();
        await mkdir(new URL('data/',import.meta.url),{recursive:true});
        await writeFile(new URL(`data/${id}.json`,import.meta.url),JSON.stringify(job,null,2));
      })().catch(()=>{job.status='error';job.error='Could not save the report.';});
      return;
    }
    if(req.method==='GET' && /^\/checks\/[a-f0-9-]{36}$/.test(path)){
      const id=path.split('/')[2];let job=jobs.get(id);
      if(!job)try{job=JSON.parse(await readFile(new URL(`data/${id}.json`,import.meta.url),'utf8'));}catch{}
      return json(res,job?200:404,job||{error:'Check not found.'});
    }
    if(req.method==='GET' && /^\/evidence\/[a-f0-9-]{36}(?:-extensions)?\.png$/.test(path)){
      const data=await readFile(new URL('data/'+path.split('/')[2],import.meta.url));res.writeHead(200,{'Content-Type':'image/png'});return res.end(data);
    }
    if(req.method==='GET' && staticFiles[path]){
      const [file,type]=staticFiles[path];res.writeHead(200,{'Content-Type':type});return res.end(await readFile(new URL(`public/${file}`,import.meta.url)));
    }
    json(res,404,{error:'Not found.'});
  }catch(e){json(res,400,{error:e.code==='ENOENT'?'Not found.':redact(e.message,await loadConfig())});}
});
function redact(value,config){let s=String(value);for(const k of [config.DAYTONA_API_KEY,config.TAVILY_API_KEY])if(k)s=s.replaceAll(k,'[redacted]');return s.slice(0,600);}
server.listen(port,'127.0.0.1',()=>console.log(`Before You Install: ${origin}`));
