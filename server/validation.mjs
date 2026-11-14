export function parseStoreUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('Paste a valid Chrome Web Store link.'); }
  const match = u.pathname.match(/^\/detail\/(?:[^/]+\/)?([a-p]{32})\/?$/);
  if (u.protocol !== 'https:' || u.hostname !== 'chromewebstore.google.com' || u.port || u.username || u.password || !match) throw new Error('Use a Chrome Web Store extension listing.');
  u.search = ''; u.hash = '';
  return {url:u.href,extensionId:match[1]};
}
