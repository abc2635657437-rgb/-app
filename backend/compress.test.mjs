import assert from 'node:assert/strict';
import express from 'express';
import zlib from 'node:zlib';
import { compressPayloads } from './compress.mjs';

const app = express();
app.use(compressPayloads());
app.get('/json', (_req, res) => res.json({ data: 'x'.repeat(4000), list: Array.from({length: 60}, (_, i) => ({ i, name: 'place-' + i })) }));
app.get('/small', (_req, res) => res.json({ ok: true }));
app.get('/image', (_req, res) => res.type('png').send(Buffer.alloc(4000, 1)));
app.get('/html', (_req, res) => res.type('html').send('<div>' + 'a'.repeat(4000) + '</div>'));

const server = app.listen(0);
const port = server.address().port;
const get = path => fetch(`http://127.0.0.1:${port}${path}`, { headers: { 'accept-encoding': 'gzip' } });
// undici sends Accept-Encoding automatically, so opt out explicitly instead.
const getRaw = path => fetch(`http://127.0.0.1:${port}${path}`, { headers: { 'x-no-compression': '1' } });

const json = await get('/json');
assert.equal(json.headers.get('content-encoding'), 'gzip');
assert.equal(json.headers.get('vary'), 'Accept-Encoding');
// undici transparently decodes gzip, so the body arrives already inflated; the header
// is what proves the wire format was compressed.
const text = await json.text();
assert.equal(JSON.parse(text).data.length, 4000);
const rawJson = await getRaw('/json');
assert.equal(rawJson.headers.get('content-encoding'), null);
assert.equal(JSON.parse(await rawJson.text()).data.length, 4000);

const small = await get('/small');
assert.equal(small.headers.get('content-encoding'), null);

const image = await get('/image');
assert.equal(image.headers.get('content-encoding'), null);
assert.equal((await image.arrayBuffer()).byteLength, 4000);

const html = await get('/html');
assert.equal(html.headers.get('content-encoding'), 'gzip');
assert.equal(await html.text(), '<div>' + 'a'.repeat(4000) + '</div>');

server.close();
console.log('Compression passed: gzip JSON+HTML, plain when unsupported, skip small and binary, Vary header set.');
