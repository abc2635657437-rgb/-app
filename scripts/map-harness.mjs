// Brings up the real map-tiles module behind the real static site, so the
// provider list, tile proxy, fallback and caching can be checked over HTTP
// exactly as the browser will see them — without needing Supabase.
import express from 'express';
import { fileURLToPath } from 'node:url';
import { installMapTiles } from '../backend/map-tiles.mjs';

const app = express();
app.use((req, res, next) => { res.set('Access-Control-Allow-Origin', '*'); next(); });
installMapTiles(app);
// `pathname` on a file URL keeps the percent escapes, which breaks a Chinese
// project path; fileURLToPath decodes it into a real filesystem path.
app.use(express.static(fileURLToPath(new URL('../', import.meta.url))));
const srv = app.listen(8931, () => console.log('map harness on http://127.0.0.1:8931'));
