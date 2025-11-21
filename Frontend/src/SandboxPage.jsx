import * as THREE from "three";
import React from 'react';
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Line } from "@react-three/drei";
import EarthMaterial from "./EarthMaterial";
import AtmosphereMesh from "./AtmosphereMesh";
import { analyzeSandbox } from './api/client';

const sunDirection = new THREE.Vector3(-2, 0.5, 1.5);

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

function Earth() {
  const ref = React.useRef();
  useFrame(() => {
    ref.current.rotation.y += 0.001;
  });
  const axialTilt = 23.4 * Math.PI / 180;
  return (
    <group rotation-z={axialTilt}>
      <mesh ref={ref}>
        <icosahedronGeometry args={[2, 64]} />
        <EarthMaterial sunDirection={sunDirection}/>
        <AtmosphereMesh />
      </mesh>
    </group>
  );
}

function latLonAltToVector(lat, lon, altKm, earthRadiusScene = 2) {
  const rEarthKm = 6371.0;
  const rKm = rEarthKm + (altKm || 0);
  const scale = earthRadiusScene / rEarthKm;
  const r = rKm * scale;
  const latR = (lat || 0) * Math.PI / 180;
  const lonR = (lon || 0) * Math.PI / 180;
  const x = r * Math.cos(latR) * Math.cos(lonR);
  const y = r * Math.sin(latR);
  const z = r * Math.cos(latR) * Math.sin(lonR);
  return new THREE.Vector3(x, y, z);
}

function SatelliteSprite({ lat, lon, alt, color = '#00d9ff', size = 0.05 }) {
  const pos = React.useMemo(() => latLonAltToVector(lat, lon, alt), [lat, lon, alt]);
  return (
    <mesh position={pos}>
      <sphereGeometry args={[size, 16, 16]} />
      <meshStandardMaterial emissive={color} color={color} />
    </mesh>
  );
}

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

function SandboxPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const satelliteId = urlParams.get('satellite');
  const debrisIds = urlParams.get('debris')?.split(',') || [];

  const [satellite, setSatellite] = React.useState(null);
  const [debrisList, setDebrisList] = React.useState([]);
  const [altitude, setAltitude] = React.useState('');
  const [latitude, setLatitude] = React.useState('');
  const [longitude, setLongitude] = React.useState('');
  const [analysis, setAnalysis] = React.useState(null);
  const [loading, setLoading] = React.useState(false);
  
  // Animation state
  const [simProgress, setSimProgress] = React.useState(0);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [speed, setSpeed] = React.useState(1);
  const [showTrails, setShowTrails] = React.useState(true);

  // Load satellite and debris from main app state or URL params
  React.useEffect(() => {
    // Try to get from sessionStorage (set by main app when clicking "Open Sandbox")
    const storedSat = sessionStorage.getItem('sandboxSatellite');
    const storedDebris = sessionStorage.getItem('sandboxDebris');
    
    if (storedSat) {
      const sat = JSON.parse(storedSat);
      setSatellite(sat);
      setAltitude(String(sat.altitude_km || ''));
      setLatitude(String(sat.latitude || ''));
      setLongitude(String(sat.longitude || ''));
    }
    
    if (storedDebris) {
      setDebrisList(JSON.parse(storedDebris));
    }
  }, []);
  
  // Animation loop
  React.useEffect(() => {
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
    if (!displayLat || !displayLon) return [];
    return generateOrbitPath(displayLat, displayLon, displayAlt || 500);
  }, [displayLat, displayLon, displayAlt]);

  const displayAlt = altitude !== '' ? parseFloat(altitude) : satellite?.altitude_km;
  const displayLat = latitude !== '' ? parseFloat(latitude) : satellite?.latitude;
  const displayLon = longitude !== '' ? parseFloat(longitude) : satellite?.longitude;

  async function runSimulation() {
    if (!satellite) return;
    setLoading(true);
    try {
      const alt = altitude !== '' ? parseFloat(altitude) : undefined;
      const lat = latitude !== '' ? parseFloat(latitude) : undefined;
      const lon = longitude !== '' ? parseFloat(longitude) : undefined;
      const result = await analyzeSandbox(satellite.id, { altitude_km: alt, latitude: lat, longitude: lon });
      setAnalysis(result);
    } catch (e) {
      console.error('Sandbox analysis failed', e);
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }

  if (!satellite) {
    return (
      <div style={{ padding: 20, color: '#fff', background: '#0a0f1a', minHeight: '100vh' }}>
        <h2>Sandbox Simulation</h2>
        <p>No satellite loaded. Please select a satellite from the main dashboard and click "Open Sandbox".</p>
        <button onClick={() => window.location.href = '/dashboard'} style={{ padding: '10px 18px', marginTop: 10, border: 'none', borderRadius: 8, cursor: 'pointer', color: '#fff', background: 'linear-gradient(135deg, #3ABEFF, #7B61FF)', boxShadow: '0 0 20px rgba(58,190,255,0.3)' }}>
          Back to Dashboard
        </button>
      </div>
    );
  }

  const riskProb = analysis?.nearest?.[0]?.model1_risk?.probability;
  const riskDistance = analysis?.nearest?.[0]?.distance_now_km;

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', background: '#0a0a0f' }}>
      {/* Left Controls Panel */}
      <div style={{ 
        width: '320px', 
        background: 'rgba(10, 12, 18, 0.85)', 
        color: '#fff', 
        padding: 20, 
        overflowY: 'auto',
        borderRight: '1px solid rgba(58,190,255,0.2)',
        backdropFilter: 'blur(10px)'
      }}>
        <h2 style={{ fontSize: 16, marginBottom: 10, letterSpacing: '1px' }}>Sandbox Simulation</h2>
        <button 
          onClick={() => window.location.href = '/dashboard'} 
          style={{ 
            padding: '10px 14px', 
            marginBottom: 15, 
            background: 'transparent', 
            color: '#3ABEFF', 
            border: '1px solid rgba(58,190,255,0.4)', 
            borderRadius: 8,
            cursor: 'pointer',
            transition: 'all 0.2s ease'
          }}
        >
          ← Back to Dashboard
        </button>

        <div style={{ marginBottom: 20, padding: 12, background: '#0d0f14', borderRadius: 8, border: '1px solid rgba(58,190,255,0.2)' }}>
          <h3 style={{ fontSize: 13, marginBottom: 8, color: '#3ABEFF', letterSpacing: '1px' }}>Current Satellite</h3>
          <div style={{ fontSize: 12 }}>
            <div><strong>Name:</strong> {satellite.name || satellite.sat_name || satellite.id}</div>
            <div><strong>ID:</strong> {satellite.id}</div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 13, marginBottom: 10, color: '#3ABEFF', letterSpacing: '1px' }}>Adjust Parameters</h3>
          
          <label style={{ display: 'block', fontSize: 12, marginBottom: 5 }}>
            Altitude (km):
            <input 
              type="number" 
              value={altitude} 
              onChange={e => setAltitude(e.target.value)}
              placeholder={satellite.altitude_km}
              style={{ 
                width: '100%', 
                padding: 8, 
                marginTop: 6, 
                background: '#0f172a', 
                border: '1px solid rgba(58,190,255,0.2)', 
                borderRadius: 6,
                color: '#fff' 
              }}
            />
          </label>

          <label style={{ display: 'block', fontSize: 12, marginBottom: 5 }}>
            Latitude (deg):
            <input 
              type="number" 
              value={latitude} 
              onChange={e => setLatitude(e.target.value)}
              placeholder={satellite.latitude}
              step="0.1"
              style={{ 
                width: '100%', 
                padding: 8, 
                marginTop: 6, 
                background: '#0f172a', 
                border: '1px solid rgba(58,190,255,0.2)', 
                borderRadius: 6,
                color: '#fff' 
              }}
            />
          </label>

          <label style={{ display: 'block', fontSize: 12, marginBottom: 10 }}>
            Longitude (deg):
            <input 
              type="number" 
              value={longitude} 
              onChange={e => setLongitude(e.target.value)}
              placeholder={satellite.longitude}
              step="0.1"
              style={{ 
                width: '100%', 
                padding: 8, 
                marginTop: 6, 
                background: '#0f172a', 
                border: '1px solid rgba(58,190,255,0.2)', 
                borderRadius: 6,
                color: '#fff' 
              }}
            />
          </label>

          <button 
            onClick={runSimulation} 
            disabled={loading}
            style={{ 
              width: '100%', 
              padding: 12, 
              background: loading ? '#4b5563' : 'linear-gradient(135deg, #3ABEFF, #7B61FF)', 
              color: '#fff', 
              border: 'none', 
              cursor: loading ? 'not-allowed' : 'pointer',
              borderRadius: 10,
              fontWeight: 700,
              boxShadow: '0 0 24px rgba(58,190,255,0.4)'
            }}
          >
            {loading ? 'Running Simulation...' : 'Run Simulation'}
          </button>
        </div>

        {analysis && (
          <div style={{ padding: 12, background: '#0b0d12', borderRadius: 8, marginBottom: 20, border: '1px solid rgba(58,190,255,0.2)' }}>
            <h3 style={{ fontSize: 13, marginBottom: 8, color: '#3ABEFF', letterSpacing: '1px' }}>Simulation Results</h3>
            <div style={{ fontSize: 12 }}>
              {riskProb != null && (
                <div style={{ marginBottom: 6 }}>
                  <strong>Collision Probability:</strong>{' '}
                  <span style={{ color: riskProb > 0.7 ? '#ff4444' : riskProb > 0.3 ? '#ffaa44' : '#44ff44' }}>
                    {(riskProb * 100).toFixed(2)}%
                  </span>
                </div>
              )}
              {riskDistance != null && (
                <div style={{ marginBottom: 6 }}>
                  <strong>Nearest Debris Distance:</strong> {riskDistance.toFixed(2)} km
                </div>
              )}
              {analysis.nearest?.[0]?.debris && (
                <div style={{ marginBottom: 6 }}>
                  <strong>Closest Debris:</strong> {analysis.nearest[0].debris.name || analysis.nearest[0].debris.id}
                </div>
              )}
              <div style={{ marginTop: 10, fontSize: 11, color: '#94a3b8' }}>
                Threats detected: {analysis.nearest?.length || 0}
              </div>
            </div>
          </div>
        )}

        <div style={{ padding: 12, background: '#0d0f14', borderRadius: 8, border: '1px solid rgba(58,190,255,0.2)' }}>
          <h3 style={{ fontSize: 13, marginBottom: 8, color: '#3ABEFF', letterSpacing: '1px' }}>Tracked Debris</h3>
          <div style={{ fontSize: 11 }}>
            {debrisList.length === 0 && <div style={{ color: '#94a3b8' }}>No debris loaded</div>}
            {debrisList.slice(0, 5).map((d, i) => (
              <div key={d.id} style={{ marginBottom: 6, padding: 6, background: '#0b0d12', borderRadius: 6, border: '1px solid rgba(58,190,255,0.15)' }}>
                {d.name || d.id}
              </div>
            ))}
            {debrisList.length > 5 && (
              <div style={{ color: '#94a3b8', marginTop: 6 }}>+ {debrisList.length - 5} more</div>
            )}
          </div>
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

          <div style={{ marginBottom: 10 }}>
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
          
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, cursor: 'pointer' }}>
            <input 
              type="checkbox" 
              checked={showTrails} 
              onChange={(e) => setShowTrails(e.target.checked)}
            />
            Show Orbital Trails
          </label>
        </div>
      </div>

      {/* 3D Canvas */}
      <div style={{ flex: 1 }}>
        <Canvas camera={{ position: [0, 0.1, 5] }} gl={{ toneMapping: THREE.NoToneMapping }}>
          <Earth />
          
          {/* Animated Satellite */}
          {satTrajectory.length > 0 && (
            <AnimatedSatellite
              trajectory={satTrajectory}
              progress={simProgress}
              color={riskProb > 0.7 ? '#ff4444' : '#00d9ff'}
              size={0.06}
              showTrail={showTrails}
            />
          )}

          {/* Animated Debris */}
          {debrisList.map(d => (
            <AnimatedDebris
              key={d.id}
              debris={d}
              progress={simProgress}
              showTrail={showTrails}
            />
          ))}

          {/* Analysis result - highlight nearest debris */}
          {analysis?.nearest?.[0] && (
            <SatelliteSprite 
              lat={analysis.nearest[0].debris.latitude || 0}
              lon={analysis.nearest[0].debris.longitude || 0}
              alt={analysis.nearest[0].debris.altitude_km || 0}
              color={'#ffaa00'}
              size={0.05}
            />
          )}

          <ambientLight intensity={1.5} />
          <OrbitControls 
            enablePan={false}
            minDistance={3}
            maxDistance={10}
          />
        </Canvas>
      </div>

      {/* Info Overlay */}
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        background: 'rgba(10, 12, 18, 0.9)',
        padding: 14,
        borderRadius: 10,
        border: '1px solid rgba(58,190,255,0.25)',
        color: '#fff',
        fontSize: 12,
        maxWidth: 260,
        boxShadow: '0 0 24px rgba(58,190,255,0.15)'
      }}>
        <h3 style={{ fontSize: 13, marginBottom: 8, color: '#3ABEFF', letterSpacing: '1px' }}>Current View</h3>
        <div><strong>Altitude:</strong> {displayAlt?.toFixed(2)} km</div>
        <div><strong>Latitude:</strong> {displayLat?.toFixed(2)}°</div>
        <div><strong>Longitude:</strong> {displayLon?.toFixed(2)}°</div>
        {riskProb != null && (
          <div style={{ marginTop: 8, padding: 8, background: riskProb > 0.7 ? '#ff444422' : '#00d9ff22', borderRadius: 6, border: '1px solid rgba(58,190,255,0.25)' }}>
            <strong>Risk:</strong> {(riskProb * 100).toFixed(2)}%
          </div>
        )}
      </div>
    </div>
  );
}

export default SandboxPage;
