import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Monitor, StopCircle, ZoomIn, ZoomOut
} from 'lucide-react';
import { imageToAscii } from '../../utils/asciiMath';
import type { AsciiOptions } from '../../utils/asciiMath';
import { Button, Slider, Select, useToast } from '../shared/Widgets';

export const ScreenCaptureConverter: React.FC = () => {
  const [activeStream, setActiveStream] = useState<MediaStream | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(100);
  const [showControls, setShowControls] = useState(true);

  const [options, setOptions] = useState<AsciiOptions>({
    width: 100,
    height: 50,
    brightness: 0,
    contrast: 10,
    sharpness: 0,
    charMode: 'standard',
    colorMode: 'color',
    invert: false,
    dithering: 'none',
    customChars: ''
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const sampleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const requestRef = useRef<number | null>(null);
  const { showToast } = useToast();

  // Run render loop during capture
  useEffect(() => {
    if (isCapturing && activeStream) {
      const renderLoop = () => {
        renderFrame();
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
      stopCapture();
    };
  }, [isCapturing, activeStream, options]);

  const startCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: 30 },
        audio: false
      });

      // Handle user ending stream via browser UI
      stream.getVideoTracks()[0].onended = () => {
        stopCapture();
        showToast('Screen share ended.', 'info');
      };

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      setActiveStream(stream);
      setIsCapturing(true);
      showToast('Display capture feed connected!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Could not initiate display share. Check permissions.', 'error');
    }
  };

  const stopCapture = () => {
    if (activeStream) {
      activeStream.getTracks().forEach(track => track.stop());
      setActiveStream(null);
    }
    setIsCapturing(false);
    if (requestRef.current) {
      cancelAnimationFrame(requestRef.current);
      requestRef.current = null;
    }
    
    // Clear preview canvas
    const previewCanvas = previewCanvasRef.current;
    if (previewCanvas) {
      const ctx = previewCanvas.getContext('2d');
      ctx?.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
    }
  };

  const renderFrame = () => {
    const video = videoRef.current;
    if (!video || video.paused || video.ended) return;

    const sampleCanvas = sampleCanvasRef.current || document.createElement('canvas');
    sampleCanvasRef.current = sampleCanvas;
    const sampleCtx = sampleCanvas.getContext('2d');
    if (!sampleCtx) return;

    const isBraille = options.charMode === 'braille';
    sampleCanvas.width = isBraille ? options.width * 2 : options.width;
    sampleCanvas.height = isBraille ? options.height * 4 : options.height;

    sampleCtx.drawImage(video, 0, 0, sampleCanvas.width, sampleCanvas.height);
    const ascii = imageToAscii(sampleCanvas, options);
    drawToPreviewCanvas(ascii);
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

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
      
      {/* Hidden HTML5 Player */}
      <video
        ref={videoRef}
        playsInline
        muted
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
                <Monitor className="w-4 h-4 text-theme-accent" />
                SCREEN ENGINE PANEL
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
              {/* Capture state indicator */}
              <div className="glass border border-theme-border/40 p-3 rounded-lg flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-theme-text font-sans">CAPTURE STATUS</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${isCapturing ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'}`} />
                </div>
                <p className="text-[10px] text-theme-muted font-mono leading-relaxed">
                  {isCapturing ? 'CASTING DISPLAY STREAM ONLINE' : 'READY TO STREAM VIEWPORT'}
                </p>
                <div className="mt-2">
                  {isCapturing ? (
                    <Button variant="danger" size="sm" onClick={stopCapture} className="w-full">
                      <StopCircle className="w-4 h-4" />
                      <span>TERMINATE CAST</span>
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" onClick={startCapture} className="w-full">
                      <Monitor className="w-4 h-4" />
                      <span>INITIATE SHARE</span>
                    </Button>
                  )}
                </div>
              </div>

              {/* Sizing Resolution */}
              <div className="flex flex-col gap-3">
                <Slider label="COLUMNS (WIDTH)" min={20} max={180} step={2} value={options.width} onChange={(val) => setOptions(prev => ({ ...prev, width: val }))} />
                <Slider label="ROWS (HEIGHT)" min={10} max={120} step={2} value={options.height} onChange={(val) => setOptions(prev => ({ ...prev, height: val }))} />
              </div>

              {/* Modifiers */}
              <div className="border-t border-theme-border/20 pt-4 flex flex-col gap-4">
                <Slider label="BRIGHTNESS" min={-100} max={100} step={5} value={options.brightness} onChange={(val) => setOptions(prev => ({ ...prev, brightness: val }))} />
                <Slider label="CONTRAST" min={-100} max={100} step={5} value={options.contrast} onChange={(val) => setOptions(prev => ({ ...prev, contrast: val }))} />
              </div>

              {/* Character settings */}
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
                    { value: 'pixel', label: 'Solid pixel block' }
                  ]}
                />

                <Select
                  label="COLOR MODE"
                  value={options.colorMode}
                  onChange={(val) => setOptions(prev => ({ ...prev, colorMode: val as any }))}
                  options={[
                    { value: 'mono', label: 'Monochrome' },
                    { value: 'color', label: 'Full RGB Color' },
                    { value: 'green', label: 'Hacker Green' },
                    { value: 'amber', label: 'Amber CRT' }
                  ]}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview Viewport */}
      <div className="flex-1 flex flex-col h-full bg-black/40 overflow-hidden relative">
        <div className="h-12 border-b border-theme-border/40 bg-theme-panel/60 backdrop-blur-sm px-4 flex items-center justify-between z-10">
          <Button variant="secondary" size="sm" onClick={() => setShowControls(prev => !prev)}>
            {showControls ? 'Hide Controls' : 'Show Controls'}
          </Button>

          {isCapturing && (
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

        <div className="flex-1 overflow-auto flex items-center justify-center p-6 relative">
          {isCapturing ? (
            <div 
              style={{ transform: `scale(${previewZoom / 100})`, transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)' }}
              className="origin-center shadow-2xl"
            >
              <canvas ref={previewCanvasRef} className="max-w-none shadow-[0_0_50px_rgba(0,0,0,0.8)]" />
            </div>
          ) : (
            <div 
              onClick={startCapture}
              className="glass border border-theme-border/40 rounded-xl p-12 text-center cursor-pointer flex flex-col items-center gap-4 max-w-md hover:bg-white/5 hover:border-theme-accent/30 transition-all duration-300"
            >
              <div className="w-16 h-16 rounded-full bg-theme-accent/15 border border-theme-accent/30 shadow-neon flex items-center justify-center text-theme-accent">
                <Monitor className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-theme-text">Start Screen Cast</h3>
                <p className="text-xs text-theme-muted mt-2">
                  Share a browser tab, file window, or full screen. Stream outputs immediately scale into live character mosaics.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
