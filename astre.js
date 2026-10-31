// Vrai soleil et vraie lune dans le ciel de l'application (comme l'appli Météo de l'iPhone).
// Le soleil se place selon l'heure réelle entre son lever et son coucher : il monte le matin,
// passe au plus haut à midi et redescend le soir. La nuit, c'est la vraie lune (photo NASA)
// avec l'ombre exacte de la phase du jour.
'use strict';

const LUNE_IMG = new Image();
LUNE_IMG.src = 'icons/lune.png';

// ------------------------------------------------------------------ lune : photo NASA + ombre de la phase
function dessinerLune(ctx, cx, cy, r, phase) {
  if (!LUNE_IMG.complete || !LUNE_IMG.naturalWidth) return;
  const d = Math.ceil(r * 2), off = document.createElement('canvas');
  off.width = off.height = d;
  const o = off.getContext('2d');
  o.drawImage(LUNE_IMG, 0, 0, d, d);
  const img = o.getImageData(0, 0, d, d), px = img.data;
  const th = 2 * Math.PI * phase, Lx = Math.sin(th), Lz = -Math.cos(th);   // direction du soleil vue de la Terre
  for (let y = 0; y < d; y++) for (let x = 0; x < d; x++) {
    const nx = (x + 0.5) / r - 1, ny = (y + 0.5) / r - 1, q = nx * nx + ny * ny;
    if (q > 1) continue;
    const nz = Math.sqrt(1 - q), e = nx * Lx + nz * Lz;
    const lum = 0.05 + 0.95 * Math.min(Math.max((e + 0.04) / 0.16, 0), 1);   // terminateur doux + lumière cendrée
    const i = (y * d + x) * 4; px[i] *= lum; px[i + 1] *= lum; px[i + 2] *= lum * 1.03;
  }
  o.putImageData(img, 0, 0);
  ctx.save();
  ctx.shadowColor = 'rgba(220,230,255,.55)'; ctx.shadowBlur = r * 0.5;
  ctx.drawImage(off, cx - r, cy - r);
  ctx.restore();
}

// ------------------------------------------------------------------ soleil : disque éblouissant, halo, reflets
function dessinerSoleil(ctx, W, H, sx, sy, t, voile) {
  const k = 1 - voile * 0.75;                                 // les nuages atténuent le soleil
  // lumière diffuse dans le ciel
  let g = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(W, H) * 0.9);
  g.addColorStop(0, `rgba(255,250,225,${0.55 * k})`); g.addColorStop(0.25, `rgba(255,240,200,${0.18 * k})`); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // halo de 22° (anneau irisé, comme sur la photo de l'iPhone)
  const R = Math.min(W, H) * 0.42;
  ctx.save(); ctx.globalAlpha = 0.22 * k;
  [['rgba(255,120,80,.9)', 0.985], ['rgba(255,220,120,.8)', 1.0], ['rgba(140,220,255,.8)', 1.02], ['rgba(170,140,255,.6)', 1.04]].forEach(([c, f]) => {
    ctx.beginPath(); ctx.arc(sx, sy, R * f, 0, Math.PI * 2); ctx.strokeStyle = c; ctx.lineWidth = R * 0.03; ctx.stroke();
  });
  ctx.restore();
  // rayons qui scintillent lentement
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(t * 0.02); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    const l = R * (0.55 + 0.25 * Math.sin(t * 0.7 + i * 1.7));
    const gr = ctx.createLinearGradient(0, 0, l, 0);
    gr.addColorStop(0, `rgba(255,255,240,${0.22 * k})`); gr.addColorStop(1, 'rgba(255,255,240,0)');
    ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(l, 0); ctx.lineTo(0, 2); ctx.fill();
  }
  ctx.restore();
  // disque du soleil
  g = ctx.createRadialGradient(sx, sy, 0, sx, sy, R * 0.32);
  g.addColorStop(0, `rgba(255,255,255,${1 * k + 0.2})`); g.addColorStop(0.22, `rgba(255,255,245,${0.95 * k})`);
  g.addColorStop(0.45, `rgba(255,245,200,${0.45 * k})`); g.addColorStop(1, 'rgba(255,240,200,0)');
  ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, R * 0.32, 0, Math.PI * 2); ctx.fill();
  // reflets d'objectif sur la ligne soleil → centre de l'écran
  const cx = W / 2, cy = H * 0.75;
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  [[0.35, 0.05, 'rgba(160,220,255,.20)'], [0.6, 0.025, 'rgba(255,200,140,.22)'], [0.85, 0.08, 'rgba(140,255,200,.10)'], [1.2, 0.04, 'rgba(200,170,255,.16)']].forEach(([f, rr, c]) => {
    const x = sx + (cx - sx) * f, y = sy + (cy - sy) * f;
    const gg = ctx.createRadialGradient(x, y, 0, x, y, R * rr * 2);
    gg.addColorStop(0, c); gg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalAlpha = k; ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(x, y, R * rr * 2, 0, Math.PI * 2); ctx.fill();
  });
  ctx.restore();
}

// ------------------------------------------------------------------ boucle d'animation du ciel
const ASTRE = { infos: null };
function majAstre(infos) { ASTRE.infos = infos; }   // { maintenant, lever, coucher, jour, phase, voile } (minutes depuis minuit)

(function boucle() {
  const cv = document.getElementById('astre');
  if (cv && ASTRE.infos) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    const { maintenant, lever, coucher, jour, phase, voile } = ASTRE.infos;
    const t = performance.now() / 1000;
    if (jour) {
      // course du soleil : de gauche (lever) à droite (coucher), point le plus haut à midi solaire
      const u = Math.min(Math.max((maintenant - lever) / (coucher - lever), 0), 1);
      const sx = W * (0.08 + 0.84 * u), sy = H * (0.95 - 0.8 * Math.sin(Math.PI * u));
      dessinerSoleil(ctx, W, H, sx, sy, t, voile);
    } else {
      // la lune traverse le ciel pendant la nuit
      const duree = 1440 - coucher + lever, ecoule = (maintenant >= coucher ? maintenant - coucher : maintenant + 1440 - coucher);
      const u = Math.min(Math.max(ecoule / duree, 0), 1);
      const mx = W * (0.14 + 0.72 * u), my = H * (0.36 - 0.24 * Math.sin(Math.PI * u));
      ctx.globalAlpha = 1 - voile * 0.6;
      dessinerLune(ctx, mx, my, Math.min(W, H) * 0.075, phase);
      ctx.globalAlpha = 1;
    }
  }
  requestAnimationFrame(boucle);
})();
