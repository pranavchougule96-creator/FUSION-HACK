/**
 * SPACE-04: Satellite Orientation & Attitude Monitor
 * Real-time 3D Satellite Gimbal (Roll, Pitch, Yaw), aerospace artificial horizon,
 * and Ground Station Antenna Slew Rate & Maneuver Feasibility Gauges.
 */

import * as THREE from 'three';
import { computeAngularDistanceDeg, computeRequiredSlewTimeSec } from '../physics/slew.js';

export class SatelliteAttitudeMonitor {
  constructor(containerElement) {
    this.container = containerElement;
    this.selectedSatellite = null;
    this.currentPass = null;
    this.nextPass = null;
    this.groundStation = null;

    // Three.js mini viewport for 3D Attitude Gimbal
    this.gimbalScene = null;
    this.gimbalCamera = null;
    this.gimbalRenderer = null;
    this.satelliteBusMesh = null;
    this.antennaVectorArrow = null;

    this.initDOM();
    this.init3DGimbal();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="panel-header">
        <div class="panel-title-wrapper">
          <span class="panel-icon">🛰️</span>
          <h2 class="panel-title">SATELLITE ATTITUDE & ANTENNA SLEW MONITOR</h2>
        </div>
        <div class="telemetry-badge" id="att-selected-sat-badge">SAT: NONE</div>
      </div>

      <div class="attitude-content-grid">
        <!-- 3D Attitude Gimbal Viewport -->
        <div class="attitude-gimbal-card">
          <div class="card-subtitle">SPACECRAFT GIMBAL & BODY AXES</div>
          <div id="attitude-gimbal-viewport" class="gimbal-viewport"></div>
          <div class="attitude-rpy-readouts">
            <div class="rpy-box rpy-roll">
              <span class="rpy-label">ROLL (φ)</span>
              <span class="rpy-value" id="att-roll-val">0.00°</span>
            </div>
            <div class="rpy-box rpy-pitch">
              <span class="rpy-label">PITCH (θ)</span>
              <span class="rpy-value" id="att-pitch-val">0.00°</span>
            </div>
            <div class="rpy-box rpy-yaw">
              <span class="rpy-label">YAW (ψ)</span>
              <span class="rpy-value" id="att-yaw-val">0.00°</span>
            </div>
          </div>
        </div>

        <!-- Antenna Slew Dynamics & Transition Feasibility -->
        <div class="slew-dynamics-card">
          <div class="card-subtitle">GROUND STATION DISH SLEW TRANSITION</div>
          
          <div class="slew-status-banner" id="slew-status-banner">
            <span class="status-indicator-dot" id="slew-status-dot"></span>
            <span class="status-text" id="slew-status-text">ANTENNA STANDBY / STOWED</span>
          </div>

          <!-- Dual Gauges: Dish Az/El & Slew Velocity -->
          <div class="slew-gauges-row">
            <div class="gauge-card">
              <span class="gauge-title">POINTING (AZ / EL)</span>
              <div class="gauge-azel-display">
                <div class="azel-item">
                  <span class="azel-lbl">AZ</span>
                  <span class="azel-val" id="dish-az-val">0.0°</span>
                </div>
                <div class="azel-divider">/</div>
                <div class="azel-item">
                  <span class="azel-lbl">EL</span>
                  <span class="azel-val" id="dish-el-val">0.0°</span>
                </div>
              </div>
              <div class="sub-label" id="dish-station-name">Station: ---</div>
            </div>

            <div class="gauge-card">
              <span class="gauge-title">SLEW ANGULAR SPEED</span>
              <div class="gauge-speed-display">
                <span class="speed-val" id="dish-speed-val">0.00</span>
                <span class="speed-unit">°/sec</span>
              </div>
              <div class="speed-bar-container">
                <div class="speed-bar-fill" id="dish-speed-bar"></div>
              </div>
              <div class="sub-label" id="dish-max-speed">Max Limit: 3.5°/s</div>
            </div>
          </div>

          <!-- Slew Transition Maneuver Metrics Table -->
          <div class="slew-transition-table">
            <div class="metric-row">
              <span class="metric-key">Upcoming Maneuver:</span>
              <span class="metric-val text-cyan" id="slew-target-text">Awaiting target contact</span>
            </div>
            <div class="metric-row">
              <span class="metric-key">Angular Distance (Δθ):</span>
              <span class="metric-val font-mono" id="slew-delta-deg">--°</span>
            </div>
            <div class="metric-row">
              <span class="metric-key">Transition Time (Slew + Settle):</span>
              <span class="metric-val font-mono" id="slew-trans-time">-- s</span>
            </div>
            <div class="metric-row">
              <span class="metric-key">Pass Time Gap (Δt):</span>
              <span class="metric-val font-mono" id="slew-gap-time">-- s</span>
            </div>
            <div class="metric-row highlighted">
              <span class="metric-key">Slew Safety Margin:</span>
              <span class="metric-val font-mono font-bold" id="slew-margin-val">--</span>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  init3DGimbal() {
    const vp = this.container.querySelector('#attitude-gimbal-viewport');
    if (!vp) return;

    const width = vp.clientWidth || 240;
    const height = vp.clientHeight || 150;

    this.gimbalScene = new THREE.Scene();
    this.gimbalScene.background = new THREE.Color('#070d1a');

    this.gimbalCamera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    this.gimbalCamera.position.set(4, 3, 5);
    this.gimbalCamera.lookAt(0, 0, 0);

    this.gimbalRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.gimbalRenderer.setSize(width, height);
    this.gimbalRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    vp.appendChild(this.gimbalRenderer.domElement);

    // Gimbal Lights
    const amb = new THREE.AmbientLight(0xffffff, 0.9);
    this.gimbalScene.add(amb);
    const dir = new THREE.DirectionalLight(0x00f0ff, 1.4);
    dir.position.set(5, 5, 5);
    this.gimbalScene.add(dir);

    // Coordinate Axes Guide (Gimbal sphere ring)
    const ringGeo = new THREE.RingGeometry(1.9, 1.95, 32);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x1e3a8a, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    this.gimbalScene.add(ring);

    // Satellite Bus Model for Attitude Display
    this.satelliteBusMesh = new THREE.Group();

    // Gold CubeSat body
    const bodyGeo = new THREE.BoxGeometry(1.2, 1.8, 1.2);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      metalness: 0.9,
      roughness: 0.2,
      emissive: 0x443300
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    this.satelliteBusMesh.add(body);

    // Blue solar panel wings
    const panelGeo = new THREE.BoxGeometry(3.6, 0.08, 0.9);
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x1d4ed8,
      metalness: 0.5,
      roughness: 0.3,
      emissive: 0x00d8ff,
      emissiveIntensity: 0.25
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    this.satelliteBusMesh.add(panel);

    // Nadir antenna horn pointing down along -Y
    const hornGeo = new THREE.ConeGeometry(0.5, 0.7, 16);
    const hornMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.8 });
    const horn = new THREE.Mesh(hornGeo, hornMat);
    horn.position.y = -1.1;
    horn.rotation.x = Math.PI;
    this.satelliteBusMesh.add(horn);

    // Body coordinate arrows
    const axesHelper = new THREE.AxesHelper(2.0);
    this.satelliteBusMesh.add(axesHelper);

    this.gimbalScene.add(this.satelliteBusMesh);

    // Render loop
    const renderGimbal = () => {
      requestAnimationFrame(renderGimbal);
      if (this.gimbalRenderer && this.gimbalScene && this.gimbalCamera) {
        this.gimbalRenderer.render(this.gimbalScene, this.gimbalCamera);
      }
    };
    renderGimbal();
  }

  setSatellite(sat) {
    this.selectedSatellite = sat;
    const badge = this.container.querySelector('#att-selected-sat-badge');
    if (badge && sat) {
      badge.textContent = `${sat.name} [${sat.priority}]`;
      badge.style.borderColor = sat.color;
      badge.style.color = sat.color;
    }
  }

  /**
   * Update attitude and antenna slew states at time tSec
   */
  updateAtTime(tSec, activeSchedule, groundStations) {
    if (!this.selectedSatellite) return;

    const sat = this.selectedSatellite;

    // 1. Calculate Spacecraft Attitude Maneuver
    // When downlinking to a ground station, the satellite pitches and rolls to point antenna to station.
    // When cruising, nominal nadir pointing with subtle orbital harmonic wobble.
    let targetRoll = 0.5 * Math.sin(tSec * 0.005);
    let targetPitch = -1.2 * Math.cos(tSec * 0.004);
    let targetYaw = (sat.altitudeKm / 10) % 360;

    // Check if currently downlinking
    const activePass = activeSchedule.find(
      p => p.satId === sat.id && tSec >= p.startSec && tSec <= p.endSec
    );

    if (activePass) {
      // Dynamic pointing maneuver during pass
      const progress = (tSec - activePass.startSec) / Math.max(1, activePass.durationSec);
      targetPitch = THREE.MathUtils.lerp(-18, 18, progress);
      targetRoll = THREE.MathUtils.lerp(8, -8, progress);
    }

    sat.attitude.rollDeg = THREE.MathUtils.lerp(sat.attitude.rollDeg, targetRoll, 0.1);
    sat.attitude.pitchDeg = THREE.MathUtils.lerp(sat.attitude.pitchDeg, targetPitch, 0.1);
    sat.attitude.yawDeg = THREE.MathUtils.lerp(sat.attitude.yawDeg, targetYaw, 0.1);

    // Update 3D Gimbal orientation
    if (this.satelliteBusMesh) {
      this.satelliteBusMesh.rotation.x = (sat.attitude.pitchDeg * Math.PI) / 180;
      this.satelliteBusMesh.rotation.z = (sat.attitude.rollDeg * Math.PI) / 180;
      this.satelliteBusMesh.rotation.y = (sat.attitude.yawDeg * Math.PI) / 180;
    }

    // Update RPY numeric labels
    const rollEl = this.container.querySelector('#att-roll-val');
    const pitchEl = this.container.querySelector('#att-pitch-val');
    const yawEl = this.container.querySelector('#att-yaw-val');
    if (rollEl) rollEl.textContent = `${sat.attitude.rollDeg >= 0 ? '+' : ''}${sat.attitude.rollDeg.toFixed(2)}°`;
    if (pitchEl) pitchEl.textContent = `${sat.attitude.pitchDeg >= 0 ? '+' : ''}${sat.attitude.pitchDeg.toFixed(2)}°`;
    if (yawEl) yawEl.textContent = `${sat.attitude.yawDeg.toFixed(1)}°`;

    // 2. Ground Station Dish Slew Status & Transition Feasibility
    this.updateGroundStationSlewStatus(tSec, activeSchedule, groundStations);
  }

  updateGroundStationSlewStatus(tSec, activeSchedule, groundStations) {
    const statusBanner = this.container.querySelector('#slew-status-banner');
    const statusDot = this.container.querySelector('#slew-status-dot');
    const statusText = this.container.querySelector('#slew-status-text');
    const dishAzVal = this.container.querySelector('#dish-az-val');
    const dishElVal = this.container.querySelector('#dish-el-val');
    const stationNameEl = this.container.querySelector('#dish-station-name');
    const speedValEl = this.container.querySelector('#dish-speed-val');
    const speedBar = this.container.querySelector('#dish-speed-bar');
    const maxSpeedEl = this.container.querySelector('#dish-max-speed');
    const targetTextEl = this.container.querySelector('#slew-target-text');
    const deltaDegEl = this.container.querySelector('#slew-delta-deg');
    const transTimeEl = this.container.querySelector('#slew-trans-time');
    const gapTimeEl = this.container.querySelector('#slew-gap-time');
    const marginEl = this.container.querySelector('#slew-margin-val');

    // Find any station currently active or transitioning
    let monitoredStation = groundStations[0];
    let activePass = activeSchedule.find(p => tSec >= p.startSec && tSec <= p.endSec);

    // If no active pass, find the upcoming pass
    const upcomingPass = activeSchedule
      .filter(p => p.startSec > tSec)
      .sort((a, b) => a.startSec - b.startSec)[0];

    // Find previous pass
    const previousPass = activeSchedule
      .filter(p => p.endSec <= tSec)
      .sort((a, b) => b.endSec - a.endSec)[0];

    if (activePass) {
      monitoredStation = groundStations.find(gs => gs.id === activePass.stationId) || monitoredStation;
      const progress = (tSec - activePass.startSec) / Math.max(1, activePass.durationSec);
      const curAz = THREE.MathUtils.lerp(activePass.aosAzDeg, activePass.losAzDeg, progress);
      const curEl = THREE.MathUtils.lerp(activePass.aosElDeg, activePass.peakElDeg, Math.sin(progress * Math.PI));

      if (statusBanner) {
        statusBanner.className = 'slew-status-banner status-tracking';
        statusDot.className = 'status-indicator-dot dot-tracking';
        statusText.textContent = `NOMINAL TRACKING: ${activePass.satName} (${activePass.dataRateMbps} Mbps)`;
      }

      if (dishAzVal) dishAzVal.textContent = `${curAz.toFixed(1)}°`;
      if (dishElVal) dishElVal.textContent = `${curEl.toFixed(1)}°`;
      if (stationNameEl) stationNameEl.textContent = `Station: ${monitoredStation.name}`;

      // Tracking angular velocity ~0.4°/s
      const trackingSpeed = 0.38 + 0.15 * Math.sin(progress * 3);
      if (speedValEl) speedValEl.textContent = trackingSpeed.toFixed(2);
      if (speedBar) {
        const pct = Math.min(100, (trackingSpeed / monitoredStation.slewRateDegPerSec) * 100);
        speedBar.style.width = `${pct}%`;
        speedBar.style.backgroundColor = '#00ff9d';
      }

      if (activePass.nextSlewDetails) {
        const det = activePass.nextSlewDetails;
        if (targetTextEl) targetTextEl.textContent = `Next: ${det.targetSatName}`;
        if (deltaDegEl) deltaDegEl.textContent = `${det.angularDistDeg}°`;
        if (transTimeEl) transTimeEl.textContent = `${det.totalRequiredSec}s (slew ${det.slewDurationSec}s + set ${det.settlingTimeSec}s)`;
        if (gapTimeEl) gapTimeEl.textContent = `${det.availableGapSec}s`;
        if (marginEl) {
          marginEl.textContent = `${det.marginSec >= 0 ? '+' : ''}${det.marginSec}s (${det.isFeasible ? 'SAFE' : 'INFEASIBLE'})`;
          marginEl.className = det.isFeasible ? 'metric-val font-mono font-bold text-emerald' : 'metric-val font-mono font-bold text-coral';
        }
      }
    } else if (upcomingPass && previousPass && upcomingPass.stationId === previousPass.stationId) {
      // In transition deadband between passes on same station
      monitoredStation = groundStations.find(gs => gs.id === upcomingPass.stationId) || monitoredStation;
      const slewCalc = computeRequiredSlewTimeSec(
        previousPass.losAzDeg,
        previousPass.losElDeg,
        upcomingPass.aosAzDeg,
        upcomingPass.aosElDeg,
        monitoredStation.slewRateDegPerSec,
        monitoredStation.settlingTimeSec
      );

      const timeSincePrev = tSec - previousPass.endSec;
      const isSlewing = timeSincePrev < slewCalc.slewDurationSec;
      const isSettling = timeSincePrev >= slewCalc.slewDurationSec && timeSincePrev < slewCalc.totalRequiredSec;

      if (statusBanner) {
        if (isSlewing) {
          statusBanner.className = 'slew-status-banner status-slewing';
          statusDot.className = 'status-indicator-dot dot-slewing';
          statusText.textContent = `SLEWING DISH: Repointing to ${upcomingPass.satName} (${monitoredStation.slewRateDegPerSec}°/s)`;
        } else if (isSettling) {
          statusBanner.className = 'slew-status-banner status-settling';
          statusDot.className = 'status-indicator-dot dot-settling';
          statusText.textContent = `CARRIER SETTLING: Locking RF feed (${monitoredStation.settlingTimeSec}s lock duration)`;
        } else {
          statusBanner.className = 'slew-status-banner status-ready';
          statusDot.className = 'status-indicator-dot dot-ready';
          statusText.textContent = `ANTENNA LOCKED: Awaiting AOS for ${upcomingPass.satName}`;
        }
      }

      if (stationNameEl) stationNameEl.textContent = `Station: ${monitoredStation.name}`;
      if (dishAzVal) dishAzVal.textContent = `${upcomingPass.aosAzDeg.toFixed(1)}°`;
      if (dishElVal) dishElVal.textContent = `${upcomingPass.aosElDeg.toFixed(1)}°`;

      const curSpeed = isSlewing ? monitoredStation.slewRateDegPerSec : 0;
      if (speedValEl) speedValEl.textContent = curSpeed.toFixed(2);
      if (speedBar) {
        const pct = Math.min(100, (curSpeed / monitoredStation.slewRateDegPerSec) * 100);
        speedBar.style.width = `${pct}%`;
        speedBar.style.backgroundColor = isSlewing ? '#ffb800' : '#00f0ff';
      }

      const availableGap = upcomingPass.startSec - previousPass.endSec;
      const margin = availableGap - slewCalc.totalRequiredSec;

      if (targetTextEl) targetTextEl.textContent = `Next AOS: ${upcomingPass.satName}`;
      if (deltaDegEl) deltaDegEl.textContent = `${slewCalc.angularDistDeg.toFixed(1)}°`;
      if (transTimeEl) transTimeEl.textContent = `${slewCalc.totalRequiredSec.toFixed(1)}s`;
      if (gapTimeEl) gapTimeEl.textContent = `${availableGap}s`;
      if (marginEl) {
        marginEl.textContent = `${margin >= 0 ? '+' : ''}${margin.toFixed(1)}s (${margin >= 0 ? 'SAFE' : 'VIOLATION'})`;
        marginEl.className = margin >= 0 ? 'metric-val font-mono font-bold text-emerald' : 'metric-val font-mono font-bold text-coral';
      }
    } else {
      // Idle / Standby
      if (statusBanner) {
        statusBanner.className = 'slew-status-banner status-standby';
        statusDot.className = 'status-indicator-dot dot-standby';
        statusText.textContent = 'ANTENNA IDLE / STANDBY';
      }
      if (speedValEl) speedValEl.textContent = '0.00';
      if (speedBar) speedBar.style.width = '0%';
    }

    if (maxSpeedEl) maxSpeedEl.textContent = `Max Slew: ${monitoredStation.slewRateDegPerSec}°/s | Settle: ${monitoredStation.settlingTimeSec}s`;
  }
}
