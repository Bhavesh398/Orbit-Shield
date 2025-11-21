import * as THREE from "three";
import React from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import Nebula from "./Nebula";
import Starfield from "./Starfield";
import EarthMaterial from "./EarthMaterial";
import AtmosphereMesh from "./AtmosphereMesh";
import Header from "./Header";
import SatelliteList from "./SatelliteList";
import AlertPanel from "./AlertPanel";
import CollisionRiskChart from "./CollisionRiskChart";
import SatelliteOrbit from "./SatelliteOrbit";
import SatelliteDetailPanel from "./SatelliteDetailPanel";
import SandboxPanel from "./SandboxPanel";
import { fetchSatellites, fetchSatelliteContext, fetchDebris } from './api/client';

const sunDirection = new THREE.Vector3(-2, 0.5, 1.5);

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

function App() {
  const { x, y, z } = sunDirection;
  const [analysis, setAnalysis] = React.useState(null);
  const [riskHistory, setRiskHistory] = React.useState([]); // [{timestamp, probability, risk_level}]
  const [selectedHistoryIndex, setSelectedHistoryIndex] = React.useState(null);
  const [debrisList, setDebrisList] = React.useState([]);
  const [allDebris, setAllDebris] = React.useState([]);
  const [satellites, setSatellites] = React.useState([]);
  const [selectedSatellite, setSelectedSatellite] = React.useState(null);
  const [loadingSats, setLoadingSats] = React.useState(false);
  const [satError, setSatError] = React.useState(null);
  const [focusMode, setFocusMode] = React.useState(false);
  const wsRef = React.useRef(null);

  // Connect WebSocket for live risk updates
  React.useEffect(() => {
    // Close any existing connection
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    const url = (window.location.protocol === 'https:' ? 'wss://' : 'ws://') + window.location.host.replace(/:\d+$/, ':8000') + '/api/ws/risks';
    try {
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data);
          if (!selectedSatellite) return; // only track when a satellite selected
          // Find highest risk event for selected satellite
          const ev = (msg.events || []).filter(e => e.satellite_id === selectedSatellite.id).sort((a,b)=>b.risk_score - a.risk_score)[0];
          if (ev) {
            setRiskHistory(prev => {
              const next = [...prev, {
                timestamp: msg.timestamp,
                probability: ev.collision_probability ?? ev.risk_score,
                risk_level: ev.risk_level,
                distance_km: ev.distance_km
              }];
              // Limit buffer size
              if (next.length > 300) next.splice(0, next.length - 300);
              return next;
            });
          }
        } catch (err) {
          console.warn('WS parse error', err);
        }
      };
      ws.onerror = () => console.warn('Risk WebSocket error');
      ws.onclose = () => { /* silently */ };
    } catch (err) {
      console.warn('WebSocket connection failed', err);
    }
    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, [selectedSatellite]);

  // Reset history when satellite changes
  React.useEffect(() => {
    setRiskHistory([]);
    setSelectedHistoryIndex(null);
  }, [selectedSatellite]);

  React.useEffect(() => {
    let mounted = true;
    setLoadingSats(true);
    Promise.all([
      fetchSatellites({ all: true }),
      fetchDebris({ all: true })
    ])
      .then(([satsData, debrisData]) => {
        if(mounted) {
          setSatellites(satsData);
          setAllDebris(debrisData);
        }
      })
      .catch(e => setSatError(e.message))
      .finally(() => mounted && setLoadingSats(false));
    return () => { mounted = false; };
  }, []);

  async function analyzeSatelliteContext(sat) {
    try {
      console.log('Fetching analysis for satellite:', sat.id);
      const ctx = await fetchSatelliteContext(sat.id, 3);
      console.log('Analysis result:', ctx);
      setAnalysis(ctx);
      const nearest = ctx?.nearest || [];
      setDebrisList(nearest.map(n => n.debris));
      if (nearest.length > 0) {
        console.log('Risk Level:', nearest[0]?.model2_class?.risk_level);
        console.log('Collision Probability:', nearest[0]?.model1_risk?.probability);
      }
    } catch(e){ 
      console.error('Context analysis failed', e); 
      setAnalysis(null);
      setDebrisList([]);
    }
  }

  function handleSelectSatellite(sat){
    setSelectedSatellite(sat);
    analyzeSatelliteContext(sat);
  }

  const displayedProbability = (() => {
    if (selectedHistoryIndex == null || riskHistory.length === 0) return null;
    return riskHistory[selectedHistoryIndex];
  })();

  return (
    <div className="app-container">
      <Header />
      
      <div className="main-content">
        <div className="left-panel">
          <SatelliteList 
            satellites={satellites}
            loading={loadingSats}
            error={satError}
            selectedId={selectedSatellite?.id}
            onSelectSatellite={(sat)=>{ setSelectedSatellite(sat); analyzeSatelliteContext(sat); }}
            analysis={analysis}
          />
          <CollisionRiskChart 
            analysis={analysis}
            riskHistory={riskHistory}
            selectedIndex={selectedHistoryIndex}
            onSelectIndex={setSelectedHistoryIndex}
          />
        </div>
        
        <div className="canvas-container">
          <Canvas 
            camera={{ position: [0, 0.1, 5]}}
            gl={{ toneMapping: THREE.NoToneMapping 
          }}>
            <Earth />
            <SatelliteOrbit 
              satellites={satellites}
              selectedSatellite={selectedSatellite}
              onSelectSatellite={handleSelectSatellite}
              debrisList={debrisList}
              allDebris={allDebris}
              focusMode={focusMode}
              analysis={analysis}
            />
            <ambientLight intensity={1.5} />
            <Starfield />
            <Starfield />
            <OrbitControls 
              enablePan={false}
              minDistance={3}
              maxDistance={10}
            />
          </Canvas>
        </div>
        
        <div className="right-panel">
          <SatelliteDetailPanel 
            satellite={selectedSatellite} 
            analysis={analysis} 
            onClose={()=>setSelectedSatellite(null)}
            focusMode={focusMode}
            onToggleFocus={() => setFocusMode(!focusMode)}
          />
          <SandboxPanel satellite={selectedSatellite} analysis={analysis} />
          <AlertPanel analysis={analysis} />
        </div>
      </div>
    </div>
  );
}

export default App;
