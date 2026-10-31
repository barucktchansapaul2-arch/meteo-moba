// R.T.M Météo Moba — application installable (iPhone, Android, Windows)
// Développée par l'ingénieur BARUCK TCHANSA PAUL sous la supervision de l'ingénieur DALYOS KAPUTA.
'use strict';

const API = 'https://api.open-meteo.com/v1/forecast';
const JOURS = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const JOURS_L = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r = Math.round;

let enCours = false;
let VILLAGES = [], DATA = null, choix = 0, carte = null, calqueCarte = null;
try { choix = Math.max(0, parseInt(localStorage.getItem('rtm-choix') || '0', 10) || 0); } catch (e) { /* stockage indisponible */ }

// ------------------------------------------------------------------ icônes (style appli Météo de l'iPhone)
const NUAGE = (x, y, s, c) => `<path transform="translate(${x} ${y}) scale(${s})" fill="${c}" d="M14 34h26a10 10 0 0 0 0-20 13 13 0 0 0-25-3A11 11 0 0 0 14 34z"/>`;
const SOLEIL = (cx, cy, rr) => {
  let ray = '';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, x1 = cx + Math.cos(a) * rr * 1.45, y1 = cy + Math.sin(a) * rr * 1.45, x2 = cx + Math.cos(a) * rr * 1.95, y2 = cy + Math.sin(a) * rr * 1.95;
    ray += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#FFD60A" stroke-width="${rr * 0.32}" stroke-linecap="round"/>`;
  }
  return ray + `<circle cx="${cx}" cy="${cy}" r="${rr}" fill="#FFD60A"/>`;
};
const LUNE = (cx, cy, rr) => `<path fill="#F5F5F0" d="M${cx + rr * 0.35} ${cy - rr} A${rr} ${rr} 0 1 0 ${cx + rr} ${cy + rr * 0.45} A${rr * 0.8} ${rr * 0.8} 0 0 1 ${cx + rr * 0.35} ${cy - rr}z"/>`;
const GOUTTES = (n, c = '#64D2FF') => {
  let g = '';
  for (let i = 0; i < n; i++) { const x = 18 + i * 9; g += `<line x1="${x}" y1="40" x2="${x - 3}" y2="47" stroke="${c}" stroke-width="3.2" stroke-linecap="round"/>`; }
  return g;
};

function genre(code, jour = 1) {
  code = +code;
  if (code >= 95) return 'orage';
  if (code >= 80 || (code >= 61 && code < 70)) return 'pluie';
  if (code >= 51) return 'bruine';
  if (code === 45 || code === 48) return 'brouillard';
  if (code === 3) return 'nuage';
  if (code === 2) return jour ? 'eclaircie' : 'eclaircie-nuit';
  return jour ? 'soleil' : 'lune';
}
function icone(code, jour = 1, taille = 30) {
  const g = genre(code, jour);
  const corps = {
    soleil: SOLEIL(26, 26, 10),
    lune: LUNE(24, 25, 13),
    eclaircie: SOLEIL(32, 18, 8) + NUAGE(-2, 12, 0.92, '#fff'),
    'eclaircie-nuit': LUNE(31, 17, 10) + NUAGE(-2, 12, 0.92, '#fff'),
    nuage: NUAGE(4, 4, 0.82, '#C7D3E0') + NUAGE(-1, 10, 0.95, '#fff'),
    bruine: NUAGE(0, -2, 0.98, '#fff') + GOUTTES(3),
    pluie: NUAGE(0, -2, 0.98, '#fff') + GOUTTES(4),
    orage: NUAGE(0, -2, 0.98, '#fff') + '<path fill="#FFD60A" d="M27 30l-7 11h6l-3 9 10-13h-6l4-7z"/>' + GOUTTES(2),
    brouillard: NUAGE(0, -6, 0.95, '#fff') + '<g stroke="#fff" stroke-width="3" stroke-linecap="round"><line x1="8" y1="38" x2="44" y2="38"/><line x1="12" y1="45" x2="40" y2="45"/></g>',
  }[g];
  return `<svg width="${taille}" height="${taille}" viewBox="0 0 52 52" aria-hidden="true">${corps}</svg>`;
}
const LIBELLE = { 0: 'Ensoleillé', 1: 'Plutôt ensoleillé', 2: 'Partiellement nuageux', 3: 'Nuageux', 45: 'Brouillard', 48: 'Brouillard', 51: 'Bruine légère', 53: 'Bruine', 55: 'Bruine forte', 61: 'Pluie faible', 63: 'Pluie', 65: 'Forte pluie', 80: 'Averses', 81: 'Averses', 82: 'Fortes averses', 95: 'Orages', 96: 'Orages et grêle', 99: 'Orages violents' };
const libelle = (c, jour = 1) => (!jour && c <= 1) ? 'Dégagé' : (LIBELLE[c] || 'Nuageux');
function ambiance(code, jour) {
  const g = genre(code, jour);
  if (!jour) return (g === 'lune' || g === 'eclaircie-nuit') ? 'nuit-clair' : 'nuit-nuage';
  return { soleil: 'jour-clair', eclaircie: 'jour-clair', nuage: 'jour-nuage', brouillard: 'jour-nuage', bruine: 'jour-pluie', pluie: 'jour-pluie', orage: 'jour-orage' }[g] || 'jour-clair';
}

// ------------------------------------------------------------------ données
async function chargerVillages() {
  const rep = await fetch('villages.json');
  VILLAGES = await rep.json();
  if (choix >= VILLAGES.length) choix = 0;
}

function valider(d) {
  const arr = Array.isArray(d) ? d : [d];
  if (arr.length !== VILLAGES.length) throw new Error('réponse invalide');
  for (const m of arr) if (!m.current || !m.hourly || !m.daily) throw new Error('réponse incomplète');
  return arr;
}

async function telecharger() {
  const p = new URLSearchParams({
    latitude: VILLAGES.map((v) => v[1]).join(','), longitude: VILLAGES.map((v) => v[2]).join(','),
    current: 'temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day,precipitation,uv_index,surface_pressure',
    hourly: 'temperature_2m,weather_code,is_day,precipitation_probability,visibility',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max',
    timezone: 'Africa/Lubumbashi', forecast_days: 10,
  });
  const ctl = new AbortController(); const minuteur = setTimeout(() => ctl.abort(), 30000);
  try {
    const rep = await fetch(`${API}?${p}`, { signal: ctl.signal, cache: 'no-store' });
    if (!rep.ok) throw new Error('HTTP ' + rep.status);
    const d = valider(await rep.json());
    try { localStorage.setItem('rtm-meteo', JSON.stringify({ quand: Date.now(), d })); } catch (e) { /* plein */ }
    return { d, enLigne: true, quand: Date.now() };
  } finally { clearTimeout(minuteur); }
}

function memoire() {
  try { const m = JSON.parse(localStorage.getItem('rtm-meteo')); if (m && m.d) return { d: valider(m.d), enLigne: false, quand: m.quand }; } catch (e) { /* rien */ }
  return null;
}

// ------------------------------------------------------------------ affichage
const fmtH = (iso) => iso.slice(11, 13) + ' h';
const dateDe = (iso) => new Date(iso.slice(0, 10) + 'T12:00:00');
const dir = (deg) => ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'][Math.round(((deg % 360) + 360) % 360 / 45) % 8];
function lune(d) {
  const p = (((d - Date.UTC(2000, 0, 6, 18, 14)) / 86400000) / 29.530588853) % 1;
  const n = [[0.03, 'Nouvelle lune'], [0.22, 'Premier croissant'], [0.28, 'Premier quartier'], [0.47, 'Gibbeuse croissante'], [0.53, 'Pleine lune'], [0.72, 'Gibbeuse décroissante'], [0.78, 'Dernier quartier'], [0.97, 'Dernier croissant'], [1.01, 'Nouvelle lune']];
  return [p, n.find((x) => p < x[0])[1]];
}
function couleurT(t) { return t >= 31 ? '#ff7a2f' : t >= 27 ? '#ffb340' : t >= 22 ? '#ffd84d' : t >= 17 ? '#7ee08a' : '#5ac8fa'; }

function afficher() {
  if (!DATA) return;
  const m = DATA.d[choix], c = m.current, dl = m.daily, h = m.hourly, nom = VILLAGES[choix][0];
  $('ciel').className = 'ciel ' + ambiance(c.weather_code, c.is_day);
  $('nom').textContent = nom.charAt(0) + nom.slice(1).toLowerCase();
  $('temp').textContent = r(c.temperature_2m) + '°';
  $('cond').textContent = libelle(c.weather_code, c.is_day);
  $('hl').textContent = `↑ ${r(dl.temperature_2m_max[0])}°  ↓ ${r(dl.temperature_2m_min[0])}°`;
  $('etat').textContent = DATA.enLigne ? '● EN LIGNE · TEMPS RÉEL' : enCours ? '● MISE À JOUR…' : '● HORS LIGNE';
  $('etat').className = 'etat ' + (DATA.enLigne ? 'ok' : enCours ? '' : 'ko');
  $('maj').textContent = (DATA.enLigne ? 'Relevé en temps réel' : 'Dernière météo enregistrée') + ' : ' + new Date(DATA.quand).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'short' });

  // résumé façon iPhone
  const prochPluie = dl.precipitation_probability_max.findIndex((x, i) => i > 0 && x >= 50);
  $('resume-jour').textContent = `${libelle(dl.weather_code[0])} aujourd'hui, maximum ${r(dl.temperature_2m_max[0])}°.` +
    (prochPluie > 0 ? ` Pluie probable ${prochPluie === 1 ? 'demain' : JOURS_L[dateDe(dl.time[prochPluie]).getDay()]}.` : ' Pas de pluie importante prévue.');

  // heure par heure (24 h) avec coucher et lever du soleil
  let k0 = h.time.indexOf(c.time.slice(0, 13) + ':00'); if (k0 < 0) k0 = 0;
  const soleil = [...dl.sunrise.slice(0, 2).map((t) => [t, 'Lever']), ...dl.sunset.slice(0, 2).map((t) => [t, 'Coucher'])];
  let html = '';
  for (let k = k0; k < Math.min(k0 + 25, h.time.length); k++) {
    const pp = r(h.precipitation_probability[k] || 0);
    html += `<div class="h"><small>${k === k0 ? 'Maint.' : fmtH(h.time[k])}</small><span class="pp">${pp >= 20 ? pp + ' %' : ''}</span>${icone(h.weather_code[k], h.is_day[k], 30)}<b>${r(h.temperature_2m[k])}°</b></div>`;
    for (const [t, lab] of soleil) if (t.slice(0, 13) === h.time[k].slice(0, 13) && k !== k0)
      html += `<div class="h"><small>${t.slice(11, 16)}</small><span class="pp"></span>${lab === 'Lever' ? icone(0, 1, 30) : icone(0, 0, 30)}<b style="font-size:15px">${lab}</b></div>`;
  }
  $('heures').innerHTML = html;

  // 10 jours avec barres de températures
  const gmin = Math.min(...dl.temperature_2m_min), gmax = Math.max(...dl.temperature_2m_max) + 0.01;
  $('jours').innerHTML = dl.time.map((t, i) => {
    const a = (dl.temperature_2m_min[i] - gmin) / (gmax - gmin) * 100, b = (dl.temperature_2m_max[i] - gmin) / (gmax - gmin) * 100;
    const pp = r(dl.precipitation_probability_max[i] || 0);
    const point = i === 0 ? `<em style="left:${(c.temperature_2m - gmin) / (gmax - gmin) * 100}%"></em>` : '';
    return `<div class="j"><span>${i === 0 ? 'Auj.' : JOURS[dateDe(t).getDay()]}</span><span class="ic">${icone(dl.weather_code[i], 1, 28)}<span>${pp >= 20 ? pp + ' %' : ''}</span></span>` +
      `<span class="mn">${r(dl.temperature_2m_min[i])}°</span><div class="barre-t"><i style="left:${a}%;right:${100 - b}%;background:linear-gradient(90deg,${couleurT(dl.temperature_2m_min[i])},${couleurT(dl.temperature_2m_max[i])})"></i>${point}</div><span>${r(dl.temperature_2m_max[i])}°</span></div>`;
  }).join('');

  // tuiles
  const uv = c.uv_index ?? dl.uv_index_max[0];
  const niv = uv < 3 ? 'Faible' : uv < 6 ? 'Modéré' : uv < 8 ? 'Élevé' : uv < 11 ? 'Très élevé' : 'Extrême';
  const lev = dl.sunrise[0].slice(11, 16), cou = dl.sunset[0].slice(11, 16);
  const minutes = (s) => +s.slice(0, 2) * 60 + +s.slice(3, 5);
  const u = Math.min(Math.max((minutes(c.time.slice(11, 16)) - minutes(lev)) / (minutes(cou) - minutes(lev)), 0), 1);
  const sx = 10 + u * 120, sy = 60 - Math.sin(u * Math.PI) * 44;
  const ventA = (c.wind_direction_10m + 180) % 360;
  const vis = (h.visibility[k0] || 0) / 1000;
  const [lp, ln] = lune(Date.now());
  const om = Math.cos(2 * Math.PI * lp) * 26;
  const ressentiTxt = c.apparent_temperature > c.temperature_2m + 1 ? 'Le ressenti est plus élevé que la température réelle.' : c.apparent_temperature < c.temperature_2m - 1 ? 'Le ressenti est plus frais que la température réelle.' : 'Ressenti proche de la température réelle.';
  const proch = dl.precipitation_sum.findIndex((x, i) => i > 0 && x >= 0.5);
  $('tuiles').innerHTML = `
    <div class="tuile"><div class="tt">☀︎ INDICE UV</div><div class="gros">${r(uv)}</div><div class="moy">${niv}</div><div class="uvbar"><em style="left:${Math.min(uv, 12) / 12 * 100}%"></em></div><p>${uv >= 6 ? 'Protégez-vous du soleil.' : 'Risque limité.'}</p></div>
    <div class="tuile"><div class="tt">🌅 COUCHER</div><div class="gros">${cou}</div>
      <svg width="140" height="66" viewBox="0 0 140 66"><path d="M10 60 Q70 -28 130 60" fill="none" stroke="rgba(255,255,255,.45)" stroke-width="2"/><line x1="0" y1="60" x2="140" y2="60" stroke="rgba(255,255,255,.3)"/><circle cx="${sx}" cy="${sy}" r="6" fill="#fff"/></svg><p>Lever : ${lev}</p></div>
    <div class="tuile"><div class="tt">💨 VENT</div><div style="display:flex;align-items:center;justify-content:space-between"><div><div class="gros">${r(c.wind_speed_10m)}</div><div class="moy">km/h</div></div>
      <svg width="86" height="86" viewBox="0 0 86 86"><circle cx="43" cy="43" r="38" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="2" stroke-dasharray="2 4"/>${['N', 'E', 'S', 'O'].map((t, i) => `<text x="${43 + Math.sin(i * Math.PI / 2) * 28}" y="${47 - Math.cos(i * Math.PI / 2) * 28}" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">${t}</text>`).join('')}<g transform="rotate(${ventA} 43 43)"><line x1="43" y1="72" x2="43" y2="16" stroke="#fff" stroke-width="3"/><path d="M43 10l-6 10h12z" fill="#fff"/></g></svg></div>
      <p>Rafales : ${r(c.wind_gusts_10m)} km/h ${dir(c.wind_direction_10m)}</p></div>
    <div class="tuile"><div class="tt">🌡 RESSENTI</div><div class="gros">${r(c.apparent_temperature)}°</div><p>${ressentiTxt}</p></div>
    <div class="tuile"><div class="tt">💧 PRÉCIPITATIONS</div><div class="gros">${(dl.precipitation_sum[0] || 0).toFixed(1)} mm</div><div class="moy">aujourd'hui</div><p>${proch > 0 ? `Prochaines : ${(dl.precipitation_sum[proch]).toFixed(1)} mm ${proch === 1 ? 'demain' : JOURS_L[dateDe(dl.time[proch]).getDay()]}.` : 'Pas de pluie notable prévue.'}</p></div>
    <div class="tuile"><div class="tt">👁 VISIBILITÉ</div><div class="gros">${vis.toFixed(0)} km</div><p>${vis >= 10 ? 'Vue parfaitement dégagée.' : 'Visibilité réduite.'}</p></div>
    <div class="tuile"><div class="tt">💦 HUMIDITÉ</div><div class="gros">${r(c.relative_humidity_2m)} %</div><p>Pression : ${r(c.surface_pressure || 0)} hPa</p></div>
    <div class="tuile"><div class="tt">🌙 LUNE</div><div class="moy">${ln}</div>
      <svg width="70" height="70" viewBox="0 0 70 70"><circle cx="35" cy="35" r="26" fill="#e8edf5"/><path d="M35 9 A26 26 0 0 ${lp < 0.5 ? 0 : 1} 35 61 A${Math.abs(om)} 26 0 0 ${(lp < 0.5) === (om > 0) ? 1 : 0} 35 9z" fill="rgba(10,25,60,.85)"/></svg></div>`;

  // alertes
  const al = [];
  DATA.d.forEach((x, i) => {
    const n = VILLAGES[i][0].charAt(0) + VILLAGES[i][0].slice(1).toLowerCase();
    if (x.daily.weather_code[0] >= 95) al.push(['', `⛈ Orage attendu aujourd'hui à ${n}`]);
    if (x.daily.temperature_2m_max[0] >= 34) al.push(['orange', `🌡 Forte chaleur à ${n} (${r(x.daily.temperature_2m_max[0])}°)`]);
    if ((x.current.wind_gusts_10m || 0) >= 50) al.push(['orange', `💨 Rafales fortes à ${n}`]);
  });
  $('alertes').innerHTML = al.length ? `<div class="alerte ${al[0][0]}">⚠ ${esc(al.slice(0, 4).map((a) => a[1]).join(' · '))}${al.length > 4 ? ` (+${al.length - 4})` : ''}</div>` : '';

  $('points').innerHTML = VILLAGES.map((_, i) => `<i class="${i === choix ? 'on' : ''}"></i>`).join('');
  remplirListe(); majCarte();
}

function remplirListe() {
  if (!DATA) return;
  const q = ($('cherche').value || '').trim().toUpperCase();
  $('liste-items').innerHTML = VILLAGES.map((v, i) => [v, i]).filter(([v]) => !q || v[0].includes(q)).map(([v, i]) => {
    const c = DATA.d[i].current, dl = DATA.d[i].daily;
    const amb = ambiance(c.weather_code, c.is_day), cls = amb.startsWith('nuit') ? 'nuit' : amb.replace('jour-', '').replace('clair', '');
    return `<button class="ligne ${cls}" data-i="${i}"><span><b>${esc(v[0].charAt(0) + v[0].slice(1).toLowerCase())}</b><small>${esc(libelle(c.weather_code, c.is_day))}<br>↑ ${r(dl.temperature_2m_max[0])}°  ↓ ${r(dl.temperature_2m_min[0])}°</small></span><span class="lt">${r(c.temperature_2m)}°</span></button>`;
  }).join('');
}

function majCarte() {
  if (typeof L === 'undefined') return;
  if (!carte) {
    carte = L.map('carte', { zoomControl: false, attributionControl: true }).setView([-7.45, 29.75], 8);
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 13, attribution: 'Imagerie © Esri' }).addTo(carte);
    calqueCarte = L.layerGroup().addTo(carte);
  }
  calqueCarte.clearLayers();
  DATA.d.forEach((m, i) => {
    const v = VILLAGES[i];
    const ic = L.divIcon({ className: '', html: `<div class="mk">${icone(m.current.weather_code, m.current.is_day, 16)} ${r(m.current.temperature_2m)}°</div>`, iconSize: null });
    L.marker([v[1], v[2]], { icon: ic, title: v[0] }).on('click', () => choisir(i)).addTo(calqueCarte);
  });
}

function choisir(i) {
  choix = i;
  try { localStorage.setItem('rtm-choix', String(i)); } catch (e) { /* rien */ }
  $('liste').classList.add('cache');
  afficher(); window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function actualiser() {
  enCours = true;
  try { DATA = await telecharger(); }
  catch (e) { DATA = memoire() || DATA; }
  enCours = false;
  if (DATA) afficher(); else $('cond').textContent = 'Aucune connexion et aucune météo enregistrée.';
}

// ------------------------------------------------------------------ démarrage
(async function () {
  await chargerVillages();
  enCours = true; DATA = memoire(); if (DATA) afficher();
  $('btn-liste').onclick = $('choix').onclick = () => { $('liste').classList.remove('cache'); $('cherche').focus(); };
  $('fermer').onclick = () => $('liste').classList.add('cache');
  $('cherche').oninput = remplirListe;
  $('liste-items').onclick = (e) => { const b = e.target.closest('button[data-i]'); if (b && DATA) choisir(+b.dataset.i); };
  $('btn-carte').onclick = () => $('carte').scrollIntoView({ behavior: 'smooth' });
  let x0 = null;                                            // balayage gauche/droite = localité suivante, comme sur l'iPhone
  document.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (x0 === null || e.target.closest('.heures,.carte-geo,.liste')) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (Math.abs(dx) > 80 && DATA) choisir((choix + (dx < 0 ? 1 : VILLAGES.length - 1)) % VILLAGES.length);
  }, { passive: true });
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  await actualiser();
  setInterval(actualiser, 10 * 60 * 1000);               // temps réel : toutes les 10 minutes
  window.addEventListener('online', actualiser);
})();
