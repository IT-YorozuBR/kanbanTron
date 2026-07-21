"use client";

import { useRef, useState, type ChangeEvent } from "react";

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoPlayer({ src }: { src: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);

  function togglePlay() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) void video.play();
    else video.pause();
  }

  function handleSeek(e: ChangeEvent<HTMLInputElement>) {
    const video = videoRef.current;
    if (!video) return;
    const value = Number(e.target.value);
    video.currentTime = value;
    setCurrentTime(value);
  }

  function handleVolumeChange(e: ChangeEvent<HTMLInputElement>) {
    const video = videoRef.current;
    if (!video) return;
    const value = Number(e.target.value);
    video.volume = value;
    video.muted = value === 0;
    setVolume(value);
    setMuted(value === 0);
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  function toggleFullscreen() {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void container.requestFullscreen();
  }

  return (
    <div ref={containerRef} className="overflow-hidden rounded-xl bg-black">
      <video
        ref={videoRef}
        src={src}
        className="block max-h-[70vh] w-full cursor-pointer bg-black"
        onClick={togglePlay}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
      <div className="flex items-center gap-3 bg-black/85 px-4 py-3">
        <button type="button" onClick={togglePlay} aria-label={playing ? "Pausar" : "Reproduzir"} className="shrink-0 text-white">
          {playing ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <rect x="3" y="2" width="4" height="12" rx="1" />
              <rect x="9" y="2" width="4" height="12" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M4 2.5v11l10-5.5-10-5.5Z" />
            </svg>
          )}
        </button>

        <span className="w-9 shrink-0 text-right text-xs tabular-nums text-white/70">{formatTime(currentTime)}</span>

        <input
          type="range"
          className="aero-range flex-1"
          min={0}
          max={duration || 0}
          step={0.01}
          value={currentTime}
          onChange={handleSeek}
          aria-label="Progresso do video"
        />

        <span className="w-9 shrink-0 text-xs tabular-nums text-white/70">{formatTime(duration)}</span>

        <button type="button" onClick={toggleMute} aria-label={muted ? "Ativar som" : "Mudo"} className="shrink-0 text-white">
          {muted || volume === 0 ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 6h2.5L8 3v10L4.5 10H2V6Z" fill="currentColor" />
              <path d="M10.5 6.5l3 3M13.5 6.5l-3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2 6h2.5L8 3v10L4.5 10H2V6Z" fill="currentColor" />
              <path d="M10.5 5.5a4 4 0 0 1 0 5M12.3 4a6.3 6.3 0 0 1 0 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
          )}
        </button>

        <input
          type="range"
          className="aero-range hidden w-16 sm:block"
          min={0}
          max={1}
          step={0.05}
          value={muted ? 0 : volume}
          onChange={handleVolumeChange}
          aria-label="Volume"
        />

        <button type="button" onClick={toggleFullscreen} aria-label="Tela cheia" className="shrink-0 text-white">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <path
              d="M2 6V3.5A1.5 1.5 0 0 1 3.5 2H6M10 2h2.5A1.5 1.5 0 0 1 14 3.5V6M14 10v2.5a1.5 1.5 0 0 1-1.5 1.5H10M6 14H3.5A1.5 1.5 0 0 1 2 12.5V10"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
