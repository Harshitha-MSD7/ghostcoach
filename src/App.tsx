import { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowsClockwise, Check, CircleNotch, Ghost, Info, Crosshair, Stack, X, DownloadSimple } from '@phosphor-icons/react';
import { VideoSelector, type SelectorHandle } from './VideoSelector';
import PoseOverlay from './PoseOverlay';
import type { Capture, Health, Result } from './types';

export default function App() {
  const refInput = useRef<SelectorHandle>(null), attInput = useRef<SelectorHandle>(null);
  const [ready, setReady] = useState([false, false]);
  const [health, setHealth] = useState<Health | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [mirror, setMirror] = useState(false), [stale, setStale] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const captureRef = useRef<Capture[]>([]);
  const [active, setActive] = useState(''), [view, setView] = useState<'side' | 'overlay'>('side');
  const [help, setHelp] = useState(false);
  const resultEl = useRef<HTMLElement>(null);
  useEffect(() => {
    let cancelled = false;
    async function poll() { try { const res = await fetch('/api/health'); if (!res.ok) throw new Error(); const data = await res.json(); if (!cancelled) setHealth(data); } catch { if (!cancelled) setHealth(null); } }
    void poll(); const timer = setInterval(poll, 5000);
    return () => { cancelled = true; clearInterval(timer); };
  }, []);
  useEffect(() => () => captureRef.current.forEach(c => URL.revokeObjectURL(c.url)), []);
  const invalidate = () => setStale(true);
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
      setTimeout(() => resultEl.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
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
    <header className="topbar"><a className="brand" href="#"><Ghost size={30} weight="duotone" /><span>ghostcoach<span className="brand-period">.</span></span></a>
      <span className="nav-label">Movement studio</span><button className="help-button" onClick={() => setHelp(true)}><Info size={18} /> How it works</button></header>
    <main>
      <div className="intro"><div className="eyebrow">A DIFFERENT WAY TO PRACTICE</div><h1>See the movement.<br /><span>Find your difference.</span></h1>
        <p>Bring a reference. Add your attempt. Compare the moments that matter, one pose at a time.</p></div>
      <div className="workflow"><span className="current"><b>1</b> Add your clips</span><span className={ready.every(Boolean) ? 'current' : ''}><b>2</b> Choose matching moments</span><span className={result ? 'current' : ''}><b>3</b> See the difference</span></div>
      <div className="workspace-heading"><h2>Your practice space</h2><span className={`status ${health ? 'online' : ''}`}><i />{health ? health.model_status === 'ready' ? `Model ready · ${health.device.toUpperCase()}` : health.model_status === 'loading' ? 'Loading pretrained models…' : 'Backend connected' : 'Backend offline'}</span></div>
      <div className="sources"><VideoSelector ref={refInput} kind="reference" disabled={busy} onChange={invalidate} onReady={v => setReady(r => [v, r[1]])} />
        <VideoSelector ref={attInput} kind="attempt" disabled={busy} onChange={invalidate} onReady={v => setReady(r => [r[0], v])} /></div>
      <div className="compare-bar"><label className="mirror-control"><input type="checkbox" checked={mirror} disabled={busy} onChange={e => { setMirror(e.target.checked); invalidate(); }} /><span><strong>Mirror the reference</strong><small>Match opposite sides, like following a mirror</small></span></label>
        <button className="primary" disabled={busy || !ready.every(Boolean) || !health} onClick={runComparison}>{busy ? <CircleNotch className="spin" size={19} /> : <Crosshair size={19} />}{busy ? 'Comparing poses…' : 'Compare selected frames'}{!busy && <ArrowRight size={18} />}</button></div>
      <div className="guidance"><Info size={16} /><span>One person. Similar camera angles. Keep your shoulders, elbows, wrists, and hips visible.</span></div>
      {!health && <div className="connection-note">Start the Python backend to enable real comparisons. <code>python -m uvicorn backend.main:app --port 8000</code></div>}
      {busy && <div className="processing" role="status"><CircleNotch className="spin" size={18} />{health?.model_status === 'loading' ? 'Downloading or loading the pretrained models. First use can take several minutes.' : 'Analyzing the two selected frames. CPU processing can take longer.'}</div>}
      {error && <div className="error" role="alert">{error}</div>}
      <section ref={resultEl} className="results-section">
        <div className="section-title"><div><span className="eyebrow">THE REPLAY ROOM</span><h2>{result ? 'A closer look.' : 'Your next insight starts here.'}</h2></div>{result && <button className="secondary" onClick={download}><DownloadSimple size={17} /> Export measurements</button>}</div>
        {!result ? <div className="results-empty"><Stack size={44} weight="thin" /><div><h3>Two moments. A clearer picture.</h3><p>Your pose overlays and observations will appear here after a real comparison.</p></div><span className="empty-label">Awaiting your first comparison</span></div> : <>
          {stale && <div className="stale" role="status"><ArrowsClockwise size={17} /> Inputs have changed. These results belong to the captured frames below. Compare again to update.</div>}
          <div className="result-toolbar"><div className="tabs"><button aria-pressed={view === 'side'} className={view === 'side' ? 'active' : ''} onClick={() => setView('side')}>Side by side</button><button aria-pressed={view === 'overlay'} className={view === 'overlay' ? 'active' : ''} disabled={!overlayReady} onClick={() => setView('overlay')}>Skeleton overlay</button></div><span className="subtle">{result.processing_seconds.toFixed(1)}s processing · {result.device.toUpperCase()}</span></div>
          <div className="results-layout"><div className="visual-results">
            {view === 'side' ? <div className="frame-pair">{(['reference', 'attempt'] as const).map((key, i) => <div key={key} className="frame-column"><div className={`frame-caption ${key}`}><span className="source-dot" />{i ? 'Your attempt' : 'Reference'}<span>{captures[i].time.toFixed(2)}s</span></div><div className="frame" style={{ aspectRatio: `${result[key].width}/${result[key].height}` }}><img src={captures[i].url} alt={`${key} analyzed frame`} /><PoseOverlay points={result[key].landmarks} edges={result.edges} color={i ? '#ffa66b' : '#75c8ff'} active={i === 0 && result.mirror ? selected?.joints.map(n => n.startsWith('left_') ? n.replace('left_', 'right_') : n.replace('right_', 'left_')) : selected?.joints} viewBox={`0 0 ${result[key].width} ${result[key].height}`} label={`${key} detected skeleton`} /></div></div>)}</div> : <div className="normalized-stage"><PoseOverlay points={result.normalized.reference!} edges={result.edges} color="#75c8ff" active={selected?.joints} viewBox={normBox} label="Normalized reference skeleton" /><PoseOverlay points={result.normalized.attempt!} edges={result.edges} color="#ffa66b" active={selected?.joints} viewBox={normBox} label="Normalized attempt skeleton" /></div>}
            <p className="visual-caption">{result.mirror ? 'Mirror comparison: your anatomical left is compared with the reference’s anatomical right.' : 'Comparing the same anatomical sides in both frames.'} {view === 'overlay' && 'Skeletons are centered and scaled by torso length.'}</p>
          </div><aside className="observations"><h3>What to notice <span>{result.measurements.length}</span></h3>{result.measurements.length === 0 && <p>No reliable measurements. Choose clearer frames with visible upper-body landmarks.</p>}{result.measurements.map(m => <button key={m.id} className={`observation ${active === m.id ? 'selected' : ''}`} onClick={() => setActive(m.id)}><div><strong>{m.label}</strong><span>{Math.abs(m.difference_degrees).toFixed(0)}° difference</span></div><p>{m.message}</p><div className="angle-values"><span>Reference <b>{m.reference_angle}°</b></span><span>You <b>{m.attempt_angle}°</b></span></div></button>)}</aside></div>
          {result.warnings.length > 0 && <div className="warnings"><strong>Visibility notes</strong>{result.warnings.map(w => <p key={w}>{w}</p>)}</div>}
          <p className="measurement-note">Approximate 2D differences, not a skill or safety score. Camera angle and body proportions affect comparisons. A difference under 10° is a display tolerance, not a validated coaching standard.</p>
        </>}
      </section>
      <footer><span><Ghost size={19} /> Practice with perspective.</span><span>Selected frames are processed by your local backend. Videos stay in this browser.</span></footer>
    </main>
    {help && <div className="modal-backdrop" onClick={() => setHelp(false)}><section className="help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={e => e.stopPropagation()}><button autoFocus className="close-button" aria-label="Close help" onClick={() => setHelp(false)}><X size={21} /></button><span className="eyebrow">A LITTLE GUIDANCE</span><h2 id="help-title">Practice. Look closer. Repeat.</h2><p>Choose a short, front-facing movement with one person. Photos are welcome too.</p><ol><li>Upload a reference and an attempt.</li><li>Pause each at the same stage of the movement.</li><li>Compare and select an observation to highlight its joints.</li></ol><p>GhostCoach uses real person detection and ViTPose landmarks. It compares selected frames, not entire routines. First use downloads model weights and may take several minutes.</p><p>Use similar camera positions. Low-confidence joints are omitted. Anatomical left/right refers to the person, not the screen.</p><button className="primary" onClick={() => setHelp(false)}><Check size={18} /> Got it, let's practice</button></section></div>}
  </>;
}
