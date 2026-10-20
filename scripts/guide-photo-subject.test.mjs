import assert from 'node:assert/strict';
import { hasPhotoPhrase, photoSubjectRejection as reject, matchesDestinationPhoto, photoLocationText } from './guide-photo-subject.mjs';

const china = { countryCode: 'CN' }, france = { countryCode: 'FR' };
assert.ok(reject({title:'Industry beijing night.jpg', description:'Signs point to cafes in Beijing', tags:['Factories in China']}, 'drink', china));
assert.ok(reject({title:'Beijing Municipal Folk Music Troupe at NCPA.jpg', description:'Concerts in front of NCPA Cafe', tags:['Music performances']}, 'drink', china));
assert.equal(reject({title:'Beijing Municipal Folk Music Troupe at NCPA.jpg', tags:['Music performances']}, 'joy', china), null);
assert.equal(reject({title:'Beijing coffee shop interior.jpg'}, 'drink', china), null);
assert.equal(reject({title:'Paris café terrace'}, 'drink', france), null);
assert.ok(reject({title:'Lao She Teahouse, Beijing'}, 'drink', france));
assert.equal(reject({title:'Lao She Teahouse, Beijing'}, 'drink', china), null);
assert.ok(reject({title:'Great CCTV camera on the Great Wall of China, Beijing'}, 'play', china));
assert.ok(reject({title:'Burj Khalifa Dubai skyline'}, 'drink', {countryCode:'AE'})); // no "latte" inside unrelated words
assert.ok(reject({title:'Busker in Paris'}, 'go', france));
assert.ok(reject({title:'Train destination board Beijing'}, 'go', china));
assert.ok(reject({title:'Rice factory machinery', description:'Factory near a restaurant'}, 'drink', china));
assert.equal(reject({title:'Restaurant dining room Beijing'}, 'eat', china), null);
assert.equal(reject({title:'Hotel room Paris'}, 'stay', france), null);
assert.equal(reject({title:'Paris tram'}, 'go', france), null);
assert.ok(reject({title:'china000, Great Wall of China, Beijing, China', sourceUrl:'https://www.flickr.com/photos/21203533@N00/129041673'}, 'hero', china));
assert.ok(reject({title:'Marble mountains of Carrara', sourceUrl:'https://www.flickr.com/photos/76722295@N00/4198492342'}, 'play', {countryCode:'VN'}));
assert.equal(hasPhotoPhrase('Chinatown, Singapore', 'China'), false);
assert.equal(hasPhotoPhrase('Coffee shop in Beijing, China', 'China'), true);
assert.equal(hasPhotoPhrase('Paris, Texas', 'Paris'), true); // country/coordinates must additionally disambiguate
assert.equal(hasPhotoPhrase('Restaurant in New Yorkshire', 'New York'), false);
assert.equal(reject({title:'Coma Pedrosa II'}, 'play', {name_en:'Coma Pedrosa',countryCode:'AD'}), null);
assert.equal(matchesDestinationPhoto({title:'Marble Mountains of Carrara'}, {name_en:'Marble Mountains',city:'Da Nang',country_en:'Vietnam'}), false);
assert.equal(matchesDestinationPhoto({title:'Marble Mountains, Da Nang, Vietnam'}, {name_en:'Marble Mountains',city:'Da Nang',country_en:'Vietnam'}), true);
assert.equal(matchesDestinationPhoto({title:'Marble Mountains, Hanoi, Vietnam'}, {name_en:'Marble Mountains',city:'Da Nang',country_en:'Vietnam'}), false);
assert.equal(matchesDestinationPhoto({title:'Coma Pedrosa, Andorra'}, {name_en:'Coma Pedrosa',country_en:'Andorra'}), true);
assert.ok(reject({title:'Eggs Benedict at Mojo Speciality Coffee, Beijing',tags:['Coffee shops in Beijing']}, 'drink', china));
assert.equal(reject({title:'Eggs Benedict at Mojo Speciality Coffee, Beijing',tags:['Coffee shops in Beijing']}, 'eat', china), null);
assert.ok(reject({title:'Greatwall China (1907) Herbert G. Ponting (RESTORED)'}, 'play', china));
assert.equal(hasPhotoPhrase(photoLocationText({title:'Coffee smoker',description:'Smoking is common except maybe in Beijing or Shanghai.'}), 'Beijing'), false);
assert.equal(hasPhotoPhrase(photoLocationText({title:'Luckin Coffee at Guomao',description:'First cafe inside a Beijing Subway station.'}), 'Beijing'), true);
console.log('PASS: category evidence, manual rejections, country drink rules, whole-word place matching');
