import assert from 'node:assert/strict';
import { readFile, writeFile, rename, open, unlink, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const placeId = process.argv.find(arg => arg.startsWith('--place='))?.split('=')[1];
const kind = process.argv.find(arg => arg.startsWith('--kind='))?.split('=')[1];
assert.match(placeId || '', /^Q\d+$/, 'Select one destination with --place=Q…');
if (kind) assert.ok(['eat','drink','play','joy','stay','go'].includes(kind));
const root = new URL('../',import.meta.url), data = new URL('modules/data/',root);
const cachePath = new URL('global-guide-section-photo-cache.json',data);
const manifestPath = new URL('global-guide-section-images.json',data);
const reportPath = new URL('global-guide-section-image-validation.json',data);
const lockPath = new URL(cachePath.href + '.lock');
const lock = await open(lockPath,'wx'); // Same lock as the source builder; never write its cache concurrently.
await lock.writeFile(String(process.pid));
const atomic = async (path,value) => {const temporary=new URL(path.href+'.tmp');await writeFile(temporary,JSON.stringify(value));await rename(temporary,path);};
let cached = 0, failed = 0, rateLimited = false;
try {
  const cache = JSON.parse(await readFile(cachePath,'utf8'));
  const manifest = JSON.parse(await readFile(manifestPath,'utf8'));
  let report = {photos:{}};
  try { report=JSON.parse(await readFile(reportPath,'utf8')); } catch(error) {if(error.code!=='ENOENT')throw error;}
  assert.ok(manifest.places[placeId], 'Unknown destination');
  await mkdir(new URL('assets/destination-guides/',root),{recursive:true});
  for(const [category,photos] of Object.entries(manifest.places[placeId])) {
    if(kind && category!==kind)continue;
    for(const photo of photos) {
      const url=photo.remoteSrc||photo.src;
      let status;
      try {
        assert.match(url,/^https:\/\//);
        assert.ok(photo.creator && photo.licenseUrl && photo.sourceUrl);
        const response=await fetch(url,{signal:AbortSignal.timeout(20000)});
        status=response.status;
        assert.ok(response.ok,`HTTP ${status}`);
        const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[response.headers.get('content-type')?.split(';')[0]];
        assert.ok(ext,'Expected a supported image type');
        const bytes=Buffer.from(await response.arrayBuffer());
        assert.ok(bytes.length>1000 && bytes.length<=6*1024*1024,'Invalid image size');
        assert.ok(ext==='jpg'?bytes[0]===255&&bytes[1]===216:ext==='png'?bytes.subarray(1,4).toString()==='PNG':bytes.subarray(8,12).toString()==='WEBP','Invalid image signature');
        const digest=createHash('sha256').update(bytes).digest('hex').slice(0,16);
        const src=`/assets/destination-guides/${placeId}-section-${digest}.${ext}`;
        await writeFile(new URL(src.slice(1),root),bytes,{flag:'wx'}).catch(error=>{if(error.code!=='EEXIST')throw error;});
        const verifiedAt=new Date().toISOString();
        const entry=cache.places[placeId][category].photos.find(candidate=>(candidate.remoteSrc||candidate.src)===url);
        assert.ok(entry,'Manifest and cache diverged');
        Object.assign(photo,{src,remoteSrc:url,imageVerifiedAt:verifiedAt});
        Object.assign(entry,{src,remoteSrc:url,imageVerifiedAt:verifiedAt});
        report.photos[url]={id:placeId,kind:category,status,bytes:bytes.length,src,checkedAt:verifiedAt};
        cached++;
      } catch(error) {
        report.photos[url]={id:placeId,kind:category,status,error:error.message,checkedAt:new Date().toISOString()};
        failed++;
      }
      await atomic(cachePath,cache);
      await atomic(manifestPath,manifest);
      await atomic(reportPath,report);
      if(status===429) {rateLimited=true;break;}
    }
    if(rateLimited)break;
  }
  console.log(JSON.stringify({placeId,cached,failed,rateLimited}));
} finally {await lock.close();await unlink(lockPath);}
