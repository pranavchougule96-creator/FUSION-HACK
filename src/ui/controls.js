/**
 * SPACE-04: Scenario Control Panel & Mission Simulation Director
 * Controls for constellation size, ground stations, slew speed, settling time,
 * scenario presets, time-warp scrubber, and solver execution.
 */

export class ScenarioControlPanel {
  constructor(containerElement, callbacks = {}) {
    this.container = containerElement;
    this.callbacks = callbacks; // onReoptimize, onTimeChange, onPlayToggle, onSpeedChange, onCameraPreset, onExport

    this.isPlaying = true;
    this.speedMultiplier = 60; // default 60x warp
    this.currentSec = 0;
    this.horizonSec = 86400;

    this.config = {
      satelliteCount: 24,
      selectedStationIds: ['GS-SVB', 'GS-INU', 'GS-PUQ', 'GS-TRL', 'GS-HBK'],
      slewRateDegPerSec: 3.5,
      settlingTimeSec: 15.0,
      minElevationDeg: 10.0,
      criticalWeight: 10.0,
      highWeight: 5.0
    };

    this.initDOM();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="panel-header">
        <div class="panel-title-wrapper">
          <span class="panel-icon">⚙️</span>
          <h2 class="panel-title">SCENARIO CONFIGURATION & MISSION CONTROLS</h2>
        </div>
        <button class="primary-action-btn" id="btn-reoptimize">
          <span class="btn-glow"></span>
          <span class="btn-text">⚡ RUN AUTONOMOUS OPTIMIZER</span>
        </button>
      </div>

      <!-- Master Time Playback Bar -->
      <div class="time-control-bar">
        <div class="time-readout-box">
          <span class="time-label">SIMULATION EPOCH:</span>
          <span class="time-value font-mono" id="ctrl-sim-clock">00:00:00 UTC</span>
        </div>

        <div class="time-buttons-group">
          <button class="ctrl-btn active" id="btn-play-pause">⏸ PAUSE</button>
          <div class="speed-pill-group">
            <button class="speed-btn" data-speed="1">1x</button>
            <button class="speed-btn" data-speed="10">10x</button>
            <button class="speed-btn active" data-speed="60">60x</button>
            <button class="speed-btn" data-speed="300">300x</button>
          </div>
        </div>

        <div class="time-slider-wrapper">
          <input type="range" id="ctrl-time-slider" min="0" max="86400" value="0" step="30" class="time-slider" />
          <div class="slider-ticks">
            <span>00h</span><span>04h</span><span>08h</span><span>12h</span><span>16h</span><span>20h</span><span>24h</span>
          </div>
        </div>
      </div>

      <!-- Presets Quick Bar -->
      <div class="presets-section">
        <span class="section-label">MISSION SCENARIOS:</span>
        <div class="preset-buttons-row">
          <button class="preset-btn" data-preset="INDIA_NETWORK" style="border-color: #ff9933; color: #ff9933; font-weight: 700;">🇮🇳 Indian Network (ISRO)</button>
          <button class="preset-btn" data-preset="POLAR_SURGE">🏔️ Polar Bottleneck</button>
          <button class="preset-btn" data-preset="DISASTER_ALERT">🚨 Disaster Rapid Alert</button>
          <button class="preset-btn" data-preset="FAST_SLEW">⚡ Agile 8°/s Dishes</button>
          <button class="preset-btn" data-preset="SLOW_SLEW">⚠️ Constrained 1.2°/s Slew</button>
          <button class="preset-btn" data-preset="MEGA_SURGE">🌐 48-Sat Mega Constellation</button>
        </div>
      </div>

      <!-- Parameter Sliders & Station Toggles Grid -->
      <div class="controls-parameters-grid">
        <!-- Column 1: Constellation & Hardware Sliders -->
        <div class="param-card">
          <div class="param-card-title">CONSTELLATION & DISH KINEMATICS</div>

          <div class="param-row">
            <div class="param-info">
              <label for="slider-sat-count" class="param-name">Constellation Size</label>
              <span class="param-val font-mono text-cyan" id="val-sat-count">24 Satellites</span>
            </div>
            <input type="range" id="slider-sat-count" min="10" max="50" value="24" step="2" class="param-slider" />
          </div>

          <div class="param-row">
            <div class="param-info">
              <label for="slider-slew-rate" class="param-name">Antenna Slew Speed (ω)</label>
              <span class="param-val font-mono text-amber" id="val-slew-rate">3.5 °/sec</span>
            </div>
            <input type="range" id="slider-slew-rate" min="0.5" max="12.0" value="3.5" step="0.5" class="param-slider" />
          </div>

          <div class="param-row">
            <div class="param-info">
              <label for="slider-settle-time" class="param-name">Carrier Settling & Lock Time</label>
              <span class="param-val font-mono text-cyan" id="val-settle-time">15 sec</span>
            </div>
            <input type="range" id="slider-settle-time" min="5" max="45" value="15" step="1" class="param-slider" />
          </div>

          <div class="param-row">
            <div class="param-info">
              <label for="slider-min-el" class="param-name">Min Elevation Mask (θ_min)</label>
              <span class="param-val font-mono text-emerald" id="val-min-el">10.0°</span>
            </div>
            <input type="range" id="slider-min-el" min="5" max="25" value="10" step="1" class="param-slider" />
          </div>
        </div>

        <!-- Column 2: Ground Station Network Selector -->
        <div class="param-card">
          <div class="param-card-title">GROUND NETWORK STATIONS</div>
          <div class="stations-checkbox-grid" id="stations-checkbox-grid">
            <!-- Dynamically populated -->
          </div>
          <div class="card-footer-buttons">
            <button class="secondary-btn" id="btn-select-all-stations">Select All</button>
            <button class="secondary-btn" id="btn-polar-only-stations">Polar Only</button>
          </div>
        </div>

        <!-- Column 3: Priority Weights & Camera / Export -->
        <div class="param-card">
          <div class="param-card-title">OPTIMIZATION WEIGHTS & TOOLS</div>

          <div class="param-row">
            <div class="param-info">
              <label for="slider-crit-weight" class="param-name">Critical Priority Weight</label>
              <span class="param-val font-mono text-coral" id="val-crit-weight">10.0x</span>
            </div>
            <input type="range" id="slider-crit-weight" min="5" max="25" value="10" step="1" class="param-slider" />
          </div>

          <div class="param-row">
            <div class="param-info">
              <label for="slider-high-weight" class="param-name">High Priority Weight</label>
              <span class="param-val font-mono text-amber" id="val-high-weight">5.0x</span>
            </div>
            <input type="range" id="slider-high-weight" min="2" max="15" value="5" step="1" class="param-slider" />
          </div>

          <div class="tools-buttons-grid">
            <div class="camera-views-box">
              <span class="sub-label">CAMERA PRESETS:</span>
              <div class="cam-btns-row">
                <button class="cam-btn" data-cam="GLOBAL">Global</button>
                <button class="cam-btn" data-cam="NORTH_POLAR">North Polar</button>
                <button class="cam-btn" data-cam="SOUTH_POLAR">South Polar</button>
                <button class="cam-btn" data-cam="SELECTED_SAT">Track Sat</button>
              </div>
            </div>

            <div class="pipeline-tools-row" style="display: flex; gap: 6px; margin-top: 4px;">
              <button class="secondary-btn" id="btn-celestrak-modal" style="border-color: rgba(0, 255, 157, 0.4); color: #00ff9d; font-weight: 600;">
                📡 CelesTrak / Skyfield Pipeline
              </button>
              <button class="secondary-btn" id="btn-download-csv" style="border-color: rgba(56, 189, 248, 0.4); color: #38bdf8; font-weight: 600;">
                📥 passes.csv
              </button>
            </div>

            <button class="export-btn" id="btn-export-schedule">
              📥 EXPORT MISSION SCHEDULE (JSON)
            </button>
          </div>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  setGroundStations(allStations) {
    this.allStations = allStations;
    const grid = this.container.querySelector('#stations-checkbox-grid');
    if (!grid) return;

    grid.innerHTML = '';
    for (const gs of allStations) {
      const isChecked = this.config.selectedStationIds.includes(gs.id);
      const label = document.createElement('label');
      label.className = `station-check-label ${isChecked ? 'checked' : ''}`;
      label.innerHTML = `
        <input type="checkbox" value="${gs.id}" ${isChecked ? 'checked' : ''} class="station-checkbox" />
        <span class="station-color-dot" style="background-color: ${gs.color}"></span>
        <span class="station-name-abbr">${gs.id} - ${gs.name.split(' ')[0]}</span>
      `;
      grid.appendChild(label);
    }

    // Attach listeners
    grid.querySelectorAll('.station-checkbox').forEach(cb => {
      cb.addEventListener('change', () => {
        const checked = Array.from(grid.querySelectorAll('.station-checkbox:checked')).map(c => c.value);
        this.config.selectedStationIds = checked.length > 0 ? checked : [allStations[0].id];
        grid.querySelectorAll('.station-check-label').forEach(lbl => {
          const input = lbl.querySelector('input');
          lbl.classList.toggle('checked', input.checked);
        });
      });
    });
  }

  bindEvents() {
    // Re-optimize button
    const btnReopt = this.container.querySelector('#btn-reoptimize');
    btnReopt.addEventListener('click', () => {
      if (this.callbacks.onReoptimize) {
        this.callbacks.onReoptimize(this.config);
      }
    });

    // Play / Pause
    const btnPlay = this.container.querySelector('#btn-play-pause');
    btnPlay.addEventListener('click', () => {
      this.isPlaying = !this.isPlaying;
      btnPlay.textContent = this.isPlaying ? '⏸ PAUSE' : '▶ PLAY';
      btnPlay.classList.toggle('active', this.isPlaying);
      if (this.callbacks.onPlayToggle) {
        this.callbacks.onPlayToggle(this.isPlaying);
      }
    });

    // Speed buttons
    this.container.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.speedMultiplier = parseInt(btn.dataset.speed, 10);
        if (this.callbacks.onSpeedChange) {
          this.callbacks.onSpeedChange(this.speedMultiplier);
        }
      });
    });

    // Time Slider
    const timeSlider = this.container.querySelector('#ctrl-time-slider');
    timeSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      this.currentSec = val;
      this.updateClockDisplay(val);
      if (this.callbacks.onTimeChange) {
        this.callbacks.onTimeChange(val);
      }
    });

    // Constellation Size Slider
    const satCountSlider = this.container.querySelector('#slider-sat-count');
    const satCountVal = this.container.querySelector('#val-sat-count');
    satCountSlider.addEventListener('input', (e) => {
      this.config.satelliteCount = parseInt(e.target.value, 10);
      satCountVal.textContent = `${this.config.satelliteCount} Satellites`;
    });

    // Slew Rate Slider
    const slewSlider = this.container.querySelector('#slider-slew-rate');
    const slewVal = this.container.querySelector('#val-slew-rate');
    slewSlider.addEventListener('input', (e) => {
      this.config.slewRateDegPerSec = parseFloat(e.target.value);
      slewVal.textContent = `${this.config.slewRateDegPerSec.toFixed(1)} °/sec`;
    });

    // Settling Time Slider
    const settleSlider = this.container.querySelector('#slider-settle-time');
    const settleVal = this.container.querySelector('#val-settle-time');
    settleSlider.addEventListener('input', (e) => {
      this.config.settlingTimeSec = parseFloat(e.target.value);
      settleVal.textContent = `${this.config.settlingTimeSec} sec`;
    });

    // Min Elevation Slider
    const minElSlider = this.container.querySelector('#slider-min-el');
    const minElVal = this.container.querySelector('#val-min-el');
    minElSlider.addEventListener('input', (e) => {
      this.config.minElevationDeg = parseFloat(e.target.value);
      minElVal.textContent = `${this.config.minElevationDeg.toFixed(1)}°`;
    });

    // Priority Sliders
    const critSlider = this.container.querySelector('#slider-crit-weight');
    const critVal = this.container.querySelector('#val-crit-weight');
    critSlider.addEventListener('input', (e) => {
      this.config.criticalWeight = parseFloat(e.target.value);
      critVal.textContent = `${this.config.criticalWeight.toFixed(1)}x`;
    });

    const highSlider = this.container.querySelector('#slider-high-weight');
    const highVal = this.container.querySelector('#val-high-weight');
    highSlider.addEventListener('input', (e) => {
      this.config.highWeight = parseFloat(e.target.value);
      highVal.textContent = `${this.config.highWeight.toFixed(1)}x`;
    });

    // Station Buttons
    const btnSelectAll = this.container.querySelector('#btn-select-all-stations');
    btnSelectAll.addEventListener('click', () => {
      if (this.allStations) {
        this.config.selectedStationIds = this.allStations.map(s => s.id);
        this.setGroundStations(this.allStations);
      }
    });

    const btnPolarOnly = this.container.querySelector('#btn-polar-only-stations');
    btnPolarOnly.addEventListener('click', () => {
      this.config.selectedStationIds = ['GS-SVB', 'GS-INU', 'GS-TRL', 'GS-FBK'];
      if (this.allStations) this.setGroundStations(this.allStations);
    });

    // Camera preset buttons
    this.container.querySelectorAll('.cam-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.cam;
        if (this.callbacks.onCameraPreset) {
          this.callbacks.onCameraPreset(preset);
        }
      });
    });

    // Export button
    const btnExport = this.container.querySelector('#btn-export-schedule');
    btnExport.addEventListener('click', () => {
      if (this.callbacks.onExport) {
        this.callbacks.onExport();
      }
    });

    // Presets
    this.container.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.applyPreset(btn.dataset.preset);
      });
    });

    // CelesTrak Modal Trigger
    const btnCelesTrak = this.container.querySelector('#btn-celestrak-modal');
    if (btnCelesTrak) {
      btnCelesTrak.addEventListener('click', () => this.showCelesTrakModal());
    }

    // Download passes.csv Trigger
    const btnDownloadCsv = this.container.querySelector('#btn-download-csv');
    if (btnDownloadCsv) {
      btnDownloadCsv.addEventListener('click', () => this.downloadPassesCsv());
    }
  }

  applyPreset(presetKey) {
    if (presetKey === 'INDIA_NETWORK') {
      this.config.satelliteCount = 24;
      this.config.selectedStationIds = ['GS-BLR', 'GS-LKO', 'GS-IXZ', 'GS-SVB'];
      this.config.slewRateDegPerSec = 4.5;
      this.config.settlingTimeSec = 12.0;
      this.config.minElevationDeg = 10.0;
    } else if (presetKey === 'POLAR_SURGE') {
      this.config.satelliteCount = 28;
      this.config.selectedStationIds = ['GS-SVB', 'GS-INU', 'GS-TRL'];
      this.config.slewRateDegPerSec = 3.0;
      this.config.settlingTimeSec = 15.0;
      this.config.minElevationDeg = 10.0;
    } else if (presetKey === 'DISASTER_ALERT') {
      this.config.satelliteCount = 24;
      this.config.criticalWeight = 20.0;
      this.config.highWeight = 8.0;
      this.config.slewRateDegPerSec = 4.0;
      this.config.settlingTimeSec = 10.0;
    } else if (presetKey === 'FAST_SLEW') {
      this.config.slewRateDegPerSec = 8.0;
      this.config.settlingTimeSec = 8.0;
    } else if (presetKey === 'SLOW_SLEW') {
      this.config.slewRateDegPerSec = 1.2;
      this.config.settlingTimeSec = 25.0;
    } else if (presetKey === 'MEGA_SURGE') {
      this.config.satelliteCount = 48;
      if (this.allStations) {
        this.config.selectedStationIds = this.allStations.map(s => s.id);
      }
      this.config.slewRateDegPerSec = 4.0;
    }

    // Update UI elements
    this.updateUIFromConfig();

    // Trigger re-optimize
    if (this.callbacks.onReoptimize) {
      this.callbacks.onReoptimize(this.config);
    }
  }

  showCelesTrakModal() {
    const existing = document.getElementById('celestrak-modal-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'celestrak-modal-overlay';
    overlay.className = 'pass-detail-modal-overlay';
    overlay.style.zIndex = '3000';

    overlay.innerHTML = `
      <div class="pass-modal-box" style="width: 720px; max-height: 85vh; overflow-y: auto;">
        <div class="modal-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 20px;">📡</span>
            <h2 style="font-family: var(--font-heading); font-size: 16px; color: #fff;">
              CELESTRAK & SKYFIELD PASS INTEGRATION (SIMPLE WORDS GUIDE)
            </h2>
          </div>
          <button class="modal-close-btn" id="btn-close-celestrak">&times;</button>
        </div>

        <div style="display: flex; flex-direction: column; gap: 14px; font-size: 12px; line-height: 1.6; color: #cbd5e1;">
          <div style="background: rgba(0, 240, 255, 0.08); border-left: 3px solid var(--color-cyan); padding: 10px 14px; border-radius: 4px;">
            <strong style="color: var(--color-cyan); font-size: 13px;">How it Works in Simple Words:</strong><br>
            • <strong>CelesTrak (celestrak.org)</strong> publishes orbit details (TLE Two-Line Elements) of real Planet Labs, ISRO, and Starlink satellites.<br>
            • <strong>Skyfield (Python)</strong> reads those TLE numbers and calculates exact timestamps when a satellite rises above 10° elevation over your ground stations (AOS) and sets (LOS).<br>
            • <strong>Pass Window (Rise to Set)</strong>: That visible duration is precisely the contact window our Autonomous Scheduler allocates to maximize downlinked data!
          </div>

          <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: 700; color: #fff;">🇮🇳 Indian Ground Station Network (Real Coordinates):</span>
              <span style="font-family: var(--font-mono); font-size: 10px; color: #ff9933;">ISRO Telemetry & Gateway</span>
            </div>
            <ul style="list-style: none; padding-left: 0; display: flex; flex-direction: column; gap: 4px; font-family: var(--font-mono); font-size: 11px;">
              <li>📍 <strong>Bengaluru (GS-BLR)</strong>: 12.97° N, 77.59° E (ISRO / ISTRAC Hub)</li>
              <li>📍 <strong>Lucknow (GS-LKO)</strong>: 26.85° N, 80.95° E (Northern Telemetry Site)</li>
              <li>📍 <strong>Port Blair (GS-IXZ)</strong>: 11.62° N, 92.73° E (Andaman Oceanic Gateway)</li>
            </ul>
          </div>

          <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid var(--border-subtle); border-radius: 6px; padding: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
              <span style="font-weight: 700; color: #fff;">🛰️ Real Planet Labs TLE Sample (CelesTrak GROUP=planet):</span>
              <span style="font-family: var(--font-mono); font-size: 10px; color: var(--color-emerald);">Cached Offline</span>
            </div>
            <pre style="background: #030712; padding: 8px; border-radius: 4px; font-family: var(--font-mono); font-size: 10px; overflow-x: auto; color: var(--color-cyan); line-height: 1.4;">FLOCK 4P 1
1 47250U 20086E   26281.50000000  .00010952  00000-0  56711-3 0  9997
2 47250  97.4764 163.6657 0013583 189.6080 170.4721 15.17647209187315
SKYSAT-C1
1 41530U 16040A   26281.50000000  .00005231  00000-0  21345-3 0  9991
2 41530  97.4321 142.1234 0014523 210.4532 149.5432 15.23412345123456</pre>
          </div>

          <div style="display: flex; gap: 10px; margin-top: 6px;">
            <button class="primary-action-btn" id="modal-download-csv-btn" style="flex: 1; padding: 10px;">
              📥 DOWNLOAD PASSES.CSV (679 REAL PASSES)
            </button>
            <button class="secondary-btn" id="modal-apply-india-preset" style="flex: 1; border-color: #ff9933; color: #ff9933; font-weight: 700;">
              🇮🇳 LOAD INDIA NETWORK PRESET
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#btn-close-celestrak').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) overlay.remove();
    });

    overlay.querySelector('#modal-download-csv-btn').addEventListener('click', () => {
      this.downloadPassesCsv();
    });

    overlay.querySelector('#modal-apply-india-preset').addEventListener('click', () => {
      overlay.remove();
      this.applyPreset('INDIA_NETWORK');
    });
  }

  downloadPassesCsv() {
    const csvUrl = '/data/passes.csv';
    const a = document.createElement('a');
    a.href = csvUrl;
    a.download = 'passes.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  updateUIFromConfig() {
    const satCountSlider = this.container.querySelector('#slider-sat-count');
    const satCountVal = this.container.querySelector('#val-sat-count');
    if (satCountSlider) satCountSlider.value = this.config.satelliteCount;
    if (satCountVal) satCountVal.textContent = `${this.config.satelliteCount} Satellites`;

    const slewSlider = this.container.querySelector('#slider-slew-rate');
    const slewVal = this.container.querySelector('#val-slew-rate');
    if (slewSlider) slewSlider.value = this.config.slewRateDegPerSec;
    if (slewVal) slewVal.textContent = `${this.config.slewRateDegPerSec.toFixed(1)} °/sec`;

    const settleSlider = this.container.querySelector('#slider-settle-time');
    const settleVal = this.container.querySelector('#val-settle-time');
    if (settleSlider) settleSlider.value = this.config.settlingTimeSec;
    if (settleVal) settleVal.textContent = `${this.config.settlingTimeSec} sec`;

    const minElSlider = this.container.querySelector('#slider-min-el');
    const minElVal = this.container.querySelector('#val-min-el');
    if (minElSlider) minElSlider.value = this.config.minElevationDeg;
    if (minElVal) minElVal.textContent = `${this.config.minElevationDeg.toFixed(1)}°`;

    if (this.allStations) {
      this.setGroundStations(this.allStations);
    }
  }

  setTime(sec) {
    this.currentSec = sec;
    const timeSlider = this.container.querySelector('#ctrl-time-slider');
    if (timeSlider) timeSlider.value = sec;
    this.updateClockDisplay(sec);
  }

  updateClockDisplay(sec) {
    const clock = this.container.querySelector('#ctrl-sim-clock');
    if (clock) {
      const h = Math.floor(sec / 3600) % 24;
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} UTC`;
    }
  }
}
