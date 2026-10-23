import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../modules/community/post-ui.js', import.meta.url), 'utf8');
const createUi = () => {
  const sandbox = { document: { addEventListener() {} } };
  sandbox.window = sandbox;
  vm.runInNewContext(source, sandbox, { filename: 'post-ui.js' });
  return sandbox.TravelPostUI;
};
const post = (count) => ({
  id: 'post-carousel', title: '湖边散步', content: '一段旅行记录', author_id: 'author-1',
  profiles: { display_name: '旅行者' },
  post_media: Array.from({ length: count }, (_, index) => ({
    id: 'media-' + index, sort_order: index, media_type: index === 2 ? 'video' : 'image',
    public_url: 'https://cdn.example.test/' + index + (index === 2 ? '.mp4' : '.jpg')
  }))
});

test('detail media uses a horizontal carousel with one pagination target per item', () => {
  const html = createUi().card(post(4), { detail: true });
  assert.match(html, /class="post-gallery-track"[^>]*role="region"[^>]*aria-roledescription="carousel"/);
  assert.equal((html.match(/class="post-gallery-slide"/g) || []).length, 4);
  assert.equal((html.match(/data-post-gallery-index=/g) || []).length, 4);
  assert.match(html, /data-post-gallery-status aria-live="polite"/);
  assert.match(html, /<video controls preload="metadata"/);
});

test('a single detail image has a fixed carousel frame but no pagination controls', () => {
  const html = createUi().card(post(1), { detail: true });
  assert.equal((html.match(/class="post-gallery-slide"/g) || []).length, 1);
  assert.doesNotMatch(html, /post-gallery-pagination|data-post-gallery-index=/);
});

test('home feed shows one cover while detail retains every uploaded item', () => {
  const html = createUi().card(post(4), { homeFeed: true });
  assert.doesNotMatch(html, /post-gallery-carousel|post-gallery-track/);
  assert.equal((html.match(/data-post-media="feed"/g) || []).length, 1);
  assert.match(html, /class="home-feed-engagement"/);
  assert.match(html, /data-post-media="feed"/);
  assert.match(createUi().card(post(4), { detail: true }), /class="post-gallery-slide"[^>]*aria-label="4 共 4"/);
});
