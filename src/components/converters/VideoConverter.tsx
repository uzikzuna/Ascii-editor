import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, Volume2, VolumeX,
  ZoomIn, ZoomOut, Video as VideoIcon
} from 'lucide-react';
import { imageToAscii } from '../../utils/asciiMath';
import type { AsciiOptions } from '../../utils/asciiMath';
import { Button, Slider, Select, Switch, useToast } from '../shared/Widgets';

interface VideoConverterProps {
  initialFile: File | null;
  onClearInitialFile: () => void;
}

export const VideoConverter: React.FC<VideoConverterProps> = ({
  initialFile,
  onClearInitialFile
}) => {
  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [loop, setLoop] = useState(true);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [showControls, setShowControls] = useState(true);

  const [options, setOptions] = useState<AsciiOptions>({
    width: 90,
    height: 44,
    brightness: 5,
    contrast: 10,
    sharpness: 0,
    charMode: 'standard',
    colorMode: 'color',
    invert: false,
    dithering: 'none',
    customChars: ''
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const { showToast } = useToast();

  // Load drag-and-dropped file
  useEffect(() => {
    if (initialFile) {
      loadVideoFile(initialFile);
      onClearInitialFile();
    }
  }, [initialFile, onClearInitialFile]);

  // Video play loop
  useEffect(() => {
    if (isPlaying && videoSrc) {
      const renderLoop = () => {
        renderFrame();
        if (videoRef.current) {
          setCurrentTime(videoRef.current.currentTime);
        }
        requestRef.current = requestAnimationFrame(renderLoop);
      };
      requestRef.current = requestAnimationFrame(renderLoop);
    } else {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
    }

    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [isPlaying, videoSrc, options]);

  const loadVideoFile = (file: File) => {
    setIsPlaying(false);
    if (videoSrc) URL.revokeObjectURL(videoSrc);
    
    const url = URL.createObjectURL(file);
    setVideoSrc(url);
    showToast('Video loaded successfully!', 'success');
  };

  const renderFrame = () => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended) return;

    const sampleCanvas = sampleCanvasRef.current || document.createElement('canvas');
    sampleCanvasRef.current = sampleCanvas;
    const sampleCtx = sampleCanvas.getContext('2d');
    if (!sampleCtx) return;

    // Resample dimensions
    const isBraille = options.charMode === 'braille';
    sampleCanvas.width = isBraille ? options.width * 2 : options.width;
    sampleCanvas.height = isBraille ? options.height * 4 : options.height;

    // Sample video frame
    sampleCtx.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);

    // Convert
    const result = imageToAscii(sampleCanvas, options);
    
    // Draw to view screen
    drawToPreviewCanvas(result);
  };

  const drawToPreviewCanvas = (ascii: { charGrid: string[][]; colors?: { r: number; g: number; b: number }[][] }) => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) return;

    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;

    const grid = ascii.charGrid;
    const colors = ascii.colors;
    const rows = grid.length;
    const cols = grid[0]?.length || 0;

    if (cols === 0 || rows === 0) return;

    const charWidth = 7;
    const charHeight = 10;

    previewCanvas.width = cols * charWidth;
    previewCanvas.height = rows * charHeight;

    const activeTheme = document.documentElement.getAttribute('data-theme') || 'jarvis';
    let bg = '#080e1a';
    if (activeTheme === 'green-terminal' || activeTheme === 'oled-dark') bg = '#000000';
    else if (activeTheme === 'amber-crt') bg = '#0c0600';
    else if (activeTheme === 'cyberpunk') bg = '#120a18';
    else if (activeTheme === 'monochrome-white') bg = '#ffffff';
    else if (activeTheme === 'light-mode') bg = '#f0f4f8';

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);

    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const char = grid[r][c];

        if (colors && colors[r] && colors[r][c]) {
          const { r: red, g: green, b: blue } = colors[r][c];
          ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        } else {
          if (activeTheme === 'monochrome-white' || activeTheme === 'light-mode') {
            ctx.fillStyle = '#0f172a';
          } else {
            ctx.fillStyle = 'rgb(56, 189, 248)';
          }
        }

        ctx.fillText(char, c * charWidth, r * charHeight);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) loadVideoFile(file);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      video.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        showToast('Playback blocked. Ensure user interacted.', 'error');
      });
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
      // Trigger a single frame render when loaded paused
      setTimeout(renderFrame, 200);
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Hidden Video Player Element */}
      {videoSrc && (
        <video
          ref={videoRef}
          src={videoSrc}
          loop={loop}
          muted={isMuted}
          playsInline
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          className="hidden"
        />
      )}

      {/* Settings Side Panel */}
      <AnimatePresence>
        {showControls && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: '320px', opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="w-full md:w-80 border-b md:border-b-0 md:border-r border-theme-border/60 bg-theme-panel/40 backdrop-blur-md flex flex-col flex-shrink-0"
          >
            <div className="p-4 border-b border-theme-border/40 flex items-center justify-between bg-black/10">
              <span className="text-xs font-mono font-bold tracking-widest text-theme-muted uppercase flex items-center gap-1.5">
                <VideoIcon className="w-4 h-4 text-theme-accent" />
                VIDEO ENGINE PANEL
              </span>
              <Button variant="secondary" size="sm" onClick={() => setVideoSrc(null)} className="py-1 px-2 text-[10px]">
                Reset
              </Button>
            </div>

            {videoSrc ? (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
                {/* File summary */}
                <div className="glass border border-theme-border/40 p-3 rounded-lg flex flex-col gap-1.5">
                  <p className="text-xs font-bold text-theme-text font-sans">INPUT METADATA</p>
                  <div className="flex justify-between text-[10px] font-mono text-theme-muted mt-1">
                    <span>DURATION: {duration.toFixed(1)}s</span>
                    <span>SPEED: {playbackRate}x</span>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] text-theme-accent hover:text-theme-text font-mono underline mt-1 text-left"
                  >
                    Load another video
                  </button>
                </div>

                {/* Sizing Resolution */}
                <div className="flex flex-col gap-3">
                  <Slider label="COLUMNS (WIDTH)" min={20} max={180} step={2} value={options.width} onChange={(val) => setOptions(prev => ({ ...prev, width: val }))} />
                  <Slider label="ROWS (HEIGHT)" min={10} max={120} step={2} value={options.height} onChange={(val) => setOptions(prev => ({ ...prev, height: val }))} />
                </div>

                {/* Video specific modifiers */}
                <div className="border-t border-theme-border/20 pt-4 flex flex-col gap-4">
                  <Select
                    label="PLAYBACK SPEED"
                    value={playbackRate.toString()}
                    onChange={(val) => {
                      const num = Number(val);
                      setPlaybackRate(num);
                      if (videoRef.current) videoRef.current.playbackRate = num;
                    }}
                    options={[
                      { value: '0.5', label: '0.5x (Slow Motion)' },
                      { value: '1', label: '1.0x (Standard)' },
                      { value: '1.5', label: '1.5x (Fast)' },
                      { value: '2', label: '2.0x (Double Speed)' }
                    ]}
                  />

                  <Switch label="LOOP VIDEO PLAYBACK" checked={loop} onChange={setLoop} />
                  <Switch 
                    label="MUTED AUDIO CHANNEL" 
                    checked={isMuted} 
                    onChange={(val) => {
                      setIsMuted(val);
                      if (videoRef.current) videoRef.current.muted = val;
                    }} 
                  />
                </div>

                {/* Image Filters */}
                <div className="border-t border-theme-border/30 pt-4 flex flex-col gap-4">
                  <Slider label="BRIGHTNESS" min={-100} max={100} step={5} value={options.brightness} onChange={(val) => setOptions(prev => ({ ...prev, brightness: val }))} />
                  <Slider label="CONTRAST" min={-100} max={100} step={5} value={options.contrast} onChange={(val) => setOptions(prev => ({ ...prev, contrast: val }))} />
                </div>

                {/* Character Settings */}
                <div className="border-t border-theme-border/30 pt-4 flex flex-col gap-3">
                  <Select
                    label="CHARACTER MODE"
                    value={options.charMode}
                    onChange={(val) => setOptions(prev => ({ ...prev, charMode: val as any }))}
                    options={[
                      { value: 'standard', label: 'Standard ASCII' },
                      { value: 'extended', label: 'Extended ASCII' },
                      { value: 'blocks', label: 'Unicode Blocks' },
                      { value: 'braille', label: 'Braille Patterns' },
                      { value: 'matrix', label: 'Matrix Digital' }
                    ]}
                  />

                  <Select
                    label="COLOR MODE"
                    value={options.colorMode}
                    onChange={(val) => setOptions(prev => ({ ...prev, colorMode: val as any }))}
                    options={[
                      { value: 'mono', label: 'Monochrome' },
                      { value: 'color', label: 'Full RGB Color' },
                      { value: 'green', label: 'Phosphor Green' },
                      { value: 'amber', label: 'Phosphor Amber' },
                      { value: 'rgb', label: 'Spectrum Loop' }
                    ]}
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-theme-muted">
                No active video loaded. Load a video source to see controls.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Preview Workspace */}
      <div className="flex-1 flex flex-col h-full bg-black/40 overflow-hidden relative">
        {/* Toolbar Header */}
        <div className="h-12 border-b border-theme-border/40 bg-theme-panel/60 backdrop-blur-sm px-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowControls(prev => !prev)}>
              {showControls ? 'Hide Controls' : 'Show Controls'}
            </Button>
          </div>

          {videoSrc && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPreviewZoom(prev => Math.max(25, prev - 25))} className="p-1.5">
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs font-mono text-theme-muted">{previewZoom}%</span>
              <Button variant="secondary" size="sm" onClick={() => setPreviewZoom(prev => Math.min(300, prev + 25))} className="p-1.5">
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* Viewport */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 relative">
          {videoSrc ? (
            <div 
              style={{ transform: `scale(${previewZoom / 100})`, transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)' }}
              className="origin-center shadow-2xl"
            >
              <canvas ref={previewCanvasRef} className="max-w-none shadow-[0_0_50px_rgba(0,0,0,0.8)]" />
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="glass border border-theme-border/40 rounded-xl p-12 text-center cursor-pointer flex flex-col items-center gap-4 max-w-md hover:bg-white/5 hover:border-theme-accent/30 transition-all duration-300"
            >
              <div className="w-16 h-16 rounded-full bg-theme-accent/15 border border-theme-accent/30 shadow-neon flex items-center justify-center text-theme-accent">
                <VideoIcon className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-theme-text">Upload Video Source</h3>
                <p className="text-xs text-theme-muted mt-2">
                  Select an MP4, WEBM, or MOV video file. Real-time conversion handles 60 FPS playback loops.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Playback Control Bar */}
        {videoSrc && (
          <div className="h-16 border-t border-theme-border/40 bg-theme-panel/75 backdrop-blur-md px-6 flex items-center justify-between gap-6 z-10">
            <div className="flex items-center gap-2.5 flex-shrink-0">
              <Button variant="primary" size="sm" onClick={togglePlay} className="px-4 py-2">
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
              </Button>
              
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => {
                  setIsMuted(prev => !prev);
                  if (videoRef.current) videoRef.current.muted = !isMuted;
                }}
                className="p-2"
              >
                {isMuted ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4" />}
              </Button>
            </div>

            {/* Scrubber slider */}
            <div className="flex-1 flex items-center gap-3">
              <span className="text-xs font-mono text-theme-muted flex-shrink-0">
                {currentTime.toFixed(1)}s / {duration.toFixed(1)}s
              </span>
              <input
                type="range"
                min={0}
                max={duration || 100}
                step={0.1}
                value={currentTime}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCurrentTime(val);
                  if (videoRef.current) videoRef.current.currentTime = val;
                  // If paused, force render frame immediately
                  if (!isPlaying) setTimeout(renderFrame, 50);
                }}
                className="flex-1 h-1 bg-theme-border rounded-lg appearance-none cursor-pointer accent-theme-accent focus:outline-none"
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
