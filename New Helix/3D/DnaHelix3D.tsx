// DnaHelix3D.tsx
// Renders a DNA/RNA double helix procedurally — this is NOT a prediction,
// it's a fixed B-form helix geometry, so no API call is needed here.

import { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface DnaHelix3DProps {
  sequence: string;      // e.g. "ATGCGTACGT..."
  isRna?: boolean;       // swaps T -> U base coloring/labeling only
  height?: number;       // px
}

// Standard B-DNA geometry constants
const RISE_PER_BASE_PAIR = 0.34; // nm-scale, rendered in arbitrary Three.js units
const RADIUS = 1.0;
const TWIST_PER_BASE_PAIR = (2 * Math.PI) / 10.5; // ~10.5 bp per full turn

const BASE_COLORS: Record<string, number> = {
  A: 0xef4444, // red
  T: 0x3b82f6, // blue
  U: 0x3b82f6,
  C: 0x22c55e, // green
  G: 0xeab308, // yellow
  N: 0x9ca3af, // gray fallback
};

export default function DnaHelix3D({ sequence, height = 480 }: DnaHelix3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0a0a);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    const helixGroup = new THREE.Group();
    scene.add(helixGroup);

    const bases = sequence.slice(0, 200).split(''); // cap for perf; paginate for longer seqs
    const sphereGeo = new THREE.SphereGeometry(0.28, 12, 12);
    const backboneMaterial = new THREE.MeshStandardMaterial({ color: 0x666666 });

    const strandAPoints: THREE.Vector3[] = [];
    const strandBPoints: THREE.Vector3[] = [];

    bases.forEach((base, i) => {
      const angle = i * TWIST_PER_BASE_PAIR;
      const y = i * RISE_PER_BASE_PAIR - (bases.length * RISE_PER_BASE_PAIR) / 2;

      // Strand A (this sequence)
      const xA = RADIUS * Math.cos(angle);
      const zA = RADIUS * Math.sin(angle);
      strandAPoints.push(new THREE.Vector3(xA, y, zA));

      // Strand B (complementary, offset 180°)
      const xB = RADIUS * Math.cos(angle + Math.PI);
      const zB = RADIUS * Math.sin(angle + Math.PI);
      strandBPoints.push(new THREE.Vector3(xB, y, zB));

      // Base sphere, colored by nucleotide
      const color = BASE_COLORS[base] ?? BASE_COLORS.N;
      const sphere = new THREE.Mesh(
        sphereGeo,
        new THREE.MeshStandardMaterial({ color })
      );
      sphere.position.set(xA, y, zA);
      helixGroup.add(sphere);

      // Base-pair rung connecting the two strands
      const rungGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(xA, y, zA),
        new THREE.Vector3(xB, y, zB),
      ]);
      const rung = new THREE.Line(
        rungGeo,
        new THREE.LineBasicMaterial({ color: 0x444444 })
      );
      helixGroup.add(rung);
    });

    // Backbone strands as tubes
    [strandAPoints, strandBPoints].forEach((points) => {
      if (points.length < 2) return;
      const curve = new THREE.CatmullRomCurve3(points);
      const tubeGeo = new THREE.TubeGeometry(curve, points.length * 2, 0.08, 8, false);
      helixGroup.add(new THREE.Mesh(tubeGeo, backboneMaterial));
    });

    scene.add(new THREE.AmbientLight(0xffffff, 0.6));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(5, 5, 5);
    scene.add(dirLight);

    camera.position.set(4, 0, 8);
    camera.lookAt(0, 0, 0);

    let angle = 0;
    let frameId: number;
    const animate = () => {
      angle += 0.003;
      helixGroup.rotation.y = angle;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, [sequence, height]);

  return <div ref={mountRef} style={{ width: '100%', height }} />;
}