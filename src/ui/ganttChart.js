/**
 * SPACE-04: Interactive Multi-Track Timetable & Gantt Chart
 * High-performance timeline visualization of ground station passes with priority coding,
 * slew transition deadbands, time scrubber, and side-by-side / diff overlay modes.
 */

export class MultiTrackGanttChart {
  constructor(containerElement, onSeekCallback = null, onPassClickCallback = null) {
    this.container = containerElement;
    this.onSeek = onSeekCallback;
    this.onPassClick = onPassClickCallback;

    this.groundStations = [];
    this.optimizedResult = null;
    this.fcfsResult = null;
    this.viewMode = 'OPTIMIZED'; // 'OPTIMIZED' | 'FCFS' | 'DIFF_OVERLAY'

    this.horizonSec = 86400; // 24 hours
    this.currentSec = 0;
    this.selectedPassId = null;

    this.initDOM();
  }

  initDOM() {
    this.container.innerHTML = `
      <div class="panel-header">
        <div class="panel-title-wrapper">
          <span class="panel-icon">📊</span>
          <h2 class="panel-title">MULTI-TRACK TIMETABLE / GANTT SCHEDULER</h2>
        </div>
        <div class="gantt-view-toggles">
          <span class="toggle-label">SCHEDULE VIEW:</span>
          <div class="pill-group">
            <button class="pill-btn active" data-mode="OPTIMIZED" id="btn-mode-opt">
              <span class="pill-dot dot-opt"></span> OPTIMIZED (ILP)
            </button>
            <button class="pill-btn" data-mode="FCFS" id="btn-mode-fcfs">
              <span class="pill-dot dot-fcfs"></span> FCFS BASELINE
            </button>
            <button class="pill-btn" data-mode="DIFF_OVERLAY" id="btn-mode-diff">
              <span class="pill-dot dot-diff"></span> DIFF COMPARISON
            </button>
          </div>
        </div>
      </div>

      <!-- Priority Legend -->
      <div class="gantt-legend-bar">
        <div class="legend-item"><span class="legend-swatch legend-crit"></span> CRITICAL (10x)</div>
        <div class="legend-item"><span class="legend-swatch legend-high"></span> HIGH (5x)</div>
        <div class="legend-item"><span class="legend-swatch legend-med"></span> MEDIUM (2.5x)</div>
        <div class="legend-item"><span class="legend-swatch legend-low"></span> LOW (1.0x)</div>
        <div class="legend-item"><span class="legend-swatch legend-slew"></span> SLEW TRANSITION</div>
        <div class="legend-item"><span class="legend-swatch legend-dropped"></span> FCFS DROPPED</div>
      </div>

      <!-- Gantt Viewport Container -->
      <div class="gantt-viewport" id="gantt-viewport">
        <!-- Time Scale Header -->
        <div class="gantt-timescale-track" id="gantt-timescale"></div>

        <!-- Tracks Container -->
        <div class="gantt-tracks-container" id="gantt-tracks-container"></div>

        <!-- Vertical Current Time Scrubber Line -->
        <div class="gantt-scrubber-line" id="gantt-scrubber-line">
          <div class="scrubber-head" id="gantt-scrubber-label">00:00:00</div>
        </div>
      </div>

      <!-- Tooltip Popover -->
      <div class="gantt-tooltip" id="gantt-tooltip" style="display: none;"></div>
    `;

    // View toggle listeners
    this.container.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const mode = btn.dataset.mode;
        this.setViewMode(mode);
      });
    });

    // Time scrubber drag / click on timeline
    const viewport = this.container.querySelector('#gantt-viewport');
    viewport.addEventListener('click', (e) => {
      const rect = viewport.getBoundingClientRect();
      const clickX = e.clientX - rect.left - 180; // track label offset
      const trackWidth = rect.width - 180;
      if (clickX >= 0 && trackWidth > 0) {
        const fraction = Math.max(0, Math.min(1, clickX / trackWidth));
        const targetSec = Math.round(fraction * this.horizonSec);
        if (this.onSeek) {
          this.onSeek(targetSec);
        }
      }
    });
  }

  setData(groundStations, optimizedResult, fcfsResult, horizonSec = 86400) {
    this.groundStations = groundStations;
    this.optimizedResult = optimizedResult;
    this.fcfsResult = fcfsResult;
    this.horizonSec = horizonSec;

    this.render();
  }

  setViewMode(mode) {
    this.viewMode = mode;
    this.container.querySelectorAll('.pill-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    this.render();
  }

  render() {
    this.renderTimescale();
    this.renderTracks();
    this.updateScrubber(this.currentSec);
  }

  renderTimescale() {
    const scaleEl = this.container.querySelector('#gantt-timescale');
    if (!scaleEl) return;

    let html = `<div class="track-header-spacer">STATION TRACK</div>`;
    html += `<div class="timescale-ticks-wrapper">`;

    // 24 hours: 1 tick every 2 hours
    const hours = this.horizonSec / 3600;
    for (let h = 0; h <= hours; h += 2) {
      const leftPct = (h / hours) * 100;
      const timeStr = `${String(h).padStart(2, '0')}:00 UTC`;
      html += `
        <div class="timescale-tick" style="left: ${leftPct}%;">
          <span class="tick-line"></span>
          <span class="tick-label">${timeStr}</span>
        </div>
      `;
    }
    html += `</div>`;
    scaleEl.innerHTML = html;
  }

  renderTracks() {
    const tracksContainer = this.container.querySelector('#gantt-tracks-container');
    if (!tracksContainer) return;

    tracksContainer.innerHTML = '';

    for (const gs of this.groundStations) {
      const trackEl = document.createElement('div');
      trackEl.className = 'gantt-station-track';

      // Left Track Header
      const headerEl = document.createElement('div');
      headerEl.className = 'track-label-col';
      headerEl.innerHTML = `
        <div class="station-badge" style="border-left-color: ${gs.color};">
          <span class="station-code font-mono">${gs.id}</span>
          <span class="station-name-text">${gs.name}</span>
          <span class="station-slew-rate font-mono">ω: ${gs.slewRateDegPerSec}°/s</span>
        </div>
      `;
      trackEl.appendChild(headerEl);

      // Track Timeline Body
      const timelineEl = document.createElement('div');
      timelineEl.className = 'track-timeline-body';
      timelineEl.dataset.stationId = gs.id;

      // Filter passes for this station based on view mode
      this.populateTrackPasses(timelineEl, gs);

      trackEl.appendChild(timelineEl);
      tracksContainer.appendChild(trackEl);
    }
  }

  populateTrackPasses(timelineEl, groundStation) {
    const stId = groundStation.id;

    if (this.viewMode === 'OPTIMIZED' && this.optimizedResult) {
      const passes = this.optimizedResult.scheduled.filter(p => p.stationId === stId);
      this.renderPassList(timelineEl, passes, false);
      this.renderSlewTransitions(timelineEl, passes, groundStation);
    } else if (this.viewMode === 'FCFS' && this.fcfsResult) {
      const scheduled = this.fcfsResult.scheduled.filter(p => p.stationId === stId);
      const dropped = this.fcfsResult.rejected.filter(p => p.stationId === stId);
      this.renderPassList(timelineEl, scheduled, false);
      this.renderPassList(timelineEl, dropped, true);
      this.renderSlewTransitions(timelineEl, scheduled, groundStation);
    } else if (this.viewMode === 'DIFF_OVERLAY' && this.optimizedResult && this.fcfsResult) {
      // Show optimized scheduled, plus highlight passes that FCFS dropped but Optimizer scheduled!
      const optScheduled = this.optimizedResult.scheduled.filter(p => p.stationId === stId);
      const fcfsDropped = this.fcfsResult.rejected.filter(p => p.stationId === stId);

      this.renderPassList(timelineEl, optScheduled, false, fcfsDropped);
      this.renderSlewTransitions(timelineEl, optScheduled, groundStation);
    }
  }

  renderPassList(timelineEl, passes, isDropped = false, diffDroppedList = []) {
    const droppedIds = new Set(diffDroppedList.map(d => d.id));

    passes.forEach(p => {
      const leftPct = (p.startSec / this.horizonSec) * 100;
      const widthPct = Math.max(0.4, (p.durationSec / this.horizonSec) * 100);

      const passBlock = document.createElement('div');
      passBlock.className = `gantt-pass-block priority-${p.priority.toLowerCase()} ${isDropped ? 'pass-dropped' : ''}`;
      
      const isSalvaged = !isDropped && droppedIds.has(p.id);
      if (isSalvaged) {
        passBlock.classList.add('pass-salvaged-diff');
      }

      passBlock.style.left = `${leftPct}%`;
      passBlock.style.width = `${widthPct}%`;
      passBlock.style.backgroundColor = isDropped ? 'rgba(255, 59, 105, 0.2)' : p.color;

      passBlock.innerHTML = `
        <div class="pass-block-inner">
          <span class="pass-sat-title">${p.satName}</span>
          <span class="pass-meta-badge font-mono">${p.actualDataGB ? p.actualDataGB + ' GB' : p.priority}</span>
          ${isSalvaged ? '<span class="diff-salvage-tag">SAVED</span>' : ''}
        </div>
      `;

      // Event listeners
      passBlock.addEventListener('mouseenter', (e) => this.showTooltip(e, p, isDropped, isSalvaged));
      passBlock.addEventListener('mouseleave', () => this.hideTooltip());
      passBlock.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedPassId = p.id;
        if (this.onPassClick) this.onPassClick(p);
        if (this.onSeek) this.onSeek(p.startSec);
      });

      timelineEl.appendChild(passBlock);
    });
  }

  renderSlewTransitions(timelineEl, passes, groundStation) {
    const sorted = [...passes].sort((a, b) => a.startSec - b.startSec);

    for (let i = 0; i < sorted.length - 1; i++) {
      const cur = sorted[i];
      const next = sorted[i + 1];

      const gapSec = next.startSec - cur.endSec;
      if (gapSec <= 0) continue;

      const leftPct = (cur.endSec / this.horizonSec) * 100;
      const widthPct = (gapSec / this.horizonSec) * 100;

      if (widthPct > 0.2) {
        const slewBlock = document.createElement('div');
        slewBlock.className = 'gantt-slew-deadband';
        slewBlock.style.left = `${leftPct}%`;
        slewBlock.style.width = `${widthPct}%`;

        if (cur.nextSlewDetails) {
          slewBlock.title = `Slew: ${cur.nextSlewDetails.angularDistDeg}° in ${cur.nextSlewDetails.totalRequiredSec}s (Margin: ${cur.nextSlewDetails.marginSec}s)`;
        }

        timelineEl.appendChild(slewBlock);
      }
    }
  }

  showTooltip(event, pass, isDropped = false, isSalvaged = false) {
    const tooltip = this.container.querySelector('#gantt-tooltip');
    if (!tooltip) return;

    const startH = formatSecToUTC(pass.startSec);
    const endH = formatSecToUTC(pass.endSec);

    tooltip.innerHTML = `
      <div class="tooltip-header">
        <span class="tooltip-badge priority-${pass.priority.toLowerCase()}">${pass.priority}</span>
        <span class="tooltip-id font-mono">${pass.id}</span>
      </div>
      <div class="tooltip-title">${pass.satName} <span class="text-dim">(${pass.satType})</span></div>
      <div class="tooltip-station">Station: <strong>${pass.stationName}</strong></div>
      
      <div class="tooltip-grid">
        <div class="t-item"><span class="t-k">Window:</span><span class="t-v font-mono">${startH} - ${endH}</span></div>
        <div class="t-item"><span class="t-k">Duration:</span><span class="t-v font-mono">${pass.durationSec}s</span></div>
        <div class="t-item"><span class="t-k">Peak El:</span><span class="t-v font-mono">${pass.peakElDeg}°</span></div>
        <div class="t-item"><span class="t-k">Rate:</span><span class="t-v font-mono">${pass.dataRateMbps} Mbps</span></div>
        <div class="t-item"><span class="t-k">Downlinked:</span><span class="t-v font-mono font-bold text-emerald">${pass.actualDataGB || pass.potentialDataGB} GB</span></div>
        <div class="t-item"><span class="t-k">Priority Weight:</span><span class="t-v font-mono">${pass.priorityWeight}x</span></div>
      </div>

      ${isDropped ? `
        <div class="tooltip-conflict-box">
          <div class="conflict-title">⚠️ FCFS CONFLICT REJECTION</div>
          <div class="conflict-desc">${pass.reason || 'Slew collision / dish overlap'}</div>
          <div class="conflict-sub text-dim">${pass.conflictDetails || ''}</div>
        </div>
      ` : ''}

      ${isSalvaged ? `
        <div class="tooltip-salvage-box">
          <div class="salvage-title">✨ SALVAGED BY AUTONOMOUS OPTIMIZER</div>
          <div class="salvage-desc">Prioritized over lower-tier passes with zero slew violation!</div>
        </div>
      ` : ''}

      ${pass.nextSlewDetails ? `
        <div class="tooltip-slew-box">
          <div class="slew-title">Antenna Slew Maneuver to ${pass.nextSlewDetails.targetSatName}:</div>
          <div class="slew-sub font-mono">Δθ: ${pass.nextSlewDetails.angularDistDeg}° | Slew+Settle: ${pass.nextSlewDetails.totalRequiredSec}s | Gap: ${pass.nextSlewDetails.availableGapSec}s</div>
          <div class="slew-margin font-mono font-bold ${pass.nextSlewDetails.isFeasible ? 'text-emerald' : 'text-coral'}">
            Safety Margin: ${pass.nextSlewDetails.marginSec >= 0 ? '+' : ''}${pass.nextSlewDetails.marginSec}s (${pass.nextSlewDetails.isFeasible ? 'SAFE' : 'INFEASIBLE'})
          </div>
        </div>
      ` : ''}
    `;

    tooltip.style.display = 'block';
    const x = Math.min(window.innerWidth - 320, event.clientX + 15);
    const y = Math.min(window.innerHeight - 300, event.clientY + 15);
    tooltip.style.left = `${x}px`;
    tooltip.style.top = `${y}px`;
  }

  hideTooltip() {
    const tooltip = this.container.querySelector('#gantt-tooltip');
    if (tooltip) tooltip.style.display = 'none';
  }

  updateScrubber(currentSec) {
    this.currentSec = currentSec;
    const scrubberLine = this.container.querySelector('#gantt-scrubber-line');
    const scrubberLabel = this.container.querySelector('#gantt-scrubber-label');
    if (!scrubberLine) return;

    const fraction = Math.max(0, Math.min(1, currentSec / this.horizonSec));
    // Offset by 180px for track headers
    const viewport = this.container.querySelector('#gantt-viewport');
    if (viewport) {
      const width = viewport.clientWidth - 180;
      const leftPx = 180 + fraction * width;
      scrubberLine.style.left = `${leftPx}px`;
    }

    if (scrubberLabel) {
      scrubberLabel.textContent = formatSecToUTC(currentSec);
    }
  }
}

function formatSecToUTC(sec) {
  const h = Math.floor(sec / 3600) % 24;
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} UTC`;
}
