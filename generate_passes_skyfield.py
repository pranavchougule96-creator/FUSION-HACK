#!/usr/bin/env python3
"""
SPACE-04: CelesTrak & Skyfield Pass Generator
Calculates high-precision orbital pass windows for Planet Labs satellites (Flock, SkySat, Pelican)
over Indian Ground Stations (Bengaluru, Lucknow, Port Blair) & Global Stations.
"""

import os
import csv
import json
from datetime import datetime, timezone, timedelta

# Ground Station Network Definitions (ISRO / Indian Network + Polar Gateways)
GROUND_STATIONS = [
    {
        "id": "GS-BLR",
        "name": "Bengaluru Ground Station",
        "agency": "ISRO / ISTRAC Hub",
        "lat": 12.9716,
        "lon": 77.5946,
        "alt_m": 920.0,
        "min_elevation_deg": 10.0,
        "slew_rate_deg_s": 4.5,
        "settling_time_s": 12.0
    },
    {
        "id": "GS-LKO",
        "name": "Lucknow Telemetry Station",
        "agency": "ISRO Telemetry & Tracking",
        "lat": 26.8467,
        "lon": 80.9462,
        "alt_m": 123.0,
        "min_elevation_deg": 10.0,
        "slew_rate_deg_s": 4.0,
        "settling_time_s": 12.0
    },
    {
        "id": "GS-IXZ",
        "name": "Port Blair Ground Gateway",
        "agency": "Andaman & Nicobar Gateway",
        "lat": 11.6234,
        "lon": 92.7265,
        "alt_m": 16.0,
        "min_elevation_deg": 10.0,
        "slew_rate_deg_s": 5.0,
        "settling_time_s": 10.0
    },
    {
        "id": "GS-SVB",
        "name": "Svalbard Ground Station",
        "agency": "Arctic High Revisit",
        "lat": 78.2298,
        "lon": 15.4078,
        "alt_m": 450.0,
        "min_elevation_deg": 10.0,
        "slew_rate_deg_s": 3.5,
        "settling_time_s": 12.0
    },
    {
        "id": "GS-INU",
        "name": "Inuvik Satellite Station",
        "agency": "Polar North America",
        "lat": 68.3607,
        "lon": -133.7230,
        "alt_m": 100.0,
        "min_elevation_deg": 10.0,
        "slew_rate_deg_s": 3.0,
        "settling_time_s": 15.0
    }
]

# Priority & Radio Specs for Planet Labs Fleet
SATELLITE_PROFILES = {
    "PELICAN": {"priority": "CRITICAL", "weight": 10.0, "rate_mbps": 1800, "capacity_gb": 1024},
    "TANAGER": {"priority": "CRITICAL", "weight": 10.0, "rate_mbps": 1600, "capacity_gb": 1024},
    "SKYSAT":  {"priority": "HIGH",     "weight": 5.0,  "rate_mbps": 1200, "capacity_gb": 768},
    "FLOCK 4P": {"priority": "MEDIUM",   "weight": 2.5,  "rate_mbps": 800,  "capacity_gb": 512},
    "FLOCK 4S": {"priority": "LOW",      "weight": 1.0,  "rate_mbps": 600,  "capacity_gb": 512}
}

def get_satellite_profile(sat_name):
    upper = sat_name.upper()
    for prefix, prof in SATELLITE_PROFILES.items():
        if prefix in upper:
            return prof
    return {"priority": "MEDIUM", "weight": 2.5, "rate_mbps": 800, "capacity_gb": 512}

def run_skyfield_pipeline():
    try:
        from skyfield.api import load, wgs84
        print("✓ Skyfield library loaded successfully.")
    except ImportError:
        print("⚠️ Skyfield not installed. Run: pip install skyfield")
        return False

    script_dir = os.path.dirname(os.path.abspath(__file__))
    local_tle_path = os.path.join(script_dir, "data", "planet_tle.txt")

    # Load TLEs from local cache first to avoid CelesTrak rate-limiting
    if os.path.exists(local_tle_path):
        print(f"✓ Loading cached Planet Labs TLEs from {local_tle_path}...")
        sats = load.tle_file(local_tle_path)
    else:
        url = "https://celestrak.org/NORAD/elements/gp.php?GROUP=planet&FORMAT=tle"
        print(f"🌐 Fetching live TLEs from CelesTrak: {url} ...")
        sats = load.tle_file(url)

    print(f"✓ Parsed {len(sats)} Planet Labs satellites.")

    ts = load.timescale()
    t_start = datetime.now(timezone.utc)
    t_end = t_start + timedelta(hours=24)

    t0 = ts.from_datetime(t_start)
    t1 = ts.from_datetime(t_end)

    passes = []
    pass_id = 1

    for station in GROUND_STATIONS:
        st_topo = wgs84.latlon(station["lat"], station["lon"], elevation_m=station["alt_m"])
        min_el = station["min_elevation_deg"]

        for sat in sats:
            times, events = sat.find_events(st_topo, t0, t1, altitude_degrees=min_el)
            
            # Events: 0 = rise (AOS), 1 = culm (Peak), 2 = set (LOS)
            i = 0
            while i < len(events):
                if events[i] == 0:  # Rise
                    aos_time = times[i]
                    peak_el = min_el
                    los_time = None

                    # Find peak and set
                    j = i + 1
                    while j < len(events) and events[j] != 0:
                        if events[j] == 1:
                            # Peak culm
                            difference = sat - st_topo
                            topocentric = difference.at(times[j])
                            alt, az, distance = topocentric.altaz()
                            peak_el = round(alt.degrees, 1)
                        elif events[j] == 2:
                            los_time = times[j]
                            break
                        j += 1

                    if los_time:
                        duration_sec = int((los_time.utc_datetime() - aos_time.utc_datetime()).total_seconds())
                        if duration_sec >= 60:
                            prof = get_satellite_profile(sat.name)
                            rate_mbps = prof["rate_mbps"]
                            data_gb = round((rate_mbps * duration_sec) / 8000.0, 2)

                            passes.append({
                                "request_id": f"REQ-{pass_id:04d}",
                                "satellite_name": sat.name,
                                "station_id": station["id"],
                                "station_name": station["name"],
                                "agency": station["agency"],
                                "aos_utc": aos_time.utc_iso(),
                                "los_utc": los_time.utc_iso(),
                                "duration_seconds": duration_sec,
                                "peak_elevation_deg": peak_el,
                                "priority": prof["priority"],
                                "priority_weight": prof["weight"],
                                "data_rate_mbps": rate_mbps,
                                "potential_data_gb": data_gb
                            })
                            pass_id += 1
                    i = j
                else:
                    i += 1

    # Save CSV
    csv_path = os.path.join(script_dir, "data", "passes.csv")
    os.makedirs(os.path.dirname(csv_path), exist_ok=True)
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(passes[0].keys()))
        writer.writeheader()
        writer.writerows(passes)

    # Save JSON
    json_path = os.path.join(script_dir, "data", "passes.json")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(passes, f, indent=2)

    print(f"🎉 Generated {len(passes)} contact passes across Indian & Global ground stations!")
    print(f"   CSV File:  {csv_path}")
    print(f"   JSON File: {json_path}")
    return True

if __name__ == "__main__":
    run_skyfield_pipeline()
