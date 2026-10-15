// Licensed place photographs; never substitute generated scenery for a real place.
export const journeyPhotos = [
  ['081006_Sarria.JPG','Reiner Beeck','CC BY-SA 3.0','by-sa/3.0',42.7774499,-7.4143584],
  [null,'Diego Delso','CC BY-SA 4.0','by-sa/4.0',42.8077853,-7.6155196],
  ['Iglesia_de_San_Tirso_de_Palas_de_Rei_(3727465544).jpg','José Antonio Gil Martínez','CC BY 2.0','by/2.0',42.872466,-7.867892],
  ['Melide,_centro.jpg','Giovanni Tufo','CC BY 2.0','by/2.0',42.9145741,-8.0136139],
  ['Arzúa_04-03.JPG','P. Lameiro','CC BY-SA 3.0','by-sa/3.0',42.926582,-8.1634474],
  ['Arca,_A_Igrexa_O_Pedrouzo_desde_a_igrexa.jpg','Castelao','CC BY 4.0','by/4.0',42.9046789,-8.3624169],
  ['2010-Catedral_de_Santiago_de_Compostela-Galicia_(Spain)_3.jpg','Luis Miguel Bugallo Sánchez','CC BY-SA 3.0','by-sa/3.0',42.8804219,-8.5458608]
].map(([file,credit,license,licensePath,latitude,longitude],i)=>({
  image:i===1?'/assets/route-photos/portomarin-church.jpg':`/assets/route-photos/camino-town-${i}.jpg`,
  imageSourceUrl:file?'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(file):'https://commons.wikimedia.org/wiki/File:Iglesia_de_San_Nicol%C3%A1s,_Puertomar%C3%ADn,_Camino_de_Santiago,_Lugo,_Espa%C3%B1a,_2015-09-19,_DD_15-17_HDR.jpg',
  file,credit,license,licenseUrl:'https://creativecommons.org/licenses/'+licensePath+'/',latitude,longitude
}));

export const waypointPhotos = [
  ['Iglesia_de_Santa_Marina._Sarria,_Lugo..JPG','Pedro Mondejar','CC BY-SA 3.0 ES','by-sa/3.0/es'],
  ['Iglesia_de_Santiago_de_Barbadelo.jpg','José Antonio Gil Martínez','CC BY 2.0','by/2.0'],
  ['Iglesia_de_Santa_María_de_Ferreiros.jpg','José Antonio Gil Martínez','CC BY 2.0','by/2.0']
].map(([file,credit,license,path],i)=>({file,credit,license,licenseUrl:'https://creativecommons.org/licenses/'+path+'/',image:'/assets/route-photos/camino-stop-'+i+'.jpg',imageSourceUrl:'https://commons.wikimedia.org/wiki/File:'+encodeURIComponent(file)}));
waypointPhotos.push(journeyPhotos[1]);
