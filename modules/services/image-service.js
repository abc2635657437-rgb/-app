(function(){
  const fallback='/assets/ukiyoe-journey.svg',cache=new Map(),pending=new Map();
  async function resolve(query){
    if(!query)return fallback;if(cache.has(query))return cache.get(query);
    if(!pending.has(query))pending.set(query,fetch('/api/map/place-photos?q='+encodeURIComponent(query)).then(r=>r.ok?r.json():Promise.reject()).then(x=>x.photos?.[0]?.url||fallback).catch(()=>fallback).then(url=>(cache.set(query,url),pending.delete(query),url)));
    return pending.get(query);
  }
  async function load(image,query){
    if(!image)return fallback;image.loading='lazy';image.decoding='async';image.onerror=()=>{image.onerror=null;image.src=fallback;image.closest('.image-loading,.route-photo-loading')?.classList.remove('image-loading','route-photo-loading');};image.src=await resolve(query);if(image.complete)image.closest('.image-loading,.route-photo-loading')?.classList.remove('image-loading','route-photo-loading');else image.onload=()=>image.closest('.image-loading,.route-photo-loading')?.classList.remove('image-loading','route-photo-loading');return image.src;
  }
  window.TravelImageService={fallback,resolve,load};
}());
