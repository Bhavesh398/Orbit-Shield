import * as THREE from 'three';
import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import EarthMaterial from './EarthMaterial';
import AtmosphereMesh from './AtmosphereMesh';

const sunDirection = new THREE.Vector3(-2, 0.5, 1.5);
const SIDEREAL_DAY_SECONDS = 86164; // seconds in a sidereal day
const EARTH_ANGULAR_SPEED = (2 * Math.PI) / SIDEREAL_DAY_SECONDS; // radians per second

export default function Earth() {
  const ref = useRef();
  useFrame((state, delta) => {
    if (ref.current) ref.current.rotation.y += EARTH_ANGULAR_SPEED * delta;
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
