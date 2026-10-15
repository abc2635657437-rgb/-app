const labels = {zh:['轻松','一般','有挑战','很难','极难'],en:['Easy','Moderate','Challenging','Very demanding','Extreme']};
const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Editorial ratings must be explicitly reviewed, never inferred from a place name.
export function difficultyMarkup(difficulty, language = 'zh') {
  const lang = language === 'en' ? 'en' : 'zh';
  const t = (zh,en) => lang === 'en' ? en : zh;
  const stars = difficulty?.stars;
  const valid = Number.isInteger(stars) && stars >= 1 && stars <= 5;
  const local = value => value?.[lang] ?? '';
  const headline = valid ? `${stars}/5 · ${labels[lang][stars-1]}` : t('难度待核实','Difficulty not yet reviewed');
  return '<section class="hiking-difficulty"><b>' + (valid ? '<span aria-hidden="true">'+'★'.repeat(stars)+'☆'.repeat(5-stars)+'</span> ' : '') + escape(headline)+'</b>'
    +(difficulty?.provisional ? '<small> · '+t('暂定编辑评级，非官方等级','Provisional editorial rating, not an official grade')+'</small>' : '')
    +(local(difficulty?.scope) ? '<p>'+escape(local(difficulty.scope))+'</p>' : '')
    +(local(difficulty?.basis) ? '<p>'+escape(local(difficulty.basis))+'</p>' : '')
    +'<details><summary>'+t('查看五星难度说明','About the five-star scale')+'</summary><ol>'
    +[t('短程、平缓、路径明确；仍需考虑天气和个人体能。','Short, gentle, clearly marked paths; weather and fitness still matter.'),t('较长步行或适度起伏，需要基础体能。','Longer walking or moderate undulations; basic fitness required.'),t('长距离、明显爬升或连续多日，需要徒步经验。','Long distances, substantial ascent or consecutive days; hiking experience required.'),t('陡峭、偏远或高海拔，需充分准备与相关经验。','Steep, remote or high-altitude terrain; thorough preparation and relevant experience required.'),t('极高综合要求；必须另外核对技术等级与风险，不能只看星级。','Extreme overall demands; check separate technical grades and risks, never stars alone.')].map((description,index)=>'<li>'+(index+1)+'/5 · '+description+'</li>').join('')
    +'</ol><p>'+t('评级针对具体路段、季节和走法，不是整座山的固定等级。专业登山（如珠峰、K2 登顶）单独分类，不作为普通徒步推荐。未核实的海拔、路况与开放状态不作安全保证。','Ratings apply to a specific stage, season and itinerary, not an entire mountain. Technical mountaineering, including Everest and K2 summit ascents, is a separate category, not a normal hiking recommendation. Unverified altitude, conditions and access are not safety assurances.')+'</p></details></section>';
}
