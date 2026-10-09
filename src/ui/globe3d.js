/**
 * SPACE-04: High-Performance 3D Constellation & Ground Station Globe
 * Three.js WebGL visualization of Earth, orbital ground tracks, satellite meshes,
 * ground station visibility cones, and dynamic line-of-sight downlink beams.
 */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createEarthCanvasTexture, createStarfield } from './earthTextures.js';
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
    this.beamParticleGroup = null;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 800;
    const height = this.container.clientHeight || 500;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#030712');

    // Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.5, 3000);
    this.camera.position.set(160, 110, 210);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    this.container.appendChild(this.renderer.domElement);

    // OrbitControls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 115;
    this.controls.maxDistance = 600;
    this.controls.autoRotate = false;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xffffff, 1.8);
    sunLight.position.set(300, 150, 200);
    this.scene.add(sunLight);

    const rimLight = new THREE.DirectionalLight(0x00f0ff, 0.6);
    rimLight.position.set(-200, -100, -150);
    this.scene.add(rimLight);

    // Stars
    this.starfield = createStarfield(3000, 900);
    this.scene.add(this.starfield);

    // Earth Sphere
    const earthRadius = 100;
    const earthGeometry = new THREE.SphereGeometry(earthRadius, 64, 64);
    const earthTexture = createEarthCanvasTexture(2048, 1024);

    const earthMaterial = new THREE.MeshStandardMaterial({
      map: earthTexture,
      roughness: 0.65,
      metalness: 0.25,
      bumpScale: 1.0
    });

    this.earthMesh = new THREE.Mesh(earthGeometry, earthMaterial);
    this.scene.add(this.earthMesh);

    // Atmosphere Glow Halo
    const atmosGeometry = new THREE.SphereGeometry(earthRadius * 1.025, 48, 48);
    const atmosMaterial = new THREE.MeshBasicMaterial({
      color: 0x00d8ff,
      transparent: true,
      opacity: 0.12,
      side: THREE.BackSide
    });
    this.atmosphereMesh = new THREE.Mesh(atmosGeometry, atmosMaterial);
    this.scene.add(this.atmosphereMesh);

    // Raycasting event listener
    this.renderer.domElement.addEventListener('pointerdown', (e) => this.onPointerDown(e));

    // Resize listener
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

    // Default select first satellite if none
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
      const phi = (90 - gs.lat) * (Math.PI / 180);
      const theta = (gs.lon + 180) * (Math.PI / 180);

      const x = -(earthRadius * Math.sin(phi) * Math.cos(theta));
      const z = earthRadius * Math.sin(phi) * Math.sin(theta);
      const y = earthRadius * Math.cos(phi);

      gsGroup.position.set(x, y, z);
      // Align normal to Earth center
      gsGroup.quaternion.setFromUnitVectors(
        new THREE.Vector3(0, 1, 0),
        new THREE.Vector3(x, y, z).normalize()
      );

      // Radar Dome (Radome)
      const domeGeo = new THREE.SphereGeometry(1.6, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2);
      const domeMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(gs.color),
        roughness: 0.3,
        metalness: 0.7,
        emissive: new THREE.Color(gs.color),
        emissiveIntensity: 0.35
      });
      const domeMesh = new THREE.Mesh(domeGeo, domeMat);
      gsGroup.add(domeMesh);

      // Base Pedestal
      const baseGeo = new THREE.CylinderGeometry(1.8, 2.2, 0.8, 16);
      const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = -0.4;
      gsGroup.add(baseMesh);

      // Pulsing Ground Horizon Ring (Visibility horizon footprint)
      const ringGeo = new THREE.RingGeometry(2.5, 3.2, 24);
      const ringMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(gs.color),
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide
      });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      gsGroup.add(ringMesh);

      // 3D Visibility Cone (elevation mask cone)
      // Visual cone projecting into space with ~10° elevation mask
      const coneHeight = 18;
      const coneRadius = Math.tan(((90 - gs.minElevationDeg) * Math.PI) / 180) * 8;
      const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 24, 1, true);
      const coneMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(gs.color),
        transparent: true,
        opacity: 0.08,
        wireframe: true
      });
      const coneMesh = new THREE.Mesh(coneGeo, coneMat);
      coneMesh.position.y = coneHeight / 2;
      gsGroup.add(coneMesh);

      gsGroup.userData = { isGroundStation: true, gsData: gs };

      this.scene.add(gsGroup);
      this.groundStationMeshes.set(gs.id, { group: gsGroup, worldPos: new THREE.Vector3(x, y, z), data: gs });
    }
  }

  buildSatellitesAndOrbits() {
    // Clear previous
    this.satMeshes.forEach(mesh => this.scene.remove(mesh));
    this.satMeshes.clear();
    this.orbitLines.forEach(line => this.scene.remove(line));
    this.orbitLines.clear();

    for (const sat of this.satellites) {
      // 1. Full orbit line trajectory
      const orbitPoints = [];
      const trackPoints = sat.propagator.generateGroundTrack(0, sat.propagator.periodSec, 45);

      for (const pt of trackPoints) {
        // ECEF to Globe 3D coordinates:
        // xGlobe = -xECEF * scale, yGlobe = zECEF * scale, zGlobe = yECEF * scale
        const gx = -(pt.ecef[0] * this.scaleFactor);
        const gy = pt.ecef[2] * this.scaleFactor;
        const gz = pt.ecef[1] * this.scaleFactor;
        orbitPoints.push(new THREE.Vector3(gx, gy, gz));
      }
      orbitPoints.push(orbitPoints[0]); // close loop

      const orbitGeo = new THREE.BufferGeometry().setFromPoints(orbitPoints);
      const orbitMat = new THREE.LineBasicMaterial({
        color: new THREE.Color(sat.color),
        transparent: true,
        opacity: 0.35
      });
      const orbitLine = new THREE.Line(orbitGeo, orbitMat);
      this.scene.add(orbitLine);
      this.orbitLines.set(sat.id, orbitLine);

      // 2. 3D Satellite Mesh
      const satGroup = new THREE.Group();

      // Main satellite bus (Gold foil body)
      const busGeo = new THREE.BoxGeometry(1.6, 2.2, 1.4);
      const busMat = new THREE.MeshStandardMaterial({
        color: 0xffd700,
        metalness: 0.85,
        roughness: 0.25,
        emissive: 0x664400,
        emissiveIntensity: 0.2
      });
      const busMesh = new THREE.Mesh(busGeo, busMat);
      satGroup.add(busMesh);

      // Solar Panel Wings (Blue silicon)
      const panelGeo = new THREE.BoxGeometry(4.2, 0.1, 1.2);
      const panelMat = new THREE.MeshStandardMaterial({
        color: 0x1d4ed8,
        metalness: 0.6,
        roughness: 0.3,
        emissive: 0x00f0ff,
        emissiveIntensity: 0.3
      });
      const panelMesh = new THREE.Mesh(panelGeo, panelMat);
      panelMesh.position.y = 0;
      satGroup.add(panelMesh);

      // Antenna Feed Horn (Dish pointed to Earth / Nadir)
      const dishGeo = new THREE.ConeGeometry(0.8, 0.9, 12);
      const dishMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9 });
      const dishMesh = new THREE.Mesh(dishGeo, dishMat);
      dishMesh.position.y = -1.2;
      dishMesh.rotation.x = Math.PI;
      satGroup.add(dishMesh);

      // Glowing selection beacon sphere
      const beaconGeo = new THREE.SphereGeometry(2.0, 16, 16);
      const beaconMat = new THREE.MeshBasicMaterial({
        color: new THREE.Color(sat.color),
        transparent: true,
        opacity: 0.25,
        wireframe: true
      });
      const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
      satGroup.add(beaconMesh);

      satGroup.userData = { isSatellite: true, satId: sat.id, satData: sat, beaconMesh };

      this.scene.add(satGroup);
      this.satMeshes.set(sat.id, satGroup);
    }
  }

  /**
   * Update satellite positions, orbits, and LOS laser downlink beams for epoch tSec
   */
  updateAtTime(tSec) {
    if (!this.satellites || this.satellites.length === 0) return;

    // 1. Update satellite positions
    for (const sat of this.satellites) {
      const state = sat.propagator.propagate(tSec);
      const gx = -(state.ecefPos[0] * this.scaleFactor);
      const gy = state.ecefPos[2] * this.scaleFactor;
      const gz = state.ecefPos[1] * this.scaleFactor;

      const satMesh = this.satMeshes.get(sat.id);
      if (satMesh) {
        satMesh.position.set(gx, gy, gz);

        // Point nadir (towards Earth center)
        const earthCenter = new THREE.Vector3(0, 0, 0);
        satMesh.lookAt(earthCenter);

        // Highlight selected
        const isSelected = sat.id === this.selectedSatelliteId;
        const beacon = satMesh.userData.beaconMesh;
        if (beacon) {
          beacon.material.opacity = isSelected ? 0.75 : 0.15;
          const s = isSelected ? 1.4 : 1.0;
          beacon.scale.set(s, s, s);
        }

        // Orbit line highlight
        const orbitLine = this.orbitLines.get(sat.id);
        if (orbitLine) {
          orbitLine.material.opacity = isSelected ? 0.9 : 0.25;
          orbitLine.material.linewidth = isSelected ? 2 : 1;
        }
      }
    }

    // 2. Active Downlinks & Dynamic LOS Laser Beams
    // Check which passes are active at tSec in this.activeSchedule
    const activePasses = this.activeSchedule.filter(
      p => tSec >= p.startSec && tSec <= p.endSec
    );

    // Remove obsolete beams
    const activeBeamKeys = new Set(activePasses.map(p => `${p.satId}_${p.stationId}`));
    for (const [key, beamObj] of this.downlinkBeams.entries()) {
      if (!activeBeamKeys.has(key)) {
        this.scene.remove(beamObj.line);
        this.downlinkBeams.delete(key);
      }
    }

    // Render / update active beams
    for (const pass of activePasses) {
      const key = `${pass.satId}_${pass.stationId}`;
      const satMesh = this.satMeshes.get(pass.satId);
      const gsMeshObj = this.groundStationMeshes.get(pass.stationId);

      if (satMesh && gsMeshObj) {
        const satPos = satMesh.position.clone();
        const gsPos = gsMeshObj.worldPos.clone();

        let beamObj = this.downlinkBeams.get(key);
        if (!beamObj) {
          // Create dynamic laser cylinder beam
          const lineGeo = new THREE.BufferGeometry().setFromPoints([satPos, gsPos]);
          const lineMat = new THREE.LineBasicMaterial({
            color: new THREE.Color(pass.color || '#00ff9d'),
            linewidth: 3,
            transparent: true,
            opacity: 0.95
          });
          const line = new THREE.Line(lineGeo, lineMat);
          this.scene.add(line);

          beamObj = { line, lineMat, key, pass };
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
          // Pulse opacity
          beamObj.lineMat.opacity = 0.7 + 0.3 * Math.sin(Date.now() * 0.01);
        }
      }
    }
  }

  setCameraPreset(preset) {
    if (!this.controls || !this.camera) return;

    if (preset === 'GLOBAL') {
      this.camera.position.set(160, 110, 210);
      this.controls.target.set(0, 0, 0);
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

  animate() {
    requestAnimationFrame(this.animate);
    if (this.controls) this.controls.update();
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
