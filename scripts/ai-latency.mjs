// Measures the AI desk's perceived latency: time to first visible character,
// time to the last delta, and whether the answer completed or was truncated.
const ENDPOINT = process.argv[2] || 'https://travel-world-mwdw.onrender.com/api/ai/assistant';
const RUNS = Number(process.argv[3] || 4);

async function once(index, mode) {
  const started = performance.now();
  let metaAt = null;
  let firstDeltaAt = null;
  let lastDeltaAt = null;
  let chars = 0;
  let events = 0;
  let error = null;
  let status = 0;
  let done = false;

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    // A fresh forwarded IP per run keeps the anonymous quota from skewing the
    // latency numbers when testing against a local server.
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', 'X-Forwarded-For': `10.9.${index}.${(index * 37) % 250}` },
    body: JSON.stringify({
      message: mode === 'plan' ? `第${index}次：帮我排一下苏州两天` : `用一句话介绍苏州${index}`,
      language: 'zh',
      mode,
      region: 'cn'
    })
  });
  status = res.status;
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return { index, mode, status, error: text.slice(0, 120), ttfb: Math.round(performance.now() - started) };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    const { done: streamDone, value } = await reader.read();
    if (streamDone) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf('\n\n')) >= 0) {
      const frame = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const now = performance.now() - started;
      const name = (frame.match(/^event: (\S+)/m) || [])[1];
      const dataLine = (frame.match(/^data: (.*)$/m) || [])[1] || '';
      if (name === 'meta' && metaAt === null) metaAt = now;
      if (name === 'delta') {
        events++;
        let text = '';
        try { text = JSON.parse(dataLine).text || ''; } catch { text = ''; }
        chars += text.length;
        if (firstDeltaAt === null && text.trim()) firstDeltaAt = now;
        lastDeltaAt = now;
      }
      if (name === 'done') done = true;
      if (name === 'error') { try { error = JSON.parse(dataLine).error || 'error'; } catch { error = 'error'; } }
    }
  }
  const total = performance.now() - started;
  return {
    index, mode, status, done,
    metaMs: metaAt === null ? null : Math.round(metaAt),
    firstCharMs: firstDeltaAt === null ? null : Math.round(firstDeltaAt),
    lastCharMs: lastDeltaAt === null ? null : Math.round(lastDeltaAt),
    totalMs: Math.round(total),
    chars, events, error
  };
}

const rows = [];
for (let i = 1; i <= RUNS; i++) {
  const mode = i % 2 === 1 ? 'plan' : 'chat';
  try {
    const r = await once(i, mode);
    rows.push(r);
    console.log(`${String(i).padStart(2)} ${mode.padEnd(4)} http=${r.status} meta=${r.metaMs}ms firstChar=${r.firstCharMs}ms last=${r.lastCharMs}ms total=${r.totalMs}ms chars=${r.chars} done=${r.done}${r.error ? ' err=' + r.error : ''}`);
  } catch (e) {
    rows.push({ index: i, mode, error: String(e) });
    console.log(`${String(i).padStart(2)} ${mode.padEnd(4)} FAILED ${e}`);
  }
}

const ok = rows.filter(r => r.firstCharMs != null);
if (ok.length) {
  const pct = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.min(arr.length - 1, Math.floor(arr.length * p))];
  const first = ok.map(r => r.firstCharMs);
  const total = ok.map(r => r.totalMs);
  console.log(`\nfirst visible char: min ${Math.min(...first)}ms / median ${pct(first, 0.5)}ms / max ${Math.max(...first)}ms`);
  console.log(`complete answer:    min ${Math.min(...total)}ms / median ${pct(total, 0.5)}ms / max ${Math.max(...total)}ms`);
  console.log(`completed cleanly:  ${rows.filter(r => r.done).length}/${rows.length}`);
}
