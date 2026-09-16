import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';

const app = express();
const port = Number(process.env.PORT || 8787);
const supabaseUrl = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const aiProvider = String(process.env.AI_PROVIDER || '').toLowerCase();
const aiModel = process.env.AI_MODEL || 'gpt-4o-mini';
const aiApiKey = process.env.AI_API_KEY || '';
const aiBaseUrl = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/$/, '');
const nominatimBaseUrl = (process.env.NOMINATIM_BASE_URL || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
const osrmBaseUrl = (process.env.OSRM_BASE_URL || 'https://router.project-osrm.org').replace(/\/$/, '');
const openMeteoBaseUrl = (process.env.OPEN_METEO_BASE_URL || 'https://api.open-meteo.com').replace(/\/$/, '');
const publicAppUrl = process.env.PUBLIC_APP_URL || `http://localhost:${port}`;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error('SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required');
}

const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
const authClient = createClient(supabaseUrl, anonKey, { auth: { autoRefreshToken: false, persistSession: false } });
const allowedUploadTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'video/mp4', 'video/webm', 'video/quicktime', 'video/heic']);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: (_req, file, callback) => callback(allowedUploadTypes.has(file.mimetype) ? null : new Error('仅支持 JPG、PNG、WebP、GIF、MP4、WebM 或 MOV'), allowedUploadTypes.has(file.mimetype)) });
const aiUsage = new Map();
const responseCache = new Map();
function cacheGet(key) { const item = responseCache.get(key); if (!item || item.expiresAt < Date.now()) { responseCache.delete(key); return null; } return item.value; }
function cacheSet(key, value, ttlMs) { responseCache.set(key, { value, expiresAt: Date.now() + ttlMs }); return value; }
async function fetchJson(url, options = {}, timeoutMs = 12_000) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.message || `upstream ${response.status}`);
    return body;
  } finally { clearTimeout(timer); }
}
async function enforceAiQuota(req, res, next) {
  if (!aiApiKey || !aiProvider) return next();
  const now = Date.now(), day = new Date().toISOString().slice(0, 10), key = `${req.user.id}:${day}`;
  const usage = aiUsage.get(key) || { count: 0, recent: [] };
  usage.recent = usage.recent.filter(time => now - time < 60_000);
  if (usage.recent.length >= 3) return res.status(429).json({ error: '请求过于频繁，请稍后再试' });
  const { data, error } = await admin.rpc('consume_ai_quota', { p_user_id: req.user.id, p_daily_limit: 5 });
  if (error) { if (usage.count >= 5) return res.status(429).json({ error: '今天的免费 AI 规划次数已用完，请明天再试' }); usage.count += 1; req.aiRemaining = 5 - usage.count; }
  else { if (Number(data) < 0) return res.status(429).json({ error: '今天的免费 AI 规划次数已用完，请明天再试' }); req.aiRemaining = Math.max(0, 5 - Number(data)); }
  usage.recent.push(now); aiUsage.set(key, usage); next();
}

const normalizeOrigin = value => {
  try { return new URL(String(value || '')).origin; }
  catch (_) { return ''; }
};
const allowedOrigins = new Set([
  publicAppUrl,
  process.env.RENDER_EXTERNAL_URL,
  ...(process.env.CORS_ORIGINS || '').split(',')
].map(normalizeOrigin).filter(Boolean));
app.use(cors((req, callback) => {
  const origin = normalizeOrigin(req.get('Origin'));
  const forwardedHost = String(req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
  const forwardedProtocol = String(req.get('x-forwarded-proto') || req.protocol || 'https').split(',')[0].trim();
  const requestOrigin = normalizeOrigin(`${forwardedProtocol}://${forwardedHost}`);
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  const isAllowed = !origin || isLocal || allowedOrigins.has(origin) || origin === requestOrigin;
  callback(null, { origin: isAllowed, credentials: true });
}));
app.use(express.json({ limit: '2mb' }));
const backendDir = path.dirname(fileURLToPath(import.meta.url));
const landmarkFile = path.resolve(backendDir, '..', 'modules', 'data', 'landmarks.json');
// Serve the small runtime directly from the repository so deployments remain
// independent of the package manager's node_modules layout.
app.use('/vendor/leaflet', express.static(path.resolve(backendDir, '..', 'modules', 'vendor', 'leaflet'), { maxAge: '30d', immutable: true }));
app.use('/vendor/leaflet', express.static(path.resolve(backendDir, 'node_modules', 'leaflet', 'dist'), { maxAge: '30d', immutable: true }));
app.use(express.static(path.resolve(backendDir, '..'), { setHeaders(res, filePath) { if (/\.(?:html|js|css)$/.test(filePath) || filePath.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache, must-revalidate'); } }));

const normalizeText = value => String(value || '').trim().toLowerCase();
async function relevantLandmarks(request = {}, context = {}) {
  try {
    const source = JSON.parse(await readFile(landmarkFile, 'utf8')).landmarks || [];
    const destination = normalizeText(request.destination || context.destination);
    const interests = [...(Array.isArray(request.interests) ? request.interests : []), request.interest, context.interest]
      .flatMap(value => String(value || '').split(/[、,，\s]+/)).filter(Boolean).map(normalizeText);
    const scored = source.map(item => {
      const searchable = normalizeText([item.name, item.country, item.city, item.category, ...(item.tags || [])].join(' '));
      const destinationScore = destination && searchable.includes(destination) ? 20 : 0;
      const interestScore = interests.reduce((score, term) => score + (searchable.includes(term) ? 3 : 0), 0);
      return { item, score: destinationScore + interestScore };
    }).filter(row => row.score > 0).sort((a, b) => b.score - a.score).slice(0, 24);
    return scored.map(({ item }) => ({ id: item.id, name: item.name, country: item.country, city: item.city, latitude: item.latitude, longitude: item.longitude, category: item.category, tags: item.tags, description: item.description, bestSeason: item.bestSeason, rating: item.rating, source: 'Travel World verified landmark catalog' }));
  } catch (_) { return []; }
}

async function weatherForCandidates(candidates) {
  const place = candidates[0]; if (!place) return null;
  const key = `weather:${Number(place.latitude).toFixed(2)}:${Number(place.longitude).toFixed(2)}`;
  const cached = cacheGet(key); if (cached) return cached;
  try {
    const weather = await fetchJson(`${openMeteoBaseUrl}/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`);
    return cacheSet(key, { current: weather.current, daily: weather.daily, timezone: weather.timezone, provider: 'Open-Meteo' }, 30 * 60 * 1000);
  } catch (_) { return null; }
}

function cleanPlan(plan, candidates = []) {
  if (!plan || typeof plan !== 'object') throw new Error('AI 未返回有效计划');
  const daysPlan = Array.isArray(plan.daysPlan) ? plan.daysPlan : [];
  plan.daysPlan = daysPlan.map((day, dayIndex) => ({
    day: Number(day.day || dayIndex + 1), title: String(day.title || ''), note: String(day.note || ''), estimatedCost: Number(day.estimatedCost || 0),
    slots: (Array.isArray(day.slots) ? day.slots : []).map((slot, index) => {
      const verified = candidates.find(candidate => normalizeText(candidate.name) === normalizeText(slot.place));
      return ({
      period: String(slot.period || ''), time: String(slot.time || ''), place: String(slot.place || ''), address: String(slot.address || ''), category: String(slot.category || ''), externalPlaceId: String(slot.externalPlaceId || ''), provider: String(slot.provider || ''),
      duration: String(slot.duration || ''), durationMinutes: Number(slot.durationMinutes || 0), transport: String(slot.transport || ''), transportMinutes: Number(slot.transportMinutes || 0),
      cost: Number(slot.cost || 0), reason: String(slot.reason || ''), latitude: verified ? Number(verified.latitude) : Number(slot.latitude), longitude: verified ? Number(verified.longitude) : Number(slot.longitude),
      verificationStatus: verified ? 'verified' : (slot.verificationStatus === 'provider' && slot.sourceUrl ? 'provider' : 'unverified'), sourceUrl: String(slot.sourceUrl || ''), sortOrder: index
    }); }).filter(slot => slot.place && Number.isFinite(slot.latitude) && Number.isFinite(slot.longitude))
  }));
  return plan;
}

let lastNominatimRequestAt = 0;
async function verifyPlanPlaces(plan) {
  const destination = String(plan.destination || '').trim();
  const unknown = [...new Set((plan.daysPlan || []).flatMap(day => day.slots || []).filter(slot => slot.verificationStatus === 'unverified').map(slot => slot.place))].slice(0, 8);
  const verified = new Map();
  for (const place of unknown) {
    const query = `${place}, ${destination}`; const key = `geocode:${normalizeText(query)}`;
    let results = cacheGet(key);
    if (!results) {
      const waitMs = Math.max(0, 1050 - (Date.now() - lastNominatimRequestAt));
      if (waitMs) await new Promise(resolve => setTimeout(resolve, waitMs));
      lastNominatimRequestAt = Date.now();
      try {
        const upstream = await fetchJson(`${nominatimBaseUrl}/search?format=jsonv2&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`, { headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6', 'User-Agent': `TravelWorld/1.0 (${publicAppUrl})` } });
        results = upstream.map(item => ({ latitude: Number(item.lat), longitude: Number(item.lon), displayName: item.display_name, sourceUrl: `https://www.openstreetmap.org/${item.osm_type}/${item.osm_id}` })).filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
        cacheSet(key, results, 24 * 60 * 60 * 1000);
      } catch (_) { results = []; }
    }
    if (results[0]) verified.set(place, results[0]);
  }
  plan.daysPlan.forEach(day => day.slots.forEach(slot => {
    const result = verified.get(slot.place); if (!result || slot.verificationStatus !== 'unverified') return;
    slot.latitude = result.latitude; slot.longitude = result.longitude; slot.address = slot.address || result.displayName;
    slot.verificationStatus = 'provider'; slot.provider = 'OpenStreetMap Nominatim'; slot.sourceUrl = result.sourceUrl;
  }));
  return plan;
}

async function saveAiPlan(userId, conversationId, request, plan) {
  const title = String(plan.tripTitle || `${plan.destination || request.destination || '旅行'} · ${plan.days || request.days || ''}天`).trim();
  const { data: savedConversation } = await admin.from('ai_conversations').select('route_id').eq('id', conversationId).eq('user_id', userId).single();
  const routePayload = { owner_id: userId, title, destination: plan.destination || request.destination || '', days: plan.daysPlan || [], is_public: false, updated_at: new Date().toISOString() };
  const routeResult = savedConversation?.route_id
    ? await admin.from('routes').update(routePayload).eq('id', savedConversation.route_id).eq('owner_id', userId).select().single()
    : await admin.from('routes').insert(routePayload).select().single();
  const { data: route, error: routeError } = routeResult;
  if (routeError) throw routeError;
  if (savedConversation?.route_id) { const { error } = await admin.from('trip_days').delete().eq('route_id', route.id); if (error) throw error; }
  const dayRows = (plan.daysPlan || []).map((day, index) => ({ route_id: route.id, day_number: day.day || index + 1, title: day.title || `Day ${day.day || index + 1}`, summary: day.note || '', estimated_cost: day.estimatedCost || 0, currency: plan.currency || 'CNY', sort_order: index }));
  if (dayRows.length) {
    const { data: savedDays, error: dayError } = await admin.from('trip_days').insert(dayRows).select();
    if (dayError) throw dayError;
    const places = savedDays.flatMap(day => {
      const sourceDay = (plan.daysPlan || []).find(item => Number(item.day) === Number(day.day_number));
      return (sourceDay?.slots || []).map((slot, index) => ({ trip_day_id: day.id, external_place_id: slot.externalPlaceId || null, provider: slot.provider || null, name: slot.place, address: slot.address || null, category: slot.category || null, latitude: slot.latitude, longitude: slot.longitude, start_time: /^\d{2}:\d{2}/.test(slot.time) ? slot.time.slice(0, 5) : null, duration_minutes: slot.durationMinutes || null, transport: slot.transport || null, transport_minutes: slot.transportMinutes || null, estimated_cost: slot.cost || 0, currency: plan.currency || 'CNY', reason: slot.reason || null, verification_status: slot.verificationStatus, source_url: slot.sourceUrl || null, sort_order: index }));
    });
    if (places.length) { const { error } = await admin.from('trip_places').insert(places); if (error) throw error; }
  }
  await admin.from('ai_conversations').update({ route_id: route.id, title, context: { ...request, plan }, updated_at: new Date().toISOString() }).eq('id', conversationId).eq('user_id', userId);
  return route;
}

async function saveTripPreferences(userId, conversationId, request, context) {
  const source = { ...(context || {}), ...(request || {}) };
  const payload = {
    user_id: userId, conversation_id: conversationId, destination: source.destination || null,
    start_date: source.startDate || source.start_date || null, end_date: source.endDate || source.end_date || null,
    days: Number(source.days) || null, travelers: Number(String(source.travelers || '').match(/\d+/)?.[0]) || null,
    budget: Number(source.budget) || null, currency: source.currency || 'CNY',
    interests: Array.isArray(source.interests) ? source.interests : [], dislikes: Array.isArray(source.dislikes) ? source.dislikes : [],
    pace: source.pace || null, transport_preferences: Array.isArray(source.transportPreferences) ? source.transportPreferences : (source.transport ? [source.transport] : []),
    dietary_preferences: Array.isArray(source.dietaryPreferences) ? source.dietaryPreferences : (source.diet ? [source.diet] : []),
    accommodation_preferences: source.accommodation && typeof source.accommodation === 'object' ? source.accommodation : (source.accommodation ? { note: source.accommodation } : {}),
    extra_requirements: source.message || source.extra || null, updated_at: new Date().toISOString()
  };
  const { data: existing } = await admin.from('trip_preferences').select('id').eq('conversation_id', conversationId).eq('user_id', userId).maybeSingle();
  const result = existing ? await admin.from('trip_preferences').update(payload).eq('id', existing.id) : await admin.from('trip_preferences').insert(payload);
  if (result.error) throw result.error;
}

async function requireUser(req, res, next) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) return res.status(401).json({ error: '登录后才能操作' });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return res.status(401).json({ error: '登录已过期，请重新登录' });
  req.user = data.user;
  req.accessToken = token;
  next();
}

function publicPostQuery() {
  return admin.from('posts').select('*, profiles:author_id(id,username,display_name,bio,avatar_url), post_media(*), post_likes(user_id), comments(id,author_id,content,created_at,profiles:author_id(id,display_name,avatar_url))').order('created_at', { ascending: false });
}

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'travel-world-api' }));
app.get('/api/config', (_req, res) => res.json({ supabaseUrl, anonKey }));

app.get('/api/map/tiles/:z/:x/:y.png', async (req, res) => {
  const z = Number(req.params.z), x = Number(req.params.x), y = Number(req.params.y);
  const max = 2 ** z;
  if (!Number.isInteger(z) || !Number.isInteger(x) || !Number.isInteger(y) || z < 0 || z > 19 || x < 0 || y < 0 || x >= max || y >= max) return res.status(400).json({ error: '地图瓦片坐标无效' });
  try {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 10_000);
    const upstream = await fetch(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`, { signal: controller.signal, headers: { 'User-Agent': `TravelWorld/1.0 (${publicAppUrl})`, Accept: 'image/png' } });
    clearTimeout(timer);
    if (!upstream.ok) return res.status(502).json({ error: '地图瓦片服务暂时不可用' });
    res.set({ 'Content-Type': upstream.headers.get('content-type') || 'image/png', 'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800', 'X-Map-Attribution': 'OpenStreetMap contributors' });
    res.send(Buffer.from(await upstream.arrayBuffer()));
  } catch (_) { res.status(502).json({ error: '地图瓦片服务暂时不可用' }); }
});

app.get('/api/map/search', async (req, res) => {
  const query = String(req.query.q || '').trim().slice(0, 160);
  if (query.length < 2) return res.status(400).json({ error: '请输入至少两个字符的地点名称' });
  const cacheKey = `geocode:${normalizeText(query)}`;
  const cached = cacheGet(cacheKey); if (cached) return res.json({ results: cached, cached: true, provider: 'OpenStreetMap Nominatim' });
  try {
    const url = `${nominatimBaseUrl}/search?format=jsonv2&addressdetails=1&limit=5&q=${encodeURIComponent(query)}`;
    const upstream = await fetchJson(url, { headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6', 'User-Agent': `TravelWorld/1.0 (${publicAppUrl})` } });
    const results = upstream.map(item => ({ id: String(item.place_id), name: item.name || item.display_name.split(',')[0], displayName: item.display_name, latitude: Number(item.lat), longitude: Number(item.lon), category: item.category, type: item.type, provider: 'OpenStreetMap', sourceUrl: `https://www.openstreetmap.org/${item.osm_type}/${item.osm_id}` })).filter(item => Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
    cacheSet(cacheKey, results, 24 * 60 * 60 * 1000); res.json({ results, cached: false, provider: 'OpenStreetMap Nominatim' });
  } catch (error) { res.status(502).json({ error: '地点搜索服务暂时不可用', detail: error.message }); }
});

app.get('/api/map/reverse', async (req, res) => {
  const latitude = Number(req.query.latitude), longitude = Number(req.query.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return res.status(400).json({ error: '位置坐标无效' });
  const cacheKey = `reverse:${latitude.toFixed(3)}:${longitude.toFixed(3)}`;
  const cached = cacheGet(cacheKey); if (cached) return res.json(cached);
  try {
    const place = await fetchJson(`${nominatimBaseUrl}/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`, { headers: { 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.6', 'User-Agent': `TravelWorld/1.0 (${publicAppUrl})` } });
    const address = place.address || {};
    const result = { country: String(address.country || '').slice(0, 80), city: String(address.city || address.town || address.village || address.state || '').slice(0, 80) };
    cacheSet(cacheKey, result, 24 * 60 * 60 * 1000); res.json(result);
  } catch (_) { res.json({ country: '', city: '' }); }
});

app.post('/api/map/route', async (req, res) => {
  const points = Array.isArray(req.body?.points) ? req.body.points.slice(0, 25) : [];
  const valid = points.map(point => ({ latitude: Number(point.latitude), longitude: Number(point.longitude), name: String(point.name || '') })).filter(point => Number.isFinite(point.latitude) && Number.isFinite(point.longitude) && Math.abs(point.latitude) <= 90 && Math.abs(point.longitude) <= 180);
  if (valid.length < 2) return res.status(400).json({ error: '路线至少需要两个有效地点' });
  const coords = valid.map(point => `${point.longitude},${point.latitude}`).join(';');
  const cacheKey = `route:${coords}`; const cached = cacheGet(cacheKey); if (cached) return res.json({ ...cached, cached: true });
  try {
    const route = await fetchJson(`${osrmBaseUrl}/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`);
    const first = route.routes?.[0]; if (!first) return res.status(404).json({ error: '没有找到可用路线' });
    const result = { geometry: first.geometry, distanceMeters: Math.round(first.distance), durationSeconds: Math.round(first.duration), waypoints: valid, provider: 'OSRM / OpenStreetMap', profile: 'driving' };
    cacheSet(cacheKey, result, 6 * 60 * 60 * 1000); res.json({ ...result, cached: false });
  } catch (error) { res.status(502).json({ error: '道路路线服务暂时不可用', detail: error.message }); }
});

app.post('/api/map/presence', requireUser, async (req, res) => {
  const latitude = Number(req.body?.latitude), longitude = Number(req.body?.longitude);
  const sharing_enabled = req.body?.sharing_enabled === true;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return res.status(400).json({ error: '位置坐标无效' });
  const payload = { user_id: req.user.id, latitude, longitude, country: String(req.body?.country || '').slice(0, 80), city: String(req.body?.city || '').slice(0, 80), sharing_enabled, updated_at: new Date().toISOString() };
  const { data, error } = await admin.from('live_locations').upsert(payload, { onConflict: 'user_id' }).select('sharing_enabled,updated_at').single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.delete('/api/map/presence', requireUser, async (req, res) => {
  const { error } = await admin.from('live_locations').delete().eq('user_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

app.get('/api/map/online-users', async (req, res) => {
  const country = String(req.query.country || '').trim().slice(0, 80);
  let query = admin.from('live_locations').select('latitude,longitude,country,city,updated_at,profiles:user_id(id,username,display_name,bio,avatar_url)').eq('sharing_enabled', true).gte('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()).order('updated_at', { ascending: false }).limit(200);
  if (country) query = query.ilike('country', country);
  const { data, error } = await query;
  if (error) return res.status(400).json({ error: error.message });
  res.json({ expiresInSeconds: 300, users: data || [] });
});

app.get('/api/weather', async (req, res) => {
  const latitude = Number(req.query.latitude), longitude = Number(req.query.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return res.status(400).json({ error: '经纬度无效' });
  const cacheKey = `weather:${latitude.toFixed(2)}:${longitude.toFixed(2)}`; const cached = cacheGet(cacheKey); if (cached) return res.json({ ...cached, cached: true });
  try {
    const weather = await fetchJson(`${openMeteoBaseUrl}/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=7`);
    const result = { current: weather.current, daily: weather.daily, timezone: weather.timezone, provider: 'Open-Meteo' };
    cacheSet(cacheKey, result, 30 * 60 * 1000); res.json({ ...result, cached: false });
  } catch (error) { res.status(502).json({ error: '天气服务暂时不可用', detail: error.message }); }
});

app.post('/api/auth/register', async (req, res) => {
  const { email, password, displayName = '', username = '' } = req.body || {};
  if (!email || !password || password.length < 8) return res.status(400).json({ error: '请输入邮箱和至少 8 位密码' });
  const isChinaMailbox = /@(qq\.com|163\.com|126\.com|sina\.com|foxmail\.com|aliyun\.com)$/i.test(email);
  const { data, error } = await authClient.auth.signUp({ email, password, options: { emailRedirectTo: publicAppUrl, data: { display_name: displayName, username, email_locale: isChinaMailbox ? 'zh-CN' : 'en' } } });
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json({ user: data.user, session: data.session });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  if (error) return res.status(401).json({ error: error.message });
  res.json({ user: data.user, session: data.session });
});

app.post('/api/auth/refresh', async (req, res) => {
  const refreshToken = String(req.body?.refreshToken || '');
  if (!refreshToken) return res.status(400).json({ error: '缺少会话刷新凭证' });
  const { data, error } = await authClient.auth.refreshSession({ refresh_token: refreshToken });
  if (error || !data.session) return res.status(401).json({ error: '登录已过期，请重新登录' });
  res.json({ user: data.user, session: data.session });
});

app.get('/api/auth/session', requireUser, async (req, res) => {
  const { data: profile } = await admin.from('profiles').select('id,username,display_name,bio,avatar_url').eq('id', req.user.id).maybeSingle();
  res.json({ user: req.user, profile });
});

app.post('/api/auth/logout', requireUser, async (req, res) => {
  await admin.auth.admin.signOut(req.accessToken);
  res.status(204).end();
});

app.get('/api/users/me', requireUser, async (req, res) => {
  const { data, error } = await admin.from('profiles').select('*').eq('id', req.user.id).single();
  if (error) return res.status(404).json({ error: error.message });
  res.json(data);
});

app.get('/api/users/me/stats', requireUser, async (req, res) => {
  const uid = req.user.id;
  const [posts, followers, following, likes, trips, favorites] = await Promise.all([
    admin.from('posts').select('id', { count: 'exact', head: true }).eq('author_id', uid),
    admin.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', uid),
    admin.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', uid),
    admin.from('post_likes').select('post_id,posts!inner(author_id)', { count: 'exact', head: true }).eq('posts.author_id', uid),
    admin.from('trips').select('id', { count: 'exact', head: true }).eq('owner_id', uid),
    admin.from('favorites').select('post_id', { count: 'exact', head: true }).eq('user_id', uid)
  ]);
  const failed = [posts, followers, following, likes, trips, favorites].find(result => result.error);
  if (failed) return res.status(500).json({ error: failed.error.message });
  res.json({ posts: posts.count || 0, followers: followers.count || 0, following: following.count || 0, likes: likes.count || 0, trips: trips.count || 0, favorites: favorites.count || 0 });
});

app.patch('/api/users/me', requireUser, async (req, res) => {
  const allowed = ['display_name', 'username', 'bio', 'avatar_url'];
  const patch = Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key)));
  patch.updated_at = new Date().toISOString();
  const { data, error } = await admin.from('profiles').update(patch).eq('id', req.user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.put('/api/users/me/password', requireUser, async (req, res) => {
  const password = String(req.body?.password || '');
  if (password.length < 8) return res.status(400).json({ error: '新密码至少需要 8 位' });
  const { error } = await admin.auth.admin.updateUserById(req.user.id, { password });
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

app.get('/api/users/me/settings', requireUser, async (req, res) => {
  const defaults = { user_id: req.user.id, language: 'zh', notifications: { likes: true, comments: true, follows: true, buddy: true, chat: true }, privacy: { publicProfile: true, showTrips: true, allowFollow: true }, messages: { buddyMessages: true, communityMessages: true }, content_preferences: { domestic: true, international: true, photography: true }, general: { autoplayVideo: false, saveData: false } };
  const { data, error } = await admin.from('user_settings').select('*').eq('user_id', req.user.id).maybeSingle();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || defaults);
});

app.patch('/api/users/me/settings', requireUser, async (req, res) => {
  const allowed = ['language', 'notifications', 'privacy', 'messages', 'content_preferences', 'general'];
  const payload = { user_id: req.user.id, ...Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key))), updated_at: new Date().toISOString() };
  if (payload.language && !['zh', 'en'].includes(payload.language)) return res.status(400).json({ error: '语言设置无效' });
  const { data, error } = await admin.from('user_settings').upsert(payload, { onConflict: 'user_id' }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.get('/api/users/me/blocked', requireUser, async (req, res) => {
  const { data, error } = await admin.from('blocked_users').select('created_at, profile:blocked_id(id,username,display_name,bio,avatar_url)').eq('blocker_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(item => ({ ...item.profile, blocked_at: item.created_at })).filter(item => item.id));
});

app.post('/api/users/me/blocked/:userId', requireUser, async (req, res) => {
  if (req.params.userId === req.user.id) return res.status(400).json({ error: '不能屏蔽自己' });
  const { error } = await admin.from('blocked_users').upsert({ blocker_id: req.user.id, blocked_id: req.params.userId }, { onConflict: 'blocker_id,blocked_id' });
  if (error) return res.status(400).json({ error: error.message });
  await admin.from('follows').delete().or(`and(follower_id.eq.${req.user.id},following_id.eq.${req.params.userId}),and(follower_id.eq.${req.params.userId},following_id.eq.${req.user.id})`);
  res.status(201).json({ blocked: true });
});

app.delete('/api/users/me/blocked/:userId', requireUser, async (req, res) => {
  const { error } = await admin.from('blocked_users').delete().eq('blocker_id', req.user.id).eq('blocked_id', req.params.userId);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

app.post('/api/users/me/avatar', requireUser, upload.single('file'), async (req, res) => {
  if (!req.file || !req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: '请选择有效头像图片' });
  const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const storagePath = `${req.user.id}/avatar/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage.from('media').upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (uploadError) return res.status(400).json({ error: uploadError.message });
  const { data: urlData } = admin.storage.from('media').getPublicUrl(storagePath);
  const { data, error } = await admin.from('profiles').update({ avatar_url: urlData.publicUrl, updated_at: new Date().toISOString() }).eq('id', req.user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json({ ...data, storage_path: storagePath });
});

app.get('/api/community/feed', async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);
  const { data, error } = await publicPostQuery().limit(limit);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/community/feed/following', requireUser, async (req, res) => {
  const { data: follows, error: followError } = await admin.from('follows').select('following_id').eq('follower_id', req.user.id);
  if (followError) return res.status(500).json({ error: followError.message });
  const ids = (follows || []).map(item => item.following_id); if (!ids.length) return res.json([]);
  const { data, error } = await publicPostQuery().in('author_id', ids).limit(50);
  if (error) return res.status(500).json({ error: error.message }); res.json(data || []);
});

app.post('/api/community/posts', requireUser, async (req, res) => {
  const { title = '', content = '', type = 'story', location_name = null, country = null, city = null, latitude = null, longitude = null, route_id = null } = req.body || {};
  const { data, error } = await admin.from('posts').insert({ author_id: req.user.id, title, content, type, location_name, country, city, latitude, longitude, route_id }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

app.post('/api/community/posts/:postId/media', requireUser, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请选择图片或视频' });
  const { data: post } = await admin.from('posts').select('author_id').eq('id', req.params.postId).single();
  if (!post || post.author_id !== req.user.id) return res.status(403).json({ error: '无权上传到此帖子' });
  const ext = (req.file.originalname.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${req.user.id}/${req.params.postId}/${crypto.randomUUID()}.${ext}`;
  const { error: uploadError } = await admin.storage.from('media').upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (uploadError) return res.status(400).json({ error: uploadError.message });
  const { data: urlData } = admin.storage.from('media').getPublicUrl(path);
  const mediaType = req.file.mimetype.startsWith('video/') ? 'video' : 'image';
  const { data, error } = await admin.from('post_media').insert({ post_id: req.params.postId, storage_path: path, public_url: urlData.publicUrl, media_type: mediaType, sort_order: Number(req.body.sort_order || 0) }).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

app.post('/api/community/posts/:postId/like', requireUser, async (req, res) => {
  const postId = req.params.postId;
  const { data: post } = await admin.from('posts').select('author_id,title').eq('id', postId).single();
  if (!post) return res.status(404).json({ error: '帖子不存在' });
  const { data: existing } = await admin.from('post_likes').select('post_id').eq('post_id', postId).eq('user_id', req.user.id).maybeSingle();
  if (existing) {
    const { error } = await admin.from('post_likes').delete().eq('post_id', postId).eq('user_id', req.user.id);
    if (error) return res.status(400).json({ error: error.message });
    await admin.from('notifications').delete().eq('recipient_id', post.author_id).eq('actor_id', req.user.id).eq('type', 'like').eq('post_id', postId);
  } else {
    const { error } = await admin.from('post_likes').insert({ post_id: postId, user_id: req.user.id });
    if (error) return res.status(400).json({ error: error.message });
    if (post.author_id !== req.user.id) await admin.from('notifications').insert({ recipient_id: post.author_id, actor_id: req.user.id, type: 'like', post_id: postId, message: `赞了你的内容${post.title ? `「${post.title}」` : ''}` });
  }
  const { count } = await admin.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', postId);
  res.json({ liked: !existing, count: count || 0 });
});

app.post('/api/community/posts/:postId/comments', requireUser, async (req, res) => {
  const content = String(req.body?.content || '').trim();
  if (!content) return res.status(400).json({ error: '评论不能为空' });
  const { data, error } = await admin.from('comments').insert({ post_id: req.params.postId, author_id: req.user.id, content }).select('*, profiles:author_id(id,display_name,avatar_url)').single();
  if (error) return res.status(400).json({ error: error.message });
  const { data: post } = await admin.from('posts').select('author_id,title').eq('id', req.params.postId).single();
  if (post && post.author_id !== req.user.id) await admin.from('notifications').insert({ recipient_id: post.author_id, actor_id: req.user.id, type: 'comment', post_id: req.params.postId, message: `评论了你的内容${post.title ? `「${post.title}」` : ''}` });
  res.status(201).json(data);
});

app.delete('/api/community/comments/:id', requireUser, async (req, res) => {
  const { data: comment } = await admin.from('comments').select('id,author_id,post:post_id(author_id)').eq('id', req.params.id).single();
  if (!comment) return res.status(404).json({ error: '评论不存在' });
  if (comment.author_id !== req.user.id && comment.post?.author_id !== req.user.id) return res.status(403).json({ error: '无权删除该评论' });
  const { error } = await admin.from('comments').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

app.patch('/api/community/posts/:postId', requireUser, async (req, res) => {
  const allowed = ['title', 'content', 'location_name', 'country', 'city', 'latitude', 'longitude'];
  const patch = { ...Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key))), updated_at: new Date().toISOString() };
  const { data, error } = await admin.from('posts').update(patch).eq('id', req.params.postId).eq('author_id', req.user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.delete('/api/community/posts/:postId', requireUser, async (req, res) => {
  const { data: media } = await admin.from('post_media').select('storage_path').eq('post_id', req.params.postId);
  const { error } = await admin.from('posts').delete().eq('id', req.params.postId).eq('author_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  if (media?.length) await admin.storage.from('media').remove(media.map(item => item.storage_path));
  res.status(204).end();
});

app.post('/api/community/posts/:postId/favorite', requireUser, async (req, res) => {
  const postId = req.params.postId;
  const { data: post } = await admin.from('posts').select('id').eq('id', postId).single();
  if (!post) return res.status(404).json({ error: '帖子不存在' });
  const { data: existing } = await admin.from('favorites').select('post_id').eq('post_id', postId).eq('user_id', req.user.id).maybeSingle();
  const result = existing
    ? await admin.from('favorites').delete().eq('post_id', postId).eq('user_id', req.user.id)
    : await admin.from('favorites').insert({ post_id: postId, user_id: req.user.id });
  if (result.error) return res.status(400).json({ error: result.error.message });
  res.json({ favorited: !existing });
});

app.get('/api/community/favorites', requireUser, async (req, res) => {
  const { data, error } = await admin.from('favorites').select('created_at, posts:post_id(*, profiles:author_id(id,username,display_name,bio,avatar_url), post_media(*), post_likes(user_id), comments(id))').eq('user_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(item => item.posts).filter(Boolean));
});

app.get('/api/community/me/posts', requireUser, async (req, res) => {
  const { data, error } = await publicPostQuery().eq('author_id', req.user.id).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/community/me/routes', requireUser, async (req, res) => {
  const { data, error } = await admin.from('routes').select('*, trip_days(*, trip_places(*))').eq('owner_id', req.user.id).order('updated_at', { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/community/following', requireUser, async (req, res) => {
  const { data, error } = await admin.from('follows').select('created_at, profile:following_id(id,username,display_name,bio,avatar_url)').eq('follower_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(item => ({ ...item.profile, followed_at: item.created_at })).filter(item => item.id));
});

app.get('/api/community/followers', requireUser, async (req, res) => {
  const { data, error } = await admin.from('follows').select('created_at, profile:follower_id(id,username,display_name,bio,avatar_url)').eq('following_id', req.user.id).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(item => ({ ...item.profile, followed_at: item.created_at })).filter(item => item.id));
});

app.get('/api/community/interactions', requireUser, async (req, res) => {
  const { data, error } = await admin.from('notifications').select('id,type,message,post_id,read_at,created_at,actor:actor_id(id,username,display_name,bio,avatar_url),post:post_id(id,title)').eq('recipient_id', req.user.id).in('type', ['like', 'comment', 'follow']).order('created_at', { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/community/users/:userId/follow', requireUser, async (req, res) => {
  if (req.user.id === req.params.userId) return res.status(400).json({ error: '不能关注自己' });
  const { data: blocks } = await admin.from('blocked_users').select('blocker_id').or(`and(blocker_id.eq.${req.user.id},blocked_id.eq.${req.params.userId}),and(blocker_id.eq.${req.params.userId},blocked_id.eq.${req.user.id})`).limit(1);
  if (blocks?.length) return res.status(403).json({ error: '当前用户关系不允许关注' });
  const { data: existing } = await admin.from('follows').select('follower_id').eq('follower_id', req.user.id).eq('following_id', req.params.userId).maybeSingle();
  if (existing) {
    const { error } = await admin.from('follows').delete().eq('follower_id', req.user.id).eq('following_id', req.params.userId);
    if (error) return res.status(400).json({ error: error.message });
    await admin.from('notifications').delete().eq('recipient_id', req.params.userId).eq('actor_id', req.user.id).eq('type', 'follow');
  } else {
    const { error } = await admin.from('follows').insert({ follower_id: req.user.id, following_id: req.params.userId });
    if (error) return res.status(400).json({ error: error.message });
    await admin.from('notifications').insert({ recipient_id: req.params.userId, actor_id: req.user.id, type: 'follow', message: '关注了你' });
  }
  res.json({ following: !existing });
});

app.get('/api/notifications', requireUser, async (req, res) => {
  const { data, error } = await admin.from('notifications').select('*, actor:actor_id(id,display_name,avatar_url)').eq('recipient_id', req.user.id).order('created_at', { ascending: false }).limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.patch('/api/notifications/:id/read', requireUser, async (req, res) => {
  const { data, error } = await admin.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', req.params.id).eq('recipient_id', req.user.id).select().single();
  if (error) return res.status(404).json({ error: '通知不存在' });
  res.json(data);
});

app.get('/api/trips', async (_req, res) => {
  const { data, error } = await admin.from('trips').select('*, owner:owner_id(id,display_name,avatar_url,bio), buddy_applications(id,status), buddy_relations(user_id)').eq('status', 'open').order('created_at', { ascending: false }).limit(50);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/trips', requireUser, async (req, res) => {
  const title = String(req.body?.title || '').trim(), destination = String(req.body?.destination || '').trim();
  if (!title || !destination) return res.status(400).json({ error: '请填写旅行标题和目的地' });
  const payload = { owner_id: req.user.id, title: title.slice(0, 120), destination: destination.slice(0, 120), start_date: req.body?.startDate || null, end_date: req.body?.endDate || null, description: String(req.body?.description || '').slice(0, 3000), status: 'open' };
  const { data, error } = await admin.from('trips').insert(payload).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.status(201).json(data);
});

app.patch('/api/trips/:tripId', requireUser, async (req, res) => {
  const fields = { title: req.body?.title, destination: req.body?.destination, start_date: req.body?.startDate, end_date: req.body?.endDate, description: req.body?.description, status: req.body?.status };
  const patch = Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));
  const { data, error } = await admin.from('trips').update(patch).eq('id', req.params.tripId).eq('owner_id', req.user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
});

app.delete('/api/trips/:tripId', requireUser, async (req, res) => {
  const { error } = await admin.from('trips').delete().eq('id', req.params.tripId).eq('owner_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

app.get('/api/routes', async (_req, res) => {
  const { data, error } = await admin.from('routes').select('*, owner:owner_id(id,username,display_name,bio,avatar_url), trip_days(*,trip_places(*)), posts!posts_route_id_fkey(id,post_likes(user_id),comments(id,author_id,content,created_at,author:author_id(id,display_name,avatar_url)))').eq('is_public', true).order('updated_at', { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(route => ({ ...route, interaction_post_id: route.posts?.[0]?.id || null, route_likes: route.posts?.[0]?.post_likes || [], route_comments: route.posts?.[0]?.comments || [], posts: undefined })));
});

app.get('/api/routes/favorites', requireUser, async (req, res) => {
  const { data, error } = await admin.from('favorites').select('post:post_id!inner(route_id)').eq('user_id', req.user.id).not('post.route_id', 'is', null);
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(item => item.post?.route_id).filter(Boolean));
});

app.get('/api/routes/favorite-items', requireUser, async (req, res) => {
  const { data, error } = await admin.from('favorites').select('created_at, post:post_id!inner(route:route_id(*,owner:owner_id(id,display_name,avatar_url),trip_days(*,trip_places(*))))').eq('user_id', req.user.id).not('post.route_id', 'is', null).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json((data || []).map(item => item.post?.route).filter(Boolean));
});

app.patch('/api/routes/:id', requireUser, async (req, res) => {
  const allowed = ['title', 'destination', 'days', 'is_public'];
  const patch = { ...Object.fromEntries(Object.entries(req.body || {}).filter(([key]) => allowed.includes(key))), updated_at: new Date().toISOString() };
  const { data, error } = await admin.from('routes').update(patch).eq('id', req.params.id).eq('owner_id', req.user.id).select().single();
  if (error) return res.status(400).json({ error: error.message });
  const { data: linked } = await admin.from('posts').select('id').eq('route_id', data.id).eq('author_id', req.user.id).maybeSingle();
  if (data.is_public) {
    const postPayload = { author_id: req.user.id, route_id: data.id, type: 'route', title: data.title, content: `公开旅行路线：${data.destination}`, location_name: data.destination, city: data.destination, updated_at: new Date().toISOString() };
    const postResult = linked ? await admin.from('posts').update(postPayload).eq('id', linked.id) : await admin.from('posts').insert(postPayload);
    if (postResult.error) return res.status(400).json({ error: postResult.error.message });
  } else if (linked) await admin.from('posts').delete().eq('id', linked.id);
  res.json(data);
});

app.delete('/api/routes/:id', requireUser, async (req, res) => {
  await admin.from('posts').delete().eq('route_id', req.params.id).eq('author_id', req.user.id);
  const { error } = await admin.from('routes').delete().eq('id', req.params.id).eq('owner_id', req.user.id);
  if (error) return res.status(400).json({ error: error.message });
  res.status(204).end();
});

app.post('/api/routes/:id/like', requireUser, async (req, res) => {
  const { data: post } = await admin.from('posts').select('id').eq('route_id', req.params.id).single(); if (!post) return res.status(404).json({ error: '公开路线不存在' });
  const { data: existing } = await admin.from('post_likes').select('post_id').eq('post_id', post.id).eq('user_id', req.user.id).maybeSingle();
  const result = existing ? await admin.from('post_likes').delete().eq('post_id', post.id).eq('user_id', req.user.id) : await admin.from('post_likes').insert({ post_id: post.id, user_id: req.user.id });
  if (result.error) return res.status(400).json({ error: result.error.message });
  const { count } = await admin.from('post_likes').select('*', { count: 'exact', head: true }).eq('post_id', post.id); res.json({ liked: !existing, count: count || 0 });
});

app.post('/api/routes/:id/favorite', requireUser, async (req, res) => {
  const { data: post } = await admin.from('posts').select('id').eq('route_id', req.params.id).single(); if (!post) return res.status(404).json({ error: '公开路线不存在' });
  const { data: existing } = await admin.from('favorites').select('post_id').eq('post_id', post.id).eq('user_id', req.user.id).maybeSingle();
  const result = existing ? await admin.from('favorites').delete().eq('post_id', post.id).eq('user_id', req.user.id) : await admin.from('favorites').insert({ post_id: post.id, user_id: req.user.id });
  if (result.error) return res.status(400).json({ error: result.error.message }); res.json({ favorited: !existing });
});

app.post('/api/routes/:id/comments', requireUser, async (req, res) => {
  const content = String(req.body?.content || '').trim(); if (!content) return res.status(400).json({ error: '评论不能为空' });
  const { data: post } = await admin.from('posts').select('id').eq('route_id', req.params.id).single(); if (!post) return res.status(404).json({ error: '公开路线不存在' });
  const { data, error } = await admin.from('comments').insert({ post_id: post.id, author_id: req.user.id, content }).select('*,author:author_id(id,display_name,avatar_url)').single();
  if (error) return res.status(400).json({ error: error.message }); res.status(201).json(data);
});

app.post('/api/trips/:tripId/applications', requireUser, async (req, res) => {
  const { data: trip } = await admin.from('trips').select('id,owner_id,title,status').eq('id', req.params.tripId).single();
  if (!trip || trip.status !== 'open') return res.status(404).json({ error: '旅行不存在或已停止招募' });
  if (trip.owner_id === req.user.id) return res.status(400).json({ error: '不能申请自己发布的旅行' });
  const { data, error } = await admin.from('buddy_applications').insert({ trip_id: trip.id, applicant_id: req.user.id, message: String(req.body?.message || '').slice(0, 1000) }).select().single();
  if (error) return res.status(400).json({ error: error.code === '23505' ? '你已经申请过这次旅行' : error.message });
  await admin.from('notifications').insert({ recipient_id: trip.owner_id, actor_id: req.user.id, type: 'buddy_application', trip_id: trip.id, message: `申请同行「${trip.title}」` });
  res.status(201).json(data);
});

app.get('/api/buddy/applications', requireUser, async (req, res) => {
  const direction = req.query.direction === 'sent' ? 'sent' : 'received';
  let query = admin.from('buddy_applications').select('*, trip:trip_id(*, owner:owner_id(id,display_name,avatar_url)), applicant:applicant_id(id,display_name,avatar_url,bio)').order('created_at', { ascending: false });
  if (direction === 'sent') query = query.eq('applicant_id', req.user.id);
  else {
    const { data: ownedTrips, error: tripError } = await admin.from('trips').select('id').eq('owner_id', req.user.id);
    if (tripError) return res.status(500).json({ error: tripError.message });
    const ids = (ownedTrips || []).map(item => item.id); if (!ids.length) return res.json([]);
    query = query.in('trip_id', ids);
  }
  const { data, error } = await query; if (error) return res.status(500).json({ error: error.message }); res.json(data || []);
});

app.patch('/api/buddy/applications/:id', requireUser, async (req, res) => {
  const statusValue = String(req.body?.status || '');
  if (statusValue === 'cancelled') {
    const { data, error } = await admin.from('buddy_applications').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('applicant_id', req.user.id).eq('status', 'pending').select().single();
    if (error) return res.status(400).json({ error: '申请无法取消' }); return res.json({ application: data, chatId: null });
  }
  if (!['accepted', 'rejected'].includes(statusValue)) return res.status(400).json({ error: '状态无效' });
  const { data: chatId, error } = await admin.rpc('respond_buddy_application', { p_application_id: req.params.id, p_owner_id: req.user.id, p_status: statusValue });
  if (!error) return res.json({ status: statusValue, chatId: chatId || null });
  const { data: application } = await admin.from('buddy_applications').select('*, trip:trip_id(*)').eq('id', req.params.id).single();
  if (!application || application.trip.owner_id !== req.user.id) return res.status(403).json({ error: '无权处理该申请' });
  await admin.from('buddy_applications').update({ status: statusValue, updated_at: new Date().toISOString() }).eq('id', req.params.id);
  let fallbackChatId = null;
  if (statusValue === 'accepted') {
    await admin.from('buddy_relations').upsert([{ trip_id: application.trip_id, user_id: req.user.id }, { trip_id: application.trip_id, user_id: application.applicant_id }], { onConflict: 'trip_id,user_id' });
    const chatResult = await admin.from('chats').upsert({ trip_id: application.trip_id }, { onConflict: 'trip_id' }).select().single(); fallbackChatId = chatResult.data?.id || null;
    if (fallbackChatId) await admin.from('chat_members').upsert([{ chat_id: fallbackChatId, user_id: req.user.id }, { chat_id: fallbackChatId, user_id: application.applicant_id }], { onConflict: 'chat_id,user_id' });
  }
  await admin.from('notifications').insert({ recipient_id: application.applicant_id, actor_id: req.user.id, type: `buddy_application_${statusValue}`, trip_id: application.trip_id, message: statusValue === 'accepted' ? '你的同行申请已通过' : '你的同行申请未通过' });
  res.json({ status: statusValue, chatId: fallbackChatId, transactional: false });
});

app.post('/api/direct-chats/:userId', requireUser, async (req, res) => {
  const otherId = req.params.userId;
  if (otherId === req.user.id) return res.status(400).json({ error: '不能和自己私聊' });
  const { data: other } = await admin.from('profiles').select('id,display_name,username,avatar_url,bio').eq('id', otherId).maybeSingle();
  if (!other) return res.status(404).json({ error: '用户不存在' });
  const { data: mine } = await admin.from('chat_members').select('chat_id').eq('user_id', req.user.id);
  const myIds = (mine || []).map(item => item.chat_id);
  if (myIds.length) {
    const { data: shared } = await admin.from('chat_members').select('chat_id').eq('user_id', otherId).in('chat_id', myIds);
    for (const row of shared || []) {
      const { count } = await admin.from('chat_members').select('*', { count: 'exact', head: true }).eq('chat_id', row.chat_id);
      if (count === 2) return res.json({ chatId: row.chat_id, user: other, existing: true });
    }
  }
  const title = '与' + (other.display_name || other.username || '旅行者') + '的私聊';
  const { data: trip, error: tripError } = await admin.from('trips').insert({ owner_id: req.user.id, title, destination: 'Travel World', description: '地图在线用户私聊', status: 'closed' }).select().single();
  if (tripError) return res.status(400).json({ error: tripError.message });
  const { data: chat, error: chatError } = await admin.from('chats').insert({ trip_id: trip.id }).select().single();
  if (chatError) return res.status(400).json({ error: chatError.message });
  const { error: memberError } = await admin.from('chat_members').insert([{ chat_id: chat.id, user_id: req.user.id }, { chat_id: chat.id, user_id: otherId }]);
  if (memberError) return res.status(400).json({ error: memberError.message });
  res.status(201).json({ chatId: chat.id, user: other, existing: false });
});

app.get('/api/chats', requireUser, async (req, res) => {
  const { data: memberships, error } = await admin.from('chat_members').select('chat_id').eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message }); const ids = (memberships || []).map(item => item.chat_id); if (!ids.length) return res.json([]);
  const { data, error: chatError } = await admin.from('chats').select('*, trip:trip_id(*), chat_members(user_id, profiles:user_id(id,display_name,avatar_url))').in('id', ids).order('created_at', { ascending: false });
  if (chatError) return res.status(500).json({ error: chatError.message }); res.json(data || []);
});

app.get('/api/chats/:id/messages', requireUser, async (req, res) => {
  const { data: member } = await admin.from('chat_members').select('chat_id').eq('chat_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
  if (!member) return res.status(403).json({ error: '你不是该旅行聊天室成员' });
  const { data, error } = await admin.from('chat_messages').select('*, sender:sender_id(id,display_name,avatar_url)').eq('chat_id', req.params.id).order('created_at').limit(200);
  if (error) return res.status(500).json({ error: error.message }); res.json(data || []);
});

app.post('/api/chats/:id/messages', requireUser, async (req, res) => {
  const { data: member } = await admin.from('chat_members').select('chat_id').eq('chat_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
  if (!member) return res.status(403).json({ error: '你不是该旅行聊天室成员' });
  const content = String(req.body?.content || '').trim(), mediaUrl = req.body?.mediaUrl || null;
  if (!content && !mediaUrl) return res.status(400).json({ error: '消息不能为空' });
  const { data, error } = await admin.from('chat_messages').insert({ chat_id: req.params.id, sender_id: req.user.id, content: content.slice(0, 4000), media_url: mediaUrl }).select('*, sender:sender_id(id,display_name,avatar_url)').single();
  if (error) return res.status(400).json({ error: error.message }); res.status(201).json(data);
});

app.post('/api/chats/:id/media', requireUser, upload.single('file'), async (req, res) => {
  const { data: member } = await admin.from('chat_members').select('chat_id').eq('chat_id', req.params.id).eq('user_id', req.user.id).maybeSingle();
  if (!member) return res.status(403).json({ error: '你不是该旅行聊天室成员' });
  if (!req.file || !req.file.mimetype.startsWith('image/')) return res.status(400).json({ error: '聊天暂时只支持发送图片' });
  const ext = (req.file.originalname.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const storagePath = `${req.user.id}/chats/${req.params.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await admin.storage.from('media').upload(storagePath, req.file.buffer, { contentType: req.file.mimetype, upsert: false });
  if (error) return res.status(400).json({ error: error.message });
  const { data } = admin.storage.from('media').getPublicUrl(storagePath); res.status(201).json({ mediaUrl: data.publicUrl });
});

app.get('/api/ai/conversations', requireUser, async (req, res) => {
  const { data, error } = await admin.from('ai_conversations').select('id,title,status,route_id,context,created_at,updated_at').eq('user_id', req.user.id).order('updated_at', { ascending: false }).limit(30);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.get('/api/ai/conversations/:id', requireUser, async (req, res) => {
  const { data: conversation, error } = await admin.from('ai_conversations').select('*').eq('id', req.params.id).eq('user_id', req.user.id).single();
  if (error) return res.status(404).json({ error: '没有找到该旅行对话' });
  const { data: messages } = await admin.from('ai_messages').select('id,role,content,structured_data,created_at').eq('conversation_id', conversation.id).eq('user_id', req.user.id).order('created_at');
  res.json({ conversation, messages: messages || [] });
});

app.post('/api/routes/map-place', requireUser, async (req, res) => {
  const landmarkId = String(req.body?.landmarkId || '');
  const landmarks = JSON.parse(await readFile(landmarkFile, 'utf8')).landmarks || [];
  const landmark = landmarks.find(item => item.id === landmarkId); if (!landmark) return res.status(404).json({ error: '地标不存在' });
  let routeId = req.body?.routeId || null, route;
  if (routeId) { const result = await admin.from('routes').select('*').eq('id', routeId).eq('owner_id', req.user.id).single(); route = result.data; }
  if (!route) {
    const result = await admin.from('routes').insert({ owner_id: req.user.id, title: '我的地图路线', destination: landmark.city || landmark.country, days: [], is_public: false }).select().single();
    if (result.error) return res.status(400).json({ error: result.error.message }); route = result.data; routeId = route.id;
  }
  let { data: day } = await admin.from('trip_days').select('*').eq('route_id', routeId).eq('day_number', 1).maybeSingle();
  if (!day) { const result = await admin.from('trip_days').insert({ route_id: routeId, day_number: 1, title: 'Day 1', summary: '从地图收藏的地点', sort_order: 0 }).select().single(); if (result.error) return res.status(400).json({ error: result.error.message }); day = result.data; }
  const { data: existing } = await admin.from('trip_places').select('id').eq('trip_day_id', day.id).eq('external_place_id', landmark.id).maybeSingle();
  if (existing) return res.json({ routeId, placeId: existing.id, added: false });
  const { count } = await admin.from('trip_places').select('id', { count: 'exact', head: true }).eq('trip_day_id', day.id);
  const { data: place, error } = await admin.from('trip_places').insert({ trip_day_id: day.id, external_place_id: landmark.id, provider: 'Travel World catalog', name: landmark.name, category: landmark.category, latitude: landmark.latitude, longitude: landmark.longitude, reason: landmark.description, verification_status: 'verified', sort_order: count || 0 }).select().single();
  if (error) return res.status(400).json({ error: error.message }); res.status(201).json({ routeId, placeId: place.id, added: true });
});

app.post('/api/ai/plan', requireUser, enforceAiQuota, async (req, res) => {
  if (!aiApiKey || !aiProvider) return res.status(503).json({ error: '云端 AI 尚未配置。请在后端环境变量设置 AI_PROVIDER、AI_MODEL、AI_API_KEY；系统不会用固定模板冒充在线 AI。' });
  const request = req.body?.request || {};
  if (JSON.stringify(request).length > 12_000) return res.status(413).json({ error: '旅行需求内容过长，请精简后重试' });
  const suppliedContext = req.body?.context || {};
  let conversation;
  if (req.body?.conversationId) {
    const result = await admin.from('ai_conversations').select('*').eq('id', req.body.conversationId).eq('user_id', req.user.id).single();
    if (result.error) return res.status(404).json({ error: '没有找到该旅行对话' });
    conversation = result.data;
  } else {
    const result = await admin.from('ai_conversations').insert({ user_id: req.user.id, title: request.destination ? `${request.destination}旅行` : '新的旅行计划', context: suppliedContext }).select().single();
    if (result.error) return res.status(500).json({ error: result.error.message });
    conversation = result.data;
  }
  const context = { ...(conversation.context || {}), ...suppliedContext };
  try { await saveTripPreferences(req.user.id, conversation.id, request, context); }
  catch (error) { return res.status(500).json({ error: `旅行偏好保存失败：${error.message}` }); }
  const candidates = await relevantLandmarks(request, context);
  const weather = await weatherForCandidates(candidates);
  const message = String(req.body?.message || request.extra || '生成一份旅行计划').trim();
  await admin.from('ai_messages').insert({ conversation_id: conversation.id, user_id: req.user.id, role: 'user', content: message, structured_data: request });
  const system = `你是 Travel World 的专业旅行顾问。你的核心任务是生成或修改真实可执行的旅行计划，不说空泛套话。综合目的地、日期、天数、人数、总预算、币种、兴趣、厌恶、节奏、步行承受度、交通、饮食和住宿偏好。每天通常安排 2-4 个主要活动，并为交通、排队、吃饭和休息留出时间。总估算不得无理由超过预算；预算不足时必须解释并主动降级。只可使用候选地点或用户已确认的地点；候选之外的地点必须标为 unverified，绝不能虚构坐标、营业时间、价格或评分。无法确认的实时信息写入 warnings。返回严格 JSON，不要 Markdown，结构为 {tripTitle,destination,days,budget,currency,estimated,remainingBudget,summary,season,warnings:[],needsClarification:boolean,clarifyingQuestion:string,daysPlan:[{day,title,note,estimatedCost,slots:[{period,time,place,address,category,duration,durationMinutes,transport,transportMinutes,cost,reason,latitude,longitude,verificationStatus,externalPlaceId,provider,sourceUrl}]}]}。若信息不足但仍可合理规划，应采用清晰假设并写入 warnings；仅在缺少目的地或天数时提出最多两个问题。`;
  const historyResult = await admin.from('ai_messages').select('role,content,structured_data').eq('conversation_id', conversation.id).eq('user_id', req.user.id).order('created_at', { ascending: true }).limit(20);
  const history = (historyResult.data || []).slice(0, -1).map(item => ({ role: item.role === 'assistant' ? 'assistant' : 'user', content: item.role === 'assistant' && item.structured_data ? JSON.stringify(item.structured_data) : item.content }));
  const user = JSON.stringify({ currentRequest: request, savedContext: context, verifiedCandidatePlaces: candidates, weather, instruction: context.plan ? '根据最新要求增量修改当前计划，保留未被要求改变的部分。' : '生成首版完整计划。' });
  try {
    const response = await fetch(aiBaseUrl + '/chat/completions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + aiApiKey }, body: JSON.stringify({ model: aiModel, temperature: 0.2, max_tokens: 6000, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: user }] }) });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) return res.status(502).json({ error: body?.error?.message || '云端 AI 请求失败', conversationId: conversation.id });
    const plan = await verifyPlanPlaces(cleanPlan(JSON.parse(body.choices?.[0]?.message?.content || '{}'), candidates));
    await saveTripPreferences(req.user.id, conversation.id, { ...request, destination: plan.destination || request.destination, days: plan.days || request.days, budget: plan.budget ?? request.budget, currency: plan.currency || request.currency }, context);
    await admin.from('ai_messages').insert({ conversation_id: conversation.id, user_id: req.user.id, role: 'assistant', content: plan.summary || plan.tripTitle || '旅行计划已更新', structured_data: plan });
    let route = null;
    if (!plan.needsClarification && plan.daysPlan?.length) route = await saveAiPlan(req.user.id, conversation.id, request, plan);
    return res.json({ plan, conversationId: conversation.id, routeId: route?.id || null, provider: aiProvider, model: aiModel, candidatesUsed: candidates.length, remainingToday: req.aiRemaining });
  } catch (error) {
    return res.status(502).json({ error: error.message || 'AI 规划失败', conversationId: conversation.id });
  }
});

app.use((error, _req, res, _next) => {
  if (error instanceof multer.MulterError) return res.status(400).json({ error: error.code === 'LIMIT_FILE_SIZE' ? '文件不能超过 50 MB' : error.message });
  if (error) return res.status(400).json({ error: error.message || '请求处理失败' });
});

app.listen(port, () => console.log(`Travel World API listening on http://localhost:${port}`));
