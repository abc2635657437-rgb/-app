import test from 'node:test';
import assert from 'node:assert/strict';
import { cleanPublicPosts, draftIssues, isPublicQualityPost } from '../modules/community/post-quality.js';

const photo = { media_type: 'image', public_url: 'https://cdn.example.test/trip.jpg' };
const valid = (overrides = {}) => ({
  id: 'post-1', title: '京都清晨散步', content: '清晨沿着鸭川慢慢走到祇园，街道很安静，适合拍照和喝咖啡。',
  location_name: '京都', post_media: [photo], ...overrides
});

test('public feed keeps only titled, substantive, located posts with an HTTPS photo', () => {
  const items = [
    valid(), valid({ id: 'bad-title', title: '1' }), valid({ id: 'no-photo', post_media: [] }),
    valid({ id: 'no-place', location_name: '' }), valid({ id: 'test', content: '这是 Travel World 公测版测试内容。' }),
    valid({ id: 'contact', content: '欢迎联系我：2635657437@qq.com' })
  ];
  assert.deepEqual(cleanPublicPosts(items).map(post => post.id), ['post-1']);
});

test('exact duplicate travel stories are removed without mutating source items', () => {
  const first = valid(), duplicate = valid({ id: 'post-2', title: '京都 清晨散步！', content: '清晨沿着鸭川慢慢走到祇园，街道很安静，适合拍照和喝咖啡。' });
  const source = [first, duplicate];
  assert.deepEqual(cleanPublicPosts(source).map(post => post.id), ['post-1']);
  assert.equal(source.length, 2);
});

test('new posts need title, body, destination and at least one photo', () => {
  assert.deepEqual(draftIssues({ title: '京都', content: '清晨沿着鸭川慢慢走到祇园，街道很安静。', location_name: '京都', files: [{ type: 'image/jpeg' }] }), []);
  assert.deepEqual(draftIssues({ title: '1', content: '测试版', location_name: '', files: [] }), [
    '请写一个清楚的标题', '请补充至少 12 个字的旅行正文', '请填写旅行目的地', '请移除测试或占位文字', '请至少添加一张照片'
  ]);
});

test('broken or non-HTTPS media is not considered a public photo', () => {
  assert.equal(isPublicQualityPost(valid({ post_media: [{ media_type: 'image', public_url: 'http://cdn.example.test/trip.jpg' }] })), false);
});
