import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// Convert lat/long/alt (km) to 3D Cartesian scaled to scene
function latLonAltToVector(lat, lon, altKm, earthRadiusScene = 2) {
  const rEarthKm = 6371.0;
  const rKm = rEarthKm + (altKm || 0);
  const scale = earthRadiusScene / rEarthKm; // km -> scene units
  const r = rKm * scale;
  const latR = (lat || 0) * Math.PI / 180;
  const lonR = (lon || 0) * Math.PI / 180;
  const x = r * Math.cos(latR) * Math.cos(lonR);
  const y = r * Math.sin(latR);
  const z = r * Math.cos(latR) * Math.sin(lonR);
  return new THREE.Vector3(x, y, z);
}

function SatelliteSprite({ sat, color = '#00d9ff', selected, onSelect, glow = false }) {
  const ref = useRef();
  // Freeze position based on current lat/lon/alt; could animate if velocity available
  const pos = useMemo(() => latLonAltToVector(sat.latitude || 0, sat.longitude || 0, sat.altitude_km || 0), [sat.latitude, sat.longitude, sat.altitude_km]);
  useEffect(() => { if (ref.current) ref.current.position.copy(pos); }, [pos]);
  return (
    <group>
      <mesh ref={ref} onClick={(e)=>{ e.stopPropagation(); onSelect && onSelect(sat); }}>
        <sphereGeometry args={[selected ? 0.06 : 0.04, 16, 16]} />
        <meshStandardMaterial emissive={selected ? '#ff6b35' : color} color={selected ? '#ff6b35' : color} />
      </mesh>
      {glow && (
        <mesh position={pos}>
          <sphereGeometry args={[0.09, 16, 16]} />
          <meshBasicMaterial color={'#ff0066'} transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  );
}

function DebrisSprite({ debris }) {
  const ref = useRef();
  const pos = useMemo(() => latLonAltToVector(debris.latitude || 0, debris.longitude || 0, debris.altitude_km || debris.altitude || 0), [debris.latitude, debris.longitude, debris.altitude_km, debris.altitude]);
  useEffect(() => { if (ref.current) ref.current.position.copy(pos); }, [pos]);
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[0.035, 12, 12]} />
      <meshStandardMaterial emissive={'#ff0000'} color={'#ff0000'} />
    </mesh>
  );
}

function SatelliteOrbit({ satellites = [], selectedSatellite, debrisList = [], allDebris = [], onSelectSatellite, focusMode = false, analysis }) {
  const { camera } = useThree();
  const targetRef = useRef(new THREE.Vector3());
  const animProgress = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const trailRef = useRef();
  const trailPoints = useRef([]);

  // Restore focus mode: when active show only selected satellite, otherwise all
  const visibleSatellites = (focusMode && selectedSatellite) ? [selectedSatellite] : satellites;
  const visibleDebris = (focusMode && selectedSatellite) ? debrisList : allDebris;

  // Use instanced mesh when not in focus mode and large satellite count
  const useInstanced = !(focusMode && selectedSatellite) && visibleSatellites.length > 500;
  const instancedRef = useRef();

  useEffect(() => {
    if (!useInstanced || !instancedRef.current) return;
    const mesh = instancedRef.current;
    const dummy = new THREE.Object3D();
    visibleSatellites.forEach((sat, i) => {
      const pos = latLonAltToVector(sat.latitude || 0, sat.longitude || 0, sat.altitude_km || 0);
      dummy.position.copy(pos);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      // Color risk highlight if available (store in instance color attribute if extended later)
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [useInstanced, visibleSatellites]);

  // Recompute end position when selection changes
  useEffect(() => {
    if (selectedSatellite && selectedSatellite.latitude != null) {
      const satVec = latLonAltToVector(selectedSatellite.latitude, selectedSatellite.longitude, selectedSatellite.altitude_km);
      targetRef.current.copy(satVec);
      
      // Position camera to look at the satellite from a good angle
      const cameraOffset = satVec.clone().normalize().multiplyScalar(satVec.length() + 1.5);
      endPos.current.copy(cameraOffset);
      startPos.current.copy(camera.position);
      animProgress.current = 0;
    }
  }, [selectedSatellite, camera.position]);

  useFrame((state, delta) => {
    if (animProgress.current < 1 && selectedSatellite) {
      animProgress.current += delta * 1.5; // Faster animation
      const t = Math.min(animProgress.current, 1);
      // Smoothstep for easing
      const eased = t * t * (3 - 2 * t);
      const newPos = new THREE.Vector3().lerpVectors(startPos.current, endPos.current, eased);
      camera.position.copy(newPos);
      camera.lookAt(targetRef.current);
    }
    // Update orbit trail for selected satellite
    if (selectedSatellite) {
      const p = latLonAltToVector(selectedSatellite.latitude || 0, selectedSatellite.longitude || 0, selectedSatellite.altitude_km || 0);
      // Simulate slight forward motion by adjusting longitude over time
      selectedSatellite.longitude = (selectedSatellite.longitude || 0) + delta * 0.2;
      trailPoints.current.push(p.clone());
      if (trailPoints.current.length > 150) trailPoints.current.shift();
      if (trailRef.current) {
        const geom = trailRef.current.geometry;
        const positions = new Float32Array(trailPoints.current.length * 3);
        trailPoints.current.forEach((pt, i) => {
          positions[i*3] = pt.x; positions[i*3+1] = pt.y; positions[i*3+2] = pt.z;
        });
        geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geom.setDrawRange(0, trailPoints.current.length);
        geom.computeBoundingSphere();
      }
    }
  });

  return (
    <group>
      {/* Instanced rendering for large sets */}
      {useInstanced && (
        <instancedMesh ref={instancedRef} args={[null, null, visibleSatellites.length]}
          onClick={(e) => {
            const idx = e.instanceId;
            const sat = visibleSatellites[idx];
            sat && onSelectSatellite && onSelectSatellite(sat);
          }}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial emissive={'#00d9ff'} color={'#00d9ff'} />
        </instancedMesh>
      )}
      {!useInstanced && visibleSatellites.map(sat => {
        const isSelected = selectedSatellite?.id === sat.id;
        const riskProb = analysis?.nearest?.[0]?.model1_risk?.probability;
        const glow = isSelected && riskProb != null && riskProb > 0.5;
        return (
          <SatelliteSprite key={sat.id} sat={sat} selected={isSelected} onSelect={onSelectSatellite} glow={glow} />
        );
      })}
      {visibleDebris.map(d => (
        <DebrisSprite key={d.id} debris={d} />
      ))}
      {selectedSatellite && (
        <line ref={trailRef}>
          <bufferGeometry />
          <lineBasicMaterial color="#ffaa00" linewidth={2} />
        </line>
      )}
      {selectedSatellite && (
        <mesh>
          {/* Orbit ring approximation */}
          <ringGeometry args={[2.05, 2.06, 128]} />
          <meshBasicMaterial color="#444" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

export default SatelliteOrbit;
