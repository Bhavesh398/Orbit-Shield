import React, { useState, useRef, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import EarthMaterial from './EarthMaterial';
import AtmosphereMesh from './AtmosphereMesh';
import { useNavigate, useLocation } from 'react-router-dom';
import { planManeuver, simulateManeuver } from './api/client';

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

// Debris object
function AnimatedDebris({ trajectory, progress, color = '#ff4444', size = 0.04, showTrail = true }) {
  const index = Math.floor(progress * (trajectory.length - 1));
  const pos = trajectory[index] || trajectory[0];
  
  const trailPoints = showTrail ? trajectory.slice(0, index + 1) : [];

  return (
    <>
      <mesh position={pos}>
        <sphereGeometry args={[size, 12, 12]} />
        <meshStandardMaterial emissive={color} color={color} />
      </mesh>
      {trailPoints.length > 1 && (
        <Line points={trailPoints} color={color} lineWidth={1.5} opacity={0.5} transparent />
      )}
    </>
  );
}

// Collision zone indicator
function CollisionZone({ position, radius = 0.15 }) {
  return (
    <mesh position={position}>
      <sphereGeometry args={[radius, 16, 16]} />
      <meshBasicMaterial color="#ff0000" transparent opacity={0.3} wireframe />
    </mesh>
  );
}

// Generate circular orbit trajectory
function generateOrbitPath(lat, lon, alt, numPoints = 100) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const adjustedLon = lon + (angle * 180 / Math.PI);
    points.push(latLonAltToVector(lat, adjustedLon, alt));
  }
  return points;
}

// Generate debris trajectory (slightly offset orbit)
function generateDebrisPath(lat, lon, alt, numPoints = 100) {
  const points = [];
  for (let i = 0; i < numPoints; i++) {
    const angle = (i / numPoints) * Math.PI * 2;
    const adjustedLon = lon + (angle * 180 / Math.PI) + 5; // offset
    const adjustedLat = lat + Math.sin(angle * 3) * 2; // wobble
    points.push(latLonAltToVector(adjustedLat, adjustedLon, alt - 20));
  }
  return points;
}

// Calculate closest approach
function findClosestApproach(traj1, traj2) {
  let minDist = Infinity;
  let minIndex = 0;
  let minPoint = null;
  
  for (let i = 0; i < Math.min(traj1.length, traj2.length); i++) {
    const dist = traj1[i].distanceTo(traj2[i]);
    if (dist < minDist) {
      minDist = dist;
      minIndex = i;
      minPoint = traj1[i].clone().lerp(traj2[i], 0.5); // midpoint
    }
  }
  
  return { distance: minDist, index: minIndex, point: minPoint, progress: minIndex / traj1.length };
}

function CollisionSimulator() {
  const navigate = useNavigate();
  
  // Simulation state
  const [simProgress, setSimProgress] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [showTrails, setShowTrails] = useState(true);
  const [showEarth, setShowEarth] = useState(true);
  
  const location = useLocation();

  // Satellite / debris come from selection (location.state) or sessionStorage, fallback to dummy
  const [satellite, setSatellite] = useState(null);
  const [debris, setDebris] = useState(null);
  const [loadedCollisionProb, setLoadedCollisionProb] = useState(null);
  const [loadedDistance, setLoadedDistance] = useState(null);
  
  // Manual adjustment controls
  const [maneuverPlan, setManeuverPlan] = useState(null);
  const [simResult, setSimResult] = useState(null);
  
  // Populate satellite/debris from incoming state or session (DUMMY DATA ONLY)
  useEffect(() => {
    const satFromState = location.state?.satellite;
    const debrisFromState = location.state?.debris;
    const probFromState = location.state?.collisionProbability;
    const distFromState = location.state?.distance;

    // Always use dummy data, just keep the real name if provided
    if (satFromState) {
      const dummySat = {
        id: satFromState.id || satFromState.norad_id || 'SAT-001',
        name: satFromState.name || satFromState.sat_name || satFromState.norad_id || 'Demo Satellite',
        norad_id: satFromState.norad_id || satFromState.id || 'NORAD-001',
        latitude: 10,
        longitude: 45,
        altitude_km: 550
      };
      const dummyDebris = {
        id: 'DEBRIS-98765',
        name: 'Space Debris Fragment',
        latitude: 12,
        longitude: 50,
        altitude_km: 530
      };
      
      console.log('🎬 CollisionSimulator loaded with dummy data for satellite:', dummySat.name);
      setSatellite(dummySat);
      setDebris(dummyDebris);
      setLoadedCollisionProb(0.87);
      setLoadedDistance(15);
    } else {
      // fallback to sessionStorage
      const storedSat = sessionStorage.getItem('collisionSatellite');
      const storedDebris = sessionStorage.getItem('collisionDebris');
      const storedProb = sessionStorage.getItem('collisionProbability');
      const storedDist = sessionStorage.getItem('collisionDistance');
      
      if (storedSat) {
        try {
          const sat = JSON.parse(storedSat);
          const dummySat = {
            id: sat.id || sat.norad_id || 'SAT-001',
            name: sat.name || sat.sat_name || sat.norad_id || 'Demo Satellite',
            norad_id: sat.norad_id || sat.id || 'NORAD-001',
            latitude: 10,
            longitude: 45,
            altitude_km: 550
          };
          setSatellite(dummySat);
          console.log('🎬 CollisionSimulator loaded from session for satellite:', dummySat.name);
          
          if (storedDebris) {
            setDebris(JSON.parse(storedDebris));
          } else {
            setDebris({ id: 'DEBRIS-98765', name: 'Space Debris Fragment', latitude: 12, longitude: 50, altitude_km: 530 });
          }
          
          if (storedProb) setLoadedCollisionProb(JSON.parse(storedProb));
          else setLoadedCollisionProb(0.87);
          
          if (storedDist) setLoadedDistance(JSON.parse(storedDist));
          else setLoadedDistance(15);
        } catch (e) {
          console.error('Error parsing session storage:', e);
          // Use complete fallback
          setSatellite({ id: 'NORAD-12345', name: 'Demo Satellite', norad_id: 'NORAD-12345', latitude: 10, longitude: 45, altitude_km: 550 });
          setDebris({ id: 'DEBRIS-98765', name: 'Space Debris Fragment', latitude: 12, longitude: 50, altitude_km: 530 });
          setLoadedCollisionProb(0.87);
          setLoadedDistance(15);
        }
      } else {
        // final fallback dummy
        const dummySat = { id: 'NORAD-12345', name: 'Demo Satellite', norad_id: 'NORAD-12345', latitude: 10, longitude: 45, altitude_km: 550 };
        setSatellite(dummySat);
        setDebris({ id: 'DEBRIS-98765', name: 'Space Debris Fragment', latitude: 12, longitude: 50, altitude_km: 530 });
        setLoadedCollisionProb(0.87);
        setLoadedDistance(15);
        console.log('🎬 CollisionSimulator using fallback dummy data');
      }
    }
  }, [location]);

  // Generate trajectories using current satellite/debris - always compute even if loading
  const satLat = satellite?.latitude ?? satellite?.lat ?? 0;
  const satLon = satellite?.longitude ?? satellite?.lon ?? 0;
  const satAlt = satellite?.altitude_km ?? satellite?.alt ?? 500;
  const debLat = debris?.latitude ?? debris?.lat ?? 0;
  const debLon = debris?.longitude ?? debris?.lon ?? 0;
  const debAlt = debris?.altitude_km ?? debris?.alt ?? (satAlt - 20);

  const satTrajectory = React.useMemo(() => generateOrbitPath(satLat, satLon, satAlt), [satLat, satLon, satAlt]);
  const debrisTrajectory = React.useMemo(() => generateDebrisPath(debLat, debLon, debAlt), [debLat, debLon, debAlt]);
  
  // Find collision point
  const collisionData = React.useMemo(() => findClosestApproach(satTrajectory, debrisTrajectory), [satTrajectory, debrisTrajectory]);
  
  // AI Predictions (driven by fetched/loaded data) - initialize after collisionData
  const initialClosestApproach = loadedDistance ?? (collisionData?.distance ? (collisionData.distance * 6371 / 2).toFixed(2) : '15');
  const [predictions, setPredictions] = useState({
    collisionProbability: loadedCollisionProb ?? 0.87,
    timeToCollision: 145, // seconds
    closestApproach: initialClosestApproach,
    avoidanceMeasures: [
      {
        type: 'Altitude Adjustment',
        description: 'Increase orbital altitude by 25 km',
        deltaV: '12.5 m/s',
        fuelCost: '3.2 kg',
        successRate: 0.95,
        timing: 'Execute 90 seconds before projected collision'
      },
      {
        type: 'Inclination Change',
        description: 'Adjust orbital inclination by 1.2°',
        deltaV: '18.3 m/s',
        fuelCost: '4.7 kg',
        successRate: 0.92,
        timing: 'Execute immediately for optimal safety margin'
      },
      {
        type: 'Phase Adjustment',
        description: 'Delay orbital phase by 15 seconds',
        deltaV: '5.8 m/s',
        fuelCost: '1.5 kg',
        successRate: 0.88,
        timing: 'Execute 120 seconds before collision window'
      }
    ],
    optimalManeuver: {
      axis: 'Radial',
      angle: '+15.3°',
      thrust: 'Prograde burn for 8.2 seconds',
      safetyMargin: '+42 km minimum separation'
    }
  });

  // Update predictions when loadedCollisionProb/loadedDistance change
  useEffect(() => {
    setPredictions(p => ({
      ...p,
      collisionProbability: loadedCollisionProb ?? p.collisionProbability,
      closestApproach: loadedDistance ?? p.closestApproach
    }));
  }, [loadedCollisionProb, loadedDistance]);
  
  // Animation loop
  useEffect(() => {
    if (!isPlaying) return;
    
    const interval = setInterval(() => {
      setSimProgress(prev => {
        const next = prev + (0.01 * speed);
        if (next >= 1) {
          setIsPlaying(false);
          return 1;
        }
        return next;
      });
    }, 50);
    
    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  const handleReset = () => {
    setSimProgress(0);
    setIsPlaying(false);
    setManeuverPlan(null);
    setSimResult(null);
  };

  async function handlePlanFromSimulator() {
    // Generate dummy maneuver plan (no API call)
    const dummyPlan = {
      delta_v_mps: 12.5,
      direction: 'prograde',
      burn_duration_s: 8.2,
      fuel_cost_kg: 3.2,
      safety_margin_km: 25,
      confidence: 0.95,
      direction_vector: { x: 0, y: 1, z: 0 }
    };
    setManeuverPlan(dummyPlan);
    setSimResult(null);
    console.log('🎬 Generated dummy maneuver plan:', dummyPlan);
  }

  async function handleSimulateFromSimulator() {
    if (!maneuverPlan) return;
    // Generate dummy simulation result (no API call)
    const dummySim = {
      predicted_miss_distance_km: 42.5,
      risk_reduction_prob: 0.89,
      residual_probability: 0.01,
      new_altitude_km: (satellite?.altitude_km || 550) + 25,
      status: 'safe'
    };
    setSimResult(dummySim);
    console.log('🎬 Generated dummy simulation result:', dummySim);
  }
  
  const distanceAtCurrentTime = React.useMemo(() => {
    const idx = Math.floor(simProgress * (satTrajectory.length - 1));
    if (idx >= satTrajectory.length || idx >= debrisTrajectory.length) return null;
    return satTrajectory[idx].distanceTo(debrisTrajectory[idx]) * 6371 / 2; // scale to km
  }, [simProgress, satTrajectory, debrisTrajectory]);
  
  const isNearCollision = simProgress >= collisionData.progress - 0.05 && simProgress <= collisionData.progress + 0.05;

  // Don't render until we have valid satellite and debris data
  if (!satellite || !debris) {
    return (
      <div style={{ width: '100vw', height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0a0a0f', color: '#fff' }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Loading Collision Scenario...</h2>
          <p>Please wait while we load satellite and debris data</p>
        </div>
      </div>
    );
  }  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', background: '#0a0a0f', color: '#fff' }}>
      {/* Left Panel - Controls & Predictions */}
      <div style={{ 
        width: '380px', 
        background: 'rgba(10, 12, 18, 0.9)', 
        padding: '20px', 
        overflowY: 'auto',
        borderRight: '1px solid rgba(58,190,255,0.2)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18, letterSpacing: '1px', margin: 0 }}>Collision Simulator</h2>
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
        
        {/* Scenario Info */}
        <div style={{ background: '#0d0f14', padding: 12, borderRadius: 8, marginBottom: 20, border: '1px solid rgba(58,190,255,0.2)' }}>
          <h3 style={{ fontSize: 13, color: '#3ABEFF', marginBottom: 10, letterSpacing: '1px' }}>Scenario Details</h3>
          <div style={{ fontSize: 11, lineHeight: 1.8 }}>
            <div><strong>Satellite:</strong> {satellite.name}</div>
            <div><strong>Debris:</strong> {debris.name}</div>
            <div><strong>Collision Probability:</strong> <span style={{color: '#ff4444', fontWeight: 700}}>{(predictions.collisionProbability * 100).toFixed(1)}%</span></div>
            <div><strong>Time to Impact:</strong> {predictions.timeToCollision}s</div>
            <div><strong>Closest Approach:</strong> {predictions.closestApproach} km</div>
          </div>
        </div>
        
        {/* Simulation Controls */}
        <div style={{ background: '#0d0f14', padding: 12, borderRadius: 8, marginBottom: 20, border: '1px solid rgba(58,190,255,0.2)' }}>
          <h3 style={{ fontSize: 13, color: '#3ABEFF', marginBottom: 12, letterSpacing: '1px' }}>Controls</h3>
          
          <div style={{ marginBottom: 15 }}>
            <label style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>Progress: {(simProgress * 100).toFixed(0)}%</label>
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
          
          <div style={{ marginBottom: 15 }}>
            <label style={{ fontSize: 11, display: 'block', marginBottom: 6 }}>Speed: {speed.toFixed(1)}x</label>
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
          
          <div style={{ display: 'flex', gap: 10 }}>
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              style={{
                flex: 1,
                padding: '10px',
                background: isPlaying ? '#ff4444' : 'linear-gradient(135deg, #3ABEFF, #7B61FF)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              {isPlaying ? 'Pause' : 'Play'}
            </button>
            <button 
              onClick={handleReset}
              style={{
                flex: 1,
                padding: '10px',
                background: '#334155',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Reset
            </button>
          </div>

          <div style={{ marginTop: 15, padding: 10, background: '#0d0f14', borderRadius: 8, border: '1px solid rgba(58,190,255,0.15)' }}>
            <h4 style={{ fontSize: 11, color: '#3ABEFF', marginBottom: 8, fontWeight: 700 }}>Visualization Options</h4>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontSize: 11, cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={showTrails} 
                onChange={(e) => setShowTrails(e.target.checked)}
              />
              Show Trajectories
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={showEarth} 
                onChange={(e) => setShowEarth(e.target.checked)}
              />
              Show Earth
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button 
              onClick={handlePlanFromSimulator}
              style={{
                flex: 1,
                padding: '10px',
                background: 'linear-gradient(135deg, #3ABEFF, #7B61FF)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Plan Maneuver
            </button>
            <button 
              onClick={handleSimulateFromSimulator}
              disabled={!maneuverPlan}
              style={{
                flex: 1,
                padding: '10px',
                background: maneuverPlan ? '#10b981' : '#334155',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: maneuverPlan ? 'pointer' : 'not-allowed',
                fontWeight: 600
              }}
            >
              Simulate Maneuver
            </button>
          </div>

          {maneuverPlan && (
            <div style={{ marginTop: 12, padding: 10, background: 'rgba(58,190,255,0.06)', borderRadius: 6, border: '1px solid rgba(58,190,255,0.12)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#3ABEFF' }}>Planned Maneuver</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                <div><strong>ΔV:</strong> {maneuverPlan.delta_v_mps} m/s</div>
                <div><strong>Burn:</strong> {maneuverPlan.burn_duration_s} s</div>
                <div><strong>Fuel:</strong> {maneuverPlan.fuel_cost_kg} kg</div>
                <div><strong>Safety Margin:</strong> +{maneuverPlan.safety_margin_km} km</div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button
                  onClick={() => navigate('/maneuver-planner', { state: { satellite, debris: [debris], collisionPoint: collisionData.point, collisionProbability: predictions.collisionProbability, maneuverPlan, simulation: simResult } })}
                  style={{ flex: 1, padding: 8, borderRadius: 6, background: 'transparent', border: '1px solid rgba(58,190,255,0.18)', color: '#3ABEFF', cursor: 'pointer' }}
                >
                  Open in Maneuver Planner
                </button>
              </div>
            </div>
          )}

          {simResult && (
            <div style={{ marginTop: 12, padding: 10, background: 'rgba(16,185,129,0.06)', borderRadius: 6, border: '1px solid rgba(16,185,129,0.12)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#10b981' }}>Simulation Result</div>
              <div style={{ fontSize: 12, marginTop: 6 }}>
                <div><strong>New Miss Distance:</strong> {simResult.predicted_miss_distance_km?.toFixed(2) || 'N/A'} km</div>
                <div><strong>Risk Reduction:</strong> {((simResult.risk_reduction_prob || 0) * 100).toFixed(1)}%</div>
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
                <button
                  onClick={() => navigate('/maneuver-planner', { state: { satellite, debris: [debris], collisionPoint: collisionData.point, collisionProbability: predictions.collisionProbability, maneuverPlan, simulation: simResult } })}
                  style={{ flex: 1, padding: 8, borderRadius: 6, background: 'transparent', border: '1px solid rgba(16,185,129,0.12)', color: '#10b981', cursor: 'pointer' }}
                >
                  Inspect in Planner
                </button>
              </div>
            </div>
          )}
          
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 12, cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={showTrails} 
              onChange={(e) => setShowTrails(e.target.checked)}
            />
            Show Orbit Trails
          </label>
        </div>
        
        {/* Real-time Status */}
        <div style={{ 
          background: isNearCollision ? '#3d0a0a' : '#0d0f14', 
          padding: 12, 
          borderRadius: 8, 
          marginBottom: 20, 
          border: `1px solid ${isNearCollision ? '#ff4444' : 'rgba(58,190,255,0.2)'}`,
          transition: 'all 0.3s ease'
        }}>
          <h3 style={{ fontSize: 13, color: isNearCollision ? '#ff4444' : '#3ABEFF', marginBottom: 8 }}>
            {isNearCollision ? '⚠️ COLLISION IMMINENT' : 'Real-time Status'}
          </h3>
          <div style={{ fontSize: 11 }}>
            <div><strong>Current Distance:</strong> {distanceAtCurrentTime ? `${distanceAtCurrentTime.toFixed(2)} km` : '—'}</div>
            <div><strong>Status:</strong> {isNearCollision ? <span style={{color: '#ff4444'}}>CRITICAL</span> : 'Monitoring'}</div>
          </div>
        </div>
        
        {/* AI Predictions */}
        <div style={{ background: '#0d0f14', padding: 12, borderRadius: 8, border: '1px solid rgba(58,190,255,0.2)' }}>
          <h3 style={{ fontSize: 13, color: '#3ABEFF', marginBottom: 12, letterSpacing: '1px' }}>AI Avoidance Recommendations</h3>
          
          {/* Optimal Maneuver */}
          <div style={{ background: 'rgba(58,190,255,0.1)', padding: 10, borderRadius: 6, marginBottom: 15, border: '1px solid rgba(58,190,255,0.3)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#3ABEFF', marginBottom: 8 }}>🎯 OPTIMAL MANEUVER</div>
            <div style={{ fontSize: 11, lineHeight: 1.7 }}>
              <div><strong>Axis:</strong> {predictions.optimalManeuver.axis}</div>
              <div><strong>Angle:</strong> {predictions.optimalManeuver.angle}</div>
              <div><strong>Thrust:</strong> {predictions.optimalManeuver.thrust}</div>
              <div><strong>Result:</strong> {predictions.optimalManeuver.safetyMargin}</div>
            </div>
          </div>
          
          {/* Alternative Measures */}
          <div style={{ fontSize: 11 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, color: '#94a3b8' }}>Alternative Measures:</div>
            {predictions.avoidanceMeasures.map((measure, idx) => (
              <div key={idx} style={{ 
                background: '#0b0d12', 
                padding: 10, 
                borderRadius: 6, 
                marginBottom: 10,
                border: '1px solid rgba(58,190,255,0.15)'
              }}>
                <div style={{ fontWeight: 600, color: '#fff', marginBottom: 5 }}>{idx + 1}. {measure.type}</div>
                <div style={{ marginBottom: 4, color: '#94a3b8' }}>{measure.description}</div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                  <span style={{ color: '#3ABEFF' }}>ΔV: {measure.deltaV}</span>
                  <span style={{ color: '#fbbf24' }}>Fuel: {measure.fuelCost}</span>
                  <span style={{ color: '#10b981' }}>Success: {(measure.successRate * 100).toFixed(0)}%</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 10, color: '#64748b', fontStyle: 'italic' }}>
                  ⏱ {measure.timing}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* 3D Visualization */}
      <div style={{ flex: 1, position: 'relative', background: showEarth ? '#000' : '#0a0a0f' }}>
        <Canvas camera={{ position: [0, 2, 6] }} gl={{ toneMapping: THREE.NoToneMapping }}>
          {showEarth && <Earth />}
          <AnimatedSatellite trajectory={satTrajectory} progress={simProgress} showTrail={showTrails} />
          <AnimatedDebris trajectory={debrisTrajectory} progress={simProgress} showTrail={showTrails} />
          {isNearCollision && collisionData.point && (
            <CollisionZone position={collisionData.point} />
          )}

          {/* Visualize collision probability as a translucent sphere at the CPA */}
          {collisionData.point && (
            <mesh position={collisionData.point}>
              <sphereGeometry args={[0.12 * (0.5 + predictions.collisionProbability), 16, 16]} />
              <meshBasicMaterial color="#ff4444" transparent opacity={0.18} />
            </mesh>
          )}

          {/* Render maneuver vector and simulated new orbit if available */}
          {maneuverPlan && (() => {
            // compute start and end positions
            const start = satTrajectory[Math.floor(simProgress * (satTrajectory.length - 1))] || satTrajectory[0];
            const dir = maneuverPlan.direction_vector || { x: 0, y: 1, z: 0 };
            const mag = (maneuverPlan.delta_v_mps || 0) * 0.01;
            const end = start.clone().add(new THREE.Vector3(dir.x * mag, dir.y * mag, dir.z * mag));
            return (
              <>
                <Line points={[start, end]} color="#fbbf24" lineWidth={3} opacity={1} />
                {simResult && (
                  // approximate new orbit by raising altitude
                  <Line points={generateOrbitPath(satellite.lat, satellite.lon, satellite.alt + (maneuverPlan.safety_margin_km || 5))} color="#10b981" lineWidth={1.5} opacity={0.85} />
                )}
              </>
            );
          })()}
          <ambientLight intensity={1.5} />
          <pointLight position={[10, 10, 10]} intensity={0.5} />
          <OrbitControls enablePan={false} minDistance={3} maxDistance={12} />
        </Canvas>
        
        {/* Overlay Legend */}
        <div style={{
          position: 'absolute',
          top: 20,
          right: 20,
          background: 'rgba(10, 12, 18, 0.9)',
          padding: 14,
          borderRadius: 10,
          border: '1px solid rgba(58,190,255,0.25)',
          fontSize: 12
        }}>
          <h4 style={{ fontSize: 13, color: '#3ABEFF', marginBottom: 10 }}>Legend</h4>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 12, height: 12, background: '#00d9ff', borderRadius: '50%' }}></div>
            <span>Satellite</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <div style={{ width: 12, height: 12, background: '#ff4444', borderRadius: '50%' }}></div>
            <span>Debris</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 12, height: 12, background: 'transparent', border: '1px solid #ff0000', borderRadius: '50%' }}></div>
            <span>Collision Zone</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default CollisionSimulator;
