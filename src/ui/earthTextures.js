/**
 * SPACE-04: Procedural High-Fidelity Earth & Starfield Canvas Textures
 * Renders crisp, self-contained Earth continent maps, ocean specular maps, and space stars
 * completely offline with zero external network dependency.
 */

import * as THREE from 'three';

/**
 * Creates high-resolution procedural Earth texture using canvas vector landmass approximations.
 */
export function createEarthCanvasTexture(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 1. Deep Space Oceanic Base Gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0, '#061325'); // Arctic deep blue
  oceanGrad.addColorStop(0.5, '#0b1d3a'); // Equatorial navy
  oceanGrad.addColorStop(1, '#051120'); // Antarctic deep blue
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // 2. Latitude and Longitude Graticule Grid (Aerospace Coordinate Net)
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.08)';
  ctx.lineWidth = 1;

  // Longitude meridians (every 15 degrees = 24 lines)
  for (let lon = -180; lon <= 180; lon += 15) {
    const x = ((lon + 180) / 360) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Latitude parallels (every 15 degrees)
  for (let lat = -90; lat <= 90; lat += 15) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Equator & Prime Meridian highlighted
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.22)';
  ctx.lineWidth = 1.5;
  // Equator
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
  // Prime Meridian
  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();

  // 3. Draw Continents using simplified vector polygon coordinates
  // Convert [lon, lat] pairs to canvas [x, y]
  function toCanvas(lon, lat) {
    const x = ((lon + 180) / 360) * width;
    const y = ((90 - lat) / 180) * height;
    return [x, y];
  }

  function drawContinent(points, fillColor, strokeColor) {
    if (!points || points.length < 3) return;
    ctx.beginPath();
    const [startX, startY] = toCanvas(points[0][0], points[0][1]);
    ctx.moveTo(startX, startY);
    for (let i = 1; i < points.length; i++) {
      const [px, py] = toCanvas(points[i][0], points[i][1]);
      ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  const landFill = '#132c4a'; // High-tech dark teal landmass
  const landBorder = 'rgba(0, 255, 180, 0.4)'; // Glowing coastline

  // North America
  drawContinent([
    [-168, 65], [-140, 70], [-120, 75], [-85, 75], [-80, 60], [-60, 50],
    [-65, 43], [-75, 35], [-80, 25], [-95, 20], [-105, 20], [-120, 35],
    [-125, 48], [-135, 58], [-165, 60]
  ], landFill, landBorder);

  // Greenland
  drawContinent([
    [-55, 60], [-40, 60], [-20, 70], [-25, 83], [-50, 83], [-55, 75]
  ], landFill, landBorder);

  // South America
  drawContinent([
    [-80, 10], [-60, 12], [-35, -5], [-38, -15], [-50, -30], [-65, -55],
    [-75, -50], [-72, -35], [-80, -5], [-80, 10]
  ], landFill, landBorder);

  // Europe
  drawContinent([
    [-10, 36], [0, 44], [5, 52], [10, 58], [25, 71], [35, 70],
    [30, 50], [25, 40], [15, 38], [0, 36], [-10, 36]
  ], landFill, landBorder);

  // Scandinavia / Svalbard area
  drawContinent([
    [5, 58], [15, 58], [25, 71], [15, 71]
  ], landFill, landBorder);

  // Africa
  drawContinent([
    [-17, 15], [-17, 28], [10, 37], [25, 32], [32, 30], [50, 12],
    [40, -5], [32, -28], [20, -35], [15, -30], [10, -5], [-15, 10]
  ], landFill, landBorder);

  // Asia
  drawContinent([
    [30, 40], [40, 45], [60, 40], [70, 60], [90, 75], [140, 72],
    [170, 65], [140, 50], [130, 35], [120, 22], [105, 10], [90, 22],
    [75, 10], [70, 25], [50, 25], [35, 30]
  ], landFill, landBorder);

  // India
  drawContinent([
    [68, 24], [88, 22], [80, 8], [75, 8]
  ], landFill, landBorder);

  // Australia
  drawContinent([
    [114, -22], [125, -15], [140, -12], [150, -23], [150, -35],
    [135, -38], [115, -35]
  ], landFill, landBorder);

  // Antarctica
  drawContinent([
    [-180, -70], [-120, -72], [-60, -65], [0, -70], [60, -68],
    [120, -66], [180, -70], [180, -90], [-180, -90]
  ], '#1a3a5f', 'rgba(0, 240, 255, 0.5)');

  // 4. Urban Center Lights / Glowing Tech Nodes
  ctx.fillStyle = '#00f0ff';
  const techNodes = [
    [-122, 37], [-74, 40], [-0.1, 51.5], [13.4, 52.5], [139.7, 35.7],
    [15.4, 78.2], [-133.7, 68.4], [-70.9, -53.2], [2.5, -72.0], [27.7, -25.9],
    [103.8, 1.3], [-155.7, 18.9], [-147.7, 64.8]
  ];

  for (const [lon, lat] of techNodes) {
    const [cx, cy] = toCanvas(lon, lat);
    const radGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, 6);
    radGrad.addColorStop(0, '#ffffff');
    radGrad.addColorStop(0.3, '#00f0ff');
    radGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, 2 * Math.PI);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Creates high-detail space starfield particle background.
 */
export function createStarfield(count = 2500, radius = 500) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const colorPalette = [
    new THREE.Color('#ffffff'),
    new THREE.Color('#94a3b8'),
    new THREE.Color('#38bdf8'),
    new THREE.Color('#a855f7'),
    new THREE.Color('#00f0ff')
  ];

  for (let i = 0; i < count; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = u * 2.0 * Math.PI;
    const phi = Math.acos(2.0 * v - 1.0);
    const r = radius * (0.8 + 0.4 * Math.random());

    const x = r * Math.sin(phi) * Math.cos(theta);
    const y = r * Math.sin(phi) * Math.sin(theta);
    const z = r * Math.cos(phi);

    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;

    const col = colorPalette[Math.floor(Math.random() * colorPalette.length)];
    colors[i * 3] = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const material = new THREE.PointsMaterial({
    size: 1.5,
    vertexColors: true,
    transparent: true,
    opacity: 0.85
  });

  return new THREE.Points(geometry, material);
}
