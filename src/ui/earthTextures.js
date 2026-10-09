/**
 * SPACE-04: High-Fidelity Earth Procedural Textures & Atmospheric Shaders
 * Generates photorealistic continental landmasses, biomes (rainforests, arid deserts, icecaps),
 * oceanic specular reflections, city night lights, and standalone dynamic cloud layers.
 */

import * as THREE from 'three';

/**
 * Creates a photorealistic Earth diffuse and specular canvas texture.
 * Features accurate continental geometry, biome gradients, graticule grid, and night city clusters.
 */
export function createRealisticEarthTexture(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // 1. Deep Ocean Base with Latitudinal Bathymetric Gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, height);
  oceanGrad.addColorStop(0.00, '#020b18'); // Arctic deep abyss
  oceanGrad.addColorStop(0.15, '#05162e'); // North temperate ocean
  oceanGrad.addColorStop(0.35, '#0a2347'); // North subtropical navy
  oceanGrad.addColorStop(0.50, '#0c2e59'); // Tropical / Equatorial azure navy
  oceanGrad.addColorStop(0.65, '#0a2347'); // South subtropical navy
  oceanGrad.addColorStop(0.85, '#05162e'); // South temperate ocean
  oceanGrad.addColorStop(1.00, '#020b18'); // Antarctic Southern Ocean abyss
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, width, height);

  // Shallow Continental Shelves & Coastal Azure Waters (Soft turquoise halos around coasts)
  ctx.fillStyle = 'rgba(0, 180, 220, 0.08)';
  for (let i = 0; i < 60; i++) {
    const rx = Math.random() * width;
    const ry = (0.15 + Math.random() * 0.7) * height;
    ctx.beginPath();
    ctx.ellipse(rx, ry, 70 + Math.random() * 140, 25 + Math.random() * 50, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }

  // 2. Graticule Navigation Coordinates Grid (Subtle, crisp aerospace lines)
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
  ctx.lineWidth = 1;

  for (let lon = -180; lon <= 180; lon += 15) {
    const x = ((lon + 180) / 360) * width;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  for (let lat = -90; lat <= 90; lat += 15) {
    const y = ((90 - lat) / 180) * height;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Equator & Prime Meridian highlighted
  ctx.strokeStyle = 'rgba(0, 240, 255, 0.16)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(width / 2, 0);
  ctx.lineTo(width / 2, height);
  ctx.stroke();

  // Helper coordinate converters
  function toX(lon) { return ((lon + 180) / 360) * width; }
  function toY(lat) { return ((90 - lat) / 180) * height; }

  function drawDetailedLandmass(polyCoords, fillColor, borderColor = 'rgba(0, 255, 170, 0.35)', innerShade = null) {
    if (!polyCoords || polyCoords.length < 3) return;
    ctx.beginPath();
    ctx.moveTo(toX(polyCoords[0][0]), toY(polyCoords[0][1]));
    for (let i = 1; i < polyCoords.length; i++) {
      ctx.lineTo(toX(polyCoords[i][0]), toY(polyCoords[i][1]));
    }
    ctx.closePath();

    ctx.fillStyle = fillColor;
    ctx.fill();

    if (innerShade) {
      ctx.fillStyle = innerShade;
      ctx.fill();
    }

    if (borderColor && borderColor !== 'transparent') {
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  // 3. Biome Palettes
  const landTemperate = '#19432e';   // Lush European/Asian forest green
  const landJungle = '#124024';      // Dense tropical equatorial jungle
  const landArid = '#3b381d';        // Steppe / Savannah
  const landDesert = '#4d3d1e';      // Arid Sahara & Arabian desert sand
  const landTundra = '#223645';      // Sub-polar boreal / tundra
  const landGlacier = '#537d99';     // Polar ice pack

  // --- EURASIA (Europe + Asia) ---
  drawDetailedLandmass([
    [-10, 36], [-8, 44], [-2, 47], [5, 52], [8, 55], [12, 57], [22, 70], [35, 71],
    [55, 70], [75, 74], [105, 77], [135, 73], [165, 68], [178, 65],
    [170, 60], [145, 50], [130, 35], [120, 22], [108, 12], [100, 5],
    [98, 10], [90, 22], [88, 22], [85, 26], [78, 30], [72, 30], [68, 25],
    [55, 25], [45, 15], [35, 30], [25, 35], [15, 38], [0, 36], [-10, 36]
  ], landTemperate, 'rgba(0, 255, 180, 0.45)');

  // Scandinavian Peninsula
  drawDetailedLandmass([
    [5, 58], [10, 60], [18, 70], [28, 71], [22, 65], [15, 58], [5, 58]
  ], landTundra, 'rgba(0, 240, 255, 0.5)');

  // Svalbard Archipelago (Arctic Station Node)
  drawDetailedLandmass([
    [14, 77], [22, 78], [24, 80], [18, 80.5], [12, 79], [14, 77]
  ], landGlacier, 'rgba(0, 240, 255, 0.7)');

  // UK & Ireland
  drawDetailedLandmass([
    [-10, 50], [-6, 54], [-3, 58], [0, 54], [1, 51], [-5, 50], [-10, 50]
  ], landTemperate, 'rgba(0, 255, 180, 0.4)');

  // Japan Archipelago
  drawDetailedLandmass([
    [130, 32], [133, 34], [138, 37], [142, 44], [144, 43], [139, 39], [132, 33], [130, 32]
  ], landTemperate, 'rgba(0, 255, 180, 0.4)');

  // --- INDIAN SUBCONTINENT (Rich Detail & Highlighted) ---
  // Indian Mainland: Gujarat, Western Ghats, Kanyakumari, Coromandel, Bengal, Himalayas
  drawDetailedLandmass([
    [68, 24],   // Gujarat / Rann of Kutch
    [70, 21],   // Saurashtra
    [72.8, 19], // Mumbai / Konkan
    [74.5, 15], // Goa / Karnataka coast
    [76.2, 10], // Kerala / Malabar
    [77.5, 8.1],// Kanyakumari (Cape Comorin)
    [79.8, 10], // Tamil Nadu / Palk Strait
    [80.3, 13], // Chennai / Coromandel
    [83.3, 17.7],// Andhra / Visakhapatnam
    [86.8, 20.5],// Odisha / Paradip
    [88.3, 22.2],// West Bengal / Sundarbans
    [92.5, 21], // Bangladesh / Chittagong
    [95, 26],   // Northeast India / Assam / Arunachal
    [88, 28],   // Sikkim / Bhutan
    [83, 29],   // Nepal / Himalayas
    [78, 32],   // Himachal / Uttarakhand
    [74, 34],   // Jammu & Kashmir
    [72, 30],   // Punjab / Rajasthan border
    [68, 24]    // Gujarat
  ], '#205436', 'rgba(255, 153, 51, 0.75)'); // Lush emerald with saffron aerospace outline

  // Western Ghats Biodiversity Corridor (Deep tropical green overlay)
  drawDetailedLandmass([
    [73, 19], [74, 15], [76, 10], [77, 8.5], [75.5, 12], [73.5, 16], [73, 19]
  ], '#123820', 'transparent');

  // Himalayan Snow & Glaciers (Northern Indian Rim)
  drawDetailedLandmass([
    [74, 34], [78, 32], [83, 29], [88, 28], [94, 28], [93, 29], [86, 31], [78, 34], [74, 34]
  ], '#7da1bc', 'rgba(255, 255, 255, 0.5)');

  // Thar Desert (Northwestern India / Rajasthan)
  drawDetailedLandmass([
    [70, 26], [73, 28], [74, 26], [71, 24], [70, 26]
  ], landDesert, 'transparent');

  // Sri Lanka
  drawDetailedLandmass([
    [79.8, 9.5], [81.8, 8.5], [81.2, 6.2], [79.8, 6.8], [79.8, 9.5]
  ], '#1a482d', 'rgba(255, 153, 51, 0.5)');

  // Andaman & Nicobar Islands (Port Blair Gateway GS-IXZ)
  drawDetailedLandmass([
    [92.6, 13.5], [93.1, 13.5], [93.0, 11.5], [92.6, 11.5], [92.6, 13.5]
  ], '#1a5030', 'rgba(0, 240, 255, 0.7)');
  drawDetailedLandmass([
    [93.5, 8.5], [94.0, 8.5], [93.8, 6.8], [93.4, 6.8], [93.5, 8.5]
  ], '#1a5030', 'rgba(0, 240, 255, 0.7)');

  // --- ARABIAN PENINSULA & MIDDLE EAST (Desert Ochre) ---
  drawDetailedLandmass([
    [35, 30], [42, 28], [55, 25], [59, 22], [55, 16], [45, 12], [43, 16], [35, 30]
  ], landDesert, 'rgba(255, 184, 0, 0.4)');

  // --- AFRICA (Equatorial Rainforest + Sahara + Savannah) ---
  drawDetailedLandmass([
    [-17, 15], [-17, 28], [-5, 36], [10, 37], [25, 32], [32, 30], [45, 12],
    [51, 12], [42, -5], [36, -20], [30, -34], [18, -35], [15, -28], [10, -5],
    [-5, 5], [-15, 10], [-17, 15]
  ], landArid, 'rgba(0, 255, 180, 0.35)');

  // Sahara Desert Overlay (North Africa)
  drawDetailedLandmass([
    [-15, 20], [-10, 32], [10, 34], [25, 30], [35, 26], [35, 18], [20, 16], [0, 16], [-15, 20]
  ], landDesert, 'transparent');

  // Congo Tropical Basin (Equatorial Africa)
  drawDetailedLandmass([
    [10, 5], [25, 5], [28, -5], [14, -5], [10, 5]
  ], landJungle, 'transparent');

  // Madagascar
  drawDetailedLandmass([
    [43, -12], [49, -12], [50, -25], [44, -25], [43, -12]
  ], landTemperate, 'rgba(0, 255, 180, 0.3)');

  // --- NORTH AMERICA ---
  drawDetailedLandmass([
    [-168, 65], [-150, 68], [-120, 74], [-85, 74], [-75, 62], [-60, 50],
    [-65, 43], [-75, 35], [-80, 25], [-95, 20], [-105, 20], [-120, 35],
    [-125, 48], [-135, 58], [-165, 60], [-168, 65]
  ], landTemperate, 'rgba(0, 255, 180, 0.4)');

  // Alaska & Inuvik region
  drawDetailedLandmass([
    [-168, 65], [-150, 71], [-133, 69], [-130, 60], [-155, 58], [-168, 65]
  ], landTundra, 'rgba(0, 240, 255, 0.5)');

  // Greenland Ice Shield
  drawDetailedLandmass([
    [-55, 60], [-35, 65], [-20, 72], [-25, 83], [-50, 83], [-55, 75], [-55, 60]
  ], landGlacier, 'rgba(0, 240, 255, 0.65)');

  // --- SOUTH AMERICA ---
  drawDetailedLandmass([
    [-80, 10], [-60, 12], [-35, -5], [-35, -12], [-45, -24], [-55, -35],
    [-68, -55], [-75, -50], [-72, -35], [-80, -5], [-80, 10]
  ], landTemperate, 'rgba(0, 255, 180, 0.35)');

  // Amazon Rainforest Basin
  drawDetailedLandmass([
    [-75, 5], [-50, 4], [-45, -8], [-70, -10], [-75, 5]
  ], landJungle, 'transparent');

  // Southern Tip / Punta Arenas (GS-PUQ)
  drawDetailedLandmass([
    [-75, -48], [-68, -50], [-66, -55], [-72, -55], [-75, -48]
  ], landTundra, 'rgba(255, 184, 0, 0.5)');

  // --- AUSTRALIA ---
  drawDetailedLandmass([
    [114, -22], [125, -15], [140, -12], [150, -23], [152, -36],
    [138, -38], [115, -35], [114, -22]
  ], landDesert, 'rgba(255, 184, 0, 0.4)');

  // --- ANTARCTICA (Deep Southern Ice Sheet / Troll GS-TRL) ---
  drawDetailedLandmass([
    [-180, -70], [-120, -72], [-60, -65], [0, -70], [60, -68],
    [120, -66], [180, -70], [180, -90], [-180, -90]
  ], '#3b6287', 'rgba(0, 240, 255, 0.7)');

  // 4. Night Lights (Golden & Cyan Glowing Clusters for Major Cities & Ground Station Hubs)
  const cityClusters = [
    // --- INDIA (High Density Night Glow) ---
    [77.59, 12.97, 10, '#ff9933'], // Bengaluru (ISRO ISTRAC Hub)
    [80.94, 26.85, 8, '#ff9933'],  // Lucknow Telemetry Station (GS-LKO)
    [92.73, 11.62, 7, '#00f0ff'],  // Port Blair Gateway (GS-IXZ)
    [72.88, 19.07, 12, '#ffb800'], // Mumbai
    [77.20, 28.61, 13, '#ffb800'], // New Delhi / NCR
    [88.36, 22.57, 9, '#ff9933'],  // Kolkata
    [80.27, 13.08, 9, '#ff9933'],  // Chennai / Sriharikota launch corridor
    [78.48, 17.38, 9, '#ffb800'],  // Hyderabad (NRSC Earth Observation Hub)
    [72.57, 23.02, 8, '#ff9933'],  // Ahmedabad (SAC ISRO)
    [76.95, 8.52, 7, '#ff9933'],   // Thiruvananthapuram (VSSC ISRO)

    // --- GLOBAL GROUND STATIONS & AEROSPACE HUBS ---
    [15.41, 78.23, 7, '#00f0ff'],   // Svalbard Arctic Node (GS-SVB)
    [-133.72, 68.36, 7, '#00ff9d'], // Inuvik Polar Node (GS-INU)
    [-70.92, -53.16, 7, '#ffb800'], // Punta Arenas (GS-PUQ)
    [2.54, -72.01, 6, '#a855f7'],   // Troll Antarctic Node (GS-TRL)
    [27.71, -25.89, 7, '#38bdf8'],  // Hartebeesthoek (GS-HBK)
    [-155.68, 18.91, 7, '#f43f5e'], // South Point Hawaii (GS-HAW)
    [103.82, 1.35, 11, '#ffcc00'],  // Singapore Terminal (GS-SGP)
    [-147.72, 64.84, 7, '#22d3ee'], // Fairbanks Alaska (GS-FBK)

    // --- GLOBAL METROPOLITAN HUBS ---
    [-122.42, 37.77, 11, '#ffcc00'], // SF / Planet Labs Mission Control
    [-74.00, 40.71, 12, '#ffcc00'],  // New York
    [-0.12, 51.50, 11, '#ffcc00'],   // London
    [2.35, 48.85, 10, '#ffcc00'],    // Paris
    [139.69, 35.68, 12, '#ffcc00'],  // Tokyo
    [121.47, 31.23, 11, '#ffcc00'],  // Shanghai
    [114.17, 22.31, 10, '#ffcc00'],  // Hong Kong
    [55.27, 25.20, 9, '#ffcc00'],    // Dubai
    [151.21, -33.86, 9, '#ffcc00']   // Sydney
  ];

  for (const [lon, lat, radius, color] of cityClusters) {
    const cx = toX(lon);
    const cy = toY(lat);

    const radGrad = ctx.createRadialGradient(cx, cy, 0.5, cx, cy, radius);
    radGrad.addColorStop(0, '#ffffff');
    radGrad.addColorStop(0.3, color);
    radGrad.addColorStop(0.7, 'rgba(255, 200, 100, 0.25)');
    radGrad.addColorStop(1, 'transparent');

    ctx.fillStyle = radGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.anisotropy = 16;
  return texture;
}

/**
 * Creates dynamic realistic procedural Cloud texture map.
 * Generates wispy cirrus, trade wind bands, and realistic cyclone vortices.
 */
export function createRealisticCloudTexture(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = 'rgba(0, 0, 0, 0)';
  ctx.fillRect(0, 0, width, height);

  // Generate wispy swirling cloud patterns
  const numBands = 75;
  for (let i = 0; i < numBands; i++) {
    const lat = (Math.random() - 0.5) * 155;
    const y = ((90 - lat) / 180) * height;
    const x = Math.random() * width;
    const cloudWidth = 180 + Math.random() * 400;
    const cloudHeight = 25 + Math.random() * 80;

    const grad = ctx.createRadialGradient(x, y, 4, x, y, cloudWidth / 2);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.65)');
    grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.35)');
    grad.addColorStop(0.8, 'rgba(255, 255, 255, 0.10)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(x, y, cloudWidth / 2, cloudHeight / 2, Math.random() * 0.4 - 0.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // Major cyclone / tropical storm eddies (Indian Ocean, Pacific, Atlantic)
  const stormVortices = [
    [520, 280, 160],   // Atlantic Hurricane track
    [1420, 340, 190],  // West Pacific Typhoon
    [920, 520, 150],   // Bay of Bengal / Indian Ocean Cyclone
    [1080, 680, 140],  // South Pacific vortex
    [320, 720, 130]    // South Atlantic vortex
  ];

  for (const [cx, cy, radius] of stormVortices) {
    const grad = ctx.createRadialGradient(cx, cy, 10, cx, cy, radius);
    grad.addColorStop(0.0, 'rgba(255, 255, 255, 0.85)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.55)');
    grad.addColorStop(0.7, 'rgba(255, 255, 255, 0.20)');
    grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Spiral arms
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 14;
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 3; a += 0.2) {
      const r = (a / (Math.PI * 3)) * (radius * 0.85);
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (a === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

/**
 * Creates high-detail space starfield particle background.
 */
export function createStarfield(count = 3500, radius = 900) {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);

  const colorPalette = [
    new THREE.Color('#ffffff'),
    new THREE.Color('#e2e8f0'),
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
    size: 1.6,
    vertexColors: true,
    transparent: true,
    opacity: 0.9
  });

  return new THREE.Points(geometry, material);
}
