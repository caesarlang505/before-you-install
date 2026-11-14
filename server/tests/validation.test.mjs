import test from 'node:test';
import assert from 'node:assert/strict';
import {parseStoreUrl} from '../validation.mjs';

test('accepts a Store extension and removes tracking', () => {
  const id = 'a'.repeat(32);
  assert.deepEqual(parseStoreUrl(`https://chromewebstore.google.com/detail/test/${id}?utm=x`), {extensionId:id,url:`https://chromewebstore.google.com/detail/test/${id}`});
});
test('rejects foreign URLs, credentials, invalid IDs and trailing paths', () => {
  for (const url of ['http://127.0.0.1/', 'https://chromewebstore.google.com.evil.test/detail/x/'+'a'.repeat(32), 'https://user@chromewebstore.google.com/detail/x/'+'a'.repeat(32), 'https://chromewebstore.google.com/detail/x/'+'z'.repeat(32), 'https://chromewebstore.google.com/detail/x/'+'a'.repeat(32)+'/extra']) assert.throws(()=>parseStoreUrl(url));
});
