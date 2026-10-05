import { useEffect, useRef, useState } from 'react';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { ArrowsClockwise } from '@phosphor-icons/react/dist/csr/ArrowsClockwise';
import { Check } from '@phosphor-icons/react/dist/csr/Check';
import { CircleNotch } from '@phosphor-icons/react/dist/csr/CircleNotch';
import { Ghost } from '@phosphor-icons/react/dist/csr/Ghost';
import { Info } from '@phosphor-icons/react/dist/csr/Info';
import { Crosshair } from '@phosphor-icons/react/dist/csr/Crosshair';
import { Stack } from '@phosphor-icons/react/dist/csr/Stack';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { DownloadSimple } from '@phosphor-icons/react/dist/csr/DownloadSimple';
import { VideoSelector, type SelectorHandle } from './VideoSelector';
import PoseOverlay from './PoseOverlay';
import type { Capture, Health, Result } from './types';
import { MovementStudy } from './StudioAtmosphere';

export default function App() {
  const refInput = useRef<SelectorHandle>(null), attInput = useRef<SelectorHandle>(null);
  const [ready, setReady] = useState([false, false]);
  const [session, setSession] = useState(0);
  const [resetMessage, setResetMessage] = useState('');
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [mirror, setMirror] = useState(false), [stale, setStale] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const captureRef = useRef<Capture[]>([]);
  const [active, setActive] = useState(''), [view, setView] = useState<'side' | 'overlay'>('side');
  const [help, setHelp] = useState(false);
  const resultEl = useRef<HTMLElement>(null);
  const helpDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (help) helpDialog.current?.showModal();
    else helpDialog.current?.close();
  }, [help]);
  useEffect(() => {
    let cancelled = false;
    async function poll() { try { const res = await fetch('/api/health'); if (!res.ok) throw new Error(); const data = await res.json(); if (!cancelled) setHealth(data); } catch { if (!cancelled) setHealth(null); } }
    void poll(); const timer = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  useEffect(() => () => captureRef.current.forEach(c => URL.revokeObjectURL(c.url)), []);
  const invalidate = () => { setStale(true); setResetMessage(''); };
  function clearAll() {
    if (busy) return;
    captureRef.current.forEach(c => URL.revokeObjectURL(c.url));
    captureRef.current = [];
    setCaptures([]);
    setResult(null);
    setError('');
    setReady([false, false]);
    setMirror(false);
    setStale(false);
    setActive('');
    setView('side');
    // Remount the selectors to release media URLs and reset every input state.
    setSession(current => current + 1);
    setResetMessage('All clips and results cleared. Ready for a new attempt.');
  }
  async function runComparison() {
    if (!refInput.current || !attInput.current) return;
    setBusy(true); setError('');
    let next: Capture[] = [];
    try {
      next.push(await refInput.current.capture()); next.push(await attInput.current.capture());
      const form = new FormData(); form.append('reference', next[0].blob, 'reference.jpg'); form.append('attempt', next[1].blob, 'attempt.jpg'); form.append('mirror', String(mirror));
      const response = await fetch('/api/compare-poses', { method: 'POST', body: form });
      const data = await response.json().catch(() => ({ detail: 'Backend did not return a valid response. Check that it is running.' }));
      if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : 'Comparison request was rejected.');
      captureRef.current.forEach(c => URL.revokeObjectURL(c.url)); captureRef.current = next;
      setCaptures(next); setResult(data); setActive(data.measurements[0]?.id || ''); setStale(false); setView('side');
      setTimeout(() => resultEl.current?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' }), 80);
    } catch (err) { next.forEach(c => URL.revokeObjectURL(c.url)); setError(err instanceof Error ? err.message : 'Comparison failed.'); }
    finally { setBusy(false); }
  }
  const selected = result?.measurements.find(m => m.id === active);
  const overlayReady = !!result?.normalized.reference && !!result?.normalized.attempt;
  function download() {
    const blob = new Blob([JSON.stringify({ ...result, timestamps: captures.map(c => c.time) }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'ghostcoach-comparison.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const normPoints = result ? Object.values(result.normalized).flatMap(p => p ? Object.values(p).filter(v => v.confidence >= .35) : []) : [];
  const minX = Math.min(-1.5, ...normPoints.map(p => p.x)) - .3, minY = Math.min(-2, ...normPoints.map(p => p.y)) - .3;
  const maxX = Math.max(1.5, ...normPoints.map(p => p.x)) + .3, maxY = Math.max(1, ...normPoints.map(p => p.y)) + .3;
  const normBox = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
  return <>
    <a className="skip-link" href="#practice">Skip to practice space</a>
    <header className="topbar"><a className="brand" href="#"><Ghost size={30} weight="duotone" /><span>ghostcoach<span className="brand-period">.</span></span></a>
      <span className="nav-label">Your personal movement studio</span><button className="help-button" onClick={() => setHelp(true)}><Info size={18} /> How it works</button></header>
    <main>
      <section className="intro" aria-labelledby="studio-title"><div className="intro-copy"><div className="eyebrow"><span className="live-dot" /> THE MOVEMENT NOTEBOOK</div><h1 id="studio-title">Practice.<br /><span>Then look closer.</span></h1>
        <p>Put your reference beside your attempt. Pick the same moment in each and see how your positions compare.</p><a className="intro-link" href="#practice">Choose your clips <ArrowRight size={18} /></a></div><MovementStudy /></section>
      <div className="workflow" aria-label="Comparison progress"><span className="current"><b>{ready.every(Boolean) ? <Check size={12} /> : '01'}</b><span>Add your clips<small>A reference & your attempt</small></span></span><span className={ready.every(Boolean) ? 'current' : ''}><b>02</b><span>Find your moment<small>Pause at a matching pose</small></span></span><span className={result ? 'current' : ''}><b>03</b><span>See the difference<small>A fresh perspective on form</small></span></span><span className="workflow-note">Small adjustments.<br />Meaningful progress.</span></div>
      <section id="practice" className="practice-section" aria-labelledby="practice-title">
      <div className="workspace-heading"><div><span className="eyebrow">01 / THE STUDIO</span><h2 id="practice-title">Your practice space<span className="heading-period">.</span></h2></div><div className="workspace-actions"><button className="secondary" disabled={busy} onClick={clearAll}><ArrowsClockwise size={16} /> Clear all</button><span className={`status ${health ? 'online' : ''}`}><i />{health ? health.model_status === 'ready' ? `Model ready · ${health.device.toUpperCase()}` : health.model_status === 'loading' ? 'Loading pretrained models…' : 'Backend connected' : 'Backend offline'}</span></div></div>
      <p className="sr-only" role="status">{resetMessage}</p>
      <div className="sources"><VideoSelector key={`reference-${session}`} ref={refInput} kind="reference" disabled={busy} onChange={invalidate} onReady={v => setReady(r => [v, r[1]])} />
        <VideoSelector key={`attempt-${session}`} ref={attInput} kind="attempt" disabled={busy} onChange={invalidate} onReady={v => setReady(r => [r[0], v])} /></div>
      <div className="compare-bar"><label className="mirror-control"><input type="checkbox" checked={mirror} disabled={busy} onChange={e => { setMirror(e.target.checked); invalidate(); }} /><span><strong>Mirror the reference</strong><small>Match opposite sides, like following a mirror</small></span></label>
        <button className="primary" disabled={busy || !ready.every(Boolean) || !health} onClick={runComparison}>{busy ? <CircleNotch className="spin" size={19} /> : <Crosshair size={19} />}{busy ? 'Comparing poses…' : 'Compare selected frames'}{!busy && <ArrowRight size={18} />}</button></div>
      <div className="guidance"><Info size={16} /><span>One person. Similar camera angles. Keep your shoulders, elbows, wrists, and hips visible.</span></div>
      {!health && <div className="connection-note" role="status"><Info size={18} /><span><strong>The comparison engine is offline.</strong> You can still prepare your clips. Connect the local backend to analyze your selected frames.</span></div>}
      {busy && <div className="processing" role="status"><CircleNotch className="spin" size={18} />{health?.model_status === 'loading' ? 'Downloading or loading the pretrained models. First use can take several minutes.' : 'Analyzing the two selected frames. CPU processing can take longer.'}</div>}
      {error && <div className="error" role="alert">{error}</div>}
      </section>
      <section ref={resultEl} className="results-section">
        <div className="section-title"><div><span className="eyebrow">02 / THE REPLAY ROOM</span><h2>{result ? 'A closer look.' : 'Your comparison notes.'}</h2></div>{result && <button className="secondary" onClick={download}><DownloadSimple size={17} /> Export measurements</button>}</div>
        {!result ? <div className="results-empty"><span className="empty-art"><Stack size={38} weight="thin" /></span><div><h3>Nothing to compare just yet.</h3><p>Add two clips and select matching frames. Your overlays and joint measurements will appear here.</p></div><span className="empty-label">READY WHEN YOU ARE</span></div> : <>
          {stale && <div className="stale" role="status"><ArrowsClockwise size={17} /> Inputs have changed. These results belong to the captured frames below. Compare again to update.</div>}
          <div className="result-toolbar"><div className="tabs"><button aria-pressed={view === 'side'} className={view === 'side' ? 'active' : ''} onClick={() => setView('side')}>Side by side</button><button aria-pressed={view === 'overlay'} className={view === 'overlay' ? 'active' : ''} disabled={!overlayReady} onClick={() => setView('overlay')}>Skeleton overlay</button></div><span className="subtle">{result.processing_seconds.toFixed(1)}s processing · {result.device.toUpperCase()}</span></div>
          <div className="results-layout"><div className="visual-results">
            {view === 'side' ? <div className="frame-pair">{(['reference', 'attempt'] as const).map((key, i) => <div key={key} className="frame-column"><div className={`frame-caption ${key}`}><span className="source-dot" />{i ? 'Your attempt' : 'Reference'}<span>{captures[i].time.toFixed(2)}s</span></div><div className="frame"><img src={captures[i].url} alt={`${key} analyzed frame`} /><PoseOverlay points={result[key].landmarks} edges={result.edges} color={i ? '#b45327' : '#2455d6'} active={i === 0 && result.mirror ? selected?.joints.map(n => n.startsWith('left_') ? n.replace('left_', 'right_') : n.replace('right_', 'left_')) : selected?.joints} viewBox={`0 0 ${result[key].width} ${result[key].height}`} label={`${key} detected skeleton`} /></div></div>)}</div> : <div className="normalized-stage"><div className="overlay-legend"><span><i className="source-dot" /> Reference</span><span className="attempt"><i className="source-dot" /> Your attempt</span></div><PoseOverlay points={result.normalized.reference!} edges={result.edges} color="#2455d6" active={selected?.joints} viewBox={normBox} label="Normalized reference skeleton" /><PoseOverlay points={result.normalized.attempt!} edges={result.edges} color="#b45327" active={selected?.joints} viewBox={normBox} label="Normalized attempt skeleton" /></div>}
            <p className="visual-caption">{result.mirror ? 'Mirror comparison: your anatomical left is compared with the reference’s anatomical right.' : 'Comparing the same anatomical sides in both frames.'} {view === 'overlay' && 'Skeletons are centered and scaled by torso length.'}</p>
          </div><aside className="observations"><h3>What to notice <span>{result.measurements.length}</span></h3>{result.measurements.length === 0 && <p>No reliable measurements. Choose clearer frames with visible upper-body landmarks.</p>}{result.measurements.map(m => <button key={m.id} className={`observation ${active === m.id ? 'selected' : ''}`} onClick={() => setActive(m.id)}><div><strong>{m.label}</strong><span>{Math.abs(m.difference_degrees).toFixed(0)}° difference</span></div><p>{m.message}</p><div className="angle-values"><span>Reference <b>{m.reference_angle}°</b></span><span>You <b>{m.attempt_angle}°</b></span></div></button>)}</aside></div>
          {result.warnings.length > 0 && <div className="warnings"><strong>Visibility notes</strong>{result.warnings.map(w => <p key={w}>{w}</p>)}</div>}
          <p className="measurement-note">Approximate 2D differences, not a skill or safety score. Camera angle and body proportions affect comparisons. A difference under 10° is a display tolerance, not a validated coaching standard.</p>
        </>}
      </section>
      <footer><span><Ghost size={19} /> Practice with perspective.</span><span>Selected frames are processed by your local backend. Videos stay in this browser.</span></footer>
    </main>
    <dialog ref={helpDialog} className="help-modal" aria-labelledby="help-title" onCancel={() => setHelp(false)} onClose={() => setHelp(false)}><button autoFocus className="close-button" aria-label="Close help" onClick={() => setHelp(false)}><X size={21} /></button><span className="eyebrow">A LITTLE GUIDANCE</span><h2 id="help-title">Practice. Look closer. Repeat.</h2><p>Choose a short, front-facing movement with one person. Photos are welcome too.</p><ol><li>Upload a reference and an attempt.</li><li>Pause each at the same stage of the movement.</li><li>Compare and select an observation to highlight its joints.</li></ol><p>GhostCoach uses real person detection and ViTPose landmarks. It compares selected frames, not entire routines. First use downloads model weights and may take several minutes.</p><p>Use similar camera positions. Low-confidence joints are omitted. Anatomical left/right refers to the person, not the screen.</p><button className="primary" onClick={() => setHelp(false)}><Check size={18} /> Got it, let's practice</button></dialog>
  </>;
}
