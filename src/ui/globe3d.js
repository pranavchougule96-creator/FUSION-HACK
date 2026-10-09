/**
 * SPACE-04: High-Performance 3D Constellation & Ground Station Globe
 * Three.js WebGL visualization of photorealistic Earth, orbital ground tracks, satellite meshes,
 * ground station visibility footprints, and dynamic line-of-sight downlink beams.
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
    this.orbitLines = new Map();
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
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 3000);
    this.camera.position.set(160, 110, 210);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.container.appendChild(this.renderer.domElement);

    // 4. OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 115;
    this.controls.maxDistance = 600;
    this.controls.autoRotate = false;

    // 5. Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    this.scene.add(ambientLight);

    // Sun Directional Light (illuminates day/night terminator with warm sunlight)
    const sunLight = new THREE.DirectionalLight(0xfff8ee, 2.0);
    sunLight.position.set(320, 160, 220);
    this.scene.add(sunLight);

    // Deep space azure rim fill
    const rimLight = new THREE.DirectionalLight(0x00e1ff, 0.65);
    rimLight.position.set(-220, -120, -180);
    this.scene.add(rimLight);

    // 6. Deep Space Stars
    this.starfield = createStarfield(3500, 950);
    this.scene.add(this.starfield);

    // 7. Photorealistic Earth Sphere
    const earthRadius = 100;
    const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthTexture = createRealisticEarthTexture(2048, 1024);

    const earthMaterial = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.55,
      metalness: 0.15,
      bumpScale: 0.05
    });

    this.earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    this.scene.add(this.earthMesh);

    // 8. Independent Dynamic Cloud Layer
    const cloudGeometry = new THREE.SphereGeometry(earthRadius * 1.008, 64, 64);
    const cloudTexture = createRealisticCloudTexture(2048, 1024);

    const cloudMaterial = new THREE.MeshStandardMaterial({
      map: cloudTexture,
      transparent: true,
      opacity: 0.45,
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
      opacity: 0.16,
      side: THREE.BackSide
    });
    this.atmosphereMesh = new THREE.Mesh(atmosGeometry, atmosMaterial);
    this.scene.add(this.atmosphereMesh);

    // Raycasting event listener for clicking satellites
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

    // Default select first satellite if none selected
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
    // Clear previous
    this.groundStationMeshes.forEach(mesh => this.scene.remove(mesh));
    this.groundStationMeshes.clear();

    const earthRadius = 100;

    for (const gs of this.groundStations) {
      const gsGroup = new THREE.Group();

      // Geodetic to 3D Sphere Position
      const gsPos = this.latLonToVector3(gs.lat, gs.lon, earthRadius);
      gsGroup.position.copy(gsPos);

      // Align group normal to Earth surface
      const normal = gsPos.clone().normalize();
      gsGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal);

      // 1. Station Pedestal & Foundation
      const baseGeo = new THREE.CylinderGeometry(0.8, 1.2, 0.6, 12);
      const baseMat = new THREE.MeshStandardMaterial({
        color: 0x334155,
        metalness: 0.8,
        roughness: 0.3
      });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = 0.3;
      gsGroup.add(baseMesh);

      // 2. Parabolic Ground Station Dish
      const dishGeo = new THREE.SphereGeometry(1.6, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.45);
      const dishMat = new THREE.MeshStandardMaterial({
        color: 0xf1f5f9,
        metalness: 0.6,
        roughness: 0.3,
        side: THREE.DoubleSide
      });
      const dishMesh = new THREE.Mesh(dishGeo, dishMat);
      dishMesh.position.y = 1.3;
      dishMesh.rotation.x = Math.PI; // Face upward
      gsGroup.add(dishMesh);

      // Feed horn antenna tip
      const hornGeo = new THREE.ConeGeometry(0.3, 0.9, 8);
      const hornMat = new THREE.MeshBasicMaterial({ color: gs.color || 0x00f0ff });
      const hornMesh = new THREE.Mesh(hornGeo, hornMat);
      hornMesh.position.y = 2.0;
      gsGroup.add(hornMesh);

      // 3. Ground Station Visibility Footprint Ring (FOV cone base on Earth surface)
      const fovAngleRad = Math.acos(earthRadius / (earthRadius + 500 * this.scaleFactor));
      const ringRadius = Math.tan(fovAngleRad) * 14;

      const ringGeo = new THREE.RingGeometry(ringRadius * 0.92, ringRadius, 36);
      const ringMat = new THREE.MeshBasicMaterial({
        color: gs.color || 0x00f0ff,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = -Math.PI / 2;
      ringMesh.position.y = 0.05;
      gsGroup.add(ringMesh);

      // 4. Station Beacon Halo Light
      const beaconGeo = new THREE.SphereGeometry(0.4, 8, 8);
      const beaconMat = new THREE.MeshBasicMaterial({ color: gs.color || 0x00f0ff });
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      beaconMesh.position.y = 2.2;
      gsGroup.add(beaconMesh);

      gsGroup.userData = { isGroundStation: true, stationData: gs };
      this.scene.add(gsGroup);
      this.groundStationMeshes.set(gs.id, gsGroup);
    }
  }

  buildSatellitesAndOrbits() {
    // Clear previous
    this.satMeshes.forEach(mesh => this.scene.remove(mesh));
    this.satMeshes.clear();
    this.orbitLines.forEach(line => this.scene.remove(line));
    this.orbitLines.clear();

    const earthRadius = 100;

    for (const sat of this.satellites) {
      // 1. Orbital Ring Track
      const orbitRadius = earthRadius + (sat.altitudeKm * this.scaleFactor);
      const orbitPoints = [];
      const numSegments = 120;

      const incRad = THREE.MathUtils.degToRad(sat.inclinationDeg);
      const raanRad = THREE.MathUtils.degToRad(sat.raanDeg);

      for (let i = 0; i <= numSegments; i++) {
        const u = (i / numSegments) * Math.PI * 2;
        // Orbital plane coords
        const xOrb = orbitRadius * Math.cos(u);
        const yOrb = 0;
        const zOrb = orbitRadius * Math.sin(u);

        // Rotate by inclination around X
        const xInc = xOrb;
        const yInc = zOrb * Math.sin(incRad);
        const zInc = zOrb * Math.cos(incRad);

        // Rotate by RAAN around Y
        const xEci = xInc * Math.cos(raanRad) - zInc * Math.sin(raanRad);
        const yEci = yInc;
        const zEci = xInc * Math.sin(raanRad) + zInc * Math.cos(raanRad);

        orbitPoints.push(new THREE.Vector3(xEci, yEci, zEci));
      }

      const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const orbitMat = new THREE.LineBasicMaterial({
        color: sat.priorityColor || 0x00f0ff,
        transparent: true,
        opacity: 0.28
      });
      const orbitLine = new THREE.Line(orbitGeo, orbitMat);
      this.scene.add(orbitLine);
      this.orbitLines.set(sat.id, orbitLine);

      // 2. Spacecraft Model Group
      const satGroup = new THREE.Group();

      // Main Bus (Gold Multi-Layer Insulation MLI Foil)
      const busGeo = new THREE.BoxGeometry(1.4, 1.4, 2.2);
      const busMat = new THREE.MeshStandardMaterial({
        color: 0xd4af37,
        metalness: 0.9,
        roughness: 0.2
      });
      const busMesh = new THREE.Mesh(busGeo, busMat);
      satGroup.add(busMesh);

      // Solar Panel Wings
      const panelGeo = new THREE.BoxGeometry(4.6, 0.08, 1.2);
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0x0f2744,
        roughness: 0.3,
        metalness: 0.8
      });
      const panelMesh = new THREE.Mesh(panelGeo, panelMat);
      panelMesh.position.y = 0;
      satGroup.add(panelMesh);

      // Downlink High-Gain Antenna Dish
      const antGeo = new THREE.ConeGeometry(0.5, 0.7, 8);
      const antMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
      const antMesh = new THREE.Mesh(antGeo, antMat);
      antMesh.rotation.x = Math.PI;
      antMesh.position.y = -0.9;
      satGroup.add(antMesh);

      // Priority Glow Sphere
      const glowGeo = new THREE.SphereGeometry(1.8, 12, 12);
      const glowMat = new THREE.MeshBasicMaterial({
        color: sat.priorityColor || 0x00f0ff,
        transparent: true,
        opacity: 0.25,
        wireframe: true
      });
      const glowMesh = new THREE.Mesh(glowGeo, glowMat);
      satGroup.add(glowMesh);

      satGroup.userData = { isSatellite: true, satId: sat.id, satData: sat };
      this.scene.add(satGroup);
      this.satMeshes.set(sat.id, satGroup);
    }
  }

  /**
   * Update satellite positions and active downlink beams at simulation time
   */
  updateAtTime(simSec) {
    const earthRadius = 100;

    // 1. Update satellite orbital positions
    for (const sat of this.satellites) {
      const mesh = this.satMeshes.get(sat.id);
      if (!mesh) continue;

      const state = sat.getStateAtTime(simSec);
      const r = earthRadius + (sat.altitudeKm * this.scaleFactor);

      // Spherical lat/lon to Cartesian ECEF
      const pos = this.latLonToVector3(state.lat, state.lon, r);
      mesh.position.copy(pos);

      // Orient satellite so antenna points toward Earth center
      mesh.lookAt(0, 0, 0);

      // Highlight selected satellite
      if (sat.id === this.selectedSatelliteId) {
        mesh.scale.set(1.4, 1.4, 1.4);
      } else {
        mesh.scale.set(1.0, 1.0, 1.0);
      }
    }

    // 2. Update active downlink beams
    this.updateDownlinkBeams(simSec);
  }

  updateDownlinkBeams(simSec) {
    // Find passes currently active at simSec
    const currentActivePasses = this.activeSchedule.filter(
      p => simSec >= p.startSec && simSec <= p.endSec
    );

    const activeKeys = new Set();
    currentActivePasses.forEach(p => activeKeys.add(`${p.satId}_${p.stationId}`));

    // Remove defunct beams
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
          // Create line
          const lineGeo = new THREE.BufferGeometry().setFromPoints([satPos, gsPos]);
          const lineMat = new THREE.LineBasicMaterial({
            color: pass.color || 0x00f0ff,
            transparent: true,
            opacity: 0.9,
            linewidth: 2
          });
          const line = new THREE.Line(lineGeo, lineMat);
          this.scene.add(line);

          // Photon packet light
          const pulseLight = new THREE.PointLight(pass.color || 0x00f0ff, 2.0, 40);
          pulseLight.position.copy(satPos);
          this.scene.add(pulseLight);

          beamObj = { line, lineMat, pulseLight, key, pass };
          this.downlinkBeams.set(key, beamObj);
        } else {
          // Update beam points
          const positions = beamObj.line.geometry.attributes.position.array;
          positions[0] = satPos.x;
          positions[1] = satPos.y;
          positions[2] = satPos.z;
          positions[3] = gsPos.x;
          positions[4] = gsPos.y;
          positions[5] = gsPos.z;
          beamObj.line.geometry.attributes.position.needsUpdate = true;

          // Pulse opacity & move photon packet along beam
          const tPulse = (Date.now() % 1000) / 1000;
          beamObj.pulseLight.position.lerpVectors(satPos, gsPos, tPulse);
          beamObj.lineMat.opacity = 0.75 + 0.25 * Math.sin(Date.now() * 0.012);
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
      // Focus on Indian Subcontinent (ISRO Hubs: Bengaluru, Lucknow, Port Blair)
      const indiaFocus = this.latLonToVector3(20, 80, 100);
      const camPos = indiaFocus.clone().normalize().multiplyScalar(240);
      camPos.y += 30; // slight overhead angle
      this.camera.position.copy(camPos);
      this.controls.target.copy(indiaFocus.clone().multiplyScalar(0.4));
    } else if (preset === 'NORTH_POLAR') {
      // Svalbard / Inuvik Arctic view
      this.camera.position.set(0, 260, 40);
      this.controls.target.set(0, 70, 0);
    } else if (preset === 'SOUTH_POLAR') {
      // Troll / Punta Arenas Antarctic view
      this.camera.position.set(0, -260, 40);
      this.controls.target.set(0, -70, 0);
    } else if (preset === 'SELECTED_SAT') {
      if (this.selectedSatelliteId) {
        const mesh = this.satMeshes.get(this.selectedSatelliteId);
        if (mesh) {
          const pos = mesh.position.clone();
          this.camera.position.set(pos.x * 1.5, pos.y * 1.5, pos.z * 1.5);
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

    // Dynamic rotation of cloud mesh independently of Earth surface
    if (this.cloudMesh) {
      this.cloudMesh.rotation.y += 0.00025;
    }

    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
