// Frontend API client for Orbit Shield
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api';

async function apiGet(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(`API GET ${path} failed: ${res.status}`);
  return res.json();
}

export async function fetchSatellites({ all = true, limit } = {}) {
  const qs = all ? '?all=true' : (limit ? `?limit=${limit}` : '');
  const data = await apiGet(`/satellites${qs}`);
  return data?.data || [];
}

export async function fetchDebris({ all = true, limit } = {}) {
  const qs = all ? '?all=true' : (limit ? `?limit=${limit}` : '');
  const data = await apiGet(`/debris${qs}`);
  return data?.data || [];
}

export async function fetchSatelliteAnalysis(id, topN = 3) {
  const data = await apiGet(`/satellite-analysis/analyze/${id}?top_n=${topN}&include_maneuver=true`);
  return data?.data || null;
}

// Fetch satellite context: nearest debris + risk (topN debris)
export async function fetchSatelliteContext(id, topN = 3) {
  const data = await apiGet(`/satellite-analysis/analyze/${id}?top_n=${topN}&include_maneuver=true`);
  return data?.data || null;
}

export async function fetchAlerts() {
  const data = await apiGet('/alerts');
  return data?.data || [];
}

export async function fetchHighRisk(threshold = 0.7) {
  const data = await apiGet(`/satellite-analysis/high-risk?risk_threshold=${threshold}&limit=10`);
  return data?.data || { high_risk_satellites: [] };
}

async function apiPost(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`API POST ${path} failed: ${res.status}`);
  return res.json();
}

export async function planManeuver(satelliteId, distanceKm) {
  const body = {
    satellite_id: satelliteId,
    threat_data: {
      distance_km: distanceKm,
      satellite_position: { x: 0, y: 0, z: 400 },
      satellite_velocity: { vx: 7.5, vy: 0, vz: 0 },
      threat_direction: { x: 1, y: 0, z: 0 }
    }
  };
  const data = await apiPost('/maneuvers/plan', body);
  return data?.data || null;
}

export async function simulateManeuver(satelliteId, distanceKm, maneuver) {
  const body = {
    satellite_id: satelliteId,
    threat_data: { distance_km: distanceKm },
    maneuver: maneuver || null
  };
  const data = await apiPost('/maneuvers/simulate', body);
  return data?.data || null;
}

export async function analyzeSandbox(satelliteId, params) {
  const body = {
    satellite_id: satelliteId,
    altitude_km: params.altitude_km,
    latitude: params.latitude,
    longitude: params.longitude,
    top_n: 3
  };
  const res = await fetch(`${API_BASE}/satellite-analysis/analyze-sandbox`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error('Sandbox analyze failed');
  const data = await res.json();
  return data?.data || null;
}

export async function fetchCollisionEventsForSimulator(satId, debId = null) {
  const params = new URLSearchParams({ sat_id: satId });
  if (debId) params.append('deb_id', debId);
  const data = await apiGet(`/collision-events/for-simulator?${params.toString()}`);
  return data?.data || [];
}
