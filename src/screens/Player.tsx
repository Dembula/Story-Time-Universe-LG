import { useCallback, useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
import { ViewerAPI } from "@/api/viewerApi";
import { resolveStreamUrl } from "@/api/mediaUrl";
import type { EpisodePlaybackInfo } from "@/api/types";
import type { PlaybackRequest } from "@/state/Navigation";
import { useRemote } from "@/tv/useRemote";
import { focusManager } from "@/tv/focusManager";

interface PlayerProps {
  request: PlaybackRequest;
  onClose: () => void;
}

const CONTROLS_TIMEOUT = 3800;
const SEEK_STEP = 10;

export function Player({ request, onClose }: PlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [buffered, setBuffered] = useState(0);
  const [seekFeedback, setSeekFeedback] = useState<{ dir: 1 | -1; total: number } | null>(null);
  const [currentEpisodeId, setCurrentEpisodeId] = useState<string | null>(request.episodeId ?? null);
  const [nextUp, setNextUp] = useState<EpisodePlaybackInfo | null>(null);
  const [countdown, setCountdown] = useState(0);

  const hideTimer = useRef<number | null>(null);
  const seekTimer = useRef<number | null>(null);
  const countdownTimer = useRef<number | null>(null);
  const lastSaved = useRef(0);
  const watched = useRef(0);
  const contentIdRef = useRef(request.contentId);

  // Pause the spatial engine so no white focus rings appear over the video.
  useEffect(() => {
    focusManager.setPaused(true);
    return () => focusManager.setPaused(false);
  }, []);

  const scheduleHide = useCallback(() => {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => {
      const v = videoRef.current;
      if (v && !v.paused) setControlsVisible(false);
    }, CONTROLS_TIMEOUT);
  }, []);

  const showControls = useCallback(
    (persist = false) => {
      setControlsVisible(true);
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (!persist) scheduleHide();
    },
    [scheduleHide],
  );

  const saveProgress = useCallback((final: boolean) => {
    const v = videoRef.current;
    if (!v || request.isTrailer) return;
    const pos = v.currentTime;
    if (!isFinite(pos) || pos < 0) return;
    const dur = isFinite(v.duration) ? v.duration : undefined;
    if (!final && Math.abs(pos - lastSaved.current) < 3) return;
    lastSaved.current = pos;
    watched.current = Math.max(watched.current, pos);
    void ViewerAPI.saveWatchProgress(contentIdRef.current, pos, dur);
    if (final && watched.current > 5) {
      void ViewerAPI.recordWatchSession(contentIdRef.current, watched.current);
    }
  }, [request.isTrailer]);

  const loadSource = useCallback(
    async (episodeId: string | null, isTrailer: boolean) => {
      const video = videoRef.current;
      if (!video) return;
      setLoading(true);
      setError(null);

      // Tear down any previous HLS instance.
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      try {
        const bundle = await ViewerAPI.fetchPlaybackBundle({
          contentId: request.contentId,
          episodeId,
          trailer: isTrailer,
        });
        const src = resolveStreamUrl(bundle.playback?.src);
        if (!src) throw new Error("No playable stream was returned for this title.");

        const isHls =
          bundle.playback?.type === "application/x-mpegurl" || /\.m3u8($|\?)/i.test(src);

        const resumeAt = isTrailer
          ? 0
          : (await ViewerAPI.fetchWatchProgress(request.contentId).catch(() => ({ position: 0 }))).position;

        const startPlayback = () => {
          if (!isTrailer && resumeAt > 5) {
            try {
              video.currentTime = resumeAt;
            } catch {
              /* ignore */
            }
          }
          void video.play().then(() => setPlaying(true)).catch(() => undefined);
          setLoading(false);
        };

        if (isHls && !video.canPlayType("application/vnd.apple.mpegurl")) {
          const HlsMod = (await import("hls.js")).default;
          if (HlsMod.isSupported()) {
            const hls = new HlsMod({
              enableWorker: true,
              lowLatencyMode: false,
              xhrSetup: (xhr) => {
                xhr.withCredentials = true;
              },
            });
            hlsRef.current = hls;
            hls.loadSource(src);
            hls.attachMedia(video);
            hls.on(HlsMod.Events.MANIFEST_PARSED, startPlayback);
            hls.on(HlsMod.Events.ERROR, (_e, data) => {
              if (data.fatal) setError("Playback error. Please try again.");
            });
            return;
          }
        }

        // Native HLS (webOS/Safari) or progressive MP4.
        video.src = src;
        video.addEventListener("loadedmetadata", startPlayback, { once: true });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not start playback.");
        setLoading(false);
      }
    },
    [request.contentId],
  );

  // Initial load.
  useEffect(() => {
    contentIdRef.current = request.contentId;
    void loadSource(request.episodeId ?? null, !!request.isTrailer);
    showControls();
    return () => {
      saveProgress(true);
      if (hlsRef.current) hlsRef.current.destroy();
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
      if (countdownTimer.current) window.clearInterval(countdownTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Time / progress updates.
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => {
      setCurrent(v.currentTime);
      if (isFinite(v.duration)) setDuration(v.duration);
      if (v.buffered.length) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const onPlay = () => {
      setPlaying(true);
      scheduleHide();
    };
    const onPause = () => {
      setPlaying(false);
      showControls(true);
    };
    const interval = window.setInterval(() => saveProgress(false), 8000);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", handleEnded);
    return () => {
      window.clearInterval(interval);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", handleEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scheduleHide, showControls, saveProgress]);

  const nextEpisode = useCallback((): EpisodePlaybackInfo | null => {
    if (request.isTrailer || !request.episodes?.length || !currentEpisodeId) return null;
    const idx = request.episodes.findIndex((e) => e.episodeId === currentEpisodeId);
    if (idx < 0 || idx + 1 >= request.episodes.length) return null;
    return request.episodes[idx + 1];
  }, [request.episodes, request.isTrailer, currentEpisodeId]);

  function handleEnded() {
    saveProgress(true);
    const next = nextEpisode();
    if (next) beginNextUp(next);
  }

  function beginNextUp(next: EpisodePlaybackInfo) {
    setNextUp(next);
    setCountdown(8);
    setControlsVisible(false);
    if (countdownTimer.current) window.clearInterval(countdownTimer.current);
    countdownTimer.current = window.setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          window.clearInterval(countdownTimer.current!);
          playEpisode(next);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }

  function playEpisode(ep: EpisodePlaybackInfo) {
    if (countdownTimer.current) window.clearInterval(countdownTimer.current);
    setNextUp(null);
    setCurrentEpisodeId(ep.episodeId);
    void loadSource(ep.episodeId, false);
    showControls();
  }

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPlaying(true);
      scheduleHide();
    } else {
      v.pause();
      setPlaying(false);
      showControls(true);
    }
  }, [scheduleHide, showControls]);

  const seekBy = useCallback(
    (delta: number) => {
      const v = videoRef.current;
      if (!v) return;
      let target = v.currentTime + delta;
      target = Math.max(0, isFinite(v.duration) ? Math.min(target, v.duration) : target);
      v.currentTime = target;
      setCurrent(target);
      showControls();
      setSeekFeedback((prev) => {
        const total = prev && prev.dir === (delta > 0 ? 1 : -1) ? prev.total + Math.abs(delta) : Math.abs(delta);
        return { dir: delta > 0 ? 1 : -1, total };
      });
      if (seekTimer.current) window.clearTimeout(seekTimer.current);
      seekTimer.current = window.setTimeout(() => setSeekFeedback(null), 800);
    },
    [showControls],
  );

  const exit = useCallback(() => {
    saveProgress(true);
    onClose();
  }, [onClose, saveProgress]);

  useRemote({
    disableSpatial: true,
    onBack: () => {
      if (nextUp) {
        setNextUp(null);
        if (countdownTimer.current) window.clearInterval(countdownTimer.current);
        showControls(true);
        return;
      }
      exit();
    },
    onPlayPause: togglePlay,
    onPlay: () => {
      videoRef.current?.play();
      setPlaying(true);
    },
    onPause: () => {
      videoRef.current?.pause();
      setPlaying(false);
    },
    onStop: exit,
    onFastForward: () => seekBy(SEEK_STEP),
    onRewind: () => seekBy(-SEEK_STEP),
    onKey: (code) => {
      if (nextUp) {
        if (code === 13) {
          playEpisode(nextUp);
          return true;
        }
        return false;
      }
      switch (code) {
        case 37: // LEFT
          seekBy(-SEEK_STEP);
          return true;
        case 39: // RIGHT
          seekBy(SEEK_STEP);
          return true;
        case 38: // UP
        case 40: // DOWN
          showControls();
          return true;
        case 13: // OK
          togglePlay();
          return true;
        default:
          return false;
      }
    },
  });

  const progressPct = duration > 0 ? (current / duration) * 100 : 0;
  const bufferedPct = duration > 0 ? (buffered / duration) * 100 : 0;
  const titleText = request.isTrailer ? `Trailer · ${request.title}` : request.title;

  return (
    <div className="player">
      <video ref={videoRef} className="player-video" playsInline />

      {loading && !error && (
        <div className="player-center">
          <div className="spinner" />
          <div className="player-loading-text">{request.isTrailer ? "Loading trailer…" : "Loading…"}</div>
        </div>
      )}

      {error && (
        <div className="player-center">
          <div className="player-error-icon">⚠</div>
          <div className="error-text">{error}</div>
          <button className="btn btn-secondary" onClick={exit}>
            Close
          </button>
        </div>
      )}

      {seekFeedback && (
        <div className={`seek-feedback ${seekFeedback.dir > 0 ? "right" : "left"}`}>
          <div className="seek-glyph">{seekFeedback.dir > 0 ? "»" : "«"}</div>
          <div className="seek-amount">{seekFeedback.total}s</div>
        </div>
      )}

      {/* Controls overlay — title + back button fade in/out with activity. */}
      {!nextUp && (
        <div className={`player-controls ${controlsVisible ? "visible" : ""}`}>
          <div className="player-scrim-top" />
          <div className="player-scrim-bottom" />

          <div className="player-top">
            <button className="player-back" onClick={exit} aria-label="Back">
              ‹
            </button>
            <div className="player-title">{titleText}</div>
            <div className="player-top-spacer" />
          </div>

          {!playing && !loading && (
            <button className="player-bigplay" onClick={togglePlay} aria-label="Play">
              ▶
            </button>
          )}

          <div className="player-bottom">
            <div className="player-timerow">
              <span className="player-time">{formatTime(current)}</span>
              <div className="seekbar">
                <div className="seekbar-track" />
                <div className="seekbar-buffered" style={{ width: `${bufferedPct}%` }} />
                <div className="seekbar-fill" style={{ width: `${progressPct}%` }} />
              </div>
              <span className="player-time">{formatTime(duration)}</span>
            </div>

            <div className="player-transport">
              <span className="transport-hint">◄◄ 10s</span>
              <button className="transport-btn primary" onClick={togglePlay}>
                {playing ? "❚❚" : "▶"}
              </button>
              <span className="transport-hint">10s ►►</span>
            </div>
          </div>
        </div>
      )}

      {nextUp && (
        <div className="nextup">
          <div className="nextup-card rise-in">
            <div className="nextup-kicker">Up Next</div>
            <div className="nextup-label">{nextUp.episodeLabel}</div>
            <div className="nextup-title">{nextUp.title}</div>
            <div className="nextup-actions">
              <button className="btn btn-primary" onClick={() => playEpisode(nextUp)}>
                ▶ Play Next {countdown > 0 ? `· ${countdown}` : ""}
              </button>
              <button className="btn btn-secondary" onClick={exit}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return "0:00";
  const total = Math.round(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}
