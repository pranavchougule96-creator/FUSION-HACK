/**
 * SPACE-04: Ground Station Antenna Slew Dynamics & Maneuver Feasibility
 * Strict angular geometry, slew velocity constraints, and carrier lock settling physics.
 */

/**
 * Convert Azimuth and Elevation angles in degrees to a 3D unit direction vector in local ENU frame.
 * Azimuth: clockwise from North (0° = North, 90° = East)
 * Elevation: above horizon (0° = Horizon, 90° = Zenith)
 */
export function azElToUnitVector(azDeg, elDeg) {
  const azRad = (azDeg * Math.PI) / 180;
  const elRad = (elDeg * Math.PI) / 180;

  const cosEl = Math.cos(elRad);
  const sinEl = Math.sin(elRad);
  const sinAz = Math.sin(azRad);
  const cosAz = Math.cos(azRad);

  // ENU: East, North, Up
  const east = cosEl * sinAz;
  const north = cosEl * cosAz;
  const up = sinEl;

  return [east, north, up];
}

/**
 * Compute the spherical angular separation (great-circle angle in degrees)
 * between two antenna pointing vectors (Az1, El1) and (Az2, El2).
 */
export function computeAngularDistanceDeg(az1Deg, el1Deg, az2Deg, el2Deg) {
  const u1 = azElToUnitVector(az1Deg, el1Deg);
  const u2 = azElToUnitVector(az2Deg, el2Deg);

  // Dot product
  const dot = u1[0] * u2[0] + u1[1] * u2[1] + u1[2] * u2[2];
  const clampedDot = Math.max(-1.0, Math.min(1.0, dot));

  const angleRad = Math.acos(clampedDot);
  return (angleRad * 180) / Math.PI;
}

/**
 * Compute required slew transition time between two pointing angles.
 * T_trans = (angular_distance / slew_rate) + settling_time
 */
export function computeRequiredSlewTimeSec(
  az1Deg,
  el1Deg,
  az2Deg,
  el2Deg,
  slewRateDegPerSec = 3.0,
  settlingTimeSec = 15.0
) {
  const angularDistDeg = computeAngularDistanceDeg(az1Deg, el1Deg, az2Deg, el2Deg);
  const slewDurationSec = angularDistDeg / Math.max(0.1, slewRateDegPerSec);
  const totalRequiredSec = slewDurationSec + settlingTimeSec;

  return {
    angularDistDeg,
    slewDurationSec,
    settlingTimeSec,
    totalRequiredSec
  };
}

/**
 * Assess slew transition feasibility between pass 1 (LOS) and pass 2 (AOS).
 */
export function evaluateSlewFeasibility(pass1, pass2, groundStation) {
  const timeGapSec = pass2.startSec - pass1.endSec;
  
  const slewCalc = computeRequiredSlewTimeSec(
    pass1.losAzDeg,
    pass1.losElDeg,
    pass2.aosAzDeg,
    pass2.aosElDeg,
    groundStation.slewRateDegPerSec,
    groundStation.settlingTimeSec
  );

  const marginSec = timeGapSec - slewCalc.totalRequiredSec;
  const isFeasible = marginSec >= 0;

  return {
    timeGapSec,
    ...slewCalc,
    marginSec,
    isFeasible,
    status: isFeasible
      ? marginSec > 30 ? 'SAFE' : 'TIGHT_MARGIN'
      : 'INFEASIBLE_COLLISION'
  };
}
