import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, Pause, SkipForward, SkipBack, Download,
  ZoomIn, ZoomOut, Film, RefreshCw
} from 'lucide-react';
import { parseGIF, decompressFrames } from 'gifuct-js';
import type { GIFFrame } from 'gifuct-js';
import { imageToAscii } from '../../utils/asciiMath';
import type { AsciiOptions } from '../../utils/asciiMath';
import { Button, Slider, Select, Switch, useToast } from '../shared/Widgets';

interface GifConverterProps {
  initialFile: File | null;
  onClearInitialFile: () => void;
}

export const GifConverter: React.FC<GifConverterProps> = ({
  initialFile,
  onClearInitialFile
}) => {
  const [gifFrames, setGifFrames] = useState<GIFFrame[]>([]);
  const [currentFrameIdx, setCurrentFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(10);
  const [loop, setLoop] = useState(true);
  const [onionSkin, setOnionSkin] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [showControls, setShowControls] = useState(true);
  
  const [options, setOptions] = useState<AsciiOptions>({
    width: 80,
    height: 40,
    brightness: 0,
    contrast: 0,
    sharpness: 0,
    charMode: 'standard',
    colorMode: 'color',
    invert: false,
    dithering: 'none',
    customChars: ''
  });

  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Offscreen canvasses for decoding
  const gifCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Active preview canvas
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  
  const playTimerRef = useRef<number | null>(null);
  const { showToast } = useToast();

  // Handle drag and drop files from dashboard
  useEffect(() => {
    if (initialFile) {
      loadGifFile(initialFile);
      onClearInitialFile();
    }
  }, [initialFile, onClearInitialFile]);

  // Handle frame progression during playback
  useEffect(() => {
    if (isPlaying && gifFrames.length > 0) {
      const delay = 1000 / fps;
      playTimerRef.current = window.setTimeout(() => {
        setCurrentFrameIdx(prev => {
          if (prev >= gifFrames.length - 1) {
            if (loop) return 0;
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, delay);
    }

    return () => {
      if (playTimerRef.current) clearTimeout(playTimerRef.current);
    };
  }, [isPlaying, currentFrameIdx, gifFrames, fps, loop]);

  // Redraw ASCII whenever active frame or rendering options change
  useEffect(() => {
    if (gifFrames.length > 0 && gifFrames[currentFrameIdx]) {
      renderActiveFrame();
    }
  }, [currentFrameIdx, gifFrames, options, onionSkin]);

  const loadGifFile = (file: File) => {
    setLoading(true);
    setLoadingProgress(10);
    setIsPlaying(false);
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        setLoadingProgress(40);
        
        const parsed = parseGIF(buffer);
        setLoadingProgress(70);
        
        const decompressed = decompressFrames(parsed, true);
        setLoadingProgress(90);
        
        if (decompressed.length === 0) {
          showToast('Failed to decode GIF frames', 'error');
          setLoading(false);
          return;
        }

        setGifFrames(decompressed);
        setCurrentFrameIdx(0);
        
        // Estimate FPS from first frame delay
        const delay = decompressed[0]?.delay || 100;
        setFps(Math.round(1000 / delay) || 10);
        
        setLoading(false);
        showToast(`Loaded GIF with ${decompressed.length} frames!`, 'success');
      } catch (err) {
        console.error(err);
        showToast('Error parsing GIF file.', 'error');
        setLoading(false);
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const renderActiveFrame = () => {
    const frame = gifFrames[currentFrameIdx];
    if (!frame) return;

    // 1. Get dimensions of the full GIF (dims of the first frame is usually the bounds)
    const firstFrame = gifFrames[0];
    const gifWidth = firstFrame.dims.width;
    const gifHeight = firstFrame.dims.height;

    // 2. Set up offscreen GIF canvas
    const gifCanvas = gifCanvasRef.current || document.createElement('canvas');
    gifCanvasRef.current = gifCanvas;
    gifCanvas.width = gifWidth;
    gifCanvas.height = gifHeight;
    const gifCtx = gifCanvas.getContext('2d');
    if (!gifCtx) return;

    // Dispose frame or clear canvas depending on frame type
    gifCtx.clearRect(0, 0, gifWidth, gifHeight);

    // Draw previous frame for onion skinning
    if (onionSkin && currentFrameIdx > 0) {
      const prevFrame = gifFrames[currentFrameIdx - 1];
      drawFramePatch(gifCtx, prevFrame);
      // Blend opacity
      gifCtx.fillStyle = 'rgba(8, 14, 26, 0.4)';
      gifCtx.fillRect(0, 0, gifWidth, gifHeight);
    }

    // Draw active frame patch
    drawFramePatch(gifCtx, frame);

    // 3. Set up sample canvas at target rows/cols for ASCII
    const sampleCanvas = sampleCanvasRef.current || document.createElement('canvas');
    sampleCanvasRef.current = sampleCanvas;
    const sampleCtx = sampleCanvas.getContext('2d');
    if (!sampleCtx) return;

    const isBraille = options.charMode === 'braille';
    sampleCanvas.width = isBraille ? options.width * 2 : options.width;
    sampleCanvas.height = isBraille ? options.height * 4 : options.height;

    // Resample GIF canvas down to ASCII character grid size
    sampleCtx.drawImage(gifCanvas, 0, 0, sampleCanvas.width, sampleCanvas.height);

    // 4. Run ASCII Art converter
    const ascii = imageToAscii(sampleCanvas, options);

    // 5. Draw results to visible preview canvas
    drawToPreviewCanvas(ascii);
  };

  const drawFramePatch = (ctx: CanvasRenderingContext2D, frame: GIFFrame) => {
    if (!frame.patch) return;
    const patchCanvas = document.createElement('canvas');
    patchCanvas.width = frame.dims.width;
    patchCanvas.height = frame.dims.height;
    const patchCtx = patchCanvas.getContext('2d');
    if (!patchCtx) return;

    const imgData = patchCtx.createImageData(frame.dims.width, frame.dims.height);
    imgData.data.set(frame.patch);
    patchCtx.putImageData(imgData, 0, 0);

    ctx.drawImage(patchCanvas, frame.dims.left, frame.dims.top);
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
    if (file) {
      loadGifFile(file);
    }
  };

  // Compile full ASCII text frames for download
  const exportAsciiFramesText = () => {
    if (gifFrames.length === 0) return;
    showToast('Compiling animation frames...', 'info');

    // Run converter on all frames and join them
    // Note: We use sample canvasses offscreen
    const output: string[] = [];
    const firstFrame = gifFrames[0];
    const gifWidth = firstFrame.dims.width;
    const gifHeight = firstFrame.dims.height;

    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = gifWidth;
    tempCanvas.height = gifHeight;
    const tempCtx = tempCanvas.getContext('2d');

    const sampleCanvas = document.createElement('canvas');
    const isBraille = options.charMode === 'braille';
    sampleCanvas.width = isBraille ? options.width * 2 : options.width;
    sampleCanvas.height = isBraille ? options.height * 4 : options.height;
    const sampleCtx = sampleCanvas.getContext('2d');

    if (!tempCtx || !sampleCtx) return;

    gifFrames.forEach((frame, idx) => {
      // Clear or overlay
      tempCtx.clearRect(0, 0, gifWidth, gifHeight);
      drawFramePatch(tempCtx, frame);
      
      sampleCtx.clearRect(0, 0, sampleCanvas.width, sampleCanvas.height);
      sampleCtx.drawImage(tempCanvas, 0, 0, sampleCanvas.width, sampleCanvas.height);
      
      const res = imageToAscii(sampleCanvas, options);
      output.push(`--- FRAME ${idx} ---\n${res.text}`);
    });

    const blob = new Blob([output.join('\n\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ascii_forge_gif_frames.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded text frames!', 'success');
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/gif"
        onChange={handleFileUpload}
        className="hidden"
      />

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
                <Film className="w-4 h-4 text-theme-accent" />
                GIF TIMELINE PANEL
              </span>
              <Button variant="secondary" size="sm" onClick={() => setGifFrames([])} className="py-1 px-2 text-[10px]">
                Reset
              </Button>
            </div>

            {gifFrames.length > 0 ? (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
                {/* File summary */}
                <div className="glass border border-theme-border/40 p-3 rounded-lg flex flex-col gap-1.5">
                  <p className="text-xs font-bold text-theme-text font-sans">GIF SEQUENCER CACHE</p>
                  <div className="flex justify-between text-[10px] font-mono text-theme-muted mt-1">
                    <span>FRAMES: {gifFrames.length}</span>
                    <span>FPS CONFIG: {fps}</span>
                  </div>
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="text-[10px] text-theme-accent hover:text-theme-text font-mono underline mt-1 text-left"
                  >
                    Load another GIF
                  </button>
                </div>

                {/* Timeline parameters */}
                <div className="flex flex-col gap-4 border-b border-theme-border/20 pb-4">
                  <Slider label="PLAYBACK SPEED (FPS)" min={1} max={30} step={1} value={fps} onChange={setFps} />
                  
                  <Switch label="LOOP SEQUENCE" checked={loop} onChange={setLoop} />
                  <Switch label="ONION SKINNING" checked={onionSkin} onChange={setOnionSkin} />
                </div>

                {/* Sizing Resolution */}
                <div className="flex flex-col gap-3">
                  <Slider label="COLUMNS (WIDTH)" min={20} max={180} step={2} value={options.width} onChange={(val) => setOptions(prev => ({ ...prev, width: val }))} />
                  <Slider label="ROWS (HEIGHT)" min={10} max={120} step={2} value={options.height} onChange={(val) => setOptions(prev => ({ ...prev, height: val }))} />
                </div>

                {/* Filters */}
                <div className="border-t border-theme-border/30 pt-4 flex flex-col gap-4">
                  <Slider label="BRIGHTNESS" min={-100} max={100} step={5} value={options.brightness} onChange={(val) => setOptions(prev => ({ ...prev, brightness: val }))} />
                  <Slider label="CONTRAST" min={-100} max={100} step={5} value={options.contrast} onChange={(val) => setOptions(prev => ({ ...prev, contrast: val }))} />
                  <Slider label="SHARPNESS" min={0} max={100} step={5} value={options.sharpness} onChange={(val) => setOptions(prev => ({ ...prev, sharpness: val }))} />
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
                      { value: 'braille', label: 'Braille Patterns (High-Res)' },
                      { value: 'pixel', label: 'Solid Pixel Block' },
                      { value: 'matrix', label: 'Matrix Katakana' }
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
                      { value: 'rgb', label: 'Rainbow Spectrum' }
                    ]}
                  />

                  <Select
                    label="DITHERING MODE"
                    value={options.dithering}
                    onChange={(val) => setOptions(prev => ({ ...prev, dithering: val as any }))}
                    options={[
                      { value: 'none', label: 'None' },
                      { value: 'floyd-steinberg', label: 'Floyd-Steinberg' }
                    ]}
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-theme-muted">
                No animated GIF loaded. Load a GIF file to view control configurations.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Preview Screen */}
      <div className="flex-1 flex flex-col h-full bg-black/40 overflow-hidden relative">
        {/* Toolbar Header */}
        <div className="h-12 border-b border-theme-border/40 bg-theme-panel/60 backdrop-blur-sm px-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => setShowControls(prev => !prev)}>
              {showControls ? 'Hide Controls' : 'Show Controls'}
            </Button>
          </div>

          {gifFrames.length > 0 && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setPreviewZoom(prev => Math.max(25, prev - 25))} className="p-1.5">
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs font-mono text-theme-muted">{previewZoom}%</span>
              <Button variant="secondary" size="sm" onClick={() => setPreviewZoom(prev => Math.min(300, prev + 25))} className="p-1.5">
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              
              <div className="w-px h-4 bg-theme-border/60 mx-1" />

              <Button variant="glow" size="sm" onClick={exportAsciiFramesText}>
                <Download className="w-3.5 h-3.5" />
                <span>Export Frames</span>
              </Button>
            </div>
          )}
        </div>

        {/* Viewport Render Area */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 relative">
          {loading ? (
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-theme-accent animate-spin" />
              <p className="text-xs font-mono text-theme-muted">DECOMPRESSING CHANNELS: {loadingProgress}%</p>
            </div>
          ) : gifFrames.length > 0 ? (
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
                <Film className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-theme-text">Upload GIF Source</h3>
                <p className="text-xs text-theme-muted mt-2">
                  Import an animated GIF to decompress its buffer map. Play frame-by-frame and control playback speeds instantly.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Timeline Control Footer Bar */}
        {gifFrames.length > 0 && (
          <div className="h-16 border-t border-theme-border/40 bg-theme-panel/75 backdrop-blur-md px-6 flex items-center justify-between gap-6 z-10">
            {/* Play/Pause controls */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => setCurrentFrameIdx(prev => Math.max(0, prev - 1))}
                disabled={isPlaying}
                title="Previous Frame"
                className="p-2"
              >
                <SkipBack className="w-4 h-4" />
              </Button>
              
              <Button 
                variant="primary" 
                size="sm" 
                onClick={() => setIsPlaying(prev => !prev)}
                className="px-4 py-2"
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
              </Button>
              
              <Button 
                variant="secondary" 
                size="sm" 
                onClick={() => setCurrentFrameIdx(prev => Math.min(gifFrames.length - 1, prev + 1))}
                disabled={isPlaying}
                title="Next Frame"
                className="p-2"
              >
                <SkipForward className="w-4 h-4" />
              </Button>
            </div>

            {/* Timeline Scrubbing slider */}
            <div className="flex-1 flex items-center gap-3">
              <span className="text-xs font-mono text-theme-muted flex-shrink-0">
                FRAME {currentFrameIdx + 1} / {gifFrames.length}
              </span>
              <input
                type="range"
                min={0}
                max={gifFrames.length - 1}
                value={currentFrameIdx}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentFrameIdx(Number(e.target.value));
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
