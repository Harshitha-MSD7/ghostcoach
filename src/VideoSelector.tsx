import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { UploadSimple, FilmStrip, ImageSquare, ArrowCounterClockwise } from '@phosphor-icons/react';
import type { Capture } from './types';

export type SelectorHandle = { capture: () => Promise<Capture> };
type Props = { kind: 'reference' | 'attempt'; disabled: boolean; onChange: () => void; onReady: (ready: boolean) => void };
export const VideoSelector = forwardRef<SelectorHandle, Props>(function VideoSelector({ kind, disabled, onChange, onReady }, ref) {
  const video = useRef<HTMLVideoElement>(null);
  const image = useRef<HTMLImageElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const isImage = file?.type.startsWith('image/');
  useEffect(() => {
    if (!file) { setUrl(''); return; }
    const next = URL.createObjectURL(file); setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [file]);
  function updateReady(value: boolean) { setReady(value); onReady(value); }
  function choose(next?: File) {
    if (!next) return;
    if (!/^(image|video)\//.test(next.type)) { setError('Choose a video or image file.'); return; }
    if (next.size > 200 * 1024 * 1024) { setError('Choose a file smaller than 200 MB.'); return; }
    updateReady(false); setError(''); setTime(0); setDuration(0); setFile(next); onChange();
  }
  useImperativeHandle(ref, () => ({ capture: async () => {
    const el = isImage ? image.current : video.current;
    if (!el || !ready) throw new Error('Wait for both selected frames to load.');
    if (el instanceof HTMLVideoElement) {
      el.pause();
      if (el.seeking) await new Promise<void>((resolve, reject) => {
        const finish = () => { clearTimeout(timer); resolve(); };
        const timer = setTimeout(() => { el.removeEventListener('seeked', finish); reject(new Error('Video seek timed out. Try another frame.')); }, 5000);
        el.addEventListener('seeked', finish, { once: true });
      });
    }
    const width = el instanceof HTMLVideoElement ? el.videoWidth : el.naturalWidth;
    const height = el instanceof HTMLVideoElement ? el.videoHeight : el.naturalHeight;
    if (!width || !height) throw new Error('This frame is not available yet.');
    const scale = Math.min(1, 1600 / Math.max(width, height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
    canvas.getContext('2d')!.drawImage(el, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Frame capture failed.')), 'image/jpeg', .92));
    return { blob, url: URL.createObjectURL(blob), time: el instanceof HTMLVideoElement ? el.currentTime : 0 };
  } }), [isImage, ready]);
  return <section className={`source-panel ${kind}`}>
    <div className="source-heading"><div><span className="source-dot" />{kind === 'reference' ? 'Reference' : 'Your attempt'}</div><span className="subtle">{kind === 'reference' ? '01' : '02'}</span></div>
    <div className={`media-well ${!file ? 'empty' : ''}`} style={disabled ? { pointerEvents: 'none' } : undefined} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!disabled) choose(e.dataTransfer.files[0]); }}>
      {!file ? <button className="upload-target" disabled={disabled} onClick={() => input.current?.click()}>
        <span className="upload-art"><FilmStrip size={38} weight="thin" /></span>
        <strong>{kind === 'reference' ? 'Start with inspiration.' : 'Make it your movement.'}</strong>
        <span>{kind === 'reference' ? 'Add the movement you want to practice' : 'Add a recording of your own attempt'}</span>
        <span className="upload-action"><UploadSimple size={16} /> Choose video or image</span>
        <small>or drop a file here · up to 200 MB</small>
      </button> : isImage ? <img ref={image} src={url} alt={`${kind} source`} onLoad={() => updateReady(true)} onError={() => { setError('Image could not be decoded.'); updateReady(false); }} /> :
        <video ref={video} src={url} controls={!disabled} playsInline preload="auto"
          onLoadedMetadata={e => { const d = e.currentTarget.duration; setDuration(Number.isFinite(d) ? d : 0); }}
          onLoadedData={() => updateReady(true)}
          onTimeUpdate={e => { setTime(e.currentTarget.currentTime); onChange(); }}
          onSeeking={() => { updateReady(false); onChange(); }} onSeeked={() => updateReady(true)}
          onError={() => { setError('This video format cannot be played. Try an H.264 MP4 or a photo.'); updateReady(false); }} />}
    </div>
    <input ref={input} className="sr-only" type="file" accept="video/*,image/jpeg,image/png,image/webp" aria-label={`Upload ${kind}`} disabled={disabled} onChange={e => { choose(e.target.files?.[0]); e.target.value = ''; }} />
    <div className="source-controls">
      <div className="file-row"><span>{file ? file.name : <><ImageSquare size={15} /> Photos work too</>}</span>
        {file && <button disabled={disabled} className="text-button" onClick={() => input.current?.click()}><ArrowCounterClockwise size={14} /> Replace</button>}
      </div>
      <div className="scrubber"><input type="range" aria-label={`${kind} frame timestamp`} min={0} max={duration || 1} step={.04} value={time} disabled={!file || !!isImage || disabled || !duration}
        onChange={e => { const t = Number(e.target.value); setTime(t); if (video.current) video.current.currentTime = t; onChange(); }} /><span>{time.toFixed(2)}s</span></div>
    </div>
    {error && <p className="error inline" role="alert">{error}</p>}
  </section>;
});
