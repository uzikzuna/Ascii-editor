import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, Download, Copy, ZoomIn, ZoomOut, Sliders, FileText, Image as ImageIcon 
} from 'lucide-react';
import { imageToAscii } from '../../utils/asciiMath';
import type { AsciiOptions } from '../../utils/asciiMath';
import { Button, Slider, Select, Switch, useToast } from '../shared/Widgets';

interface ImageConverterProps {
  initialFile: File | null;
  onClearInitialFile: () => void;
}

export const ImageConverter: React.FC<ImageConverterProps> = ({
  initialFile,
  onClearInitialFile
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [options, setOptions] = useState<AsciiOptions>({
    width: 100,
    height: 50,
    brightness: 0,
    contrast: 0,
    sharpness: 0,
    charMode: 'standard',
    colorMode: 'color',
    invert: false,
    dithering: 'none',
    customChars: ''
  });

  const [asciiResult, setAsciiResult] = useState<{
    text: string;
    charGrid: string[][];
    colors?: { r: number; g: number; b: number }[][];
  } | null>(null);

  const [previewZoom, setPreviewZoom] = useState(100);
  const [showControls, setShowControls] = useState(true);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { showToast } = useToast();

  // Handle drag and drop files
  useEffect(() => {
    if (initialFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          setImageSrc(e.target.result as string);
        }
      };
      reader.readAsDataURL(initialFile);
      onClearInitialFile(); // Reset home trigger file
    }
  }, [initialFile, onClearInitialFile]);

  // Trigger processing when image or options change
  useEffect(() => {
    if (imageSrc) {
      processImage();
    }
  }, [imageSrc, options]);

  const processImage = () => {
    const img = new Image();
    img.src = imageSrc || '';
    img.onload = () => {
      imageRef.current = img;
      renderAscii();
    };
  };

  const renderAscii = () => {
    const img = imageRef.current;
    if (!img) return;

    // Use offscreen canvas to scale and sample pixels
    const canvas = canvasRef.current || document.createElement('canvas');
    canvasRef.current = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Adjust width/height.
    // For Braille mode, we process in 2x4 cells, so internal canvas width must be twice the columns
    const columns = options.width;
    const rows = options.height;
    const isBraille = options.charMode === 'braille';
    
    canvas.width = isBraille ? columns * 2 : columns;
    canvas.height = isBraille ? rows * 4 : rows;

    // Draw scaled image to sample canvas
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // Call ASCII engine
    const result = imageToAscii(canvas, options);
    setAsciiResult(result);

    // Render output to preview canvas for 60 FPS performance and styling
    drawToPreviewCanvas(result);
  };

  // Render colored character grid onto standard HTML Canvas
  const drawToPreviewCanvas = (result: typeof asciiResult) => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas || !result) return;

    const ctx = previewCanvas.getContext('2d');
    if (!ctx) return;

    const grid = result.charGrid;
    const colors = result.colors;
    const rows = grid.length;
    const cols = grid[0]?.length || 0;

    if (cols === 0 || rows === 0) return;

    // Font size settings
    const charWidth = 7;
    const charHeight = 10;
    
    previewCanvas.width = cols * charWidth;
    previewCanvas.height = rows * charHeight;

    // Draw background based on theme variables
    const activeTheme = document.documentElement.getAttribute('data-theme') || 'jarvis';
    let bg = '#080e1a'; // JARVIS dark
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
        
        // Colors mapping
        if (colors && colors[r] && colors[r][c]) {
          const { r: red, g: green, b: blue } = colors[r][c];
          ctx.fillStyle = `rgb(${red}, ${green}, ${blue})`;
        } else {
          // Fallback mono text color based on theme
          if (activeTheme === 'monochrome-white' || activeTheme === 'light-mode') {
            ctx.fillStyle = '#0f172a';
          } else {
            ctx.fillStyle = 'rgb(56, 189, 248)'; // default cyan glow
          }
        }

        ctx.fillText(char, c * charWidth, r * charHeight);
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImageSrc(e.target.result as string);
        showToast('Image uploaded successfully!', 'success');
      }
    };
    reader.readAsDataURL(file);
  };

  const copyToClipboard = () => {
    if (!asciiResult) return;
    navigator.clipboard.writeText(asciiResult.text);
    showToast('ASCII text copied to clipboard!', 'success');
  };

  const downloadText = () => {
    if (!asciiResult) return;
    const blob = new Blob([asciiResult.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ascii_forge_art.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded TXT file', 'success');
  };

  const downloadHtml = () => {
    if (!asciiResult) return;
    const activeTheme = document.documentElement.getAttribute('data-theme') || 'jarvis';
    let bg = '#080e1a';
    let textCol = '#38bdf8';
    if (activeTheme === 'green-terminal') { bg = '#000000'; textCol = '#39ff14'; }
    else if (activeTheme === 'amber-crt') { bg = '#0c0600'; textCol = '#ffb000'; }
    else if (activeTheme === 'cyberpunk') { bg = '#120a18'; textCol = '#ec4899'; }
    else if (activeTheme === 'monochrome-white') { bg = '#ffffff'; textCol = '#000000'; }
    else if (activeTheme === 'light-mode') { bg = '#f0f4f8'; textCol = '#2563eb'; }

    let htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      background-color: ${bg};
      color: ${textCol};
      font-family: monospace;
      font-size: 8px;
      line-height: 6px;
      letter-spacing: 0px;
      white-space: pre;
      margin: 20px;
    }
    span { display: inline-block; }
  </style>
</head>
<body>
    `;

    const grid = asciiResult.charGrid;
    const colors = asciiResult.colors;

    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const char = grid[r][c] === ' ' ? '&nbsp;' : grid[r][c];
        if (colors && colors[r] && colors[r][c]) {
          const { r: red, g: green, b: blue } = colors[r][c];
          htmlContent += `<span style="color: rgb(${red},${green},${blue})">${char}</span>`;
        } else {
          htmlContent += char;
        }
      }
      htmlContent += '\n';
    }

    htmlContent += '\n</body>\n</html>';

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ascii_forge_art.html';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Downloaded HTML file', 'success');
  };

  const downloadPng = () => {
    const previewCanvas = previewCanvasRef.current;
    if (!previewCanvas) return;
    const url = previewCanvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ascii_forge_art.png';
    a.click();
    showToast('Downloaded PNG file', 'success');
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
      
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
                <Sliders className="w-4 h-4 text-theme-accent" />
                CONVERTER PANEL
              </span>
              <Button variant="secondary" size="sm" onClick={() => setImageSrc(null)} className="py-1 px-2 text-[10px]">
                Reset
              </Button>
            </div>

            {imageSrc ? (
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5">
                {/* Image Details */}
                <div className="glass border border-theme-border/40 p-3 rounded-lg flex items-center gap-3">
                  <div className="w-14 h-14 rounded border border-theme-border/60 overflow-hidden bg-black/40 flex-shrink-0 flex items-center justify-center">
                    <img src={imageSrc} className="max-w-full max-h-full object-contain" alt="Original Thumb" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs text-theme-text font-bold truncate">ACTIVE SOURCE</p>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="text-[10px] text-theme-accent hover:text-theme-text font-mono underline mt-1"
                    >
                      Change image source
                    </button>
                  </div>
                </div>

                {/* Resizing Resolution */}
                <div className="flex flex-col gap-3">
                  <Slider label="COLUMNS (WIDTH)" min={20} max={250} step={2} value={options.width} onChange={(val) => setOptions(prev => ({ ...prev, width: val }))} />
                  <Slider label="ROWS (HEIGHT)" min={10} max={180} step={2} value={options.height} onChange={(val) => setOptions(prev => ({ ...prev, height: val }))} />
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
                      { value: 'matrix', label: 'Matrix Katakana' },
                      { value: 'custom', label: 'Custom Character Set' }
                    ]}
                  />

                  {options.charMode === 'custom' && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] text-theme-muted font-mono">CUSTOM CHARS (DARK TO LIGHT)</span>
                      <input
                        type="text"
                        value={options.customChars || ''}
                        onChange={(e) => setOptions(prev => ({ ...prev, customChars: e.target.value }))}
                        placeholder="e.g.  .-*#%"
                        className="px-3 py-1.5 rounded bg-theme-bg border border-theme-border text-sm text-theme-text focus:outline-none"
                      />
                    </div>
                  )}

                  <Select
                    label="COLOR MODE"
                    value={options.colorMode}
                    onChange={(val) => setOptions(prev => ({ ...prev, colorMode: val as any }))}
                    options={[
                      { value: 'mono', label: 'Monochrome (Theme Default)' },
                      { value: 'color', label: 'Full RGB Color' },
                      { value: 'green', label: 'Terminal Phosphor Green' },
                      { value: 'amber', label: 'Terminal Amber' },
                      { value: 'rgb', label: 'Chroma RGB Rainbow' }
                    ]}
                  />

                  <Select
                    label="DITHERING MODE"
                    value={options.dithering}
                    onChange={(val) => setOptions(prev => ({ ...prev, dithering: val as any }))}
                    options={[
                      { value: 'none', label: 'None (Threshold / Map)' },
                      { value: 'floyd-steinberg', label: 'Floyd-Steinberg Diffusion' }
                    ]}
                  />

                  <Switch
                    label="INVERT COLOR MAP"
                    checked={options.invert}
                    onChange={(val) => setOptions(prev => ({ ...prev, invert: val }))}
                  />
                </div>
              </div>
            ) : (
              <div className="p-4 text-center text-xs text-theme-muted">
                No active image loaded. Upload an image source to display parameter controls.
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Workspace (Preview Area) */}
      <div className="flex-1 flex flex-col h-full bg-black/40 overflow-hidden relative">
        <input 
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        {/* Toolbar Header */}
        <div className="h-12 border-b border-theme-border/40 bg-theme-panel/60 backdrop-blur-sm px-4 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setShowControls(prev => !prev)}
              className="px-2 py-1 text-xs"
            >
              {showControls ? 'Hide Settings' : 'Show Settings'}
            </Button>
            {asciiResult && (
              <span className="text-[10px] font-mono text-theme-muted hidden sm:inline-block">
                GRID RESOLUTION: {options.charMode === 'braille' ? options.width : asciiResult.charGrid[0]?.length || 0} x {options.charMode === 'braille' ? options.height : asciiResult.charGrid.length || 0}
              </span>
            )}
          </div>

          {imageSrc && (
            <div className="flex items-center gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => setPreviewZoom(prev => Math.max(25, prev - 25))} title="Zoom Out" className="p-1.5">
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs font-mono text-theme-muted min-w-[36px] text-center">{previewZoom}%</span>
              <Button variant="secondary" size="sm" onClick={() => setPreviewZoom(prev => Math.min(300, prev + 25))} title="Zoom In" className="p-1.5">
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              
              <div className="w-px h-4 bg-theme-border/60 mx-1" />

              <Button variant="secondary" size="sm" onClick={copyToClipboard} title="Copy ASCII">
                <Copy className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Copy</span>
              </Button>

              <div className="relative group">
                <Button variant="glow" size="sm">
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </Button>
                <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block w-36 rounded-lg border border-theme-border/60 bg-theme-panel p-1 shadow-2xl glass">
                  <button onClick={downloadText} className="flex items-center gap-2 w-full px-3 py-2 rounded text-xs font-sans text-theme-text hover:bg-white/5 transition-colors">
                    <FileText className="w-3.5 h-3.5" /> Plain Text (.txt)
                  </button>
                  <button onClick={downloadHtml} className="flex items-center gap-2 w-full px-3 py-2 rounded text-xs font-sans text-theme-text hover:bg-white/5 transition-colors">
                    <FileText className="w-3.5 h-3.5" /> HTML (.html)
                  </button>
                  <button onClick={downloadPng} className="flex items-center gap-2 w-full px-3 py-2 rounded text-xs font-sans text-theme-text hover:bg-white/5 transition-colors">
                    <ImageIcon className="w-3.5 h-3.5" /> Image (.png)
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Viewport content */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 relative">
          {imageSrc ? (
            <div 
              style={{ transform: `scale(${previewZoom / 100})`, transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)' }}
              className="origin-center shadow-2xl relative"
            >
              <canvas 
                ref={previewCanvasRef} 
                className="max-w-none shadow-[0_0_50px_rgba(0,0,0,0.8)]"
              />
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="glass border border-theme-border/40 rounded-xl p-12 text-center cursor-pointer flex flex-col items-center gap-4 max-w-md hover:bg-white/5 hover:border-theme-accent/30 transition-all duration-300"
            >
              <div className="w-16 h-16 rounded-full bg-theme-accent/15 border border-theme-accent/30 shadow-neon flex items-center justify-center text-theme-accent">
                <Upload className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-theme-text">Upload Image Source</h3>
                <p className="text-xs text-theme-muted mt-2">
                  Select a PNG, JPG, JPEG, WEBP or BMP from your system. Live sampling and rendering updates immediately.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
