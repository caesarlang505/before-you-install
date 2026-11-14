import {readFile, writeFile, chmod} from 'node:fs/promises';
const path = new URL('.env', import.meta.url);
export async function loadConfig() {
  let text = '';
  try { text = await readFile(path,'utf8'); } catch(e) {if(e.code!=='ENOENT') throw e;}
  const config = Object.fromEntries(text.split(/\r?\n/).filter(l=>/^[A-Z_]+=/.test(l)).map(l=>[l.slice(0,l.indexOf('=')),l.slice(l.indexOf('=')+1).replace(/^['"]|['"]$/g,'')]));
  for (const k of ['DAYTONA_API_KEY','TAVILY_API_KEY']) config[k] = process.env[k] || config[k] || '';
  return config;
}
export async function saveConfig(values) {
  const config = await loadConfig();
  for (const key of ['DAYTONA_API_KEY','TAVILY_API_KEY']) {
    if (typeof values[key] === 'string' && values[key].trim()) {
      const value = values[key].trim();
      if (!/^[\x21-\x7e]{10,512}$/.test(value)) throw new Error('That key has an invalid format.');
      if (key === 'TAVILY_API_KEY' && !value.startsWith('tvly-')) throw new Error('The Tavily API key should start with tvly-. Copy the API key from your Tavily dashboard.');
      config[key] = value;
    }
  }
  await writeFile(path,Object.entries(config).map(([k,v])=>`${k}=${v}`).join('\n')+'\n',{mode:0o600});
  await chmod(path,0o600);
}
export function publicConfig(c) {return {daytona:!!c.DAYTONA_API_KEY,tavily:!!c.TAVILY_API_KEY};}
