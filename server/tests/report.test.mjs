import test from 'node:test';
import assert from 'node:assert/strict';
import {buildReport, relevantSources} from '../report.mjs';
test('reports failed installation as incomplete, never as safe',()=>{
 const r=buildReport({extensionId:'a'.repeat(32),url:'https://chromewebstore.google.com/detail/'+ 'a'.repeat(32)},{installed:false,error:'Store blocked'}, {results:[]});
 assert.match(r.summary,/incomplete/i);assert.match(r.limitation,/not installed/i);assert.equal(r.sandbox.installed,false);
});
test('excludes articles that do not mention the checked extension',()=>{
 const id='a'.repeat(32);
 const input=[{title:'Google Translate extension',content:'Publisher details',url:'https://example.com/a'}, {title:'Wallet malware',content:'A different extension',url:'https://example.com/b'}, {title:'Directory',content:id,url:'https://example.com/c'}];
 assert.deepEqual(relevantSources(input,id,'Google Translate').map(x=>x.url),['https://example.com/a','https://example.com/c']);
});
test('permissions are capabilities, external snippets remain attributed claims',()=>{
 const r=buildReport({extensionId:'a'.repeat(32),url:'https://chromewebstore.google.com/detail/'+ 'a'.repeat(32)},{installed:true,method:'Store UI',manifest:{name:'Test',permissions:['cookies'],host_permissions:['<all_urls>']},domains:['example.com']},{results:[{title:'A post',content:'malware claim',url:'https://example.com/article'}]});
 assert.ok(r.findings.some(f=>f.title.includes('cookies')));assert.ok(r.findings.some(f=>f.evidence.includes('does not prove')));assert.ok(r.findings.some(f=>f.title.startsWith('Outside source')));
});
