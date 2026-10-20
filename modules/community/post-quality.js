const TEST_CONTENT = /(?:公测版|测试版|内部测试|test\s*(?:version|build)|placeholder|lorem ipsum)/i;
const CONTACT_CONTENT = /(?:[\w.+-]+@[\w.-]+\.[a-z]{2,}|(?:\+?86[-\s]?)?1[3-9]\d{9}|QQ(?:邮箱|号)?|微信号?|手机号|联系方式)/i;

const compact = value => String(value || '').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
const countText = value => Array.from(String(value || '').trim()).length;

export function postFingerprint(post = {}) {
  return [post.title, post.content, post.location_name || post.city || post.route?.destination]
    .map(compact)
    .join('|');
}

export function postTextIssues({ title, content, location_name, city, destination } = {}) {
  const issues = [];
  const text = [title, content, location_name, city, destination].filter(Boolean).join('\n');
  if (countText(title) < 2) issues.push('请写一个清楚的标题');
  if (countText(content) < 12) issues.push('请补充至少 12 个字的旅行正文');
  if (countText(location_name || city || destination) < 2) issues.push('请填写旅行目的地');
  if (TEST_CONTENT.test(text)) issues.push('请移除测试或占位文字');
  if (CONTACT_CONTENT.test(text)) issues.push('请移除公开联系方式');
  return issues;
}

export function hasPublicPhoto(post = {}) {
  return (post.post_media || []).some(item => {
    if (item?.media_type !== 'image' || !item.public_url) return false;
    try { return new URL(item.public_url).protocol === 'https:'; }
    catch { return false; }
  });
}

export function isPublicQualityPost(post) {
  return Boolean(post?.id) && postTextIssues(post).length === 0 && hasPublicPhoto(post);
}

export function cleanPublicPosts(posts, limit = 30) {
  const seen = new Set(), result = [];
  for (const post of Array.isArray(posts) ? posts : []) {
    if (!isPublicQualityPost(post)) continue;
    const fingerprint = postFingerprint(post);
    if (!fingerprint || seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    result.push(post);
    if (result.length >= limit) break;
  }
  return result;
}

export function draftIssues({ title, content, location_name, city, destination, files = [], posts = [] } = {}) {
  const issues = postTextIssues({ title, content, location_name, city, destination });
  if (!files.some(file => String(file?.type || '').startsWith('image/'))) issues.push('请至少添加一张照片');
  const fingerprint = postFingerprint({ title, content, location_name, city, destination });
  if (fingerprint && posts.some(post => postFingerprint(post) === fingerprint)) issues.push('这条旅行记录已发布过');
  return issues;
}
