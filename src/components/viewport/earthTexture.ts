"use client";

import * as THREE from "three";

/**
 * Creates a procedural high-resolution Earth texture map on a canvas.
 * Renders realistic oceans, continental landmasses, deserts, polar ice,
 * and swirling cloud layers without needing external network assets.
 */
export function createProceduralEarthTexture(): THREE.CanvasTexture | null {
  if (typeof document === "undefined") return null;

  const width = 1024;
  const height = 512;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // 1. Deep Ocean Base with subtle latitude gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, "#081b33");
  oceanGrad.addColorStop(0.5, "#0b264a");
  oceanGrad.addColorStop(1, "#081b33");
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Helper to convert lat/long (-90..90, -180..180) to canvas (x, y)
  const toX = (lon: number) => ((lon + 180) / 360) * width;
  const toY = (lat: number) => ((90 - lat) / 180) * height;

  // 2. Continental Landmasses
  ctx.fillStyle = "#1c4a2a"; // Lush continental green

  // North America
  ctx.beginPath();
  ctx.moveTo(toX(-165), toY(68));
  ctx.lineTo(toX(-130), toY(70));
  ctx.lineTo(toX(-80), toY(72));
  ctx.lineTo(toX(-65), toY(45));
  ctx.lineTo(toX(-75), toY(30));
  ctx.lineTo(toX(-82), toY(25));
  ctx.lineTo(toX(-97), toY(18));
  ctx.lineTo(toX(-105), toY(22));
  ctx.lineTo(toX(-120), toY(35));
  ctx.lineTo(toX(-125), toY(48));
  ctx.lineTo(toX(-145), toY(60));
  ctx.closePath();
  ctx.fill();

  // South America
  ctx.beginPath();
  ctx.moveTo(toX(-80), toY(10));
  ctx.lineTo(toX(-50), toY(-5));
  ctx.lineTo(toX(-35), toY(-8));
  ctx.lineTo(toX(-40), toY(-22));
  ctx.lineTo(toX(-55), toY(-35));
  ctx.lineTo(toX(-68), toY(-54));
  ctx.lineTo(toX(-75), toY(-45));
  ctx.lineTo(toX(-72), toY(-20));
  ctx.lineTo(toX(-80), toY(-5));
  ctx.closePath();
  ctx.fill();

  // Eurasia
  ctx.beginPath();
  ctx.moveTo(toX(-10), toY(60));
  ctx.lineTo(toX(20), toY(70));
  ctx.lineTo(toX(60), toY(72));
  ctx.lineTo(toX(110), toY(75));
  ctx.lineTo(toX(170), toY(65));
  ctx.lineTo(toX(140), toY(50));
  ctx.lineTo(toX(120), toY(30));
  ctx.lineTo(toX(105), toY(20));
  ctx.lineTo(toX(80), toY(15));
  ctx.lineTo(toX(65), toY(25));
  ctx.lineTo(toX(50), toY(35));
  ctx.lineTo(toX(30), toY(42));
  ctx.lineTo(toX(10), toY(45));
  ctx.lineTo(toX(-5), toY(40));
  ctx.lineTo(toX(-8), toY(50));
  ctx.closePath();
  ctx.fill();

  // Africa
  ctx.beginPath();
  ctx.moveTo(toX(-15), toY(32));
  ctx.lineTo(toX(10), toY(37));
  ctx.lineTo(toX(32), toY(30));
  ctx.lineTo(toX(50), toY(12));
  ctx.lineTo(toX(42), toY(-5));
  ctx.lineTo(toX(35), toY(-25));
  ctx.lineTo(toX(20), toY(-34));
  ctx.lineTo(toX(12), toY(-18));
  ctx.lineTo(toX(8), toY(4));
  ctx.lineTo(toX(-15), toY(15));
  ctx.closePath();
  ctx.fill();

  // Australia
  ctx.beginPath();
  ctx.moveTo(toX(115), toY(-20));
  ctx.lineTo(toX(130), toY(-15));
  ctx.lineTo(toX(145), toY(-15));
  ctx.lineTo(toX(150), toY(-28));
  ctx.lineTo(toX(140), toY(-38));
  ctx.lineTo(toX(120), toY(-35));
  ctx.lineTo(toX(114), toY(-26));
  ctx.closePath();
  ctx.fill();

  // 3. Arid / Sahara / Gobi Deserts (Ochre / Tan overlays)
  ctx.fillStyle = "#6b5832";
  // Sahara
  ctx.beginPath();
  ctx.ellipse(toX(18), toY(22), 95, 28, 0, 0, Math.PI * 2);
  ctx.fill();
  // Middle East / Arabia
  ctx.beginPath();
  ctx.ellipse(toX(45), toY(24), 40, 20, 0, 0, Math.PI * 2);
  ctx.fill();
  // Australian Outback
  ctx.beginPath();
  ctx.ellipse(toX(132), toY(-26), 45, 20, 0, 0, Math.PI * 2);
  ctx.fill();

  // 4. Polar Ice Caps (Greenland & Antarctica)
  ctx.fillStyle = "#edf2f7";
  // Arctic / Greenland
  ctx.beginPath();
  ctx.ellipse(toX(-40), toY(75), 45, 22, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(0, 0, width, toY(80));

  // Antarctica (Solid white ice sheet along bottom)
  ctx.fillRect(0, toY(-65), width, height - toY(-65));

  // 5. Swirling Atmospheric Cloud Bands (Translucent white)
  ctx.fillStyle = "rgba(255, 255, 255, 0.32)";
  for (let i = 0; i < 18; i++) {
    const cx = (i * 65 + 30) % width;
    const cy = toY(15 + Math.sin(i * 1.2) * 45);
    const radX = 80 + (i % 5) * 30;
    const radY = 14 + (i % 3) * 8;
    ctx.beginPath();
    ctx.ellipse(cx, cy, radX, radY, 0.15 * Math.sin(i), 0, Math.PI * 2);
    ctx.fill();
  }

  // Cyclonic Storm Swirls
  ctx.fillStyle = "rgba(255, 255, 255, 0.45)";
  ctx.beginPath();
  ctx.arc(toX(-60), toY(35), 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(toX(140), toY(25), 30, 0, Math.PI * 2);
  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
