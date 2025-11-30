import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Line } from '@react-three/drei';
import * as THREE from 'three';
import EarthMaterial from './EarthMaterial';
import AtmosphereMesh from './AtmosphereMesh';
import Earth from './Earth';
import { useNavigate, useLocation } from 'react-router-dom';
import { planManeuver, simulateManeuver } from './api/client';

const sunDirection = new THREE.Vector3(-2, 0.5, 1.5);

// Earth component
// Use shared Earth component (real sidereal rotation)

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

// Generate proper 3D orbital trajectory around Earth
function generateOrbitPath(lat, lon, alt, numPoints = 100) {
  const points = [];
  const rEarthKm = 6371.0;
  const earthRadiusScene = 2;
  const scale = earthRadiusScene / rEarthKm;
  const orbitRadius = (rEarthKm + alt) * scale;
  
  // Convert initial position to orbital plane
  const latR = lat * Math.PI / 180;
  const lonR = lon * Math.PI / 180;
  
  // Calculate orbital inclination (angle of orbit relative to equator)
  const inclination = latR; // Orbit inclination matches initial latitude
  
  for (let i = 0; i < numPoints; i++) {
    const theta = (i / numPoints) * Math.PI * 2; // Angle around orbit
    
    // Position in orbital plane (2D)
    const xOrbit = orbitRadius * Math.cos(theta);
    const yOrbit = orbitRadius * Math.sin(theta);
    
    // Rotate by inclination to create 3D orbit
    const x = xOrbit * Math.cos(lonR) - yOrbit * Math.sin(lonR) * Math.cos(inclination);
    const y = yOrbit * Math.sin(inclination);
    const z = xOrbit * Math.sin(lonR) + yOrbit * Math.cos(lonR) * Math.cos(inclination);
    
    points.push(new THREE.Vector3(x, y, z));
  }
  return points;
}

// Generate debris trajectory (slightly offset orbit with perturbations)
function generateDebrisPath(lat, lon, alt, numPoints = 100) {
  const points = [];
  const rEarthKm = 6371.0;
  const earthRadiusScene = 2;
  const scale = earthRadiusScene / rEarthKm;
  const orbitRadius = (rEarthKm + alt) * scale;
  
  // Offset debris orbit slightly
  const latR = (lat + 2) * Math.PI / 180; // 2 degree offset
  const lonR = (lon + 5) * Math.PI / 180; // 5 degree offset
  const inclination = latR;
  
  for (let i = 0; i < numPoints; i++) {
    const theta = (i / numPoints) * Math.PI * 2;
    
    // Add perturbations to simulate irregular debris orbit
    const perturbation = 0.02 * Math.sin(theta * 3); // Small wobble
    const r = orbitRadius * (1 + perturbation);
    
    const xOrbit = r * Math.cos(theta);
    const yOrbit = r * Math.sin(theta);
    
    const x = xOrbit * Math.cos(lonR) - yOrbit * Math.sin(lonR) * Math.cos(inclination);
    const y = yOrbit * Math.sin(inclination);
    const z = xOrbit * Math.sin(lonR) + yOrbit * Math.cos(lonR) * Math.cos(inclination);
    
    points.push(new THREE.Vector3(x, y, z));
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

  // Satellite / debris come from selection (location.state) or sessionStorage
  const [satellite, setSatellite] = useState(null);
  const [debrisList, setDebrisList] = useState([]);
  const [loadedCollisionProb, setLoadedCollisionProb] = useState(null);
  const [loadedDistance, setLoadedDistance] = useState(null);
  
  // Manual adjustment controls
  const [maneuverPlan, setManeuverPlan] = useState(null);
  const [simResult, setSimResult] = useState(null);
  
  // Populate satellite/debris from incoming state or session (REAL DATA)
  useEffect(() => {
    const satFromState = location.state?.satellite;
    const debrisListFromState = location.state?.debrisList;
    const probFromState = location.state?.collisionProbability;
    const distFromState = location.state?.distance;

    // Use real data from state
    if (satFromState) {
      console.log('🎬 CollisionSimulator loaded with real satellite data:', satFromState.name);
      console.log('  Satellite position:', { lat: satFromState.latitude, lon: satFromState.longitude, alt: satFromState.altitude_km });
      console.log('  Debris count:', debrisListFromState?.length || 0);
      
      setSatellite(satFromState);
      setDebrisList(debrisListFromState || []);
      setLoadedCollisionProb(probFromState ?? 0.5);
      setLoadedDistance(distFromState ?? 10);
    } else {
      // fallback to sessionStorage
      const storedSat = sessionStorage.getItem('collisionSatellite');
      const storedDebrisList = sessionStorage.getItem('collisionDebrisList');
      const storedProb = sessionStorage.getItem('collisionProbability');
      const storedDist = sessionStorage.getItem('collisionDistance');
      
      if (storedSat) {
        try {
          const sat = JSON.parse(storedSat);
          setSatellite(sat);
          console.log('🎬 CollisionSimulator loaded real data from session for satellite:', sat.name);
          console.log('  Position:', { lat: sat.latitude, lon: sat.longitude, alt: sat.altitude_km });
          
          if (storedDebrisList) {
            const debList = JSON.parse(storedDebrisList);
            setDebrisList(debList);
            console.log('  Debris count:', debList.length);
          } else {
            setDebrisList([]);
          }
          
          if (storedProb) setLoadedCollisionProb(JSON.parse(storedProb));
          else setLoadedCollisionProb(0.5);
          
          if (storedDist) setLoadedDistance(JSON.parse(storedDist));
          else setLoadedDistance(10);
        } catch (e) {
          console.error('Error parsing session storage:', e);
          // Use complete fallback
          setSatellite({ id: 'NORAD-12345', name: 'Demo Satellite', norad_id: 'NORAD-12345', latitude: 10, longitude: 45, altitude_km: 550 });
          setDebrisList([]);
          setLoadedCollisionProb(0.87);
          setLoadedDistance(15);
        }
      } else {
        // final fallback dummy
        const dummySat = { id: 'NORAD-12345', name: 'Demo Satellite', norad_id: 'NORAD-12345', latitude: 10, longitude: 45, altitude_km: 550 };
        setSatellite(dummySat);
        setDebrisList([]);
        setLoadedCollisionProb(0.87);
        setLoadedDistance(15);
        console.log('🎬 CollisionSimulator using fallback dummy data');
      }
    }
  }, [location]);

  // Generate satellite trajectory
  const satLat = satellite?.latitude ?? satellite?.lat ?? 0;
  const satLon = satellite?.longitude ?? satellite?.lon ?? 0;
  const satAlt = satellite?.altitude_km ?? satellite?.alt ?? 500;

  const satTrajectory = React.useMemo(() => generateOrbitPath(satLat, satLon, satAlt), [satLat, satLon, satAlt]);
  
  // Generate trajectories for all debris
  const debrisTrajectories = React.useMemo(() => {
    return debrisList.map(deb => {
      const debLat = deb?.latitude ?? deb?.lat ?? 0;
      const debLon = deb?.longitude ?? deb?.lon ?? 0;
      const debAlt = deb?.altitude_km ?? deb?.alt ?? (satAlt - 20);
      return {
        debris: deb,
        trajectory: generateDebrisPath(debLat, debLon, debAlt)
      };
    });
  }, [debrisList, satAlt]);
  
  // Find closest approach for each debris
  const collisionDataList = React.useMemo(() => {
    return debrisTrajectories.map(({ debris, trajectory }) => ({
      debris,
      ...findClosestApproach(satTrajectory, trajectory)
    }));
  }, [satTrajectory, debrisTrajectories]);
  
  // Get the most dangerous collision (shortest distance)
  const primaryCollision = React.useMemo(() => {
    if (collisionDataList.length === 0) return null;
    return collisionDataList.reduce((min, curr) => 
      curr.distance < min.distance ? curr : min
    );
  }, [collisionDataList]);
  
  // AI Predictions (driven by fetched/loaded data) - initialize after primaryCollision
  const initialClosestApproach = loadedDistance ?? (primaryCollision?.distance ? (primaryCollision.distance * 6371 / 2).toFixed(2) : '15');
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
    try {
      console.log('🚀 Planning maneuver with real API...');
      const result = await planManeuver({
        satellite_id: satellite.id,
        debris_id: debris.id,
        collision_prob: predictions.collisionProbability
      });
      
      if (result && result.maneuver) {
        setManeuverPlan(result.maneuver);
        setSimResult(null);
        console.log('✅ Real maneuver plan received:', result.maneuver);
      } else {
        console.warn('⚠️ API returned no maneuver, using fallback');
        // Fallback if API fails
        const fallbackPlan = {
          delta_v_mps: 12.5,
          direction: 'prograde',
          burn_duration_s: 8.2,
          fuel_cost_kg: 3.2,
          safety_margin_km: 25,
          confidence: 0.95,
          direction_vector: { x: 0, y: 1, z: 0 }
        };
        setManeuverPlan(fallbackPlan);
        setSimResult(null);
      }
    } catch (error) {
      console.error('❌ Error planning maneuver:', error);
      // Fallback on error
      const fallbackPlan = {
        delta_v_mps: 12.5,
        direction: 'prograde',
        burn_duration_s: 8.2,
        fuel_cost_kg: 3.2,
        safety_margin_km: 25,
        confidence: 0.95,
        direction_vector: { x: 0, y: 1, z: 0 }
      };
      setManeuverPlan(fallbackPlan);
      setSimResult(null);
    }
  }

  async function handleSimulateFromSimulator() {
    if (!maneuverPlan) return;
    try {
      console.log('🚀 Simulating maneuver with real API...');
      const result = await simulateManeuver({
        satellite_id: satellite.id,
        maneuver: maneuverPlan
      });
      
      if (result && result.simulation) {
        setSimResult(result.simulation);
        console.log('✅ Real simulation result received:', result.simulation);
      } else {
        console.warn('⚠️ API returned no simulation, using fallback');
        // Fallback if API fails
        const fallbackSim = {
          predicted_miss_distance_km: 42.5,
          risk_reduction_prob: 0.89,
          residual_probability: 0.01,
          new_altitude_km: (satellite?.altitude_km || 550) + 25,
          status: 'safe'
        };
        setSimResult(fallbackSim);
      }
    } catch (error) {
      console.error('❌ Error simulating maneuver:', error);
      // Fallback on error
      const fallbackSim = {
        predicted_miss_distance_km: 42.5,
        risk_reduction_prob: 0.89,
        residual_probability: 0.01,
        new_altitude_km: (satellite?.altitude_km || 550) + 25,
        status: 'safe'
      };
      setSimResult(fallbackSim);
    }
  }
  
  const distanceAtCurrentTime = React.useMemo(() => {
    if (!primaryCollision || debrisTrajectories.length === 0) return null;
    const idx = Math.floor(simProgress * (satTrajectory.length - 1));
    const primaryDebrisTraj = debrisTrajectories[0]?.trajectory;
    if (!primaryDebrisTraj || idx >= satTrajectory.length || idx >= primaryDebrisTraj.length) return null;
    return satTrajectory[idx].distanceTo(primaryDebrisTraj[idx]) * 6371 / 2; // scale to km
  }, [simProgress, satTrajectory, debrisTrajectories, primaryCollision]);
  
  const isNearCollision = primaryCollision && simProgress >= primaryCollision.progress - 0.05 && simProgress <= primaryCollision.progress + 0.05;

  // Don't render until we have valid satellite data
  if (!satellite) {
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
            <div><strong>Tracking:</strong> {debrisList.length} debris object{debrisList.length !== 1 ? 's' : ''}</div>
            {debrisList.slice(0, 3).map((deb, idx) => (
              <div key={deb.id || idx} style={{ 
                marginTop: 6, 
                paddingLeft: 8, 
                borderLeft: `2px solid ${['#ff4444', '#ff8844', '#ffaa44'][idx]}`,
                fontSize: 10
              }}>
                <div><strong>#{idx + 1}:</strong> {deb.name || deb.id}</div>
                {deb.distance_km && <div>Distance: {deb.distance_km.toFixed(2)} km</div>}
                {deb.collision_probability && <div>Risk: {(deb.collision_probability * 100).toFixed(1)}%</div>}
              </div>
            ))}
            <div style={{ marginTop: 8 }}><strong>Primary Threat Probability:</strong> <span style={{color: '#ff4444', fontWeight: 700}}>{(predictions.collisionProbability * 100).toFixed(1)}%</span></div>
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
          
          {/* Removed interactive speed slider — timeline speed still controlled by internal state */}
          
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
                  onClick={() => navigate('/maneuver-planner', { state: { satellite, debris: debrisList, collisionPoint: primaryCollision?.point, collisionProbability: predictions.collisionProbability, maneuverPlan, simulation: simResult } })}
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
                  onClick={() => navigate('/maneuver-planner', { state: { satellite, debris: debrisList, collisionPoint: primaryCollision?.point, collisionProbability: predictions.collisionProbability, maneuverPlan, simulation: simResult } })}
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
          
          {/* Render all debris with different colors */}
          {debrisTrajectories.map((debTraj, idx) => (
            <AnimatedDebris 
              key={debTraj.debris.id || idx}
              trajectory={debTraj.trajectory} 
              progress={simProgress} 
              showTrail={showTrails}
              color={['#ff4444', '#ff8844', '#ffaa44'][idx] || '#ff4444'}
              size={idx === 0 ? 0.05 : 0.04}
            />
          ))}
          
          {/* Show collision zone for primary threat */}
          {primaryCollision && isNearCollision && primaryCollision.point && (
            <CollisionZone position={primaryCollision.point} />
          )}

          {/* Visualize collision probability as a translucent sphere at the CPA */}
          {primaryCollision?.point && (
            <mesh position={primaryCollision.point}>
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
