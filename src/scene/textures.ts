/**
 * Procedurally generated surface textures (the handover GLBs ship PBR values but no texture
 * maps for the leather and the sandblasted aluminium). Generated once on a canvas at runtime.
 */
import * as THREE from 'three';

function rnd(seed: number) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function canvas(size: number) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  return c;
}

function finish(c: HTMLCanvasElement, repeat: number, color = false, repeatV = repeat, mirrored = false) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = mirrored ? THREE.MirroredRepeatWrapping : THREE.RepeatWrapping;
  t.repeat.set(repeat, repeatV);
  t.anisotropy = 8;
  if (color) t.colorSpace = THREE.SRGBColorSpace;
  t.needsUpdate = true;
  return t;
}

/**
 * Leather maps from a photographed/rendered grain image (grey detail around mid-grey, see
 * public/images/leather-detail.jpg: a crop of the handover render's leather pad with the lighting
 * gradient removed). The image is the albedo detail; normal and roughness are derived from it.
 */
export function leatherFromImage(url: string, repeatU = 2.17, repeatV = 3.3): Promise<LeatherMaps> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const size = 1024;
      const cc = canvas(size);
      const ctx = cc.getContext('2d')!;
      ctx.drawImage(img, 0, 0, size, size);
      const imgData = ctx.getImageData(0, 0, size, size);
      const d = imgData.data;
      const h = new Float32Array(size * size);
      for (let i = 0; i < size * size; i++) h[i] = d[i * 4] / 255;
      // albedo: stretch the grain contrast around mid-grey so the cells read as cells, not as noise
      for (let i = 0; i < size * size; i++) {
        const v = Math.max(0, Math.min(255, 128 + (d[i * 4] - 128) * 2.8));
        d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      }
      ctx.putImageData(imgData, 0, 0);
      const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
      const nc = canvas(size), rc = canvas(size);
      const nImg = nc.getContext('2d')!.createImageData(size, size);
      const rImg = rc.getContext('2d')!.createImageData(size, size);
      const strength = 2.6;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
        const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
        const inv = 1 / Math.hypot(dx, dy, 1);
        const i = (y * size + x) * 4;
        nImg.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
        nImg.data[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
        nImg.data[i + 2] = (inv * 0.5 + 0.5) * 255;
        nImg.data[i + 3] = 255;
        const rough = 140 + (0.5 - at(x, y)) * 140; // creases (dark) rougher, grain tops glossier
        rImg.data[i] = rImg.data[i + 1] = rImg.data[i + 2] = Math.max(60, Math.min(230, rough));
        rImg.data[i + 3] = 255;
      }
      nc.getContext('2d')!.putImageData(nImg, 0, 0);
      rc.getContext('2d')!.putImageData(rImg, 0, 0);
      resolve({
        color: finish(cc, repeatU, true, repeatV, true),
        normal: finish(nc, repeatU, false, repeatV, true),
        rough: finish(rc, repeatU, false, repeatV, true),
      });
    };
    img.onerror = () => reject(new Error('leather image failed to load'));
    img.src = url;
  });
}

/** Pebbled leather height field (0..255, mid grey = flat): convex grains of varying size, creases between them. */
function leatherHeight(size: number): Float32Array {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  const r = rnd(7);
  ctx.fillStyle = '#6a6a6a';
  ctx.fillRect(0, 0, size, size);
  const draw = (x: number, y: number, rad: number, g: number) => {
    // draw wrapped copies only where the grain crosses a tile edge (keeps the texture seamless and cheap)
    const xs = x < rad ? [0, size] : x > size - rad ? [0, -size] : [0];
    const ys = y < rad ? [0, size] : y > size - rad ? [0, -size] : [0];
    for (const dx of xs) for (const dy of ys) {
      const grad = ctx.createRadialGradient(x + dx, y + dy, 0, x + dx, y + dy, rad);
      grad.addColorStop(0, `rgba(${g},${g},${g},1)`);
      grad.addColorStop(0.7, `rgba(${g},${g},${g},0.85)`);
      grad.addColorStop(1, `rgba(${g},${g},${g},0)`);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x + dx, y + dy, rad, 0, Math.PI * 2); ctx.fill();
    }
  };
  for (let i = 0; i < 1100; i++) draw(r() * size, r() * size, 6 + r() * 12, 120 + r() * 60);
  for (let i = 0; i < 2000; i++) draw(r() * size, r() * size, 2.5 + r() * 5, 140 + r() * 70);
  ctx.strokeStyle = 'rgba(40,40,40,0.5)';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 1400; i++) {
    const x = r() * size, y = r() * size, l = 5 + r() * 12, a = r() * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + Math.cos(a + 0.5) * l * 0.5, y + Math.sin(a + 0.5) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
  }
  const d = ctx.getImageData(0, 0, size, size).data;
  const h = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) h[i] = d[i * 4] / 255 + (r() - 0.5) * 0.04;
  return h;
}

export type LeatherMaps = { normal: THREE.CanvasTexture; rough: THREE.CanvasTexture; color: THREE.CanvasTexture };

/** Leather normal + roughness maps derived from the height field. */
export function leatherTextures(size = 512, repeat = 5): LeatherMaps {
  const h = leatherHeight(size);
  const at = (x: number, y: number) => h[((y + size) % size) * size + ((x + size) % size)];
  const nc = canvas(size), rc = canvas(size), cc = canvas(size);
  const nImg = nc.getContext('2d')!.createImageData(size, size);
  const rImg = rc.getContext('2d')!.createImageData(size, size);
  const cImg = cc.getContext('2d')!.createImageData(size, size);
  const strength = 4.5;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
    const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
    const inv = 1 / Math.hypot(dx, dy, 1);
    const i = (y * size + x) * 4;
    nImg.data[i] = (-dx * inv * 0.5 + 0.5) * 255;
    nImg.data[i + 1] = (-dy * inv * 0.5 + 0.5) * 255;
    nImg.data[i + 2] = (inv * 0.5 + 0.5) * 255;
    nImg.data[i + 3] = 255;
    // creases rougher, grain tops glossier
    const rough = 150 + (0.6 - at(x, y)) * 120;
    rImg.data[i] = rImg.data[i + 1] = rImg.data[i + 2] = Math.max(0, Math.min(255, rough));
    rImg.data[i + 3] = 255;
    // albedo: grain tops a touch lighter, creases darker (black leather)
    const c = 22 + (at(x, y) - 0.45) * 70;
    cImg.data[i] = cImg.data[i + 1] = Math.max(8, Math.min(70, c)); cImg.data[i + 2] = Math.max(10, Math.min(74, c + 3));
    cImg.data[i + 3] = 255;
  }
  nc.getContext('2d')!.putImageData(nImg, 0, 0);
  rc.getContext('2d')!.putImageData(rImg, 0, 0);
  cc.getContext('2d')!.putImageData(cImg, 0, 0);
  return { normal: finish(nc, repeat), rough: finish(rc, repeat), color: finish(cc, repeat, true) };
}

/** Fine sandblasted grain for the aluminium roughness. */
export function grainTexture(size = 256, strength = 16, repeat = 8): THREE.CanvasTexture {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  const r = rnd(42);
  const img = ctx.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const v = 128 + (r() - 0.5) * strength + (r() - 0.5) * strength * 0.5;
    d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return finish(c, repeat);
}

/** Woven fabric (for the MacBook cable sleeve). */
export function fabricTexture(size = 256): THREE.CanvasTexture {
  const c = canvas(size);
  const ctx = c.getContext('2d')!;
  const r = rnd(99);
  ctx.fillStyle = '#7f7f7f';
  ctx.fillRect(0, 0, size, size);
  const cell = 8;
  for (let y = 0; y < size; y += cell) for (let x = 0; x < size; x += cell) {
    const over = ((x / cell + y / cell) % 2) === 0;
    const g = over ? 150 + r() * 20 : 95 + r() * 20;
    ctx.fillStyle = `rgb(${g},${g},${g})`;
    ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
  }
  return finish(c, 40);
}
