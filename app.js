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
  try { NORMALES = await (await fetch('normales.json')).json(); } catch (e) { NORMALES = null; }
  if (choix >= VILLAGES.length) choix = 0;
}

function valider(d) {
  const arr = Array.isArray(d) ? d : [d];
  if (arr.length !== VILLAGES.length) throw new Error('réponse invalide');
  for (const m of arr) if (!m.current || !m.hourly || !m.daily) throw new Error('réponse incomplète');
  return arr;
}

function garder(d, quand) {
  try { localStorage.setItem('rtm-meteo', JSON.stringify({ quand, d })); } catch (e) { /* plein */ }
}

// météo préparée toutes les heures par le site (un seul appel à Open-Meteo pour tous les téléphones)
async function fichierSite() {
  const ctl = new AbortController(); const minuteur = setTimeout(() => ctl.abort(), 60000);
  try {
    const rep = await fetch('meteo.json?t=' + Date.now(), { signal: ctl.signal, cache: 'no-store' });
    if (!rep.ok) throw new Error('HTTP ' + rep.status);
    const m = await rep.json();
    return { d: valider(m.d), quand: +m.quand };
  } finally { clearTimeout(minuteur); }
}

async function telecharger() {
  let site = null;
  try { site = await fichierSite(); } catch (e) { /* fichier absent ou réseau lent */ }
  if (site && Date.now() - site.quand < 3 * 3600 * 1000) { garder(site.d, site.quand); return { ...site, enLigne: true }; }
  try { return await openMeteo(); }
  catch (e) {
    if (site) { garder(site.d, site.quand); return { ...site, enLigne: false }; }
    throw e;
  }
}

async function openMeteo() {
  const p = new URLSearchParams({
    latitude: VILLAGES.map((v) => v[1]).join(','), longitude: VILLAGES.map((v) => v[2]).join(','),
    current: 'temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,is_day,uv_index,surface_pressure',
    hourly: 'temperature_2m,weather_code,is_day,precipitation_probability,visibility,uv_index',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,sunrise,sunset,uv_index_max,wind_speed_10m_max',
    timezone: 'Africa/Lubumbashi', forecast_days: 10, forecast_hours: 48,   // 165 localités : heure par heure limité à 48 h (plus léger sur téléphone)
  });
  const ctl = new AbortController(); const minuteur = setTimeout(() => ctl.abort(), 60000);
  try {
    const rep = await fetch(`${API}?${p}`, { signal: ctl.signal, cache: 'no-store' });
    if (!rep.ok) throw new Error('HTTP ' + rep.status);
    const d = valider(await rep.json());
    garder(d, Date.now());
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
  // vrai soleil / vraie lune dans le ciel, à leur position réelle
  const mn = (iso) => +iso.slice(11, 13) * 60 + +iso.slice(14, 16);
  const g0 = genre(c.weather_code, c.is_day);
  majAstre({ maintenant: mn(c.time), lever: mn(dl.sunrise[0]), coucher: mn(dl.sunset[0]), jour: !!c.is_day, phase: lune(Date.now())[0],
             voile: { nuage: 0.85, pluie: 1, bruine: 0.95, orage: 1, brouillard: 0.9, eclaircie: 0.35, 'eclaircie-nuit': 0.35 }[g0] || 0 });
  $('nom').textContent = nom.charAt(0) + nom.slice(1).toLowerCase();
  $('temp').textContent = r(c.temperature_2m) + '°';
  $('cond').textContent = libelle(c.weather_code, c.is_day);
  $('mini').textContent = `${nom.charAt(0) + nom.slice(1).toLowerCase()}  ${r(c.temperature_2m)}° | ${libelle(c.weather_code, c.is_day)}`;
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

  // tuiles (même présentation que l'appli Météo de l'iPhone)
  $('tuiles').innerHTML = tuiles(c, dl, h, k0, nom);
  const peindreLune = () => document.querySelectorAll('.lune-tuile').forEach((cv) => { const x = cv.getContext('2d'); x.clearRect(0, 0, 240, 240); dessinerLune(x, 120, 120, 100, +cv.dataset.phase); });
  if (LUNE_IMG.complete) peindreLune(); else LUNE_IMG.addEventListener('load', peindreLune, { once: true });

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

// ------------------------------------------------------------------ petites icônes de titre (traits fins, comme sur l'iPhone)
const PICTO = {
  moyennes: '<path d="M2 13l4-5 3 3 5-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M2 2v12h13" fill="none" stroke="currentColor" stroke-width="1.6"/>',
  vent: '<path d="M1 6h9a2.5 2.5 0 1 0-2.5-2.5M1 10h12a2.5 2.5 0 1 1-2.5 2.5M1 8h6" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  lune: '<path d="M10 1.5a6.5 6.5 0 1 0 4.5 11A5.5 5.5 0 0 1 10 1.5z" fill="currentColor"/>',
  coucher: '<path d="M8 2v5m-3-2l3 3 3-3M2 12h12M4 9.5a4 4 0 0 1 8 0" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><path d="M1 14.5h14" stroke="currentColor" stroke-width="1.4"/>',
  uv: '<circle cx="8" cy="8" r="3" fill="currentColor"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>',
  ressenti: '<path d="M6 2.5a2 2 0 0 1 4 0v6.3a3.5 3.5 0 1 1-4 0z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="11.5" r="1.6" fill="currentColor"/><path d="M8 11V6" stroke="currentColor" stroke-width="1.5"/>',
  pluie: '<path d="M8 1.5C6 5 3.5 7.5 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7.5 10 5 8 1.5z" fill="currentColor"/>',
  visibilite: '<path d="M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5-7-5-7-5z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="8" r="2.4" fill="currentColor"/>',
  humidite: '<path d="M8 1.5C6 5 3.5 7.5 3.5 10a4.5 4.5 0 0 0 9 0C12.5 7.5 10 5 8 1.5z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 11a2 2 0 0 0 2 2" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>',
};
const titre = (p, t) => `<div class="tt"><svg width="15" height="15" viewBox="0 0 16 16">${PICTO[p]}</svg>${t}</div>`;
let NORMALES = null;

function lunePhoto(p) {
  // lune réaliste : disque gris clair avec mers et cratères, partie dans l'ombre selon la phase
  const k = Math.cos(2 * Math.PI * p), rx = Math.max(Math.abs(k) * 46, 0.01), gibbeuse = k < 0;
  // croissante : ombre à gauche ; décroissante : ombre à droite ; le terminateur est une demi-ellipse
  const ombre = p < 0.5
    ? `M50 4 A46 46 0 0 0 50 96 A${rx} 46 0 0 ${gibbeuse ? 1 : 0} 50 4z`
    : `M50 4 A46 46 0 0 1 50 96 A${rx} 46 0 0 ${gibbeuse ? 0 : 1} 50 4z`;
  return `<svg width="118" height="118" viewBox="0 0 100 100"><defs>
      <radialGradient id="lg" cx="42%" cy="38%" r="65%"><stop offset="0" stop-color="#f4f6fa"/><stop offset=".7" stop-color="#c9d1dd"/><stop offset="1" stop-color="#9aa6b8"/></radialGradient>
      <filter id="fl"><feGaussianBlur stdDeviation="1.2"/></filter></defs>
    <circle cx="50" cy="50" r="46" fill="url(#lg)"/>
    <g fill="#8e99ab" opacity=".55" filter="url(#fl)"><ellipse cx="38" cy="36" rx="13" ry="10"/><ellipse cx="60" cy="30" rx="9" ry="7"/><ellipse cx="57" cy="52" rx="12" ry="9"/><ellipse cx="34" cy="62" rx="8" ry="6"/><ellipse cx="68" cy="68" rx="7" ry="5"/></g>
    <g fill="none" stroke="#aeb7c6" stroke-width="1"><circle cx="46" cy="78" r="5"/><circle cx="74" cy="44" r="3.5"/><circle cx="26" cy="46" r="3"/><circle cx="56" cy="84" r="2.5"/></g>
    <path d="${ombre}" fill="rgba(12,40,90,.72)"/></svg>`;
}

function boussole(vitesse, deg) {
  let graduations = '';
  for (let i = 0; i < 72; i++) {
    const a = i * 5 * Math.PI / 180, long = i % 18 === 0 ? 0 : i % 2 === 0 ? 7 : 4;
    if (!long) continue;
    graduations += `<line x1="${60 + Math.sin(a) * 54}" y1="${60 - Math.cos(a) * 54}" x2="${60 + Math.sin(a) * (54 - long)}" y2="${60 - Math.cos(a) * (54 - long)}" stroke="rgba(255,255,255,${i % 2 ? .35 : .6})" stroke-width="1.2"/>`;
  }
  const lettres = [['N', 0], ['E', 90], ['S', 180], ['O', 270]].map(([t, a]) =>
    `<text x="${60 + Math.sin(a * Math.PI / 180) * 47}" y="${64 - Math.cos(a * Math.PI / 180) * 47}" fill="#fff" font-size="11" font-weight="700" text-anchor="middle">${t}</text>`).join('');
  // flèche : d'où vient le vent (point blanc) vers où il va (pointe)
  return `<svg width="130" height="130" viewBox="0 0 120 120">${graduations}${lettres}
    <g transform="rotate(${deg} 60 60)"><line x1="60" y1="14" x2="60" y2="38" stroke="#fff" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="14" r="5" fill="#fff"/>
      <line x1="60" y1="82" x2="60" y2="104" stroke="#fff" stroke-width="3" stroke-linecap="round"/><path d="M60 110l-6-10h12z" fill="#fff"/></g>
    <text x="60" y="61" fill="#fff" font-size="22" font-weight="600" text-anchor="middle">${vitesse}</text>
    <text x="60" y="78" fill="#fff" font-size="11" font-weight="600" text-anchor="middle">km/h</text></svg>`;
}

function courbeSoleil(u) {
  // sinusoïde jour/nuit : partie haute = jour, ligne d'horizon, point du soleil à l'heure actuelle
  let pts = '';
  for (let i = 0; i <= 60; i++) { const x = i / 60; pts += `${(x * 180).toFixed(1)},${(52 - Math.sin((x - 0.25) * 2 * Math.PI) * 34).toFixed(1)} `; }
  const xs = 0.25 + u * 0.5, sx = xs * 180, sy = 52 - Math.sin((xs - 0.25) * 2 * Math.PI) * 34;
  return `<svg width="100%" height="96" viewBox="0 0 180 96" preserveAspectRatio="none">
    <defs><clipPath id="haut"><rect x="0" y="0" width="180" height="52"/></clipPath><clipPath id="bas"><rect x="0" y="52" width="180" height="44"/></clipPath></defs>
    <polyline points="${pts}" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="3" clip-path="url(#haut)"/>
    <polyline points="${pts}" fill="none" stroke="rgba(10,40,90,.55)" stroke-width="3" clip-path="url(#bas)"/>
    <line x1="0" y1="52" x2="180" y2="52" stroke="rgba(255,255,255,.55)" stroke-width="1"/>
    <circle cx="${sx}" cy="${sy}" r="6" fill="#fff" style="filter:drop-shadow(0 0 5px #fff)"/></svg>`;
}

function tuiles(c, dl, h, k0, nom) {
  const uv = c.uv_index ?? dl.uv_index_max[0];
  const niv = uv < 3 ? 'Faible' : uv < 6 ? 'Modéré' : uv < 8 ? 'Élevé' : uv < 11 ? 'Très élevé' : 'Extrême';
  let finUV = null;                                    // dernière heure du jour avec UV ≥ 3
  for (let k = k0; k < h.time.length && h.time[k].slice(0, 10) === c.time.slice(0, 10); k++) if ((h.uv_index?.[k] ?? 0) >= 3) finUV = h.time[k].slice(11, 13);
  const conseilUV = finUV ? `Utilisez un écran solaire jusqu'à ${+finUV + 1}:00.` : uv >= 3 ? 'Utilisez un écran solaire.' : 'Faible jusqu’à la fin de la journée.';
  const lev = dl.sunrise[0].slice(11, 16), cou = dl.sunset[0].slice(11, 16);
  const minutes = (s) => +s.slice(0, 2) * 60 + +s.slice(3, 5);
  const maintenant = minutes(c.time.slice(11, 16));
  const u = Math.min(Math.max((maintenant - minutes(lev)) / (minutes(cou) - minutes(lev)), -0.5), 1.5);
  const soleilPasse = maintenant > minutes(cou), avantLever = maintenant < minutes(lev);
  const vis = (h.visibility[k0] || 0) / 1000;
  const [lp, ln] = lune(Date.now());
  const illum = Math.round((1 - Math.cos(2 * Math.PI * lp)) / 2 * 100);
  const ressentiTxt = c.apparent_temperature > c.temperature_2m + 1 ? 'Le ressenti est plus élevé que la température réelle.' : c.apparent_temperature < c.temperature_2m - 1 ? 'Le ressenti est plus frais que la température réelle.' : 'Similaire à la température réelle.';
  const proch = dl.precipitation_sum.findIndex((x, i) => i > 0 && x >= 0.5);
  // moyennes : écart avec la température maximale moyenne de ce jour (climat 2021-2025)
  let moy = '';
  const doy = (d) => { const a = new Date(d.getFullYear(), 0, 1); let n = Math.round((d - a) / 86400000); if (d.getFullYear() % 4 && n >= 59) n += 1; return n; };
  const norm = NORMALES?.[nom]?.[doy(dateDe(dl.time[0]))];
  if (norm != null) {
    const ec = r(dl.temperature_2m_max[0] - norm);
    moy = `<div class="tuile">${titre('moyennes', 'MOYENNES')}<div class="gros">${ec > 0 ? '+' : ''}${ec}°</div>
      <div class="moy petit">${ec > 0 ? 'au-dessus' : ec < 0 ? 'en dessous' : 'au niveau'} des temp. max. quotidiennes moyennes</div>
      <p class="duo"><span>Aujourd'hui</span><b>Max. : ${r(dl.temperature_2m_max[0])}°</b><span>Moyenne</span><b>Max. : ${r(norm)}°</b></p></div>`;
  }
  return moy + `
    <div class="tuile">${titre('vent', 'VENT')}<div class="centre">${boussole(r(c.wind_speed_10m), (c.wind_direction_10m + 180) % 360)}</div>
      <p>Rafales : ${r(c.wind_gusts_10m)} km/h ${dir(c.wind_direction_10m)}</p></div>
    <div class="tuile">${titre('lune', ln.toUpperCase())}<div class="centre"><canvas class="lune-tuile" width="240" height="240" data-phase="${lp}"></canvas></div><p class="c">Éclairée à ${illum} %</p></div>
    <div class="tuile">${titre('coucher', soleilPasse || avantLever ? 'LEVER' : 'COUCHER')}<div class="gros">${soleilPasse ? dl.sunrise[1].slice(11, 16) : avantLever ? lev : cou}</div>${courbeSoleil(u)}
      <p>${soleilPasse || avantLever ? 'Coucher : ' + cou : 'Lever : ' + lev}</p></div>
    <div class="tuile">${titre('uv', 'INDICE UV')}<div class="gros">${r(uv)}</div><div class="moy">${niv}</div><div class="uvbar"><em style="left:${Math.min(uv, 12) / 12 * 100}%"></em></div><p>${conseilUV}</p></div>
    <div class="tuile">${titre('ressenti', 'RESSENTI')}<div class="gros">${r(c.apparent_temperature)}°</div><p>${ressentiTxt}</p></div>
    <div class="tuile">${titre('pluie', 'PRÉCIPITATIONS')}<div class="gros">${(dl.precipitation_sum[0] || 0).toFixed(1).replace('.', ',')} mm</div><div class="moy">Aujourd'hui</div>
      <p>${proch > 0 ? `Prochaines précipitations : ${(dl.precipitation_sum[proch]).toFixed(1).replace('.', ',')} mm ${proch === 1 ? 'demain' : JOURS_L[dateDe(dl.time[proch]).getDay()]}.` : 'Aucune précipitation notable prévue.'}</p></div>
    <div class="tuile">${titre('visibilite', 'VISIBILITÉ')}<div class="gros">${vis.toFixed(0)} km</div><p>${vis >= 10 ? 'Vue parfaitement dégagée.' : vis >= 4 ? 'Légère brume.' : 'Visibilité réduite.'}</p></div>
    <div class="tuile">${titre('humidite', 'HUMIDITÉ')}<div class="gros">${r(c.relative_humidity_2m)} %</div><p>Le point de rosée est de ${r(rosee(c.temperature_2m, c.relative_humidity_2m))}° en ce moment.</p></div>`;
}
function rosee(t, hr) { const a = 17.27, b = 237.7, g = a * t / (b + t) + Math.log(Math.max(hr, 1) / 100); return b * g / (a - g); }

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
    carte.attributionControl.setPrefix(false);          // pas de mention « Leaflet » en anglais
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
  if ('serviceWorker' in navigator) {
    // nouvelle version publiée : la page se recharge seule, les téléphones déjà installés se mettent à jour
    if (navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener('controllerchange', () => location.reload(), { once: true });
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch(() => {});
  }
  // en-tête compact quand on fait défiler (comme l'iPhone : « Moba 23° | Nuageux »)
  window.addEventListener('scroll', () => document.body.classList.toggle('compact', window.scrollY > 230), { passive: true });
  // installation : bouton sur Android / Windows, aide sur iPhone
  let invite = null;
  const autonome = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); invite = e; if (!autonome) $('installer').classList.remove('cache'); });
  $('installer').onclick = async () => {
    if (invite) { invite.prompt(); await invite.userChoice; invite = null; $('installer').classList.add('cache'); }
    else $('aide-ios').classList.toggle('cache');
  };
  if (!autonome && /iphone|ipad|ipod/i.test(navigator.userAgent)) $('installer').classList.remove('cache');
  await actualiser();
  setInterval(actualiser, 30 * 60 * 1000);               // temps réel : toutes les 30 minutes
  window.addEventListener('online', actualiser);
})();
