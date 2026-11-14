"""Runs only inside the disposable Daytona sandbox. No sponsor keys enter here."""
import json, time, pathlib, subprocess, re, os, struct, zipfile, hashlib, base64, stat
from urllib.parse import urlparse
from playwright.sync_api import sync_playwright

ROOT=pathlib.Path('/tmp/before-install-profile')
OUT=pathlib.Path('/tmp/before-install-result.json')
input_data=json.loads(pathlib.Path('/tmp/before-install-input.json').read_text())
extension_id=input_data['extensionId']
assert re.fullmatch('[a-p]{32}',extension_id)
result={'installed':False,'method':'Chrome Web Store installation','domains':[],'testSeconds':20}
domains=set()

def installed_manifest():
    files=list((ROOT/'Default'/'Extensions'/extension_id).glob('*/manifest.json'))
    return files[-1] if files else None

def resolve_name(manifest,path):
    name=manifest.get('name','')
    if name.startswith('__MSG_'):
        try:
            loc=manifest.get('default_locale','en')
            messages=json.loads((path.parent/'_locales'/loc/'messages.json').read_text())
            name=messages.get(name[6:-2],{}).get('message',name)
        except Exception: pass
    return name

def varint(data, offset):
    value=0; shift=0
    while offset<len(data) and shift<70:
        b=data[offset];offset+=1;value|=(b&127)<<shift
        if not b&128:return value,offset
        shift+=7
    raise ValueError('Invalid package header')

def fields(data):
    offset=0
    while offset<len(data):
        tag,offset=varint(data,offset); wire=tag&7
        if wire==2:
            length,offset=varint(data,offset)
            if offset+length>len(data):raise ValueError('Invalid package header length')
            yield tag>>3,data[offset:offset+length];offset+=length
        elif wire==0:
            _,offset=varint(data,offset)
        else:raise ValueError('Unsupported package header')

def unpack_store_package():
    data=pathlib.Path('/tmp/before-install-package.crx').read_bytes()
    if len(data)<12 or data[:4]!=b'Cr24' or struct.unpack_from('<I',data,4)[0]!=3:raise ValueError('Store did not return a CRX3 extension package.')
    hlen=struct.unpack_from('<I',data,8)[0]
    if hlen>1024*1024 or 12+hlen>len(data):raise ValueError('Invalid package header.')
    key=None
    for field,proof in fields(data[12:12+hlen]):
        if field not in (2,3):continue
        for sub,value in fields(proof):
            if sub==1:
                digest=hashlib.sha256(value).digest()[:16]
                derived=''.join(chr(97+(b>>4))+chr(97+(b&15)) for b in digest)
                if derived==extension_id:key=value;break
    if not key:raise ValueError('The Store package public key did not match the requested extension ID.')
    target=pathlib.Path('/tmp/before-install-extension');target.mkdir(exist_ok=True)
    with zipfile.ZipFile('/tmp/before-install-package.crx') as z:
        entries=z.infolist()
        if len(entries)>3000 or sum(x.file_size for x in entries)>100_000_000:raise ValueError('Extension package is too large.')
        for entry in entries:
            name=pathlib.PurePosixPath(entry.filename)
            if name.is_absolute() or '..' in name.parts or stat.S_ISLNK(entry.external_attr>>16):raise ValueError('Extension package has an unsafe file path.')
        z.extractall(target)
    path=target/'manifest.json'; manifest=json.loads(path.read_text());manifest['key']=base64.b64encode(key).decode();path.write_text(json.dumps(manifest))
    return target,manifest,hashlib.sha256(data).hexdigest()

try:
    with sync_playwright() as p:
        browser=p.chromium.launch_persistent_context(str(ROOT),executable_path='/usr/bin/google-chrome-stable',headless=False,ignore_default_args=['--disable-extensions'],args=['--no-sandbox','--disable-dev-shm-usage','--no-first-run','--lang=en-US','--force-renderer-accessibility','--enable-unsafe-extension-debugging'],viewport={'width':1200,'height':820})
        def track(req):
            host=urlparse(req.url).hostname
            if host and len(domains)<100: domains.add(host)
        browser.on('request',track)
        page=browser.pages[0] if browser.pages else browser.new_page()
        try:
            page.goto(input_data['url'],wait_until='domcontentloaded',timeout=15000)
        except Exception as network_error:
            result['storeUiError']=str(network_error)[:300]
            target,manifest,package_hash=unpack_store_package()
            client=browser.browser.new_browser_cdp_session()
            loaded=client.send('Extensions.loadUnpacked',{'path':str(target)})
            loaded_id=loaded.get('id')
            if loaded_id!=extension_id:raise RuntimeError('Chrome loaded a different extension ID; the test stopped.')
            result.update(installed=True,manifest=manifest,name=resolve_name(manifest,target/'manifest.json'),method='Google Store CRX package loaded unpacked in Chrome',packageSha256=package_hash,confirmationNeeded=False)
            page.route('https://example.com/**',lambda route:route.fulfill(status=200,content_type='text/html',body='<html><title>Test page</title><body><h1>Sandbox test page</h1><p>Example text for this extension to inspect.</p></body></html>'))
            page.goto('https://example.com/',wait_until='domcontentloaded',timeout=10000)
            page.wait_for_timeout(20000)
            page.screenshot(path='/tmp/before-install-page.png')
            try:
                page.goto('chrome://extensions/',wait_until='domcontentloaded',timeout=10000)
                page.wait_for_timeout(1500)
                page.screenshot(path='/tmp/before-install-extensions.png')
            except Exception: pass
            result['domains']=sorted(domains)
            result['observation']='20 seconds on an intercepted synthetic example.com page. Store navigation was blocked by sandbox networking. Background-worker traffic may be missing.'
            OUT.write_text(json.dumps(result));browser.close();print(json.dumps({'installed':True,'method':result['method']}));raise SystemExit(0)
        result['listingTitle']=page.title()
        add=page.get_by_role('button',name='Add to Chrome',exact=True)
        add.wait_for(state='visible',timeout=15000)
        if not add.is_enabled(): raise RuntimeError('The Chrome Web Store did not enable installation for this extension.')
        add.click(timeout=10000)
        # Chrome's native extension confirmation is outside the page DOM.
        # Capture accessibility text to find the actual named install control.
        result['confirmationNeeded']=True
        confirm = '''
import pyatspi, time
def find_add(node,depth=0):
    if depth>20: return False
    try:
        if node.name in ("Add extension","Add Extension"):
            action=node.queryAction()
            for i in range(action.nActions):
                if action.getName(i) in ("click","press","activate"):
                    action.doAction(i); return True
        for child in node:
            if find_add(child,depth+1):return True
    except Exception: pass
    return False
for _ in range(12):
    if find_add(pyatspi.Registry.getDesktop(0)):raise SystemExit(0)
    time.sleep(.5)
raise SystemExit(1)
'''
        rc=subprocess.run(['/usr/bin/python3','-c',confirm],timeout=12,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode
        if rc: result['confirmationNote']='The native confirmation could not be clicked automatically.'
        for _ in range(30):
            if installed_manifest():break
            page.wait_for_timeout(1000)
        path=installed_manifest()
        if not path:raise RuntimeError('Chrome opened the Store listing, but installation was not confirmed. The extension was not tested.')
        manifest=json.loads(path.read_text())
        result.update(installed=True,manifest=manifest,name=resolve_name(manifest,path),confirmationNeeded=False)
        # Only synthetic browsing. No user account, cookies or personal files.
        page.goto('https://example.com',wait_until='domcontentloaded',timeout=20000)
        page.wait_for_timeout(20000)
        page.screenshot(path='/tmp/before-install-page.png')
        result['domains']=sorted(domains)
        result['observation']='20 seconds on example.com in a clean profile. Request capture covers browser pages; background-worker traffic may be missing.'
        OUT.write_text(json.dumps(result))
        browser.close()
except Exception as exc:
    result['error']=str(exc)[:800]
    result['domains']=sorted(domains)
finally:
    OUT.write_text(json.dumps(result))
print(json.dumps({'installed':result['installed'],'name':result.get('name'),'error':result.get('error')}))
