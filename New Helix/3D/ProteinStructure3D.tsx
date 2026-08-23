// ProteinStructure3D.tsx
// Wires: protein sequence -> ESMFold prediction API -> PDB file -> Mol* viewer.
// Uses @rcsb/rcsb-molstar, a thin convenience wrapper around Mol* built exactly
// for "give me a sequence/PDB, get an embeddable 3D viewer" use cases —
// so you never touch raw 3D rendering math yourself.
//
// npm install @rcsb/rcsb-molstar

import { useEffect, useRef, useState } from 'react';
import { Viewer } from '@rcsb/rcsb-molstar/build/src/viewer';

interface ProteinStructure3DProps {
  proteinSequence: string; // amino acid string, e.g. "MKTAYIAKQR..."
  height?: number;
}

// Public ESMFold single-sequence folding endpoint (no API key required).
// Practical limit ~400 residues per request on the public endpoint.
const ESMFOLD_ENDPOINT = 'https://api.esmatlas.com/foldSequence/v1/pdb/';

export default function ProteinStructure3D({
  proteinSequence,
  height = 480,
}: ProteinStructure3DProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [status, setStatus] = useState<'idle' | 'folding' | 'rendering' | 'done' | 'error' | 'too_long'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const MAX_RESIDUES = 400;

  useEffect(() => {
    if (!containerRef.current || !proteinSequence) return;
    let cancelled = false;

    // Check length BEFORE touching the network — no wasted call, no unhandled
    // crash, just an immediate, calm "not available for this one" state.
    if (proteinSequence.length > MAX_RESIDUES) {
      setStatus('too_long');
      return;
    }

    async function run() {
      try {
        setStatus('folding');

        // 1. Predict structure -> get back a raw PDB text file
        const response = await fetch(ESMFOLD_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: proteinSequence,
        });

        if (!response.ok) {
          throw new Error(`ESMFold API error: ${response.status}`);
        }
        const pdbText = await response.text();
        if (cancelled) return;

        setStatus('rendering');

        // 2. Mount the Mol* viewer once — Viewer is a constructor, not an
        // async factory. Pass the DOM element directly (not an id string).
        if (!viewerRef.current && containerRef.current) {
          viewerRef.current = new Viewer(containerRef.current, {
            layoutIsExpanded: false,
            layoutShowControls: false,
            layoutShowSequence: true,
          });
        }

        // 3. Load the predicted PDB straight from the string data (no re-fetch)
        await viewerRef.current?.loadStructureFromData(pdbText, 'pdb', {
          representationParams: {
            // color by pLDDT-style confidence if present in the b-factor column
            theme: 'plddt-confidence',
          },
        });

        if (!cancelled) setStatus('done');
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : 'Unknown error');
          setStatus('error');
        }
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [proteinSequence]);

  return (
    <div style={{ width: '100%', height, position: 'relative', background: '#0a0a0a' }}>
      {status !== 'done' && status !== 'error' && status !== 'too_long' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#aaa', fontFamily: 'monospace', fontSize: 13 }}>
          {status === 'folding' ? 'Folding sequence via ESMFold…' : 'Rendering structure…'}
        </div>
      )}

      {status === 'too_long' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center', justifyContent: 'center', color: '#facc15', fontFamily: 'monospace', fontSize: 13, padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 20 }}>⚠</div>
          <div>Structure prediction unavailable — sequence too long</div>
          <div style={{ color: '#888', fontSize: 11 }}>
            {proteinSequence.length} residues (public ESMFold endpoint caps at {MAX_RESIDUES})
          </div>
        </div>
      )}

      {status === 'error' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#f87171', fontFamily: 'monospace', fontSize: 13, padding: 16, textAlign: 'center' }}>
          {errorMsg}
        </div>
      )}

      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}