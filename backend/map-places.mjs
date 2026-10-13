import {readFile} from 'node:fs/promises';
export function parseBounds(value){
  const parts=String(value??'').split(',');if(parts.length!==4||parts.some(p=>!p.trim()))throw new Error('Invalid bounds');
  const b=parts.map(Number),[s,w,n,e]=b;
  if(b.some(v=>!Number.isFinite(v))||s>=n||w>=e||s< -85||n>85||w< -180||e>180||(n-s)*(e-w)>2000)throw new Error('Invalid bounds');return b;
}
let pending;
export async function mapCatalog(){
  if(!pending)pending=readFile(new URL('../modules/data/map-place-catalog.json',import.meta.url),'utf8').then(JSON.parse).catch(e=>{pending=null;throw e;});return pending;
}
export function placesInBounds(places,[s,w,n,e]){return places.filter(p=>p.latitude>=s&&p.latitude<=n&&p.longitude>=w&&p.longitude<=e);}
export const regionCountries={china:['CN'],asia:'CN JP KR KP TW HK MO SG MY TH VN ID PH KH LA MM BN TL IN NP BT BD LK PK MV MN KZ UZ KG TJ TM AF IR IQ IL PS JO LB SY SA AE QA BH KW OM YE GE AM AZ TR'.split(' '),europe:'GB FR DE ES PT IT IE NL BE LU CH AT LI DK NO SE FI IS PL CZ SK HU RO BG GR AL ME RS BA HR SI MK EE LV LT UA BY MD RU MT CY'.split(' '),'north-america':'US CA MX GT BZ HN SV NI CR PA CU JM HT DO BS BB TT GD LC VC AG DM KN'.split(' '),'south-america':'BR AR CL PE BO EC CO VE UY PY GY SR GF'.split(' '),africa:'ZA EG MA TN DZ LY SD SS ET ER DJ SO KE TZ UG RW BI CD CG GA GQ CM CF TD NE NG BJ TG GH CI LR SL GN GW SN GM MR ML BF CV ST AO ZM ZW MW MZ NA BW SZ LS MG MU SC KM'.split(' '),oceania:'AU NZ FJ PG SB VU NC PF WS TO TV KI FM MH PW NR'.split(' ')};
export function regionPlaces(places,region,country=''){return places.filter(p=>(regionCountries[region]||[]).includes(p.countryCode)&&(!country||p.countryCode===country));}
export function installMapPlaces(app){
  app.get('/api/map/destinations',async(req,res)=>{
    const region=String(req.query.region||'china'),country=String(req.query.country||''),page=Number(req.query.page||0);
    if(!regionCountries[region]||(country&&!/^[A-Z]{2}$/.test(country))||!Number.isInteger(page)||page<0||page>2000)return res.status(400).json({error:'Invalid destination filter'});
    try{const catalog=await mapCatalog(),regional=regionPlaces(catalog.places,region),matches=regionPlaces(regional,region,country),countries=[...new Set(regional.map(p=>p.countryCode))].sort();res.json({places:matches.slice(page*8,page*8+8).map(p=>({...p,sourceUrl:'https://www.wikidata.org/wiki/'+p.id})),total:matches.length,countries,page,pageSize:8,license:catalog.license,attribution:catalog.attribution});}catch(_){res.status(503).json({error:'Destination directory unavailable'});}
  });
  app.get('/api/map/places',async(req,res)=>{
    let bounds;try{bounds=parseBounds(req.query.bbox);}catch(_){return res.status(400).json({error:'Invalid map bounds; zoom in and retry.'});}
    try{
      const catalog=await mapCatalog(),matches=placesInBounds(catalog.places,bounds);
      const places=matches.slice(0,400).map(p=>({...p,sourceUrl:'https://www.wikidata.org/wiki/'+p.id,provider:'Audiala open directory',license:catalog.license,verification:'Third-party place directory; verify access and current conditions.'}));
      res.json({places,totalInView:matches.length,limited:matches.length>400,provider:catalog.attribution,sourceUrl:catalog.sourceUrl,license:catalog.license,licenseUrl:catalog.licenseUrl,sourceGeneratedAt:catalog.sourceGeneratedAt});
    }catch(_){res.status(503).json({error:'Place directory unavailable. Existing landmarks remain visible.'});}
  });
}
