import * as THREE from 'three';

export interface HillClimbTextures {
  mascotCutoutTexture: THREE.CanvasTexture;
  coinFrontTexture: THREE.CanvasTexture;
  coinBumpTexture: THREE.CanvasTexture;
  coinLogoCleanUrl: string;
  tireTexture: THREE.CanvasTexture;
  grassTexture: THREE.CanvasTexture;
  dirtTexture: THREE.CanvasTexture;
  fuelTexture: THREE.CanvasTexture;
}

export async function loadHillClimbTextures(renderer: THREE.WebGLRenderer): Promise<HillClimbTextures> {
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  const loadImage = (src: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error(`Failed to load image from ${src}: ${e}`));
      img.src = src;
    });
  };

  const mascotSrc = '/assets/aistudio/Screenshot_2026_1111_185946_3a195c90.png';
  const markSrc = '/assets/aistudio/Screenshot_2026_1111_013101_29e1dc6a.png';

  const [mascotImg, markImg] = await Promise.all([
    loadImage(mascotSrc),
    loadImage(markSrc),
  ]);

  // 1. Exact Mascot Cutout Texture (Preserves exact face, mask, hoodie, colors, while keying out outer blue sky)
  const cutoutCanvas = document.createElement('canvas');
  cutoutCanvas.width = mascotImg.width;
  cutoutCanvas.height = mascotImg.height;
  const cutoutCtx = cutoutCanvas.getContext('2d')!;
  cutoutCtx.drawImage(mascotImg, 0, 0);

  const imgData = cutoutCtx.getImageData(0, 0, cutoutCanvas.width, cutoutCanvas.height);
  const data = imgData.data;
  const w = cutoutCanvas.width;
  const h = cutoutCanvas.height;

  const visited = new Uint8Array(w * h);
  const queue: number[] = [];

  const isSkyPixel = (x: number, y: number) => {
    const idx = (y * w + x) * 4;
    const r = data[idx];
    const b = data[idx + 2];
    return b > 140 && b > r + 30 && r < 190;
  };

  for (let x = 0; x < w; x++) {
    if (isSkyPixel(x, 0)) queue.push(x, 0);
    if (isSkyPixel(x, 1)) queue.push(x, 1);
  }
  for (let y = 0; y < Math.floor(h * 0.7); y++) {
    if (isSkyPixel(0, y)) queue.push(0, y);
    if (isSkyPixel(w - 1, y)) queue.push(w - 1, y);
  }

  while (queue.length > 0) {
    const cy = queue.pop()!;
    const cx = queue.pop()!;
    const pixelIdx = cy * w + cx;
    if (visited[pixelIdx]) continue;
    visited[pixelIdx] = 1;

    data[pixelIdx * 4 + 3] = 0;

    const neighbors = [
      [cx + 1, cy],
      [cx - 1, cy],
      [cx, cy + 1],
      [cx, cy - 1],
    ];

    for (const [nx, ny] of neighbors) {
      if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
        const nIdx = ny * w + nx;
        if (!visited[nIdx] && isSkyPixel(nx, ny)) {
          queue.push(nx, ny);
        }
      }
    }
  }

  cutoutCtx.putImageData(imgData, 0, 0);
  const mascotCutoutTexture = new THREE.CanvasTexture(cutoutCanvas);
  mascotCutoutTexture.colorSpace = THREE.SRGBColorSpace;
  mascotCutoutTexture.anisotropy = maxAnisotropy;
  mascotCutoutTexture.needsUpdate = true;

  // 2. Extract Clean Horizontal Silver Infinity Mark (from Screenshot_2026_1111_013101_29e1dc6a.png)
  // Smoothly key out the uniform dark background while preserving exact silver loops & aspect ratio
  const markCanvas = document.createElement('canvas');
  markCanvas.width = markImg.width;
  markCanvas.height = markImg.height;
  const markCtx = markCanvas.getContext('2d')!;
  markCtx.drawImage(markImg, 0, 0);

  const markData = markCtx.getImageData(0, 0, markCanvas.width, markCanvas.height);
  const mPixels = markData.data;
  const bgR = mPixels[0];
  const bgG = mPixels[1];
  const bgB = mPixels[2];

  for (let i = 0; i < mPixels.length; i += 4) {
    const dr = mPixels[i] - bgR;
    const dg = mPixels[i + 1] - bgG;
    const db = mPixels[i + 2] - bgB;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (dist < 14) {
      mPixels[i + 3] = 0;
    } else if (dist < 40) {
      mPixels[i + 3] = Math.round(((dist - 14) / 26) * 255);
    }
  }
  markCtx.putImageData(markData, 0, 0);
  const coinLogoCleanUrl = markCanvas.toDataURL('image/png');

  // 3. Polished Metallic Silver Coin Face Texture (Perfectly HORIZONTAL & Centered)
  const coinCanvas = document.createElement('canvas');
  coinCanvas.width = 512;
  coinCanvas.height = 512;
  const coinCtx = coinCanvas.getContext('2d')!;

  const cx = 256;
  const cy = 256;
  const radius = 248;

  // Polished outer silver metallic gradient
  const grad = coinCtx.createLinearGradient(40, 40, 472, 472);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.25, '#e2e8f0');
  grad.addColorStop(0.55, '#94a3b8');
  grad.addColorStop(0.8, '#cbd5e1');
  grad.addColorStop(1, '#64748b');

  coinCtx.fillStyle = grad;
  coinCtx.beginPath();
  coinCtx.arc(cx, cy, radius, 0, Math.PI * 2);
  coinCtx.fill();

  // Inner brushed graphite-silver medallion so the silver infinity symbol pops clearly
  const innerGrad = coinCtx.createRadialGradient(cx - 45, cy - 45, 20, cx, cy, 206);
  innerGrad.addColorStop(0, '#475569');
  innerGrad.addColorStop(0.55, '#334155');
  innerGrad.addColorStop(1, '#1e293b');
  coinCtx.fillStyle = innerGrad;
  coinCtx.beginPath();
  coinCtx.arc(cx, cy, 206, 0, Math.PI * 2);
  coinCtx.fill();

  // Subtle concentric metallic lathe rings
  coinCtx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  coinCtx.lineWidth = 1.5;
  for (let r = 40; r < 200; r += 14) {
    coinCtx.beginPath();
    coinCtx.arc(cx, cy, r, 0, Math.PI * 2);
    coinCtx.stroke();
  }

  // Polished silver beveled inner & outer border rings
  coinCtx.strokeStyle = '#f8fafc';
  coinCtx.lineWidth = 8;
  coinCtx.beginPath();
  coinCtx.arc(cx, cy, 210, 0, Math.PI * 2);
  coinCtx.stroke();

  coinCtx.strokeStyle = '#94a3b8';
  coinCtx.lineWidth = 6;
  coinCtx.beginPath();
  coinCtx.arc(cx, cy, 236, 0, Math.PI * 2);
  coinCtx.stroke();

  // Milled coin edge notches
  coinCtx.fillStyle = '#475569';
  const numNotches = 48;
  for (let i = 0; i < numNotches; i++) {
    const angle = (i / numNotches) * Math.PI * 2;
    const nx = cx + Math.cos(angle) * 224;
    const ny = cy + Math.sin(angle) * 224;
    coinCtx.beginPath();
    coinCtx.arc(nx, ny, 2.5, 0, Math.PI * 2);
    coinCtx.fill();
  }

  // Subtle diagonal reflection highlight across the coin face
  const sheenGrad = coinCtx.createLinearGradient(80, 80, 420, 420);
  sheenGrad.addColorStop(0, 'rgba(255, 255, 255, 0.22)');
  sheenGrad.addColorStop(0.45, 'rgba(255, 255, 255, 0.0)');
  sheenGrad.addColorStop(1, 'rgba(255, 255, 255, 0.1)');
  coinCtx.fillStyle = sheenGrad;
  coinCtx.beginPath();
  coinCtx.arc(cx, cy, 206, 0, Math.PI * 2);
  coinCtx.fill();

  // Draw the EXACT horizontal silver infinity symbol dead-center with original proportions!
  const markWidth = 340;
  const markHeight = markWidth * (markImg.height / markImg.width);
  const markX = cx - markWidth / 2;
  const markY = cy - markHeight / 2;

  coinCtx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  coinCtx.shadowBlur = 14;
  coinCtx.shadowOffsetX = 0;
  coinCtx.shadowOffsetY = 5;
  coinCtx.drawImage(markCanvas, markX, markY, markWidth, markHeight);
  coinCtx.shadowColor = 'transparent';

  const coinFrontTexture = new THREE.CanvasTexture(coinCanvas);
  coinFrontTexture.colorSpace = THREE.SRGBColorSpace;
  coinFrontTexture.anisotropy = maxAnisotropy;
  coinFrontTexture.needsUpdate = true;

  // Coin Bump Map (raised infinity symbol + border rings)
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bumpCtx = bumpCanvas.getContext('2d')!;
  bumpCtx.fillStyle = '#707070';
  bumpCtx.fillRect(0, 0, 512, 512);

  bumpCtx.strokeStyle = '#ffffff';
  bumpCtx.lineWidth = 14;
  bumpCtx.beginPath();
  bumpCtx.arc(cx, cy, 212, 0, Math.PI * 2);
  bumpCtx.stroke();

  bumpCtx.drawImage(markCanvas, markX, markY, markWidth, markHeight);

  const coinBumpTexture = new THREE.CanvasTexture(bumpCanvas);
  coinBumpTexture.anisotropy = maxAnisotropy;
  coinBumpTexture.needsUpdate = true;

  // 4. Chunky Off-Road Tire Tread Texture
  const tireCanvas = document.createElement('canvas');
  tireCanvas.width = 256;
  tireCanvas.height = 256;
  const tireCtx = tireCanvas.getContext('2d')!;
  tireCtx.fillStyle = '#1e293b';
  tireCtx.fillRect(0, 0, 256, 256);
  tireCtx.fillStyle = '#0f172a';
  for (let y = 0; y < 256; y += 32) {
    tireCtx.fillRect(0, y, 256, 16);
    tireCtx.fillStyle = '#334155';
    tireCtx.fillRect(10, y + 4, 100, 8);
    tireCtx.fillRect(146, y + 4, 100, 8);
  }
  const tireTexture = new THREE.CanvasTexture(tireCanvas);
  tireTexture.wrapS = THREE.RepeatWrapping;
  tireTexture.wrapT = THREE.RepeatWrapping;
  tireTexture.repeat.set(4, 1);
  tireTexture.anisotropy = maxAnisotropy;

  // 5. Neutral Tileable Road Surface Texture (tinted cleanly per level)
  const grassCanvas = document.createElement('canvas');
  grassCanvas.width = 256;
  grassCanvas.height = 256;
  const gCtx = grassCanvas.getContext('2d')!;
  gCtx.fillStyle = '#e2e8f0'; // bright neutral so level.roadColor tints accurately
  gCtx.fillRect(0, 0, 256, 256);

  for (let i = 0; i < 2400; i++) {
    const gx = Math.random() * 256;
    const gy = Math.random() * 256;
    gCtx.fillStyle = Math.random() > 0.5 ? '#cbd5e1' : '#ffffff';
    gCtx.fillRect(gx, gy, 3, 5);
  }
  const grassTexture = new THREE.CanvasTexture(grassCanvas);
  grassTexture.wrapS = THREE.RepeatWrapping;
  grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(10, 1);
  grassTexture.colorSpace = THREE.SRGBColorSpace;
  grassTexture.anisotropy = maxAnisotropy;

  // 6. Neutral Tileable Cliff/Soil Texture (tinted cleanly per level)
  const dirtCanvas = document.createElement('canvas');
  dirtCanvas.width = 256;
  dirtCanvas.height = 256;
  const dCtx = dirtCanvas.getContext('2d')!;
  dCtx.fillStyle = '#d4d4d8';
  dCtx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 1800; i++) {
    const dx = Math.random() * 256;
    const dy = Math.random() * 256;
    dCtx.fillStyle = Math.random() > 0.5 ? '#a1a1aa' : '#71717a';
    dCtx.fillRect(dx, dy, 4, 4);
  }
  // Horizontal geological strata lines
  dCtx.fillStyle = 'rgba(0,0,0,0.12)';
  dCtx.fillRect(0, 60, 256, 6);
  dCtx.fillRect(0, 150, 256, 8);
  dCtx.fillRect(0, 210, 256, 5);

  const dirtTexture = new THREE.CanvasTexture(dirtCanvas);
  dirtTexture.wrapS = THREE.RepeatWrapping;
  dirtTexture.wrapT = THREE.RepeatWrapping;
  dirtTexture.repeat.set(8, 4);
  dirtTexture.colorSpace = THREE.SRGBColorSpace;
  dirtTexture.anisotropy = maxAnisotropy;

  // 7. Fuel Canister Texture
  const fuelCanvas = document.createElement('canvas');
  fuelCanvas.width = 256;
  fuelCanvas.height = 256;
  const fCtx = fuelCanvas.getContext('2d')!;
  fCtx.fillStyle = '#dc2626';
  fCtx.fillRect(0, 0, 256, 256);

  fCtx.strokeStyle = '#ffffff';
  fCtx.lineWidth = 10;
  fCtx.strokeRect(18, 18, 220, 220);

  fCtx.fillStyle = '#ffffff';
  fCtx.font = 'bold 54px sans-serif';
  fCtx.textAlign = 'center';
  fCtx.textBaseline = 'middle';
  fCtx.fillText('FUEL', 128, 128);

  const fuelTexture = new THREE.CanvasTexture(fuelCanvas);
  fuelTexture.colorSpace = THREE.SRGBColorSpace;

  return {
    mascotCutoutTexture,
    coinFrontTexture,
    coinBumpTexture,
    coinLogoCleanUrl,
    tireTexture,
    grassTexture,
    dirtTexture,
    fuelTexture,
  };
}
