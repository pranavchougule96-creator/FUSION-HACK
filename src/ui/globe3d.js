/**
 * SPACE-04: High-Performance 3D Constellation & Ground Station Globe
 * Three.js WebGL visualization with photorealistic NASA Earth textures, normal relief maps,
 * specular ocean reflection, dynamic cloud sphere, and high-visibility satellite beacon sprites.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRealisticEarthTexture, createRealisticCloudTexture, createStarfield } from './earthTextures.js';
import { EARTH_RADIUS_KM } from '../physics/groundStations.js';

export class ConstellationGlobe3D {
  constructor(containerElement, onSatelliteSelectCallback = null) {
    this.container = containerElement;
    this.onSatelliteSelect = onSatelliteSelectCallback;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.earthMesh = null;
    this.cloudMesh = null;
    this.atmosphereMesh = null;
    this.starfield = null;

    this.satellites = [];
    this.groundStations = [];
    this.activeSchedule = [];
    this.selectedSatelliteId = null;

    // Visual objects mappings
    this.satMeshes = new Map();
    this.satSprites = new Map();
    this.orbitLines = new Map();
    this.orbitPulses = new Map();
    this.groundStationMeshes = new Map();
    this.downlinkBeams = new Map();

    // Scale factor: Earth radius 100 units
    this.scaleFactor = 100 / EARTH_RADIUS_KM;

    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 900;
    const height = this.container.clientHeight || 520;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#030712');

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 3500);
    this.camera.position.set(160, 110, 210);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 115;
    this.controls.maxDistance = 700;
    this.controls.autoRotate = false;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    // Sun Directional Light (realistic day/night illumination)
    const sunLight = new THREE.DirectionalLight(0xfffcf0, 2.4);
    sunLight.position.set(340, 160, 240);
    this.scene.add(sunLight);

    // Deep space azure limb fill light
    const rimLight = new THREE.DirectionalLight(0x00d8ff, 0.7);
    rimLight.position.set(-240, -120, -190);
    this.scene.add(rimLight);

    // 6. Deep Space Stars
    this.starfield = createStarfield(3500, 950);
    this.scene.add(this.starfield);

    // 7. Photorealistic Earth Sphere
    const earthRadius = 100;
    const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);

    // Texture Loader with real NASA textures and procedural fallbacks
    const textureLoader = new THREE.TextureLoader();
    const fallbackTexture = createRealisticEarthTexture(2048, 1024);

    const earthTexture = textureLoader.load(
      '/textures/earth_atmos_2048.jpg',
      undefined,
      undefined,
      () => { earthMaterial.map = fallbackTexture; earthMaterial.needsUpdate = true; }
    );
    earthTexture.anisotropy = 16;

    const normalTexture = textureLoader.load('/textures/earth_normal_2048.jpg');
    const specularTexture = textureLoader.load('/textures/earth_specular_2048.jpg');

    const earthMaterial = new THREE.MeshStandardMaterial({
      map: earthTexture,
      normalMap: normalTexture,
      normalScale: new THREE.Vector2(0.85, 0.85),
      roughnessMap: specularTexture,
      roughness: 0.65,
      metalness: 0.15
    });

    this.earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    this.scene.add(this.earthMesh);

    // 8. Independent Dynamic Cloud Sphere
    const cloudGeometry = new THREE.SphereGeometry(earthRadius * 1.008, 64, 64);
    const fallbackCloudTexture = createRealisticCloudTexture(2048, 1024);

    const cloudTexture = textureLoader.load(
      '/textures/earth_clouds_1024.png',
      undefined,
      undefined,
      () => { cloudMaterial.map = fallbackCloudTexture; cloudMaterial.needsUpdate = true; }
    );

    const cloudMaterial = new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.55,
      blending: THREE.NormalBlending,
      depthWrite: false
    });

    this.cloudMesh = new THREE.Mesh(cloudGeometry, cloudMaterial);
    this.scene.add(this.cloudMesh);

    // 9. Atmospheric Rayleigh Scattering Halo Shell
    const atmosGeometry = new THREE.SphereGeometry(earthRadius * 1.025, 48, 48);
    const atmosMaterial = new THREE.MeshBasicMaterial({
      color: 0x00b4ff,
      transparent: true,
      opacity: 0.18,
      side: THREE.BackSide
    });
    this.atmosphereMesh = new THREE.Mesh(atmosGeometry, atmosMaterial);
    this.scene.add(this.atmosphereMesh);

    // Raycasting event listener
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    // Window Resize listener
    window.addEventListener('resize', () => this.onWindowResize());

    // Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  /**
   * Set constellation and ground stations data
   */
  setData(satellites, groundStations, activeSchedule = []) {
    this.satellites = satellites;
    this.groundStations = groundStations;
    this.activeSchedule = activeSchedule;

    this.buildGroundStations();
    this.buildSatellitesAndOrbits();

    // Default select first satellite
    if (!this.selectedSatelliteId && satellites.length > 0) {
      this.selectedSatelliteId = satellites[0].id;
      if (this.onSatelliteSelect) {
        this.onSatelliteSelect(satellites[0]);
      }
    }
  }

  setSchedule(schedule) {
    this.activeSchedule = schedule;
  }

  buildGroundStations() {
    this.groundStationMeshes.forEach(mesh => this.scene.remove(mesh));
    this.groundStationMeshes.clear();

    const earthRadius = 100;

    for (const gs of this.groundStations) {
      const gsGroup = new THREE.Group();

      const gsPos = this.latLonToVector3(gs.lat, gs.lon, earthRadius);
      gsGroup.position.copy(gsPos);

      const normal = gsPos.clone().normalize();
      gsGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      // Station Pedestal
      const baseGeo = new THREE.CylinderGeometry(1.0, 1.4, 0.8, 12);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x1e293b,
        metalness: 0.8,
        roughness: 0.2
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 0.4;
      gsGroup.add(baseMesh);

      // Parabolic Dish
      const dishGeo = new THREE.SphereGeometry(1.8, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.45);
      const dishMat = new THREE.MeshStandardMaterial({
        color: 0xf8fafc,
        metalness: 0.5,
        roughness: 0.3,
        side: THREE.DoubleSide
      });
      const dishMesh = new THREE.Mesh(dishGeo, dishMat);
      dishMesh.position.y = 1.4;
      dishMesh.rotation.x = Math.PI;
      gsGroup.add(dishMesh);

      // Feed horn
      const hornGeo = new THREE.ConeGeometry(0.35, 1.0, 8);
      const hornMat = new THREE.MeshBasicMaterial({ color: gs.color || 0x00f0ff });
      const hornMesh = new THREE.Mesh(hornGeo, hornMat);
      hornMesh.position.y = 2.2;
      gsGroup.add(hornMesh);

      // Visibility Footprint Ring on Earth surface
      const ringGeo = new THREE.RingGeometry(11.5, 12.5, 36);
      const ringMat = new THREE.MeshBasicMaterial({
        color: gs.color || 0x00f0ff,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.08;
      gsGroup.add(ringMesh);

      // Station Callsign Sprite Label
      const labelSprite = this.createStationLabelSprite(gs.id, gs.color || '#00f0ff');
      labelSprite.position.set(0, 4.2, 0);
      gsGroup.add(labelSprite);

      gsGroup.userData = { isGroundStation: true, stationData: gs };
      this.scene.add(gsGroup);
      this.groundStationMeshes.set(gs.id, gsGroup);
    }
  }

  createStationLabelSprite(stationId, colorHex) {
    const canvas = document.createElement('canvas');
    canvas.width = 192;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = 'rgba(7, 13, 26, 0.85)';
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 2;
    ctx.roundRect(4, 4, 184, 56, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = colorHex;
    ctx.font = 'bold 22px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(stationId, 96, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(7.5, 2.5, 1);
    return sprite;
  }

  buildSatellitesAndOrbits() {
    this.satMeshes.forEach(mesh => this.scene.remove(mesh));
    this.satMeshes.clear();
    this.satSprites.forEach(sprite => this.scene.remove(sprite));
    this.satSprites.clear();
    this.orbitLines.forEach(line => this.scene.remove(line));
    this.orbitLines.clear();

    const earthRadius = 100;

    for (const sat of this.satellites) {
      // 1. Orbital Ring Track
      const orbitRadius = earthRadius + (sat.altitudeKm * this.scaleFactor);
      const orbitPoints = [];
      const numSegments = 140;

      const incRad = THREE.MathUtils.degToRad(sat.inclinationDeg);
      const raanRad = THREE.MathUtils.degToRad(sat.raanDeg);

      for (let i = 0; i <= numSegments; i++) {
        const u = (i / numSegments) * Math.PI * 2;
        const xOrb = orbitRadius * Math.cos(u);
        const yOrb = 0;
        const zOrb = orbitRadius * Math.sin(u);

        const xInc = xOrb;
        const yInc = zOrb * Math.sin(incRad);
        const zInc = zOrb * Math.cos(incRad);

        const xEci = xInc * Math.cos(raanRad) - zInc * Math.sin(raanRad);
        const yEci = yInc;
        const zEci = xInc * Math.sin(raanRad) + zInc * Math.cos(raanRad);

        orbitPoints.push(new THREE.Vector3(xEci, yEci, zEci));
      }

      const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const orbitMat = new THREE.LineBasicMaterial({
        color: sat.priorityColor || 0x00f0ff,
        transparent: true,
        opacity: 0.38
      });
      const orbitLine = new THREE.Line(orbitGeo, orbitMat);
      this.scene.add(orbitLine);
      this.orbitLines.set(sat.id, orbitLine);

      // 2. High-Visibility Satellite Spacecraft Model
      const satGroup = new THREE.Group();

      // Main Bus (Enlarged 3.0 units Gold Foil Box)
      const busGeo = new THREE.BoxGeometry(2.6, 2.6, 3.8);
      const busMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37, // Gold MLI
        metalness: 0.95,
        roughness: 0.15
      });
      const busMesh = new THREE.Mesh(busGeo, busMat);
      satGroup.add(busMesh);

      // Solar Panel Wings (Span: 10.0 units!)
      const panelGeo = new THREE.BoxGeometry(10.0, 0.12, 2.4);
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0x0d2b52, // Photovoltaic Dark Blue
        roughness: 0.25,
        metalness: 0.85
      });
      const panelMesh = new THREE.Mesh(panelGeo, panelMat);
      satGroup.add(panelMesh);

      // Solar Panel Metallic Rim
      const panelRimGeo = new THREE.BoxGeometry(10.2, 0.08, 2.6);
      const panelRimMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9 });
      const panelRim = new THREE.Mesh(panelRimGeo, panelRimMat);
      satGroup.add(panelRim);

      // Downlink Dish Antenna (Points to Earth nadir)
      const antGeo = new THREE.ConeGeometry(0.8, 1.2, 8);
      const antMat = new THREE.MeshBasicMaterial({ color: sat.priorityColor || 0x00f0ff });
      const antMesh = new THREE.Mesh(antGeo, antMat);
      antMesh.rotation.x = Math.PI;
      antMesh.position.y = -1.6;
      satGroup.add(antMesh);

      // Priority Glow Sphere
      const glowGeo = new THREE.SphereGeometry(3.2, 16, 16);
      const glowMat = new THREE.MeshBasicMaterial({
        color: sat.priorityColor || 0x00f0ff,
        transparent: true,
        opacity: 0.35,
        wireframe: true
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      satGroup.add(glowMesh);

      satGroup.userData = { isSatellite: true, satId: sat.id, satData: sat };
      this.scene.add(satGroup);
      this.satMeshes.set(sat.id, satGroup);

      // 3. High-Visibility Beacon Sprite Billboard with Satellite Name Tag!
      const beaconSprite = this.createSatelliteBeaconSprite(
        sat.priorityColor || '#00f0ff',
        sat.name
      );
      this.scene.add(beaconSprite);
      this.satSprites.set(sat.id, beaconSprite);
    }
  }

  /**
   * Creates a billboard sprite with glowing halo and name tag
   * guaranteeing the satellite is unmistakably visible at any distance.
   */
  createSatelliteBeaconSprite(colorHex, nameText) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 80;
    const ctx = canvas.getContext('2d');

    // Pulsing halo circle
    const grad = ctx.createRadialGradient(32, 40, 2, 32, 40, 28);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.3, colorHex);
    grad.addColorStop(0.7, colorHex + '77');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(32, 40, 28, 0, Math.PI * 2);
    ctx.fill();

    // Solid core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(32, 40, 6, 0, Math.PI * 2);
    ctx.fill();

    // Label Box
    ctx.fillStyle = 'rgba(7, 13, 26, 0.8)';
    ctx.strokeStyle = colorHex;
    ctx.lineWidth = 1.5;
    ctx.roundRect(66, 20, 180, 40, 6);
    ctx.fill();
    ctx.stroke();

    // Satellite Name Text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.fillText(nameText, 76, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    const sprite = new THREE.Sprite(material);
    sprite.scale.set(16, 5, 1);
    return sprite;
  }

  /**
   * Update satellite positions, beacons, and active downlink beams at simulation time
   */
  updateAtTime(simSec) {
    const earthRadius = 100;

    // 1. Update satellite orbital positions & sprites
    for (const sat of this.satellites) {
      const mesh = this.satMeshes.get(sat.id);
      const sprite = this.satSprites.get(sat.id);
      if (!mesh) continue;

      const state = sat.getStateAtTime(simSec);
      const r = earthRadius + (sat.altitudeKm * this.scaleFactor);

      const pos = this.latLonToVector3(state.lat, state.lon, r);
      mesh.position.copy(pos);

      // Point antenna toward Earth center
      mesh.lookAt(0, 0, 0);

      // Update beacon sprite position slightly offset outward
      if (sprite) {
        const spritePos = pos.clone().multiplyScalar(1.05);
        sprite.position.copy(spritePos);
        // Subtle pulse scale
        const pulse = 1.0 + 0.12 * Math.sin(Date.now() * 0.005 + (sat.noradId || 0));
        sprite.scale.set(16 * pulse, 5 * pulse, 1);
      }

      // Highlight selected satellite
      if (sat.id === this.selectedSatelliteId) {
        mesh.scale.set(1.5, 1.5, 1.5);
      } else {
        mesh.scale.set(1.0, 1.0, 1.0);
      }
    }

    // 2. Update active downlink beams
    this.updateDownlinkBeams(simSec);
  }

  updateDownlinkBeams(simSec) {
    const currentActivePasses = this.activeSchedule.filter(
      p => simSec >= p.startSec && simSec <= p.endSec
    );

    const activeKeys = new Set();
    currentActivePasses.forEach(p => activeKeys.add(`${p.satId}_${p.stationId}`));

    // Remove inactive beams
    for (const [key, beamObj] of this.downlinkBeams.entries()) {
      if (!activeKeys.has(key)) {
        this.scene.remove(beamObj.line);
        this.scene.remove(beamObj.pulseLight);
        this.downlinkBeams.delete(key);
      }
    }

    // Create or update active beams
    for (const pass of currentActivePasses) {
      const key = `${pass.satId}_${pass.stationId}`;
      const satMesh = this.satMeshes.get(pass.satId);
      const gsMesh = this.groundStationMeshes.get(pass.stationId);

      if (satMesh && gsMesh) {
        const satPos = satMesh.position;
        const gsPos = gsMesh.position;

        let beamObj = this.downlinkBeams.get(key);

        if (!beamObj) {
          const lineGeo = new THREE.BufferGeometry().setFromPoints([satPos, gsPos]);
          const lineMat = new THREE.LineBasicMaterial({
            color: pass.color || 0x00f0ff,
            transparent: true,
            opacity: 0.95,
            linewidth: 3
          });
          const line = new THREE.Line(lineGeo, lineMat);
          this.scene.add(line);

          const pulseLight = new THREE.PointLight(pass.color || 0x00f0ff, 2.5, 50);
          pulseLight.position.copy(satPos);
          this.scene.add(pulseLight);

          beamObj = { line, lineMat, pulseLight, key, pass };
          this.downlinkBeams.set(key, beamObj);
        } else {
          const positions = beamObj.line.geometry.attributes.position.array;
          positions[0] = satPos.x;
          positions[1] = satPos.y;
          positions[2] = satPos.z;
          positions[3] = gsPos.x;
          positions[4] = gsPos.y;
          positions[5] = gsPos.z;
          beamObj.line.geometry.attributes.position.needsUpdate = true;

          const tPulse = (Date.now() % 1000) / 1000;
          beamObj.pulseLight.position.lerpVectors(satPos, gsPos, tPulse);
          beamObj.lineMat.opacity = 0.8 + 0.2 * Math.sin(Date.now() * 0.015);
        }
      }
    }
  }

  setCameraPreset(preset) {
    if (!this.controls || !this.camera) return;

    if (preset === 'GLOBAL') {
      this.camera.position.set(160, 110, 210);
      this.controls.target.set(0, 0, 0);
    } else if (preset === 'INDIA') {
      const indiaFocus = this.latLonToVector3(20, 78, 100);
      const camPos = indiaFocus.clone().normalize().multiplyScalar(235);
      camPos.y += 25;
      this.camera.position.copy(camPos);
      this.controls.target.copy(indiaFocus.clone().multiplyScalar(0.4));
    } else if (preset === 'NORTH_POLAR') {
      this.camera.position.set(0, 260, 40);
      this.controls.target.set(0, 70, 0);
    } else if (preset === 'SOUTH_POLAR') {
      this.camera.position.set(0, -260, 40);
      this.controls.target.set(0, -70, 0);
    } else if (preset === 'SELECTED_SAT') {
      if (this.selectedSatelliteId) {
        const mesh = this.satMeshes.get(this.selectedSatelliteId);
        if (mesh) {
          const pos = mesh.position.clone();
          this.camera.position.set(pos.x * 1.45, pos.y * 1.45, pos.z * 1.45);
          this.controls.target.copy(pos);
        }
      }
    }
  }

  selectSatellite(satId) {
    this.selectedSatelliteId = satId;
    const sat = this.satellites.find(s => s.id === satId);
    if (sat && this.onSatelliteSelect) {
      this.onSatelliteSelect(sat);
    }
  }

  onPointerDown(event) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(this.mouse, this.camera);

    const checkObjects = [];
    this.satMeshes.forEach(mesh => checkObjects.push(mesh));

    const intersects = this.raycaster.intersectObjects(checkObjects, true);
    if (intersects.length > 0) {
      let cur = intersects[0].object;
      while (cur && !cur.userData.isSatellite) {
        cur = cur.parent;
      }
      if (cur && cur.userData.satId) {
        this.selectSatellite(cur.userData.satId);
      }
    }
  }

  latLonToVector3(latDeg, lonDeg, radius) {
    const phi = (90 - latDeg) * (Math.PI / 180);
    const theta = (lonDeg + 180) * (Math.PI / 180);
    const x = -(radius * Math.sin(phi) * Math.cos(theta));
    const z = radius * Math.sin(phi) * Math.sin(theta);
    const y = radius * Math.cos(phi);
    return new THREE.Vector3(x, y, z);
  }

  animate() {
    requestAnimationFrame(this.animate);

    // Dynamic rotation of clouds
    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += 0.0003;
    }

    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
