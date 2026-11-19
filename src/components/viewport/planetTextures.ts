"use client";

import * as THREE from "three";

// In-memory cache for generated canvas textures to avoid re-generating on re-renders
const textureCache: Record<string, THREE.CanvasTexture> = {};

function createFallbackTexture(): THREE.CanvasTexture {
  return new THREE.Texture() as unknown as THREE.CanvasTexture;
}

/**
 * Procedurally generates a high-resolution, photorealistic PBR texture map for the Sun.
 * Simulates turbulent solar granulation cells, convection currents, and limb darkening.
 */
export function getSunTexture(): THREE.CanvasTexture {
  if (textureCache["sun"]) return textureCache["sun"];
  if (typeof document === "undefined") {
    return createFallbackTexture();
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Deep molten orange/gold base
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#ff5500");
  grad.addColorStop(0.3, "#ffaa00");
  grad.addColorStop(0.5, "#fff066");
  grad.addColorStop(0.7, "#ffaa00");
  grad.addColorStop(1, "#ff5500");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Solar flares and convection granulation cells
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const r = 12 + Math.random() * 38;
    const cellGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
    cellGrad.addColorStop(0, "rgba(255, 255, 220, 0.45)");
    cellGrad.addColorStop(0.5, "rgba(255, 170, 0, 0.25)");
    cellGrad.addColorStop(1, "rgba(200, 50, 0, 0)");
    ctx.fillStyle = cellGrad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Sunspots
  ctx.fillStyle = "rgba(60, 15, 0, 0.75)";
  for (let s = 0; s < 18; s++) {
    const sx = 100 + Math.random() * 824;
    const sy = 160 + Math.random() * 192; // Sunspots cluster in mid latitudes
    const sr = 3 + Math.random() * 7;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  textureCache["sun"] = texture;
  return texture;
}

/**
 * Generates Mercury's heavily cratered, basaltic, iron-rich surface texture.
 */
export function getMercuryTexture(): THREE.CanvasTexture {
  if (textureCache["mercury"]) return textureCache["mercury"];
  if (typeof document === "undefined") {
    return createFallbackTexture();
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Dark slate-grey bedrock
  ctx.fillStyle = "#4a4947";
  ctx.fillRect(0, 0, 1024, 512);

  // Albedo variations across maria and highlands
  for (let i = 0; i < 250; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const r = 20 + Math.random() * 60;
    const bright = Math.random() > 0.5;
    ctx.fillStyle = bright ? "rgba(180, 175, 168, 0.12)" : "rgba(35, 33, 31, 0.15)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Impact craters with central peaks and ray systems
  for (let c = 0; c < 300; c++) {
    const cx = Math.random() * 1024;
    const cy = Math.random() * 512;
    const cr = 2 + Math.random() * 10;
    ctx.strokeStyle = "rgba(220, 215, 205, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = "rgba(25, 23, 22, 0.4)";
    ctx.beginPath();
    ctx.arc(cx, cy, cr * 0.75, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  textureCache["mercury"] = texture;
  return texture;
}

/**
 * Generates Venus's dense, swirling supercritical CO2 & sulfuric acid cloud canopy.
 */
export function getVenusTexture(): THREE.CanvasTexture {
  if (textureCache["venus"]) return textureCache["venus"];
  if (typeof document === "undefined") {
    return createFallbackTexture();
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Creamy amber/ochre gradient
  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#d8c29d");
  grad.addColorStop(0.3, "#e6ceac");
  grad.addColorStop(0.5, "#edd7b4");
  grad.addColorStop(0.7, "#d9bf98");
  grad.addColorStop(1, "#c4ab84");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // Swirling super-rotating chevron atmospheric cloud bands
  ctx.lineWidth = 12;
  for (let b = 0; b < 45; b++) {
    const y = Math.random() * 512;
    ctx.strokeStyle = b % 2 === 0 ? "rgba(180, 145, 95, 0.18)" : "rgba(255, 245, 225, 0.22)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.bezierCurveTo(256, y + 25, 768, y - 25, 1024, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  textureCache["venus"] = texture;
  return texture;
}

/**
 * Generates Mars's oxidized rust-orange basalt terrain, Syrtis Major, and glistening polar ice caps.
 */
export function getMarsTexture(): THREE.CanvasTexture {
  if (textureCache["mars"]) return textureCache["mars"];
  if (typeof document === "undefined") {
    return createFallbackTexture();
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Iron-oxide rich Martian red-orange soil
  const baseGrad = ctx.createLinearGradient(0, 0, 0, 512);
  baseGrad.addColorStop(0, "#a04825");
  baseGrad.addColorStop(0.5, "#c15c2d");
  baseGrad.addColorStop(1, "#984020");
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, 1024, 512);

  // Dark volcanic basalt provinces (Syrtis Major, Acidalia Planitia, Sinus Sabaeus)
  ctx.fillStyle = "rgba(55, 28, 18, 0.45)";
  ctx.beginPath();
  ctx.ellipse(320, 260, 160, 70, 0.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.ellipse(750, 280, 190, 85, -0.15, 0, Math.PI * 2);
  ctx.fill();

  // Valles Marineris canyon rift system
  ctx.strokeStyle = "rgba(40, 18, 12, 0.65)";
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(420, 275);
  ctx.lineTo(620, 285);
  ctx.stroke();

  // Fine terrain roughness dust speckling
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 1024;
    const y = Math.random() * 512;
    const r = 4 + Math.random() * 14;
    ctx.fillStyle = Math.random() > 0.4 ? "rgba(220, 120, 70, 0.15)" : "rgba(45, 22, 14, 0.12)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // Brilliant North and South Polar Ice Caps (CO2 dry ice & water ice)
  ctx.fillStyle = "#ffffff";
  // North polar cap
  ctx.beginPath();
  ctx.ellipse(512, 12, 220, 24, 0, 0, Math.PI * 2);
  ctx.fill();
  // South polar cap
  ctx.beginPath();
  ctx.ellipse(512, 500, 180, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  textureCache["mars"] = texture;
  return texture;
}

/**
 * Generates Jupiter's dynamic turbulent zonal cloud belts and the iconic Great Red Spot.
 */
export function getJupiterTexture(): THREE.CanvasTexture {
  if (textureCache["jupiter"]) return textureCache["jupiter"];
  if (typeof document === "undefined") {
    return createFallbackTexture();
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Alternating ammonia cloud belts and zones
  const colors = [
    "#8a624a", "#c7a583", "#6c4331", "#e0cdb2", "#87573d",
    "#edd9c0", "#9c6042", "#dfc5a6", "#7b4731", "#e3cbaf",
    "#8e5941", "#c4a382", "#5e3a29"
  ];
  const step = 512 / colors.length;
  for (let i = 0; i < colors.length; i++) {
    ctx.fillStyle = colors[i];
    ctx.fillRect(0, i * step, 1024, step + 1);
  }

  // Turbulent zonal wavy shear eddies
  ctx.lineWidth = 6;
  for (let w = 0; w < 60; w++) {
    const y = Math.random() * 512;
    ctx.strokeStyle = w % 2 === 0 ? "rgba(255, 240, 220, 0.25)" : "rgba(60, 30, 15, 0.25)";
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let seg = 1; seg <= 8; seg++) {
      const segX = seg * 128;
      const segY = y + (Math.sin(seg * 1.5) * 8);
      ctx.lineTo(segX, segY);
    }
    ctx.stroke();
  }

  // The Great Red Spot (Southern Tropical Zone: latitude ~ -22°)
  const grsX = 640;
  const grsY = 320;
  const grsGrad = ctx.createRadialGradient(grsX, grsY, 5, grsX, grsY, 45);
  grsGrad.addColorStop(0, "#d84b2a");
  grsGrad.addColorStop(0.6, "#c0391b");
  grsGrad.addColorStop(1, "rgba(180, 50, 20, 0)");
  ctx.fillStyle = grsGrad;
  ctx.beginPath();
  ctx.ellipse(grsX, grsY, 55, 30, 0, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  textureCache["jupiter"] = texture;
  return texture;
}

/**
 * Generates Saturn's golden-butterscotch banded atmosphere.
 */
export function getSaturnTexture(): THREE.CanvasTexture {
  if (textureCache["saturn"]) return textureCache["saturn"];
  if (typeof document === "undefined") {
    return createFallbackTexture();
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const colors = [
    "#9e8d69", "#d4c5a0", "#b8a67d", "#e5d8b8", "#cca972",
    "#ebd9b2", "#c4a775", "#ded1ad", "#bca578", "#ded4b4",
  ];
  const step = 512 / colors.length;
  for (let i = 0; i < colors.length; i++) {
    ctx.fillStyle = colors[i];
    ctx.fillRect(0, i * step, 1024, step + 1);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  textureCache["saturn"] = texture;
  return texture;
}

/**
 * Generates Saturn's iconic Rings texture with Cassini division and varying radial opacity.
 */
export function getSaturnRingTexture(): THREE.CanvasTexture {
  if (textureCache["saturn_rings"]) return textureCache["saturn_rings"];
  if (typeof document === "undefined") {
    return createFallbackTexture();
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  // Radial ring density gradient across width
  const grad = ctx.createLinearGradient(0, 0, 1024, 0);
  grad.addColorStop(0.00, "rgba(0, 0, 0, 0)"); // Inner D ring gap
  grad.addColorStop(0.12, "rgba(140, 125, 95, 0.45)"); // C ring
  grad.addColorStop(0.28, "rgba(215, 195, 150, 0.95)"); // Dense B ring
  grad.addColorStop(0.60, "rgba(205, 185, 140, 0.90)"); // Outer B ring edge
  grad.addColorStop(0.62, "rgba(10, 8, 5, 0.05)"); // Cassini Division gap!
  grad.addColorStop(0.67, "rgba(10, 8, 5, 0.05)");
  grad.addColorStop(0.69, "rgba(185, 165, 130, 0.85)"); // A ring
  grad.addColorStop(0.88, "rgba(175, 155, 120, 0.80)");
  grad.addColorStop(0.89, "rgba(20, 16, 10, 0.10)"); // Encke division
  grad.addColorStop(0.91, "rgba(165, 145, 115, 0.75)");
  grad.addColorStop(0.98, "rgba(140, 120, 95, 0.40)");
  grad.addColorStop(1.00, "rgba(0, 0, 0, 0)"); // Outer F ring falloff

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 64);

  const texture = new THREE.CanvasTexture(canvas);
  textureCache["saturn_rings"] = texture;
  return texture;
}

/**
 * Generates Uranus's smooth cyan/aquamarine atmosphere.
 */
export function getUranusTexture(): THREE.CanvasTexture {
  if (textureCache["uranus"]) return textureCache["uranus"];
  if (typeof document === "undefined") {
    return createFallbackTexture();
  }

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, "#73d2d6");
  grad.addColorStop(0.5, "#96e7ea");
  grad.addColorStop(1, "#6cc8cc");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

  const texture = new THREE.CanvasTexture(canvas);
  textureCache["uranus"] = texture;
  return texture;
}

/**
 * Generates Neptune's deep cobalt/azure blue atmosphere with white methane cirrus cloud streaks.
 */
export function getNeptuneTexture(): THREE.CanvasTexture {
  if (textureCache["neptune"]) return textureCache["neptune"];
  if (typeof document === "undefined") {
    return createFallbackTexture();
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const grad = ctx.createLinearGradient(0, 0, 0, 512);
  grad.addColorStop(0, "#1e3c8a");
  grad.addColorStop(0.3, "#274ea8");
  grad.addColorStop(0.5, "#3466cc");
  grad.addColorStop(0.7, "#25489f");
  grad.addColorStop(1, "#182f70");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 1024, 512);

  // White methane cloud streaks
  ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
  ctx.lineWidth = 3;
  for (let s = 0; s < 25; s++) {
    const x = Math.random() * 800;
    const y = 140 + Math.random() * 230;
    const len = 60 + Math.random() * 140;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y + (Math.sin(s) * 4));
    ctx.stroke();
  }

  // Great Dark Spot (Voyager 2)
  ctx.fillStyle = "rgba(10, 20, 55, 0.65)";
  ctx.beginPath();
  ctx.ellipse(450, 280, 50, 25, 0, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  textureCache["neptune"] = texture;
  return texture;
}
