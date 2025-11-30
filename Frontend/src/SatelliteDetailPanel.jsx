import React from 'react';
import { useNavigate } from 'react-router-dom';
import { planManeuver } from './api/client';

function formatValue(val) {
  if (val == null) return '';
  if (typeof val === 'number') return Number.isFinite(val) ? (Math.round(val * 100) / 100).toString() : String(val);
  if (typeof val === 'boolean') return val ? 'true' : 'false';
  if (typeof val === 'string') return val;
  try {
    return JSON.stringify(val, null, 2);
  } catch (e) {
    return String(val);
  }
}

function SatelliteDetailPanel({ satellite, analysis, onClose, focusMode, onToggleFocus }) {
  if (!satellite) return null;
  const navigate = useNavigate();
  const aSat = analysis?.sat?.id === satellite.id ? analysis?.sat : satellite;
  const nearest = analysis?.nearest?.[0];
  const distanceKm = nearest?.distance_now_km;

  async function handlePlan() {
    if (!satellite || !nearest) return;
    // Navigate to ManeuverPlannerPage with REAL satellite and debris data
    sessionStorage.setItem('maneuverSatellite', JSON.stringify(satellite));
    sessionStorage.setItem('maneuverDebris', JSON.stringify([nearest]));
    
    navigate('/maneuver-planner', {
      state: {
        satellite,
        debris: [nearest],
        collisionProbability: nearest.model1_risk?.probability || 0,
        distance: nearest.distance_now_km || 0
      }
    });
  }

  function handleSimulateCollision() {
    if (!satellite) return;
    // Use real satellite data
    const realSatellite = {
      id: satellite.id || satellite.norad_id || 'SAT-001',
      name: satellite.name || satellite.sat_name || satellite.norad_id || 'Unknown Satellite',
      norad_id: satellite.norad_id || satellite.id,
      latitude: satellite.latitude ?? satellite.lat ?? 0,
      longitude: satellite.longitude ?? satellite.lon ?? 0,
      altitude_km: satellite.altitude_km ?? satellite.alt ?? 500,
      sat_x: satellite.sat_x,
      sat_y: satellite.sat_y,
      sat_z: satellite.sat_z
    };
    
    // Get top 3 nearest debris from analysis
    const top3Debris = analysis?.nearest?.slice(0, 3).map(n => ({
      id: n.debris?.deb_id || n.debris?.id || 'DEBRIS-UNKNOWN',
      name: n.debris?.deb_name || n.debris?.name || 'Unknown Debris',
      latitude: n.debris?.latitude ?? n.debris?.lat ?? 0,
      longitude: n.debris?.longitude ?? n.debris?.lon ?? 0,
      altitude_km: n.debris?.altitude_km ?? n.debris?.alt ?? 500,
      deb_x: n.debris?.deb_x ?? n.debris?.x,
      deb_y: n.debris?.deb_y ?? n.debris?.y,
      deb_z: n.debris?.deb_z ?? n.debris?.z,
      distance_km: n.distance_now_km,
      collision_probability: n.model1_risk?.probability
    })) || [{
      id: 'DEBRIS-98765',
      name: 'Unknown Debris',
      latitude: 12,
      longitude: 50,
      altitude_km: 530
    }];
    
    const collisionProb = nearest?.model1_risk?.probability ?? 0.87;
    const collisionDist = nearest?.distance_now_km ?? 15;
    
    sessionStorage.setItem('collisionSatellite', JSON.stringify(realSatellite));
    sessionStorage.setItem('collisionDebrisList', JSON.stringify(top3Debris));
    sessionStorage.setItem('collisionProbability', JSON.stringify(collisionProb));
    sessionStorage.setItem('collisionDistance', JSON.stringify(collisionDist));

    navigate('/collision-simulator', {
      state: {
        satellite: realSatellite,
        debrisList: top3Debris,
        collisionProbability: collisionProb,
        distance: collisionDist
      }
    });
  }

  function handleOpenAIChatbot() {
    // Navigate to AI chatbot info panel with real satellite data
    sessionStorage.setItem('infoSatellite', JSON.stringify(satellite));
    navigate('/satellite-info', {
      state: { satellite }
    });
  }

  // Show prioritized keys first, then render remaining keys dynamically
  // sat_id = NORAD ID, sat_name = Satellite Name
  const prioritized = ['sat_name', 'sat_id', 'altitude_km', 'inclination_deg', 'latitude', 'longitude', 'velocity_kmps', 'status', 'created_at', 'updated_at'];
  // Exclude duplicate fields - sat_id is the NORAD ID, sat_name is the name
  const excludeKeys = ['id', 'name', 'norad_id', 'risk_level', 'collision_probability', 'x', 'y', 'z', 'vx', 'vy', 'vz'];
  const keys = Array.from(new Set([...
    prioritized.filter(k => k in aSat),
    ...Object.keys(aSat).filter(k => !prioritized.includes(k) && !excludeKeys.includes(k))
  ]));

  // Get risk level from analysis
  const riskLevel = nearest?.model2_class?.risk_level;
  const riskLabels = ['No Risk', 'Low Risk', 'Medium Risk', 'High Risk'];

  return (
    <div className="panel satellite-detail-panel">
      <div className="sat-detail-header">
        <h3 className="panel-title">SATELLITE</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="focus-btn" onClick={onToggleFocus} title={focusMode ? "Show All" : "Focus Mode"}>
            {focusMode ? '👁️ All' : '🎯 Focus'}
          </button>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
      </div>
      <div className="sat-detail-body-scroll">
        <div className="sat-detail-body">
          <div className="sat-primary-name">{aSat.sat_name || aSat.name || aSat.sat_id || aSat.norad_id || 'Unknown Satellite'}</div>
          <ul className="sat-detail-list">
          {keys.map((k) => {
            const value = formatValue(aSat[k]);
            if (!value && value !== 0) return null;
            // Custom label for sat_id to show as "NORAD ID"
            const label = k === 'sat_id' ? 'NORAD ID' : k.replace(/_/g, ' ').toUpperCase();
            return (
              <li key={k}>
                <span>{label}:</span>
                <pre className="sat-value" style={{display: 'inline', marginLeft: 6}}>{value}</pre>
              </li>
            );
          })}

          {nearest?.distance_now_km != null && <li><span>DISTANCE TO NEAREST DEBRIS:</span> {nearest.distance_now_km.toFixed(2)} km</li>}
          {nearest?.model1_risk?.probability != null && <li><span>COLLISION PROBABILITY:</span> {(nearest.model1_risk.probability * 100).toFixed(1)}%</li>}
          {nearest?.model1_risk?.probability != null && (
            <>
              <li style={{marginTop:6, display:'flex', gap:'8px'}}>
                <button
                  disabled={!nearest}
                  onClick={handlePlan}
                  className="focus-btn"
                  style={{background: 'linear-gradient(135deg, #3ABEFF, #1E90FF)', flex:1}}>
                  🛰️ Plan Maneuver
                </button>
                <button
                  onClick={handleSimulateCollision}
                  className="focus-btn"
                  style={{background: 'linear-gradient(135deg, #ff4444, #ff6b6b)', flex:1}}>
                  🎬 Simulator
                </button>
              </li>
              <li style={{marginTop:6}}>
                <button
                  onClick={handleOpenAIChatbot}
                  className="focus-btn"
                  style={{background: 'linear-gradient(135deg, #10b981, #059669)', width:'100%'}}>
                  🤖 Ask AI About This Satellite
                </button>
              </li>
            </>
          )}
          {riskLevel != null && <li><span>RISK LEVEL:</span> {riskLabels[riskLevel] || 'Unknown'}</li>}
        </ul>
        </div>
      </div>
    </div>
  );
}

export default SatelliteDetailPanel;
