import React, { useState, useEffect, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import EarthMaterial from './EarthMaterial';
import AtmosphereMesh from './AtmosphereMesh';
import { useNavigate, useLocation } from 'react-router-dom';
import { planManeuver, simulateManeuver } from './api/client';

// Generate orbital trajectory
function generateOrbitPath(lat, lon, alt, numPoints = 100) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const adjustedLon = lon + (angle * 180 / Math.PI);
    const rEarthKm = 6371.0;
    const rKm = rEarthKm + alt;
    const scale = 2 / rEarthKm;
    const r = rKm * scale;
    const latR = lat * Math.PI / 180;
    const lonR = adjustedLon * Math.PI / 180;
    const x = r * Math.cos(latR) * Math.cos(lonR);
    const y = r * Math.sin(latR);
    const z = r * Math.cos(latR) * Math.sin(lonR);
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}

// Animated satellite following trajectory
function AnimatedSatellite({ trajectory, progress, color = '#00d9ff', size = 0.06, showTrail = true }) {
  const index = Math.floor(progress * (trajectory.length - 1));
  const pos = trajectory[index] || trajectory[0];
  const trailPoints = showTrail ? trajectory.slice(0, index + 1) : [];

  return (
    <>
      <mesh position={pos}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial emissive={color} color={color} />
      </mesh>
      {trailPoints.length > 1 && (
        <Line points={trailPoints} color={color} lineWidth={2} opacity={0.6} transparent />
      )}
    </>
  );
}

// Animated debris
function AnimatedDebris({ debris, progress, showTrail = true }) {
  const trajectory = React.useMemo(() => {
    if (!debris.latitude || !debris.longitude) return [];
    return generateOrbitPath(debris.latitude, debris.longitude, debris.altitude_km || debris.altitude || 500);
  }, [debris]);
  
  if (trajectory.length === 0) return null;
  
  const index = Math.floor(progress * (trajectory.length - 1));
  const pos = trajectory[index] || trajectory[0];
  const trailPoints = showTrail ? trajectory.slice(0, index + 1) : [];

  return (
    <>
      <mesh position={pos}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial emissive="#ff4444" color="#ff4444" />
      </mesh>
      {trailPoints.length > 1 && (
        <Line points={trailPoints} color="#ff4444" lineWidth={1.5} opacity={0.5} transparent />
      )}
    </>
  );
}

const sunDirection = new THREE.Vector3(-2, 0.5, 1.5);

// Earth component
function Earth() {
  const ref = useRef();
  useFrame(() => {
    if (ref.current) ref.current.rotation.y += 0.001;
  });
  const axialTilt = 23.4 * Math.PI / 180;
  return (
    <group rotation-z={axialTilt}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[2, 64]} />
        <EarthMaterial sunDirection={sunDirection} />
        <AtmosphereMesh />
      </mesh>
    </group>
  );
}

// Convert lat/lon/alt to 3D position
function latLonAltToVector(lat, lon, altKm, earthRadiusScene = 2) {
  const rEarthKm = 6371.0;
  const rKm = rEarthKm + altKm;
  const scale = earthRadiusScene / rEarthKm;
  const r = rKm * scale;
  const latR = lat * Math.PI / 180;
  const lonR = lon * Math.PI / 180;
  const x = r * Math.cos(latR) * Math.cos(lonR);
  const y = r * Math.sin(latR);
  const z = r * Math.cos(latR) * Math.sin(lonR);
  return new THREE.Vector3(x, y, z);
}

// Satellite sprite
function SatelliteSprite({ lat, lon, alt, color = '#00d9ff', size = 0.06, label }) {
  const pos = React.useMemo(() => latLonAltToVector(lat, lon, alt), [lat, lon, alt]);
  return (
    <>
      <mesh position={pos}>
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial emissive={color} color={color} />
      </mesh>
    </>
  );
}

// Debris sprite
function DebrisSprite({ debris }) {
  const pos = React.useMemo(() => 
    latLonAltToVector(debris.latitude || 0, debris.longitude || 0, debris.altitude_km || debris.altitude || 0), 
    [debris.latitude, debris.longitude, debris.altitude_km, debris.altitude]
  );
  return (
    <mesh position={pos}>
      <sphereGeometry args={[0.03, 12, 12]} />
      <meshStandardMaterial emissive={'#ff0000'} color={'#ff0000'} />
    </mesh>
  );
}

// Orbit path visualization
function OrbitPath({ lat, lon, alt, color = '#00d9ff' }) {
  const points = React.useMemo(() => {
    const pts = [];
    for (let i = 0; i <= 100; i++) {
      const angle = (i / 100) * Math.PI * 2;
      const adjustedLon = lon + (angle * 180 / Math.PI);
      pts.push(latLonAltToVector(lat, adjustedLon, alt));
    }
    return pts;
  }, [lat, lon, alt]);

  return <Line points={points} color={color} lineWidth={1.5} opacity={0.4} transparent />;
}

// Maneuver vector arrow
function ManeuverVector({ satellite, maneuver }) {
  if (!maneuver || !satellite) return null;
  
  const startPos = latLonAltToVector(satellite.latitude || 0, satellite.longitude || 0, satellite.altitude_km || 500);
  
  // Create arrow direction based on maneuver direction
  const direction = maneuver.direction_vector || { x: 0, y: 1, z: 0 };
  const magnitude = (maneuver.delta_v_mps || 0) * 0.01; // scale for visualization
  
  const endPos = startPos.clone().add(new THREE.Vector3(
    direction.x * magnitude,
    direction.y * magnitude,
    direction.z * magnitude
  ));
  
  return (
    <Line 
      points={[startPos, endPos]} 
      color="#fbbf24" 
      lineWidth={3} 
      opacity={1}
    />
  );
}

// Simulated new orbit after maneuver
function SimulatedOrbit({ satellite, maneuver, color = '#10b981' }) {
  if (!maneuver || !satellite) return null;
  
  // Approximate new altitude after maneuver
  const newAlt = (satellite.altitude_km || 500) + (maneuver.safety_margin_km || 5);
  
  return <OrbitPath lat={satellite.latitude || 0} lon={satellite.longitude || 0} alt={newAlt} color={color} />;
}

function ManeuverPlannerPage() {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Get satellite and debris from session storage or location state
  const [satellite, setSatellite] = useState(null);
  const [debrisList, setDebrisList] = useState([]);
  const [maneuverPlan, setManeuverPlan] = useState(null);
  const [simulation, setSimulation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showOriginalOrbit, setShowOriginalOrbit] = useState(true);
  const [showSimulatedOrbit, setShowSimulatedOrbit] = useState(false);
  
  // Manual adjustment controls
  const [manualMode, setManualMode] = useState(false);
  const [manualDeltaV, setManualDeltaV] = useState(0);
  const [manualDirection, setManualDirection] = useState('prograde');
  const [manualBurnDuration, setManualBurnDuration] = useState(0);
  
  // Animation state
  const [simProgress, setSimProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showTrails, setShowTrails] = useState(true);

  useEffect(() => {
    // Try location state first
    const sat = location.state?.satellite;
    const debris = location.state?.debris;
    const collisionPoint = location.state?.collisionPoint;
    const collisionProbability = location.state?.collisionProbability;
    const initialPlan = location.state?.maneuverPlan;
    const initialSim = location.state?.simulation;
    
    if (sat) {
      setSatellite(sat);
      setDebrisList(debris || []);
      if (collisionPoint) setCollisionPoint(collisionPoint);
      if (collisionProbability != null) setCollisionProbability(collisionProbability);
      if (initialPlan) setManeuverPlan(initialPlan);
      if (initialSim) setSimulation(initialSim);
    } else {
      // Fallback to session storage
      const storedSat = sessionStorage.getItem('maneuverSatellite');
      const storedDebris = sessionStorage.getItem('maneuverDebris');
      
      if (storedSat) {
        setSatellite(JSON.parse(storedSat));
      }
      if (storedDebris) {
        setDebrisList(JSON.parse(storedDebris));
      }
    }
  }, [location]);

  const [collisionPoint, setCollisionPoint] = useState(null);
  const [collisionProbability, setCollisionProbability] = useState(null);
  
  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setSimProgress((prev) => {
        const next = prev + 0.005 * speed;
        return next >= 1 ? 0 : next;
      });
    }, 30);
    
    return () => clearInterval(interval);
  }, [isPlaying, speed]);
  
  // Generate satellite trajectory
  const satTrajectory = React.useMemo(() => {
    if (!satellite?.latitude || !satellite?.longitude) return [];
    const alt = satellite.altitude_km || satellite.altitude || 500;
    return generateOrbitPath(satellite.latitude, satellite.longitude, alt);
  }, [satellite]);

  async function handlePlanManeuver() {
    if (!satellite) return;
    
    setLoading(true);
    try {
      const nearestDistance = debrisList[0]?.distance_now_km || 10.0;
      const plan = await planManeuver(satellite.id, nearestDistance);
      setManeuverPlan(plan);
      setSimulation(null);
      setShowSimulatedOrbit(false);
      
      // Initialize manual controls with AI values
      if (plan) {
        setManualDeltaV(plan.delta_v_mps || 0);
        setManualDirection(plan.direction || 'prograde');
        setManualBurnDuration(plan.burn_duration_s || 0);
      }
    } catch (e) {
      console.error('Plan maneuver failed', e);
      alert('Failed to plan maneuver. Check console for details.');
    } finally {
      setLoading(false);
    }
  }

  async function handleSimulate() {
    if (!satellite) return;
    
    setLoading(true);
    try {
      const nearestDistance = debrisList[0]?.distance_now_km || 10.0;
      
      // Use manual values if manual mode is enabled, otherwise use AI plan
      const planToUse = manualMode ? {
        delta_v_mps: manualDeltaV,
        direction: manualDirection,
        burn_duration_s: manualBurnDuration,
        fuel_cost_kg: (manualDeltaV * 0.1).toFixed(2), // rough estimate
        safety_margin_km: 5
      } : maneuverPlan;
      
      const sim = await simulateManeuver(satellite.id, nearestDistance, planToUse);
      setSimulation(sim?.simulation || null);
      setShowSimulatedOrbit(true);
    } catch (e) {
      console.error('Simulate maneuver failed', e);
      alert('Failed to simulate maneuver. Check console for details.');
    } finally {
      setLoading(false);
    }
  }

  if (!satellite) {
    return (
      <div style={{ padding: 20, color: '#fff', background: '#0a0a0f', minHeight: '100vh' }}>
        <h2>Maneuver Planner</h2>
        <p>No satellite loaded. Please select a satellite from the dashboard first.</p>
        <button 
          onClick={() => navigate('/dashboard')}
          style={{ padding: '10px 18px', marginTop: 10, border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', background: 'linear-gradient(135deg, #3ABEFF, #7B61FF)' }}
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  const nearestDebris = debrisList[0];

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', background: '#0a0a0f', color: '#fff' }}>
      {/* Left Panel - Maneuver Planning */}
      <div style={{ 
        width: '380px', 
        background: 'rgba(10, 12, 18, 0.9)', 
        padding: '20px', 
        overflowY: 'auto',
        borderRight: '1px solid rgba(58,190,255,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, letterSpacing: '1px', margin: 0 }}>Maneuver Planner</h2>
          <button 
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '8px 14px',
              background: 'transparent',
              border: '1px solid rgba(58,190,255,0.4)',
              color: '#3ABEFF',
              borderRadius: 6,
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            ← Dashboard
          </button>
        </div>

        {/* Satellite Info */}
        <div style={{ background: '#0d0f14', padding: 12, borderRadius: 8, marginBottom: 20, border: '1px solid rgba(58,190,255,0.2)' }}>
          <h3 style={{ fontSize: 13, color: '#3ABEFF', marginBottom: 10, letterSpacing: '1px' }}>Satellite Details</h3>
          <div style={{ fontSize: 11, lineHeight: 1.8 }}>
            <div><strong>NORAD ID:</strong> {satellite.norad_id || satellite.id}</div>
            <div><strong>Name:</strong> {satellite.name || satellite.sat_name || 'Unknown'}</div>
            <div><strong>Altitude:</strong> {satellite.altitude_km?.toFixed(2) || 'N/A'} km</div>
            <div><strong>Position:</strong> ({satellite.latitude?.toFixed(2)}°, {satellite.longitude?.toFixed(2)}°)</div>
            {nearestDebris && (
              <>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(58,190,255,0.1)' }}>
                  <strong style={{ color: '#ff4444' }}>Nearest Threat:</strong>
                </div>
                <div><strong>Debris:</strong> {nearestDebris.debris?.name || nearestDebris.debris?.id || 'Unknown'}</div>
                <div><strong>Distance:</strong> {nearestDebris.distance_now_km?.toFixed(2) || 'N/A'} km</div>
                <div><strong>Collision Prob:</strong> <span style={{color: '#ff4444'}}>{((nearestDebris.model1_risk?.probability || 0) * 100).toFixed(1)}%</span></div>
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ marginBottom: 20 }}>
          <button 
            onClick={handlePlanManeuver}
            disabled={loading}
            style={{
              width: '100%',
              padding: '12px',
              background: loading ? '#4b5563' : 'linear-gradient(135deg, #3ABEFF, #7B61FF)',
              border: 'none',
              borderRadius: 8,
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: 14,
              marginBottom: 10,
              boxShadow: '0 0 20px rgba(58,190,255,0.3)'
            }}
          >
            {loading && !maneuverPlan ? 'Planning Maneuver...' : 'Plan Optimal Maneuver'}
          </button>

          {maneuverPlan && (
            <button 
              onClick={handleSimulate}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                background: loading ? '#4b5563' : '#10b981',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontWeight: 700,
                fontSize: 14
              }}
            >
              {loading && maneuverPlan ? 'Simulating...' : '🎯 Simulate Outcome'}
            </button>
          )}
        </div>

        {/* Maneuver Plan Display */}
        {maneuverPlan && (
          <>
            <div style={{ background: 'rgba(58,190,255,0.1)', padding: 12, borderRadius: 8, marginBottom: 12, border: '1px solid rgba(58,190,255,0.3)' }}>
              <h3 style={{ fontSize: 13, color: '#3ABEFF', marginBottom: 10, letterSpacing: '1px' }}>📋 AI Maneuver Plan</h3>
              <div style={{ fontSize: 11, lineHeight: 1.8 }}>
                <div><strong>Delta-V:</strong> {maneuverPlan.delta_v_mps} m/s</div>
                <div><strong>Direction:</strong> {maneuverPlan.direction || 'Optimal'}</div>
                <div><strong>Burn Duration:</strong> {maneuverPlan.burn_duration_s} seconds</div>
                <div><strong>Fuel Cost:</strong> {maneuverPlan.fuel_cost_kg} kg</div>
                <div><strong>Safety Margin:</strong> +{maneuverPlan.safety_margin_km} km</div>
              </div>
            </div>

            {/* Manual Adjustment Toggle */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', padding: 8, background: '#0d0f14', borderRadius: 6 }}>
                <input 
                  type="checkbox" 
                  checked={manualMode} 
                  onChange={(e) => setManualMode(e.target.checked)}
                />
                <span style={{ color: '#fbbf24' }}>🔧 Manual Adjustment Mode</span>
              </label>
            </div>

            {/* Manual Controls */}
            {manualMode && (
              <div style={{ background: 'rgba(251,191,36,0.1)', padding: 12, borderRadius: 8, marginBottom: 12, border: '1px solid rgba(251,191,36,0.3)' }}>
                <h3 style={{ fontSize: 13, color: '#fbbf24', marginBottom: 10, letterSpacing: '1px' }}>⚙️ Manual Tweaks</h3>
                
                {/* Delta-V Slider */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                    <strong>Delta-V:</strong> {manualDeltaV.toFixed(1)} m/s
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max={Math.max(maneuverPlan.delta_v_mps * 2, 100)}
                    step="0.1"
                    value={manualDeltaV}
                    onChange={(e) => setManualDeltaV(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Direction Select */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                    <strong>Direction:</strong>
                  </label>
                  <select 
                    value={manualDirection}
                    onChange={(e) => setManualDirection(e.target.value)}
                    style={{ 
                      width: '100%', 
                      padding: '6px', 
                      background: '#0d0f14', 
                      color: '#fff', 
                      border: '1px solid rgba(251,191,36,0.4)', 
                      borderRadius: 4,
                      fontSize: 11
                    }}
                  >
                    <option value="prograde">Prograde (Forward)</option>
                    <option value="retrograde">Retrograde (Backward)</option>
                    <option value="normal">Normal (Up)</option>
                    <option value="anti-normal">Anti-Normal (Down)</option>
                    <option value="radial-in">Radial In</option>
                    <option value="radial-out">Radial Out</option>
                  </select>
                </div>

                {/* Burn Duration Slider */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>
                    <strong>Burn Duration:</strong> {manualBurnDuration.toFixed(1)} seconds
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max={Math.max(maneuverPlan.burn_duration_s * 2, 60)}
                    step="0.5"
                    value={manualBurnDuration}
                    onChange={(e) => setManualBurnDuration(parseFloat(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>

                {/* Estimated Fuel */}
                <div style={{ fontSize: 11, padding: 8, background: 'rgba(251,191,36,0.15)', borderRadius: 4, marginTop: 8 }}>
                  <strong>Estimated Fuel:</strong> {(manualDeltaV * 0.1).toFixed(2)} kg
                </div>
              </div>
            )}
          </>
        )}

        {/* Simulation Results */}
        {simulation && (
          <div style={{ background: 'rgba(16,185,129,0.1)', padding: 12, borderRadius: 8, border: '1px solid #10b981' }}>
            <h3 style={{ fontSize: 13, color: '#10b981', marginBottom: 10, letterSpacing: '1px' }}>✅ Simulation Results</h3>
            <div style={{ fontSize: 11, lineHeight: 1.8 }}>
              <div><strong>New Miss Distance:</strong> {simulation.predicted_miss_distance_km?.toFixed(2) || 'N/A'} km</div>
              <div><strong>Risk Reduction:</strong> <span style={{color: '#10b981'}}>{((simulation.risk_reduction_prob || 0) * 100).toFixed(1)}%</span></div>
              <div><strong>Residual Probability:</strong> {simulation.residual_probability != null ? `${(simulation.residual_probability * 100).toFixed(2)}%` : 'N/A'}</div>
              <div style={{ marginTop: 10, padding: 8, background: 'rgba(16,185,129,0.15)', borderRadius: 6 }}>
                <strong>Status:</strong> <span style={{color: '#10b981'}}>Collision Risk Mitigated ✓</span>
              </div>
            </div>
          </div>
        )}

        {/* Visualization Controls */}
        <div style={{ marginTop: 20, padding: 12, background: '#0d0f14', borderRadius: 8, border: '1px solid rgba(58,190,255,0.2)' }}>
          <h4 style={{ fontSize: 12, color: '#3ABEFF', marginBottom: 10 }}>Visualization</h4>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 11, cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={showOriginalOrbit} 
              onChange={(e) => setShowOriginalOrbit(e.target.checked)}
            />
            Show Original Orbit (Blue)
          </label>
          {maneuverPlan && (
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 11, cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={showSimulatedOrbit} 
                onChange={(e) => setShowSimulatedOrbit(e.target.checked)}
              />
              Show New Orbit (Green)
            </label>
          )}
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={showTrails} 
              onChange={(e) => setShowTrails(e.target.checked)}
            />
            Show Orbital Trails
          </label>
        </div>

        {/* Time Animation Controls */}
        <div style={{ marginTop: 20, padding: 12, background: '#0d0f14', borderRadius: 8, border: '1px solid rgba(58,190,255,0.2)' }}>
          <h4 style={{ fontSize: 12, color: '#3ABEFF', marginBottom: 10 }}>Timeline Animation</h4>
          
          <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                flex: 1,
                padding: '8px',
                background: isPlaying ? '#ef4444' : '#10b981',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <button
              onClick={() => setSimProgress(0)}
              style={{
                padding: '8px 12px',
                background: '#3ABEFF',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600
              }}
            >
              ↻ Reset
            </button>
          </div>

          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>
              Speed: {speed.toFixed(1)}x
            </label>
            <input
              type="range"
              min="0.5"
              max="3"
              step="0.5"
              value={speed}
              onChange={(e) => setSpeed(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <div>
            <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 4 }}>
              Progress: {(simProgress * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={simProgress}
              onChange={(e) => setSimProgress(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>
        </div>
      </div>

      {/* 3D Visualization */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas camera={{ position: [0, 0, 6], fov: 60 }} gl={{ toneMapping: THREE.NoToneMapping }}>
          <Earth />
          
          {/* Original orbit */}
          {showOriginalOrbit && (
            <OrbitPath 
              lat={satellite.latitude || 0} 
              lon={satellite.longitude || 0} 
              alt={satellite.altitude_km || 500} 
              color="#00d9ff"
            />
          )}
          
          {/* Animated Satellite */}
          {satTrajectory.length > 0 && (
            <AnimatedSatellite
              trajectory={satTrajectory}
              progress={simProgress}
              color="#00d9ff"
              size={0.06}
              showTrail={showTrails}
            />
          )}
          
          {/* Animated Debris */}
          {debrisList.slice(0, 5).map((d, i) => (
            <AnimatedDebris
              key={i}
              debris={d.debris || d}
              progress={simProgress}
              showTrail={showTrails}
            />
          ))}
          
          {/* Maneuver vector */}
          {maneuverPlan && <ManeuverVector satellite={satellite} maneuver={maneuverPlan} />}
          
          {/* Simulated new orbit */}
          {showSimulatedOrbit && simulation && (
            <SimulatedOrbit satellite={satellite} maneuver={maneuverPlan} />
          )}
          
          <ambientLight intensity={1.5} />
          <pointLight position={[10, 10, 10]} intensity={0.5} />
          <OrbitControls 
            enablePan={true} 
            enableZoom={true}
            enableRotate={true}
            minDistance={3} 
            maxDistance={15}
            target={[0, 0, 0]}
          />
        </Canvas>

        {/* Legend */}
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'rgba(10, 12, 18, 0.9)',
          padding: 14,
          borderRadius: 10,
          border: '1px solid rgba(58,190,255,0.25)',
          fontSize: 11
        }}>
          <h4 style={{ fontSize: 12, color: '#3ABEFF', marginBottom: 10 }}>Legend</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 12, height: 12, background: '#00d9ff', borderRadius: '50%' }}></div>
            <span>Satellite & Original Orbit</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 12, height: 12, background: '#ff4444', borderRadius: '50%' }}></div>
            <span>Debris Objects</span>
          </div>
          {maneuverPlan && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ width: 20, height: 2, background: '#fbbf24' }}></div>
                <span>Maneuver Vector</span>
              </div>
              {showSimulatedOrbit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 20, height: 2, background: '#10b981' }}></div>
                  <span>New Safe Orbit</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default ManeuverPlannerPage;
