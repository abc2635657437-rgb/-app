// Zero-dependency gzip middleware.
//
// The project is deployed straight from the repository on Render, and adding new npm
// packages is not always possible in this environment, so this uses only the built-in
// zlib module. It compresses text-ish responses (JSON, JS, CSS, SVG, HTML) and leaves
// binary media, sockets and already-encoded responses alone.
import zlib from 'node:zlib';

const COMPRESSIBLE = /^(?:text\/[\w.+-]+|application\/(?:json|javascript|xml|x-javascript|manifest\+json|ld\+json|geo\+json)(?:;|$)|image\/svg(?:\+xml)?(?:;|$))/i;
const SKIP = new Set(['HEAD', 'OPTIONS', 'TRACE']);
const MIN_BYTES = 900;

export function compressPayloads(options = {}) {
  const minBytes = Number(options.minBytes ?? MIN_BYTES);
  return function gzip(req, res, next) {
    if (SKIP.has(req.method)) return next();
    if (req.headers['x-no-compression'] || !/\bgzip\b/i.test(String(req.headers['accept-encoding'] || ''))) return next();
    if (res.getHeader('Content-Encoding')) return next();

    const originalWrite = res.write.bind(res);
    const originalEnd = res.end.bind(res);
    const parts = [];
    let size = 0;
    let finished = false;

    const restore = () => { res.write = originalWrite; res.end = originalEnd; };
    res.write = (chunk, encoding, callback) => {
      if (chunk) { const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'); size += buf.length; parts.push(buf); }
      if (typeof callback === 'function') callback();
      return true;
    };

    res.end = (chunk, encoding, callback) => {
      const done = typeof callback === 'function' ? callback : (typeof encoding === 'function' ? encoding : undefined);
      if (finished) { if (done) done(); return res; }
      finished = true;
      if (chunk) { const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding || 'utf8'); size += buf.length; parts.push(buf); }

      const flush = body => {
        restore();
        if (body && body.length) originalWrite(body);
        return originalEnd(done);
      };

      const type = res.getHeader('Content-Type');
      const worthIt = size >= minBytes && (!type || COMPRESSIBLE.test(String(type)));

      if (!worthIt) return flush(size ? Buffer.concat(parts) : null);

      const etag = res.getHeader('ETag');
      if (typeof etag === 'string' && !/-gzip$/.test(etag)) res.setHeader('ETag', etag.replace(/"$/, '-gzip"'));
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Vary', 'Accept-Encoding');
      res.removeHeader('Content-Length');

      zlib.gzip(Buffer.concat(parts), { level: 6 }, (error, gzipped) => {
        if (error) { res.removeHeader('Content-Encoding'); return flush(size ? Buffer.concat(parts) : null); }
        res.setHeader('Content-Length', String(gzipped.length));
        restore();
        originalWrite(gzipped);
        return originalEnd(done);
      });

      return res;
    };

    return next();
  };
}

export default compressPayloads;
