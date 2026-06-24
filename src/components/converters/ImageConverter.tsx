import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, Download, Copy, ZoomIn, ZoomOut, Sliders, FileText, 
  Image as ImageIcon, Sparkles, RefreshCw, Eye, EyeOff,
  Lock, Unlock, Flame, Plus, Trash2, Layers as LayersIcon,
  Wand2, Palette, Droplets, Grid3X3
} from 'lucide-react';
import { Button, Slider, Select, Switch, useToast } from '../shared/Widgets';
import type { WorkerOptions, WorkerResult } from '../../utils/asciiWorker';
import type { Layer } from '../../types/workspaceState';
import { compositeLayers } from '../../utils/layersHelper';
import {
  drawRectangle, drawCircle, drawStar, drawArrow,
  drawBannerText, drawCurvedText, drawVerticalText
} from '../../utils/canvasTools';
import { applyMaterial } from '../../utils/materials';
import {
  type GlowConfig, type BackgroundRemovalConfig, type ParticleConfig,
  type ColorGradingConfig, type PostProcessConfig, type Particle,
  DEFAULT_GLOW_CONFIG, DEFAULT_BG_REMOVAL_CONFIG, DEFAULT_PARTICLE_CONFIG,
  DEFAULT_COLOR_GRADING_CONFIG, DEFAULT_POST_PROCESS_CONFIG,
  applyGlow, generateBackgroundMask, applyBackgroundMask,
  initParticles, tickParticles, renderParticles,
  applyColorGrading,
  applyCrtScanlines, applyVignette, applyFilmGrain, applyChromaticAberration
} from '../../utils/imageEffects';

interface ImageConverterProps {
  initialFile: File | null;
  onClearInitialFile: () => void;
}

export const ImageConverter: React.FC<ImageConverterProps> = ({
  initialFile,
  onClearInitialFile
}) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  
  // Custom ASCII Engine Options
  const [options, setOptions] = useState<WorkerOptions>({
    width: 120,
    height: 60,
    brightness: 0,
    contrast: 0,
    sharpness: 0,
    noiseReduction: 0,
    deblur: 0,
    contrastMethod: 'none',
    charMode: 'standard',
    customChars: '',
    colorMode: 'color',
    backgroundColorMode: 'none',
    customBgColor: '#080e1a',
    customPalette: ['#38bdf8', '#39ff14', '#ffb000', '#f43f5e', '#a855f7'],
    invert: false,
    dithering: 'none',
    edgeDetection: 'none',
    edgeWeight: 50,
    aspectRatioCorrection: true,
    fontAspectRatio: 0.58,
    detailPreservationMode: 'balanced',
    aiSmartMode: true,
    beautifyEdgeEnhance: false,
    beautifySmoothing: false,
    beautifyNoiseCleanup: false,
    beautifyDensityOptimize: false
  });

  // UI Control states
  const [activeTab, setActiveTab] = useState<'adjust' | 'style' | 'palette' | 'beautify' | 'effects' | 'layers' | 'shapes' | 'color'>('adjust');
  const [uniqueMode, setUniqueMode] = useState<string>('none');
  const [comparisonMode, setComparisonMode] = useState<'none' | 'slider' | 'diff' | 'heatmap'>('none');
  const [sliderPosition, setSliderPosition] = useState(50); // slider comparison split %
  const [activeFont, setActiveFont] = useState<'mono' | 'terminal' | 'crt' | 'pixel' | 'code'>('mono');
  
  // Zoom system
  const [zoomLocked, setZoomLocked] = useState(true);
  const [leftZoom, setLeftZoom] = useState(100);
  const [rightZoom, setRightZoom] = useState(100);

  // Stats & Results from background worker
  const [asciiResult, setAsciiResult] = useState<WorkerResult | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fps, setFps] = useState(0);
  const [newColorInput, setNewColorInput] = useState('#38bdf8');
  
  // Smart Recommendation States
  const [showRecommendation, setShowRecommendation] = useState<string | null>(null);

  // References
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileImportRef = useRef<HTMLInputElement>(null);
  const originalCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const lastProcessTime = useRef<number>(0);
  
  // Matrix rain tick
  const [matrixTick, setMatrixTick] = useState(0);
  const matrixDrops = useRef<number[]>([]);

  // ─── Pro Effects State ───
  const [glowConfig, setGlowConfig] = useState<GlowConfig>(DEFAULT_GLOW_CONFIG);
  const [bgRemovalConfig, setBgRemovalConfig] = useState<BackgroundRemovalConfig>(DEFAULT_BG_REMOVAL_CONFIG);
  const [particleConfig, setParticleConfig] = useState<ParticleConfig>(DEFAULT_PARTICLE_CONFIG);
  const [colorGradingConfig, setColorGradingConfig] = useState<ColorGradingConfig>(DEFAULT_COLOR_GRADING_CONFIG);
  const [postProcessConfig, setPostProcessConfig] = useState<PostProcessConfig>(DEFAULT_POST_PROCESS_CONFIG);

  // Layer compositing
  const [proLayers, setProLayers] = useState<Layer[]>([]);
  const [activeProLayerId, setActiveProLayerId] = useState<string>('');

  // Particle system refs
  const particlesRef = useRef<Particle[]>([]);
  const particleAnimRef = useRef<number>(0);
  const [particleTick, setParticleTick] = useState(0);

  // Shape overlay controls
  const [shapeOverlayTool, setShapeOverlayTool] = useState<'none' | 'rect' | 'circle' | 'star' | 'arrow' | 'text' | 'material'>('none');
  const [shapeChar, setShapeChar] = useState('#');
  const [shapeColor, setShapeColor] = useState('#38bdf8');
  const [shapeFilled, setShapeFilled] = useState(false);
  const [textOverlayValue, setTextOverlayValue] = useState('ASCII');
  const [textOverlayFont, setTextOverlayFont] = useState('Slant');
  const [textOverlayStyle, setTextOverlayStyle] = useState<'standard' | 'curved' | 'vertical'>('standard');
  const [materialType, setMaterialType] = useState<'metal' | 'chrome' | 'glass' | 'wood' | 'stone' | 'carbon-fiber' | 'neon' | 'plasma'>('metal');

  const { showToast } = useToast();

  // 1. Initialize Web Worker
  useEffect(() => {
    // Instantiate web worker
    workerRef.current = new Worker(
      new URL('../../utils/asciiWorker.ts', import.meta.url),
      { type: 'module' }
    );

    workerRef.current.onmessage = (e: MessageEvent<WorkerResult>) => {
      setAsciiResult(e.data);
      setIsProcessing(false);
      
      // Calculate active render FPS
      const diff = Date.now() - lastProcessTime.current;
      setFps(Math.round(1000 / (diff || 1)));

      // Trigger recommendations based on AI stats
      const { facesDetected, textDetected, logoDetected } = e.data.stats;
      if (options.aiSmartMode) {
        if (facesDetected > 0) {
          setShowRecommendation('portrait');
        } else if (textDetected) {
          setShowRecommendation('text');
        } else if (logoDetected) {
          setShowRecommendation('logo');
        } else {
          setShowRecommendation(null);
        }
      }
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, [options.aiSmartMode]);

  // 2. Matrix Rain Animation Loop
  useEffect(() => {
    if (uniqueMode !== 'matrix') return;
    let animId: number;
    const tick = () => {
      setMatrixTick(prev => prev + 1);
      animId = requestAnimationFrame(tick);
    };
    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [uniqueMode]);

  // 2b. Particle Animation Loop
  useEffect(() => {
    if (particleConfig.type === 'none') {
      particlesRef.current = [];
      return;
    }
    if (!asciiResult) return;
    const cols = asciiResult.charGrid[0]?.length || 0;
    const rows = asciiResult.charGrid.length;
    if (cols === 0 || rows === 0) return;

    particlesRef.current = initParticles(cols, rows, particleConfig);

    let running = true;
    const tick = () => {
      if (!running) return;
      particlesRef.current = tickParticles(particlesRef.current, cols, rows, particleConfig);
      setParticleTick(t => t + 1);
      particleAnimRef.current = requestAnimationFrame(tick);
    };
    particleAnimRef.current = requestAnimationFrame(tick);

    return () => {
      running = false;
      cancelAnimationFrame(particleAnimRef.current);
    };
  }, [particleConfig.type, particleConfig.rate, particleConfig.speed, asciiResult]);

  // 3. Keep Zooms synched if locked
  useEffect(() => {
    if (zoomLocked) {
      setRightZoom(leftZoom);
    }
  }, [leftZoom, zoomLocked]);

  // 4. Trigger processing when options/source changes
  useEffect(() => {
    if (imageSrc) {
      triggerConversion();
    }
  }, [imageSrc, options, uniqueMode]);

  // 5. Handle dropping / initial file loading
  useEffect(() => {
    if (initialFile) {
      loadFile(initialFile);
      onClearInitialFile();
    }
  }, [initialFile, onClearInitialFile]);

  const loadFile = (file: File) => {
    // Validate file type/extension (PNG, JPG, JPEG, WEBP, BMP)
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/bmp'];
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const allowedExtensions = ['png', 'jpg', 'jpeg', 'webp', 'bmp'];

    if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || '')) {
      showToast('Unsupported file type. Please upload a PNG, JPG, JPEG, WEBP, or BMP image.', 'error');
      return;
    }

    // Prevent crashing on massive files (e.g. limit to 20MB)
    if (file.size > 20 * 1024 * 1024) {
      showToast('File size is too large (maximum 20MB).', 'error');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      if (e.target?.result) {
        setImageSrc(e.target.result as string);
        showToast('Source image initialized in workspace.', 'success');
      }
    };
    reader.onerror = () => {
      showToast('Failed to read image file.', 'error');
    };
    reader.readAsDataURL(file);
  };

  const triggerConversion = () => {
    if (!imageSrc || !workerRef.current) return;
    setIsProcessing(true);
    lastProcessTime.current = Date.now();

    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      // Create offscreen high-res canvas
      const canvas = originalCanvasRef.current || document.createElement('canvas');
      originalCanvasRef.current = canvas;
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Post message to the processing worker thread
      workerRef.current?.postMessage({
        imageData: {
          data: imageData.data,
          width: imageData.width,
          height: imageData.height
        },
        options
      });
    };
  };

  // 6. Draw results dynamically onto output Canvas
  useEffect(() => {
    if (asciiResult) {
      drawCanvasPreview();
    }
  }, [asciiResult, comparisonMode, activeFont, matrixTick, glowConfig, bgRemovalConfig, colorGradingConfig, postProcessConfig, proLayers, particleTick]);

  const drawCanvasPreview = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !asciiResult) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rawGrid = asciiResult.charGrid;
    const rawColors = asciiResult.colors;
    const bgColors = asciiResult.bgColors;
    const rows = rawGrid.length;
    const cols = rawGrid[0]?.length || 0;

    if (cols === 0 || rows === 0) return;

    // ── Post-Conversion Processing Pipeline ──
    let grid = rawGrid;
    let colors = rawColors;

    // 1. Background removal
    if (bgRemovalConfig.enabled && colors) {
      const mask = generateBackgroundMask(colors, bgRemovalConfig);
      const result = applyBackgroundMask(grid, colors, mask, bgRemovalConfig);
      grid = result.grid;
      colors = result.colors;
    }

    // 2. Glow / bloom
    if (glowConfig.enabled && colors) {
      colors = applyGlow(colors, glowConfig);
    }

    // 3. Color grading
    if (colors) {
      colors = applyColorGrading(colors, colorGradingConfig);
    }

    // 4. Composite pro layers on top
    if (proLayers.length > 0 && colors) {
      const baseLayer: Layer = {
        id: 'base',
        name: 'Conversion',
        visible: true,
        locked: true,
        opacity: 1,
        blendMode: 'normal',
        grid,
        colors,
      };
      const composited = compositeLayers([baseLayer, ...proLayers], cols, rows);
      grid = composited.grid;
      colors = composited.colors;
    }

    // Define font sizing matching visual presets
    let charWidth = 7;
    let charHeight = 12;
    let fontName = '"JetBrains Mono", monospace';

    if (activeFont === 'terminal') {
      fontName = '"Share Tech Mono", monospace';
      charWidth = 7.5;
      charHeight = 13;
    } else if (activeFont === 'crt') {
      fontName = '"Fira Code", monospace';
      charWidth = 7.2;
      charHeight = 12.5;
    } else if (activeFont === 'pixel') {
      fontName = '"Press Start 2P", monospace';
      charWidth = 10;
      charHeight = 14;
    } else if (activeFont === 'code') {
      fontName = '"Courier Prime", monospace';
      charWidth = 7;
      charHeight = 12.2;
    }

    canvas.width = cols * charWidth;
    canvas.height = rows * charHeight;

    // Setup custom theme canvas background color
    let bg = 'rgb(8, 14, 26)';
    if (options.backgroundColorMode === 'custom' && options.customBgColor) {
      bg = options.customBgColor;
    } else if (options.backgroundColorMode === 'match') {
      bg = 'transparent';
    }

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = `500 ${charHeight - 2}px ${fontName}`;
    ctx.textBaseline = 'top';

    // Seed matrix rain drop trackers
    if (matrixDrops.current.length !== cols) {
      matrixDrops.current = Array(cols).fill(0).map(() => Math.floor(Math.random() * -rows));
    }

    // Render comparison delta overlays
    let origData: ImageData | null = null;
    if (comparisonMode === 'diff' || comparisonMode === 'heatmap') {
      const origCanvas = originalCanvasRef.current;
      if (origCanvas) {
        // Draw the image scale matched to output columns/rows onto temporary canvas
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = cols;
        tempCanvas.height = rows;
        const tempCtx = tempCanvas.getContext('2d');
        if (tempCtx) {
          tempCtx.drawImage(origCanvas, 0, 0, cols, rows);
          origData = tempCtx.getImageData(0, 0, cols, rows);
        }
      }
    }

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const char = grid[r][c];

        // Draw individual character cells background
        if (options.backgroundColorMode === 'match' && bgColors && bgColors[r] && bgColors[r][c]) {
          const bgCol = bgColors[r][c];
          ctx.fillStyle = `rgb(${bgCol.r}, ${bgCol.g}, ${bgCol.b})`;
          ctx.fillRect(c * charWidth, r * charHeight, charWidth, charHeight);
        }

        // 1. Heatmap comparison view
        if (comparisonMode === 'heatmap' && origData) {
          const pIdx = (r * cols + c) * 4;
          const origLum = 0.299 * origData.data[pIdx] + 0.587 * origData.data[pIdx+1] + 0.114 * origData.data[pIdx+2];
          
          // Re-estimate character visual density percentage
          const density = char === ' ' ? 0 : (char === '█' ? 255 : 127);
          const error = Math.abs(origLum - density);
          
          // Heat color mapping: cold blue (0 error) -> warning red (255 error)
          const redVal = Math.round(error);
          const blueVal = Math.round(255 - error);
          ctx.fillStyle = `rgb(${redVal}, 30, ${blueVal})`;
          ctx.fillRect(c * charWidth, r * charHeight, charWidth, charHeight);
          continue;
        }

        // 2. Structural difference view
        if (comparisonMode === 'diff' && origData) {
          const pIdx = (r * cols + c) * 4;
          const charColor = colors && colors[r] && colors[r][c] ? colors[r][c] : { r: 255, g: 255, b: 255 };
          const dr = Math.abs(origData.data[pIdx] - charColor.r);
          const dg = Math.abs(origData.data[pIdx+1] - charColor.g);
          const db = Math.abs(origData.data[pIdx+2] - charColor.b);
          ctx.fillStyle = `rgb(${dr}, ${dg}, ${db})`;
          ctx.fillRect(c * charWidth, r * charHeight, charWidth, charHeight);
          continue;
        }

        // 3. Matrix anim mode code
        if (uniqueMode === 'matrix') {
          // Calculate drop scrolling
          const dropY = matrixDrops.current[c];
          const dist = r - dropY;
          if (dist === 0) {
            ctx.fillStyle = '#ffffff'; // White tip
          } else if (dist > 0 && dist < 12) {
            // Gradient green trail
            const fade = (12 - dist) / 12;
            ctx.fillStyle = `rgba(57, 255, 20, ${fade})`;
          } else {
            ctx.fillStyle = 'rgba(0, 50, 0, 0.25)'; // very dark background code
          }

          // Randomize character change for matrix vibe
          const activeChar = Math.random() > 0.98 ? String.fromCharCode(33 + Math.floor(Math.random() * 93)) : char;
          ctx.fillText(activeChar, c * charWidth, r * charHeight);

          // Update drip positions
          if (r === rows - 1 && Math.random() > 0.98) {
            matrixDrops.current[c] = -Math.floor(Math.random() * 20);
          }
          continue;
        }

        // 4. Default colored rendering
        if (colors && colors[r] && colors[r][c]) {
          const { r: cr, g: cg, b: cb } = colors[r][c];
          ctx.fillStyle = `rgb(${cr}, ${cg}, ${cb})`;
        } else {
          ctx.fillStyle = 'rgb(56, 189, 248)';
        }

        ctx.fillText(char, c * charWidth, r * charHeight);
      }
    }

    // Update drop values at slow frame speed
    if (uniqueMode === 'matrix') {
      for (let c = 0; c < cols; c++) {
        matrixDrops.current[c] += 0.55;
        if (matrixDrops.current[c] > rows) {
          matrixDrops.current[c] = -Math.floor(Math.random() * 15);
        }
      }
    }

    // ── Post-Processing Canvas Passes ──

    // Render particle overlay
    if (particleConfig.type !== 'none' && particlesRef.current.length > 0) {
      ctx.font = `500 ${charHeight - 2}px ${fontName}`;
      renderParticles(ctx, particlesRef.current, particleConfig, charWidth, charHeight);
    }

    // CRT scanline overlay
    if (postProcessConfig.crtScanlines) {
      applyCrtScanlines(ctx, canvas.width, canvas.height, postProcessConfig.crtIntensity);
    }

    // Vignette darkening
    if (postProcessConfig.vignette) {
      applyVignette(ctx, canvas.width, canvas.height, postProcessConfig.vignetteIntensity);
    }

    // Film grain noise
    if (postProcessConfig.filmGrain) {
      applyFilmGrain(ctx, canvas.width, canvas.height, postProcessConfig.grainIntensity);
    }

    // Chromatic aberration
    if (postProcessConfig.chromaticAberration) {
      applyChromaticAberration(ctx, canvas.width, canvas.height, postProcessConfig.aberrationOffset);
    }
  };

  // Preset unique studio configurations
  const applyPreset = (presetName: string) => {
    setUniqueMode(presetName);
    
    const overrides: Partial<WorkerOptions> = {};
    if (presetName === 'portrait') {
      overrides.charMode = 'extended';
      overrides.dithering = 'floyd-steinberg';
      overrides.brightness = 10;
      overrides.contrast = 20;
      overrides.sharpness = 20;
      overrides.edgeDetection = 'none';
      overrides.colorMode = 'color';
      overrides.detailPreservationMode = 'faces';
      setActiveFont('mono');
    } else if (presetName === 'manga') {
      overrides.charMode = 'manga';
      overrides.dithering = 'atkinson';
      overrides.brightness = 15;
      overrides.contrast = 45;
      overrides.colorMode = 'mono';
      overrides.invert = false;
      setActiveFont('crt');
    } else if (presetName === 'pixel') {
      overrides.charMode = 'pixel';
      overrides.dithering = 'bayer-8x8';
      overrides.brightness = 5;
      overrides.contrast = 35;
      overrides.colorMode = 'palette';
      setActiveFont('pixel');
    } else if (presetName === 'logo') {
      overrides.charMode = 'blocks';
      overrides.edgeDetection = 'sobel';
      overrides.edgeWeight = 75;
      overrides.dithering = 'none';
      overrides.contrast = 55;
      overrides.colorMode = 'mono';
      setActiveFont('terminal');
    } else if (presetName === 'blueprint') {
      overrides.charMode = 'standard';
      overrides.edgeDetection = 'sobel';
      overrides.edgeWeight = 85;
      overrides.colorMode = 'mono';
      overrides.backgroundColorMode = 'custom';
      overrides.customBgColor = '#002570';
      setActiveFont('code');
    } else if (presetName === 'matrix') {
      overrides.charMode = 'matrix';
      overrides.colorMode = 'green';
      overrides.backgroundColorMode = 'none';
      setActiveFont('crt');
    } else if (presetName === 'neon') {
      overrides.charMode = 'extended';
      overrides.edgeDetection = 'sobel';
      overrides.edgeWeight = 90;
      overrides.colorMode = 'neon';
      overrides.backgroundColorMode = 'custom';
      overrides.customBgColor = '#0b0514';
      setActiveFont('mono');
    } else if (presetName === 'mosaic') {
      overrides.charMode = 'braille';
      overrides.dithering = 'floyd-steinberg';
      overrides.edgeDetection = 'sobel';
      overrides.edgeWeight = 40;
      overrides.colorMode = 'color';
      overrides.detailPreservationMode = 'details';
      setActiveFont('mono');
    }

    setOptions(prev => ({ ...prev, ...overrides }));
    showToast(`Calibrated preset configurations to: ${presetName.toUpperCase()}`, 'success');
  };

  // ── Layer Management ──

  const hexToRgbSimple = (hex: string): { r: number; g: number; b: number } => {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
  };

  const addProLayer = () => {
    if (!asciiResult) { showToast('Convert an image first before adding layers.', 'warning'); return; }
    const cols = asciiResult.charGrid[0]?.length || 0;
    const rows = asciiResult.charGrid.length;
    if (cols === 0 || rows === 0) return;
    const id = `layer-${Date.now()}`;
    const newLayer: Layer = {
      id,
      name: `Layer ${proLayers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      grid: Array(rows).fill(null).map(() => Array(cols).fill(' ')),
      colors: Array(rows).fill(null).map(() => Array(cols).fill({ r: 226, g: 232, b: 240 })),
    };
    setProLayers(prev => [...prev, newLayer]);
    setActiveProLayerId(id);
    showToast('New layer added', 'success');
  };

  const removeProLayer = (id: string) => {
    setProLayers(prev => prev.filter(l => l.id !== id));
    if (activeProLayerId === id) setActiveProLayerId('');
  };

  const toggleLayerVisibility = (id: string) => {
    setProLayers(prev => prev.map(l => l.id === id ? { ...l, visible: !l.visible } : l));
  };

  const updateLayerOpacity = (id: string, opacity: number) => {
    setProLayers(prev => prev.map(l => l.id === id ? { ...l, opacity: opacity / 100 } : l));
  };

  const updateLayerBlendMode = (id: string, blendMode: string) => {
    setProLayers(prev => prev.map(l => l.id === id ? { ...l, blendMode: blendMode as Layer['blendMode'] } : l));
  };

  const applyShapeToActiveLayer = () => {
    if (!activeProLayerId || !asciiResult) {
      showToast('Select a layer first (add one from Layers tab).', 'warning');
      return;
    }
    if (shapeOverlayTool === 'none') { showToast('Select a shape tool.', 'warning'); return; }

    const cols = asciiResult.charGrid[0]?.length || 0;
    const rows = asciiResult.charGrid.length;
    const color = hexToRgbSimple(shapeColor);

    setProLayers(prev => prev.map(layer => {
      if (layer.id !== activeProLayerId) return layer;
      const g = layer.grid.map(r => [...r]);
      const c = layer.colors.map(r => r.map(v => ({ ...v })));
      const centerR = Math.floor(rows / 2);
      const centerC = Math.floor(cols / 2);
      const radius = Math.floor(Math.min(rows, cols) / 4);

      switch (shapeOverlayTool) {
        case 'rect':
          drawRectangle(g, c, Math.floor(rows * 0.2), Math.floor(cols * 0.2), Math.floor(rows * 0.8), Math.floor(cols * 0.8), shapeChar, color, shapeFilled);
          break;
        case 'circle':
          drawCircle(g, c, centerR, centerC, radius, shapeChar, color, shapeFilled);
          break;
        case 'star':
          drawStar(g, c, centerR, centerC, radius, shapeChar, color);
          break;
        case 'arrow':
          drawArrow(g, c, Math.floor(rows * 0.3), Math.floor(cols * 0.2), Math.floor(rows * 0.7), Math.floor(cols * 0.8), shapeChar, color);
          break;
        case 'text':
          if (textOverlayStyle === 'curved') {
            drawCurvedText(g, c, centerR, centerC, radius, textOverlayValue, color);
          } else if (textOverlayStyle === 'vertical') {
            drawVerticalText(g, c, 2, centerC, textOverlayValue, color);
          } else {
            drawBannerText(g, c, Math.floor(rows * 0.3), 2, textOverlayValue, textOverlayFont, color);
          }
          break;
        case 'material':
          applyMaterial(materialType, g, c);
          break;
      }
      return { ...layer, grid: g, colors: c };
    }));
    showToast(`${shapeOverlayTool.toUpperCase()} applied to active layer`, 'success');
  };

  // Export handlers with custom metadata JSON tags
  const getMetadataHeader = () => {
    const meta = {
      options,
      uniqueMode,
      activeFont,
      app: 'ascii-forge',
      version: '2.0.0'
    };
    return `ASCII_FORGE_METADATA:${btoa(JSON.stringify(meta))}`;
  };

  // Import capability
  const handleImportMetadata = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const match = text.match(/ASCII_FORGE_METADATA:([A-Za-z0-9+/=]+)/);
      if (match && match[1]) {
        try {
          const parsed = JSON.parse(atob(match[1]));
          if (parsed.options) {
            setOptions(parsed.options);
            if (parsed.uniqueMode) setUniqueMode(parsed.uniqueMode);
            if (parsed.activeFont) setActiveFont(parsed.activeFont);
            showToast('Parameters loaded from file comments!', 'success');
          }
        } catch (err) {
          showToast('Invalid or corrupted metadata header.', 'error');
        }
      } else {
        showToast('No ASCII Forge configuration metadata found in file.', 'warning');
      }
    };
    reader.readAsText(file);
  };

  const exportAsText = () => {
    if (!asciiResult) return;
    const meta = `# ${getMetadataHeader()}\n`;
    const blob = new Blob([meta + asciiResult.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ascii_art_studio.txt';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported Plain Text with metadata', 'success');
  };

  const exportAsHtml = () => {
    if (!asciiResult) return;
    let bg = '#080e1a';
    if (options.backgroundColorMode === 'custom' && options.customBgColor) bg = options.customBgColor;
    
    let fontStyles = 'font-family: monospace; font-size: 8px; line-height: 7px;';
    if (activeFont === 'crt') fontStyles = "font-family: 'Fira Code', monospace; font-size: 8px; line-height: 7px;";
    else if (activeFont === 'pixel') fontStyles = "font-family: 'Press Start 2P', monospace; font-size: 6px; line-height: 8px;";
    
    let htmlContent = `<!-- ${getMetadataHeader()} -->
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      background-color: ${bg};
      ${fontStyles}
      letter-spacing: 0px;
      white-space: pre;
      margin: 30px;
    }
    span { display: inline-block; }
  </style>
</head>
<body>\n`;

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
    a.download = 'ascii_art_studio.html';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported interactive HTML', 'success');
  };

  const exportAsSvg = () => {
    if (!asciiResult) return;
    const grid = asciiResult.charGrid;
    const colors = asciiResult.colors;
    const rows = grid.length;
    const cols = grid[0]?.length || 0;

    let charWidth = 7;
    let charHeight = 12;
    let fontName = 'monospace';
    if (activeFont === 'pixel') fontName = '"Press Start 2P"';
    
    const svgWidth = cols * charWidth;
    const svgHeight = rows * charHeight;
    let bg = '#080e1a';
    if (options.backgroundColorMode === 'custom' && options.customBgColor) bg = options.customBgColor;

    let svgContent = `<!-- ${getMetadataHeader()} -->
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">
  <rect width="100%" height="100%" fill="${bg}"/>
  <g font-family="${fontName}" font-size="${charHeight - 2}px" font-weight="500" xml:space="preserve">`;

    for (let r = 0; r < rows; r++) {
      let activeColor = '';
      let textChunk = '';
      let startX = 0;

      for (let c = 0; c < cols; c++) {
        const char = grid[r][c];
        let cellColor = 'rgb(56,189,248)';
        if (colors && colors[r] && colors[r][c]) {
          cellColor = `rgb(${colors[r][c].r},${colors[r][c].g},${colors[r][c].b})`;
        }

        if (cellColor !== activeColor) {
          if (textChunk) {
            svgContent += `\n    <text x="${startX}" y="${r * charHeight + 10}" fill="${activeColor}">${textChunk}</text>`;
          }
          activeColor = cellColor;
          textChunk = char;
          startX = c * charWidth;
        } else {
          textChunk += char;
        }
      }

      if (textChunk) {
        svgContent += `\n    <text x="${startX}" y="${r * charHeight + 10}" fill="${activeColor}">${textChunk}</text>`;
      }
    }

    svgContent += '\n  </g>\n</svg>';

    const blob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ascii_art_studio.svg';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported SVG Vector vector asset', 'success');
  };

  const exportAsPng = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ascii_art_studio.png';
    a.click();
    showToast('Exported high-res PNG', 'success');
  };

  const exportAsAnsi = () => {
    if (!asciiResult) return;
    const grid = asciiResult.charGrid;
    const colors = asciiResult.colors;

    let ansiText = `# ${getMetadataHeader()}\n`;
    for (let r = 0; r < grid.length; r++) {
      for (let c = 0; c < grid[r].length; c++) {
        const char = grid[r][c];
        if (colors && colors[r] && colors[r][c]) {
          const { r: red, g: green, b: blue } = colors[r][c];
          ansiText += `\x1b[38;2;${red};${green};${blue}m${char}`;
        } else {
          ansiText += char;
        }
      }
      ansiText += '\x1b[0m\n'; // reset color
    }

    const blob = new Blob([ansiText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ascii_art_studio.ans';
    a.click();
    URL.revokeObjectURL(url);
    showToast('Exported ANSI raw terminal art', 'success');
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden grid-bg">
      {/* Dynamic Smart AI Recommendation Overlay */}
      <AnimatePresence>
        {showRecommendation && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-14 left-1/2 transform -translate-x-1/2 z-40 bg-theme-panel/90 border border-theme-accent/50 rounded-xl px-5 py-3 shadow-neon-strong backdrop-blur-md flex items-center gap-4 max-w-lg"
          >
            <div className="w-8 h-8 rounded-full bg-theme-accent/25 flex items-center justify-center text-theme-accent">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-sans text-theme-muted font-bold tracking-wider uppercase">AI ENGINE DETECTOR</p>
              <h4 className="text-xs font-sans font-medium text-theme-text mt-0.5">
                {showRecommendation === 'portrait' && 'Detected a face! Switch to Portrait Mode preset?'}
                {showRecommendation === 'text' && 'Detected text block! Switch to High Contrast Text preset?'}
                {showRecommendation === 'logo' && 'Detected symmetric center logo! Switch to Crisp Edge preset?'}
              </h4>
            </div>
            <div className="flex gap-2">
              <Button variant="primary" size="sm" onClick={() => applyPreset(showRecommendation)}>
                Apply
              </Button>
              <button 
                onClick={() => setShowRecommendation(null)}
                className="text-[10px] text-theme-muted hover:text-theme-text font-semibold font-mono underline"
              >
                Dismiss
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Studio Viewport */}
      <div className="flex-1 flex flex-col xl:flex-row h-full overflow-hidden">
        
        {/* COLUMN 1: Original Viewport Panel */}
        <div className="flex-1 flex flex-col border-b xl:border-b-0 xl:border-r border-theme-border/60 bg-black/20 overflow-hidden relative">
          <div className="h-10 border-b border-theme-border/30 bg-theme-panel/30 flex items-center justify-between px-4">
            <span className="text-[10px] font-mono tracking-widest text-theme-muted uppercase font-bold flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5" /> SOURCE PREVIEW
            </span>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => setLeftZoom(prev => Math.max(25, prev - 25))} className="p-1">
                <ZoomOut className="w-3 h-3" />
              </Button>
              <span className="text-[10px] font-mono text-theme-muted min-w-[28px] text-center">{leftZoom}%</span>
              <Button variant="secondary" size="sm" onClick={() => setLeftZoom(prev => Math.min(300, prev + 25))} className="p-1">
                <ZoomIn className="w-3 h-3" />
              </Button>
              <button 
                onClick={() => setZoomLocked(!zoomLocked)} 
                title={zoomLocked ? 'Unlock Zooms' : 'Lock Zooms'}
                className={`p-1.5 rounded transition-all ${zoomLocked ? 'text-theme-accent bg-theme-accent/10 border border-theme-accent/30' : 'text-theme-muted'}`}
              >
                {zoomLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto flex items-center justify-center p-6 relative">
            {imageSrc ? (
              <div 
                style={{ transform: `scale(${leftZoom / 100})`, transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)' }}
                className="origin-center shadow-lg relative max-w-full max-h-full"
              >
                <img src={imageSrc} className="max-w-xs sm:max-w-md max-h-[50vh] object-contain rounded border border-theme-border/40" alt="Source image" />
                {/* Visual Overlay representation of face box */}
                {options.aiSmartMode && asciiResult && asciiResult.stats.facesDetected > 0 && (
                  <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-theme-accent animate-pulse">
                    <span className="absolute bottom-full left-0 bg-theme-accent text-theme-bg text-[8px] font-bold px-1 py-0.5 rounded-t">
                      Skin-Tone Area Bounding Cluster
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="glass border border-theme-border/30 rounded-xl p-8 text-center cursor-pointer flex flex-col items-center gap-3 max-w-sm hover:bg-white/5 hover:border-theme-accent/30 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-full bg-theme-accent/15 border border-theme-accent/30 flex items-center justify-center text-theme-accent shadow-neon">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-theme-text">Upload Image Source</h3>
                  <p className="text-[10px] text-theme-muted mt-1 leading-relaxed">
                    Drop JPG, PNG, WEBP. Live conversions are offloaded to background threads.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* COLUMN 2: Configuration Side Panel */}
        <div className="w-full xl:w-96 border-b xl:border-b-0 xl:border-r border-theme-border/60 bg-theme-panel/40 backdrop-blur-md flex flex-col flex-shrink-0">
          
          {/* Preset Buttons Header */}
          <div className="p-3 border-b border-theme-border/40 bg-black/10 flex flex-col gap-2">
            <span className="text-[10px] font-mono font-bold tracking-widest text-theme-muted uppercase flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-theme-accent" /> UNIQUE STUDIO MODES
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {['portrait', 'manga', 'pixel', 'logo', 'blueprint', 'matrix', 'neon', 'mosaic'].map(preset => (
                <button
                  key={preset}
                  onClick={() => applyPreset(preset)}
                  className={`py-1.5 rounded text-[9px] font-sans font-bold uppercase transition-all ${
                    uniqueMode === preset
                      ? 'bg-theme-accent/25 text-theme-accent border border-theme-accent/60 shadow-neon'
                      : 'bg-theme-bg/60 text-theme-muted hover:text-theme-text border border-theme-border/40'
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Config Tabs Selectors */}
          <div className="flex overflow-x-auto border-b border-theme-border/30 bg-black/5 scrollbar-hide">
            {[
              { id: 'adjust', label: 'ADJUST', icon: <Sliders className="w-3.5 h-3.5" /> },
              { id: 'style', label: 'STYLE', icon: <Eye className="w-3.5 h-3.5" /> },
              { id: 'palette', label: 'PALETTE', icon: <Sliders className="w-3.5 h-3.5" /> },
              { id: 'beautify', label: 'BEAUTY', icon: <Sparkles className="w-3.5 h-3.5" /> },
              { id: 'effects', label: 'FX', icon: <Droplets className="w-3.5 h-3.5" /> },
              { id: 'layers', label: 'LAYERS', icon: <LayersIcon className="w-3.5 h-3.5" /> },
              { id: 'shapes', label: 'SHAPES', icon: <Grid3X3 className="w-3.5 h-3.5" /> },
              { id: 'color', label: 'COLOR', icon: <Palette className="w-3.5 h-3.5" /> }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-shrink-0 px-3 py-2 flex flex-col items-center gap-0.5 text-[9px] font-sans font-bold tracking-wider border-b-2 ${
                  activeTab === tab.id
                    ? 'border-theme-accent text-theme-accent bg-theme-accent/5'
                    : 'border-transparent text-theme-muted hover:text-theme-text'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Tabs Details */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
            
            {/* Tab: Pre-process adjust */}
            {activeTab === 'adjust' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">SAMPLING DENSITY</span>
                  <Slider label="COLUMNS (WIDTH)" min={20} max={250} step={2} value={options.width} onChange={(val) => setOptions(prev => ({ ...prev, width: val }))} />
                  <Slider label="ROWS (HEIGHT)" min={10} max={180} step={2} value={options.height} onChange={(val) => setOptions(prev => ({ ...prev, height: val }))} />
                </div>
                
                <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">CONTRAST & DYNAMIC RANGE</span>
                  <Select
                    label="DYNAMIC CONTRAST"
                    value={options.contrastMethod}
                    onChange={(val) => setOptions(prev => ({ ...prev, contrastMethod: val as any }))}
                    options={[
                      { value: 'none', label: 'Manual Adjustment only' },
                      { value: 'equalize', label: 'Histogram Equalization' }
                    ]}
                  />
                  <Slider label="BRIGHTNESS" min={-100} max={100} step={5} value={options.brightness} onChange={(val) => setOptions(prev => ({ ...prev, brightness: val }))} />
                  <Slider label="CONTRAST" min={-100} max={100} step={5} value={options.contrast} onChange={(val) => setOptions(prev => ({ ...prev, contrast: val }))} />
                </div>

                <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">IMAGE SHARPNESS & DETAILS</span>
                  <Slider label="CONVOLUTION SHARPNESS" min={0} max={100} step={5} value={options.sharpness} onChange={(val) => setOptions(prev => ({ ...prev, sharpness: val }))} />
                  <Slider label="MEDIAN NOISE REDUCTION" min={0} max={100} step={5} value={options.noiseReduction} onChange={(val) => setOptions(prev => ({ ...prev, noiseReduction: val }))} />
                  <Slider label="UNSHARP DEBLUR FILTER" min={0} max={100} step={5} value={options.deblur} onChange={(val) => setOptions(prev => ({ ...prev, deblur: val }))} />
                </div>
              </div>
            )}

            {/* Tab: Render characters styling */}
            {activeTab === 'style' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3.5">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">DITHERING ALGORITHMS</span>
                  <Select
                    label="DITHERING MODE"
                    value={options.dithering}
                    onChange={(val) => setOptions(prev => ({ ...prev, dithering: val as any }))}
                    options={[
                      { value: 'none', label: 'Threshold / Map (Direct)' },
                      { value: 'floyd-steinberg', label: 'Floyd-Steinberg Diffusion' },
                      { value: 'atkinson', label: 'Atkinson Dithering' },
                      { value: 'bayer-4x4', label: 'Bayer 4x4 Ordered' },
                      { value: 'bayer-8x8', label: 'Bayer 8x8 High Dither' }
                    ]}
                  />
                </div>

                <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3.5">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">CHARACTER MAPPINGS</span>
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
                      { value: 'manga', label: 'Manga Halftones' },
                      { value: 'custom', label: 'Custom Character Set' }
                    ]}
                  />

                  {options.charMode === 'custom' && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[9px] text-theme-muted font-mono">CUSTOM CHARS (DARK TO LIGHT)</span>
                      <input
                        type="text"
                        value={options.customChars || ''}
                        onChange={(e) => setOptions(prev => ({ ...prev, customChars: e.target.value }))}
                        placeholder="e.g.  .-*#%"
                        className="px-3 py-1.5 rounded bg-theme-bg border border-theme-border text-sm text-theme-text font-mono focus:outline-none"
                      />
                    </div>
                  )}
                </div>

                <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3.5">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">EDGE RECOVERY</span>
                  <Select
                    label="EDGE METHOD"
                    value={options.edgeDetection}
                    onChange={(val) => setOptions(prev => ({ ...prev, edgeDetection: val as any }))}
                    options={[
                      { value: 'none', label: 'Disable Edge Overlay' },
                      { value: 'sobel', label: 'Sobel Directional Operator' }
                    ]}
                  />
                  {options.edgeDetection !== 'none' && (
                    <Slider label="EDGE MAPPING MAGNITUDE" min={10} max={100} step={5} value={options.edgeWeight} onChange={(val) => setOptions(prev => ({ ...prev, edgeWeight: val }))} />
                  )}
                </div>

                <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3.5">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">STUDIO FONT PRESETS</span>
                  <Select
                    label="FONT SYSTEM"
                    value={activeFont}
                    onChange={(val) => setActiveFont(val as any)}
                    options={[
                      { value: 'mono', label: 'JetBrains Mono' },
                      { value: 'terminal', label: 'Share Tech Mono (Terminal)' },
                      { value: 'crt', label: 'Fira Code (Retro CRT)' },
                      { value: 'pixel', label: 'Press Start 2P (Pixel Font)' },
                      { value: 'code', label: 'Courier Prime (Modern Coding)' }
                    ]}
                  />
                  <Switch
                    label="CORRECT ASPECT RATIO"
                    checked={options.aspectRatioCorrection}
                    onChange={(val) => setOptions(prev => ({ ...prev, aspectRatioCorrection: val }))}
                  />
                </div>
              </div>
            )}

            {/* Tab: Palettes */}
            {activeTab === 'palette' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">COLOR MODE</span>
                  <Select
                    label="COLOR CHANNELS"
                    value={options.colorMode}
                    onChange={(val) => setOptions(prev => ({ ...prev, colorMode: val as any }))}
                    options={[
                      { value: 'mono', label: 'Monochrome (Theme Standard)' },
                      { value: 'color', label: 'Full RGB Color' },
                      { value: 'green', label: 'Retro Phosphor Green' },
                      { value: 'amber', label: 'Amber CRT orange' },
                      { value: 'rgb', label: 'Static Rainbow RGB' },
                      { value: 'ansi-16', label: 'ANSI 16 Terminal Colors' },
                      { value: 'ansi-256', label: 'ANSI 256 Color Cube' },
                      { value: 'palette', label: 'Custom Palette Mapping' },
                      { value: 'neon', label: 'Glowing Cyberpunk Neon' }
                    ]}
                  />
                </div>

                <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">BACKGROUND MAPPING</span>
                  <Select
                    label="BACKGROUND MODE"
                    value={options.backgroundColorMode}
                    onChange={(val) => setOptions(prev => ({ ...prev, backgroundColorMode: val as any }))}
                    options={[
                      { value: 'none', label: 'Standard Dark' },
                      { value: 'match', label: 'Subtle Colored cells background' },
                      { value: 'custom', label: 'Solid Custom HEX Color' }
                    ]}
                  />
                  {options.backgroundColorMode === 'custom' && (
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={options.customBgColor}
                        onChange={(e) => setOptions(prev => ({ ...prev, customBgColor: e.target.value }))}
                        className="w-8 h-8 rounded border border-theme-border cursor-pointer bg-transparent"
                      />
                      <span className="text-xs font-mono uppercase text-theme-muted">{options.customBgColor}</span>
                    </div>
                  )}
                </div>

                {options.colorMode === 'palette' && (
                  <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3">
                    <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">CUSTOM PALETTE EDITOR</span>
                    <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-black/20 border border-theme-border/40">
                      {options.customPalette?.map((color, index) => (
                        <div key={index} className="flex items-center gap-1 bg-white/5 border border-white/10 rounded px-1.5 py-0.5">
                          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                          <span className="text-[9px] font-mono text-theme-muted">{color}</span>
                          <button 
                            onClick={() => setOptions(prev => ({
                              ...prev,
                              customPalette: prev.customPalette?.filter((_, idx) => idx !== index)
                            }))}
                            className="text-[9px] text-rose-400 hover:text-rose-300 font-bold ml-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={newColorInput}
                        onChange={(e) => setNewColorInput(e.target.value)}
                        className="w-8 h-8 rounded border border-theme-border cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={newColorInput}
                        onChange={(e) => setNewColorInput(e.target.value)}
                        className="flex-1 px-3 py-1 bg-theme-bg border border-theme-border rounded text-xs font-mono focus:outline-none"
                      />
                      <Button variant="secondary" size="sm" onClick={() => {
                        if (options.customPalette?.includes(newColorInput)) return;
                        setOptions(prev => ({
                          ...prev,
                          customPalette: [...(prev.customPalette || []), newColorInput]
                        }));
                      }}>
                        <Plus className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Beautifier */}
            {activeTab === 'beautify' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">BEAUTIFIER POST-PASS</span>
                  <Switch
                    label="EDGE RE-ENHANCEMENT"
                    checked={options.beautifyEdgeEnhance}
                    onChange={(val) => setOptions(prev => ({ ...prev, beautifyEdgeEnhance: val }))}
                  />
                  <Switch
                    label="CHARACTER SMOOTHING"
                    checked={options.beautifySmoothing}
                    onChange={(val) => setOptions(prev => ({ ...prev, beautifySmoothing: val }))}
                  />
                  <Switch
                    label="SINGLE DOT NOISE CLEANUP"
                    checked={options.beautifyNoiseCleanup}
                    onChange={(val) => setOptions(prev => ({ ...prev, beautifyNoiseCleanup: val }))}
                  />
                  <Switch
                    label="DENSITY OPTIMIZER"
                    checked={options.beautifyDensityOptimize}
                    onChange={(val) => setOptions(prev => ({ ...prev, beautifyDensityOptimize: val }))}
                  />
                </div>

                <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">SMART AI ASSISTANT</span>
                  <Switch
                    label="AI REAL-TIME MODE"
                    checked={options.aiSmartMode}
                    onChange={(val) => setOptions(prev => ({ ...prev, aiSmartMode: val }))}
                  />
                </div>
              </div>
            )}

            {/* Tab: Effects (Glow, Particles, Post-Processing) */}
            {activeTab === 'effects' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">GLOW / BLOOM ENGINE</span>
                  <Switch
                    label="ENABLE GLOW"
                    checked={glowConfig.enabled}
                    onChange={(val) => setGlowConfig(prev => ({ ...prev, enabled: val }))}
                  />
                  {glowConfig.enabled && (
                    <>
                      <Slider label="GLOW RADIUS" min={1} max={8} step={1} value={glowConfig.radius} onChange={(val) => setGlowConfig(prev => ({ ...prev, radius: val }))} />
                      <Slider label="GLOW INTENSITY" min={0} max={100} step={5} value={glowConfig.intensity} onChange={(val) => setGlowConfig(prev => ({ ...prev, intensity: val }))} />
                      <Slider label="BRIGHTNESS THRESHOLD" min={50} max={250} step={10} value={glowConfig.threshold} onChange={(val) => setGlowConfig(prev => ({ ...prev, threshold: val }))} />
                      <Select
                        label="GLOW COLOR"
                        value={glowConfig.color}
                        onChange={(val) => setGlowConfig(prev => ({ ...prev, color: val as any }))}
                        options={[
                          { value: 'auto', label: 'Automatic (Source)' },
                          { value: 'warm', label: 'Warm Orange Bloom' },
                          { value: 'cool', label: 'Cool Blue Bloom' },
                          { value: 'neon', label: 'Neon Amplified' },
                          { value: 'custom', label: 'Custom Color' }
                        ]}
                      />
                      {glowConfig.color === 'custom' && (
                        <input type="color" value={glowConfig.customColor || '#ff00ff'} onChange={(e) => setGlowConfig(prev => ({ ...prev, customColor: e.target.value }))} className="w-8 h-8 rounded border border-theme-border cursor-pointer bg-transparent" />
                      )}
                    </>
                  )}
                </div>

                <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">PARTICLE OVERLAY</span>
                  <Select
                    label="PARTICLE TYPE"
                    value={particleConfig.type}
                    onChange={(val) => setParticleConfig(prev => ({ ...prev, type: val as any }))}
                    options={[
                      { value: 'none', label: 'Disabled' },
                      { value: 'rain', label: 'Digital Rain' },
                      { value: 'snow', label: 'Snowfall' },
                      { value: 'sparks', label: 'Rising Sparks' },
                      { value: 'fire', label: 'Fire Embers' },
                      { value: 'smoke', label: 'Smoke Wisps' },
                      { value: 'stars', label: 'Twinkling Stars' },
                      { value: 'matrix-rain', label: 'Matrix Code Rain' },
                      { value: 'glitch', label: 'Glitch Bars' }
                    ]}
                  />
                  {particleConfig.type !== 'none' && (
                    <>
                      <Slider label="DENSITY" min={5} max={100} step={5} value={particleConfig.rate} onChange={(val) => setParticleConfig(prev => ({ ...prev, rate: val }))} />
                      <Slider label="SPEED" min={10} max={100} step={5} value={particleConfig.speed} onChange={(val) => setParticleConfig(prev => ({ ...prev, speed: val }))} />
                    </>
                  )}
                </div>

                <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">POST-PROCESSING</span>
                  <Switch
                    label="CRT SCANLINES"
                    checked={postProcessConfig.crtScanlines}
                    onChange={(val) => setPostProcessConfig(prev => ({ ...prev, crtScanlines: val }))}
                  />
                  {postProcessConfig.crtScanlines && (
                    <Slider label="SCANLINE INTENSITY" min={10} max={100} step={5} value={postProcessConfig.crtIntensity} onChange={(val) => setPostProcessConfig(prev => ({ ...prev, crtIntensity: val }))} />
                  )}
                  <Switch
                    label="VIGNETTE"
                    checked={postProcessConfig.vignette}
                    onChange={(val) => setPostProcessConfig(prev => ({ ...prev, vignette: val }))}
                  />
                  {postProcessConfig.vignette && (
                    <Slider label="VIGNETTE INTENSITY" min={10} max={100} step={5} value={postProcessConfig.vignetteIntensity} onChange={(val) => setPostProcessConfig(prev => ({ ...prev, vignetteIntensity: val }))} />
                  )}
                  <Switch
                    label="FILM GRAIN"
                    checked={postProcessConfig.filmGrain}
                    onChange={(val) => setPostProcessConfig(prev => ({ ...prev, filmGrain: val }))}
                  />
                  {postProcessConfig.filmGrain && (
                    <Slider label="GRAIN AMOUNT" min={5} max={100} step={5} value={postProcessConfig.grainIntensity} onChange={(val) => setPostProcessConfig(prev => ({ ...prev, grainIntensity: val }))} />
                  )}
                  <Switch
                    label="CHROMATIC ABERRATION"
                    checked={postProcessConfig.chromaticAberration}
                    onChange={(val) => setPostProcessConfig(prev => ({ ...prev, chromaticAberration: val }))}
                  />
                  {postProcessConfig.chromaticAberration && (
                    <Slider label="ABERRATION OFFSET" min={1} max={10} step={1} value={postProcessConfig.aberrationOffset} onChange={(val) => setPostProcessConfig(prev => ({ ...prev, aberrationOffset: val }))} />
                  )}
                </div>
              </div>
            )}

            {/* Tab: Layers + Background Removal */}
            {activeTab === 'layers' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider flex items-center gap-1.5">
                    <Wand2 className="w-3.5 h-3.5 text-theme-accent" /> BACKGROUND REMOVAL
                  </span>
                  <Switch
                    label="ENABLE BG REMOVAL"
                    checked={bgRemovalConfig.enabled}
                    onChange={(val) => setBgRemovalConfig(prev => ({ ...prev, enabled: val }))}
                  />
                  {bgRemovalConfig.enabled && (
                    <>
                      <Slider label="LUMINANCE THRESHOLD" min={5} max={200} step={5} value={bgRemovalConfig.threshold} onChange={(val) => setBgRemovalConfig(prev => ({ ...prev, threshold: val }))} />
                      <Slider label="EDGE REFINEMENT" min={0} max={10} step={1} value={bgRemovalConfig.edgeBlur} onChange={(val) => setBgRemovalConfig(prev => ({ ...prev, edgeBlur: val }))} />
                      <Select
                        label="DETECTION MODE"
                        value={bgRemovalConfig.mode}
                        onChange={(val) => setBgRemovalConfig(prev => ({ ...prev, mode: val as any }))}
                        options={[
                          { value: 'auto', label: 'Auto-detect Background' },
                          { value: 'dark', label: 'Remove Dark Background' },
                          { value: 'light', label: 'Remove Light Background' }
                        ]}
                      />
                      <Select
                        label="REPLACEMENT"
                        value={bgRemovalConfig.replacement}
                        onChange={(val) => setBgRemovalConfig(prev => ({ ...prev, replacement: val as any }))}
                        options={[
                          { value: 'transparent', label: 'Transparent (Empty)' },
                          { value: 'solid', label: 'Solid Color Fill' },
                          { value: 'gradient', label: 'Vertical Gradient' }
                        ]}
                      />
                      {(bgRemovalConfig.replacement === 'solid' || bgRemovalConfig.replacement === 'gradient') && (
                        <div className="flex items-center gap-2">
                          <input type="color" value={bgRemovalConfig.replacementColor} onChange={(e) => setBgRemovalConfig(prev => ({ ...prev, replacementColor: e.target.value }))} className="w-7 h-7 rounded border border-theme-border cursor-pointer bg-transparent" />
                          <span className="text-[9px] font-mono text-theme-muted">Primary</span>
                          {bgRemovalConfig.replacement === 'gradient' && (
                            <>
                              <input type="color" value={bgRemovalConfig.gradientColor2} onChange={(e) => setBgRemovalConfig(prev => ({ ...prev, gradientColor2: e.target.value }))} className="w-7 h-7 rounded border border-theme-border cursor-pointer bg-transparent" />
                              <span className="text-[9px] font-mono text-theme-muted">Secondary</span>
                            </>
                          )}
                        </div>
                      )}
                      <Switch
                        label="INVERT MASK"
                        checked={bgRemovalConfig.invertMask}
                        onChange={(val) => setBgRemovalConfig(prev => ({ ...prev, invertMask: val }))}
                      />
                    </>
                  )}
                </div>

                <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">LAYER STACK</span>
                    <Button variant="secondary" size="sm" onClick={addProLayer} className="text-[9px] px-2 py-1">
                      <Plus className="w-3 h-3" /> Add
                    </Button>
                  </div>

                  {/* Base conversion layer (always present) */}
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded bg-theme-accent/5 border border-theme-accent/20">
                    <Lock className="w-3 h-3 text-theme-muted" />
                    <span className="flex-1 text-[10px] font-mono text-theme-text">Base Conversion</span>
                    <Eye className="w-3 h-3 text-theme-accent" />
                  </div>

                  {/* User layers */}
                  {proLayers.map(layer => (
                    <div
                      key={layer.id}
                      className={`flex flex-col gap-1.5 px-2 py-1.5 rounded border transition-all ${
                        activeProLayerId === layer.id
                          ? 'bg-theme-accent/10 border-theme-accent/40'
                          : 'bg-black/10 border-theme-border/30 hover:border-theme-border/50'
                      }`}
                      onClick={() => setActiveProLayerId(layer.id)}
                    >
                      <div className="flex items-center gap-2">
                        <button onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id); }} className="text-theme-muted hover:text-theme-text">
                          {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                        </button>
                        <span className="flex-1 text-[10px] font-mono text-theme-text truncate">{layer.name}</span>
                        <button onClick={(e) => { e.stopPropagation(); removeProLayer(layer.id); }} className="text-rose-400/60 hover:text-rose-400">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                      {activeProLayerId === layer.id && (
                        <div className="flex flex-col gap-1.5 pt-1">
                          <Slider label="OPACITY" min={0} max={100} step={5} value={Math.round(layer.opacity * 100)} onChange={(val) => updateLayerOpacity(layer.id, val)} />
                          <Select
                            label="BLEND"
                            value={layer.blendMode}
                            onChange={(val) => updateLayerBlendMode(layer.id, val)}
                            options={[
                              { value: 'normal', label: 'Normal' },
                              { value: 'multiply', label: 'Multiply' },
                              { value: 'screen', label: 'Screen' },
                              { value: 'overlay', label: 'Overlay' },
                              { value: 'additive', label: 'Additive' },
                              { value: 'difference', label: 'Difference' }
                            ]}
                          />
                        </div>
                      )}
                    </div>
                  ))}

                  {proLayers.length === 0 && (
                    <p className="text-[9px] text-theme-muted font-mono text-center py-2">No layers yet. Add a layer to draw shapes and apply effects.</p>
                  )}
                </div>
              </div>
            )}

            {/* Tab: Shapes / Text / Materials */}
            {activeTab === 'shapes' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">SHAPE TOOL</span>
                  <Select
                    label="SHAPE TYPE"
                    value={shapeOverlayTool}
                    onChange={(val) => setShapeOverlayTool(val as any)}
                    options={[
                      { value: 'none', label: 'Select a Shape...' },
                      { value: 'rect', label: 'Rectangle' },
                      { value: 'circle', label: 'Circle / Ellipse' },
                      { value: 'star', label: 'Star' },
                      { value: 'arrow', label: 'Arrow' },
                      { value: 'text', label: 'Text Banner' },
                      { value: 'material', label: 'Material Texture' }
                    ]}
                  />
                </div>

                {(shapeOverlayTool === 'rect' || shapeOverlayTool === 'circle' || shapeOverlayTool === 'star' || shapeOverlayTool === 'arrow') && (
                  <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3">
                    <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">SHAPE PROPERTIES</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-theme-muted w-12">CHAR</span>
                      <input
                        type="text"
                        maxLength={1}
                        value={shapeChar}
                        onChange={(e) => setShapeChar(e.target.value || '#')}
                        className="w-10 px-2 py-1 rounded bg-theme-bg border border-theme-border text-center text-sm font-mono text-theme-text focus:outline-none"
                      />
                      <input type="color" value={shapeColor} onChange={(e) => setShapeColor(e.target.value)} className="w-7 h-7 rounded border border-theme-border cursor-pointer bg-transparent" />
                      <span className="text-[9px] font-mono text-theme-muted">{shapeColor}</span>
                    </div>
                    {(shapeOverlayTool === 'rect' || shapeOverlayTool === 'circle') && (
                      <Switch
                        label="FILLED"
                        checked={shapeFilled}
                        onChange={setShapeFilled}
                      />
                    )}
                  </div>
                )}

                {shapeOverlayTool === 'text' && (
                  <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3">
                    <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">TEXT OVERLAY</span>
                    <input
                      type="text"
                      value={textOverlayValue}
                      onChange={(e) => setTextOverlayValue(e.target.value)}
                      placeholder="Enter text..."
                      className="px-3 py-1.5 rounded bg-theme-bg border border-theme-border text-sm text-theme-text font-mono focus:outline-none"
                    />
                    <Select
                      label="STYLE"
                      value={textOverlayStyle}
                      onChange={(val) => setTextOverlayStyle(val as any)}
                      options={[
                        { value: 'standard', label: 'Banner (FIGlet)' },
                        { value: 'curved', label: 'Curved Arc' },
                        { value: 'vertical', label: 'Vertical Column' }
                      ]}
                    />
                    {textOverlayStyle === 'standard' && (
                      <Select
                        label="FONT"
                        value={textOverlayFont}
                        onChange={setTextOverlayFont}
                        options={[
                          { value: 'Slant', label: 'Slant' },
                          { value: 'Standard', label: 'Standard' },
                          { value: 'Big', label: 'Big' },
                          { value: 'Banner', label: 'Banner' },
                          { value: 'Block', label: 'Block' }
                        ]}
                      />
                    )}
                    <div className="flex items-center gap-2">
                      <input type="color" value={shapeColor} onChange={(e) => setShapeColor(e.target.value)} className="w-7 h-7 rounded border border-theme-border cursor-pointer bg-transparent" />
                      <span className="text-[9px] font-mono text-theme-muted">{shapeColor}</span>
                    </div>
                  </div>
                )}

                {shapeOverlayTool === 'material' && (
                  <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3">
                    <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">MATERIAL TEXTURE</span>
                    <Select
                      label="MATERIAL"
                      value={materialType}
                      onChange={(val) => setMaterialType(val as any)}
                      options={[
                        { value: 'metal', label: 'Brushed Metal' },
                        { value: 'chrome', label: 'Chrome Reflection' },
                        { value: 'glass', label: 'Frosted Glass' },
                        { value: 'wood', label: 'Wood Grain' },
                        { value: 'stone', label: 'Stone / Granite' },
                        { value: 'carbon-fiber', label: 'Carbon Fiber Weave' },
                        { value: 'neon', label: 'Neon Contour' },
                        { value: 'plasma', label: 'Plasma Energy' }
                      ]}
                    />
                  </div>
                )}

                {shapeOverlayTool !== 'none' && (
                  <div className="border-t border-theme-border/20 pt-3">
                    <Button variant="glow" size="sm" onClick={applyShapeToActiveLayer} className="w-full py-2 text-[10px]">
                      Apply to Active Layer
                    </Button>
                    {!activeProLayerId && (
                      <p className="text-[8px] text-amber-400/70 font-mono mt-1.5 text-center">Add a layer in the LAYERS tab first</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Tab: Color Grading Engine */}
            {activeTab === 'color' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">TEMPERATURE & TINT</span>
                  <Slider label="TEMPERATURE" min={-100} max={100} step={5} value={colorGradingConfig.temperature} onChange={(val) => setColorGradingConfig(prev => ({ ...prev, temperature: val }))} />
                  <Slider label="TINT" min={-100} max={100} step={5} value={colorGradingConfig.tint} onChange={(val) => setColorGradingConfig(prev => ({ ...prev, tint: val }))} />
                </div>

                <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">HSL ADJUSTMENTS</span>
                  <Slider label="HUE SHIFT" min={0} max={360} step={5} value={colorGradingConfig.hueShift} onChange={(val) => setColorGradingConfig(prev => ({ ...prev, hueShift: val }))} />
                  <Slider label="SATURATION" min={-100} max={100} step={5} value={colorGradingConfig.saturation} onChange={(val) => setColorGradingConfig(prev => ({ ...prev, saturation: val }))} />
                  <Slider label="LIGHTNESS" min={-100} max={100} step={5} value={colorGradingConfig.lightness} onChange={(val) => setColorGradingConfig(prev => ({ ...prev, lightness: val }))} />
                </div>

                <div className="border-t border-theme-border/20 pt-3 flex flex-col gap-3">
                  <span className="text-[10px] text-theme-muted font-mono font-bold tracking-wider">VIBRANCE</span>
                  <Slider label="VIBRANCE BOOST" min={-100} max={100} step={5} value={colorGradingConfig.vibrance} onChange={(val) => setColorGradingConfig(prev => ({ ...prev, vibrance: val }))} />
                </div>

                <div className="border-t border-theme-border/20 pt-3">
                  <Button variant="secondary" size="sm" onClick={() => setColorGradingConfig(DEFAULT_COLOR_GRADING_CONFIG)} className="w-full py-1.5 text-[10px]">
                    Reset Color Grading
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Settings panel danger wiping operations */}
          <div className="p-3 border-t border-theme-border/40 bg-black/10 flex justify-between gap-2">
            <Button variant="secondary" size="sm" onClick={() => fileImportRef.current?.click()} className="flex-1 py-1.5 text-[10px]">
              Import Metadata
            </Button>
            <input 
              ref={fileImportRef}
              type="file"
              accept=".txt,.html,.svg"
              onChange={handleImportMetadata}
              className="hidden"
            />
            <Button variant="danger" size="sm" onClick={() => triggerConversion()} className="flex-1 py-1.5 text-[10px]">
              Re-sync Canvas
            </Button>
          </div>
        </div>

        {/* COLUMN 3: ASCII Studio Preview Board */}
        <div className="flex-1 flex flex-col bg-black/40 overflow-hidden relative">
          
          {/* Main Top Header toolbar */}
          <div className="h-12 border-b border-theme-border/40 bg-theme-panel/60 backdrop-blur-sm px-4 flex items-center justify-between z-10 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono tracking-widest text-theme-muted uppercase font-bold flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5 text-theme-accent" /> OUTPUT ENGINE
              </span>
              <div className="hidden md:flex items-center gap-1 border border-theme-border/60 bg-black/30 rounded px-2 py-0.5 text-[9px] font-mono text-theme-muted">
                {asciiResult && (
                  <span>
                    GRID: {asciiResult.charGrid[0]?.length || 0}x{asciiResult.charGrid.length || 0}
                  </span>
                )}
              </div>
            </div>

            {/* Split live comparison controllers */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-mono text-theme-muted hidden sm:inline">COMPARE:</span>
              <div className="flex bg-theme-bg/60 border border-theme-border/80 rounded p-0.5">
                {[
                  { id: 'none', label: 'None' },
                  { id: 'slider', label: 'Slider' },
                  { id: 'diff', label: 'Diff' },
                  { id: 'heatmap', label: 'Heat' }
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setComparisonMode(mode.id as any)}
                    className={`px-2 py-0.5 rounded text-[9px] font-sans font-semibold uppercase ${
                      comparisonMode === mode.id
                        ? 'bg-theme-accent/20 text-theme-accent'
                        : 'text-theme-muted hover:text-theme-text'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Export options */}
            <div className="flex items-center gap-1.5">
              <Button variant="secondary" size="sm" onClick={() => setRightZoom(prev => Math.max(25, prev - 25))} className="p-1">
                <ZoomOut className="w-3 h-3" />
              </Button>
              <span className="text-[10px] font-mono text-theme-muted min-w-[28px] text-center">{rightZoom}%</span>
              <Button variant="secondary" size="sm" onClick={() => setRightZoom(prev => Math.min(300, prev + 25))} className="p-1">
                <ZoomIn className="w-3 h-3" />
              </Button>
              
              <div className="w-px h-4 bg-theme-border/60 mx-1" />

              <Button variant="secondary" size="sm" onClick={() => {
                if (!asciiResult) return;
                navigator.clipboard.writeText(asciiResult.text);
                showToast('ASCII copied to clipboard!', 'success');
              }}>
                <Copy className="w-3.5 h-3.5" />
              </Button>

              <div className="relative group">
                <Button variant="glow" size="sm" className="py-1 px-2.5 text-xs">
                  <Download className="w-3.5 h-3.5" /> Export
                </Button>
                <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block w-36 rounded-lg border border-theme-border/60 bg-theme-panel p-1 shadow-2xl glass">
                  <button onClick={exportAsText} className="flex items-center gap-2 w-full px-3 py-2 rounded text-[10px] font-sans text-theme-text hover:bg-white/5">
                    Plain Text (.txt)
                  </button>
                  <button onClick={exportAsHtml} className="flex items-center gap-2 w-full px-3 py-2 rounded-[10px] text-[10px] font-sans text-theme-text hover:bg-white/5">
                    HTML Studio (.html)
                  </button>
                  <button onClick={exportAsSvg} className="flex items-center gap-2 w-full px-3 py-2 rounded-[10px] text-[10px] font-sans text-theme-text hover:bg-white/5">
                    SVG Vector (.svg)
                  </button>
                  <button onClick={exportAsPng} className="flex items-center gap-2 w-full px-3 py-2 rounded-[10px] text-[10px] font-sans text-theme-text hover:bg-white/5">
                    PNG Render (.png)
                  </button>
                  <button onClick={exportAsAnsi} className="flex items-center gap-2 w-full px-3 py-2 rounded-[10px] text-[10px] font-sans text-theme-text hover:bg-white/5">
                    ANSI Terminal (.ans)
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Main drawing display viewport */}
          <div 
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const file = e.dataTransfer.files?.[0];
              if (file) loadFile(file);
            }}
            className="flex-1 overflow-auto flex items-center justify-center p-6 relative"
          >
            <input 
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadFile(file);
              }}
              className="hidden"
            />

            {imageSrc ? (
              <div className="relative">
                {/* 1. Comparison Scrub Slider Mode */}
                {comparisonMode === 'slider' ? (
                  <div className="relative overflow-hidden select-none border border-theme-border" style={{ width: '400px', height: '300px' }}>
                    {/* Background Layer: original image */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <img src={imageSrc} className="max-w-full max-h-full object-contain pointer-events-none" alt="comparison original" />
                    </div>
                    {/* Foreground Layer: ASCII Canvas clipped */}
                    <div 
                      className="absolute inset-0 flex items-center justify-center pointer-events-none"
                      style={{
                        clipPath: `polygon(0 0, ${sliderPosition}% 0, ${sliderPosition}% 100%, 0 100%)`
                      }}
                    >
                      <canvas ref={previewCanvasRef} className="max-w-full max-h-full object-contain bg-[#080e1a]" />
                    </div>
                    {/* Draggable scrub bar */}
                    <div 
                      className="absolute top-0 bottom-0 w-1 bg-theme-accent cursor-ew-resize z-20"
                      style={{ left: `${sliderPosition}%` }}
                    />
                    <input 
                      type="range" 
                      min="0" 
                      max="100"
                      value={sliderPosition}
                      onChange={(e) => setSliderPosition(Number(e.target.value))}
                      className="absolute inset-0 opacity-0 cursor-ew-resize z-30"
                    />
                  </div>
                ) : (
                  // 2. Default Canvas output
                  <div 
                    style={{ transform: `scale(${rightZoom / 100})`, transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1)' }}
                    className="origin-center shadow-[0_0_60px_rgba(0,0,0,0.85)] border border-theme-border/40 relative bg-black/5"
                  >
                    <canvas 
                      ref={previewCanvasRef} 
                      className="max-w-none transition-shadow block"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div 
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const file = e.dataTransfer.files?.[0];
                  if (file) loadFile(file);
                }}
                className="glass border border-theme-border/30 rounded-xl p-8 text-center cursor-pointer flex flex-col items-center gap-3 max-w-sm hover:bg-white/5 hover:border-theme-accent/30 transition-all duration-300"
              >
                <div className="w-12 h-12 rounded-full bg-theme-accent/15 border border-theme-accent/30 flex items-center justify-center text-theme-accent shadow-neon">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-theme-text">Upload Image Source</h3>
                  <p className="text-[10px] text-theme-muted mt-1 leading-relaxed">
                    Drag & drop or click to upload PNG, JPG, JPEG, WEBP, or BMP.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Main bottom stats metrics footer */}
          <div className="h-10 border-t border-theme-border/40 bg-theme-panel/75 backdrop-blur-md px-4 flex items-center justify-between text-[10px] font-mono text-theme-muted flex-shrink-0 z-10">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin text-theme-accent' : ''}`} />
                {isProcessing ? 'CALIBRATING...' : 'READY'}
              </span>
              {asciiResult && (
                <>
                  <span className="hidden sm:inline">| ACCURACY: <b className="text-theme-accent">{asciiResult.stats.accuracyScore}%</b></span>
                  <span className="hidden md:inline">| DETAILS: <b className="text-emerald-400">{asciiResult.stats.detailPreservationScore}%</b></span>
                  <span className="hidden lg:inline">| FIDELITY: <b className="text-indigo-400">{asciiResult.stats.fidelityScore}%</b></span>
                  <span className="hidden xl:inline">| QUALITY SCORE: <b className="text-amber-400">{asciiResult.stats.qualityScore}/100</b></span>
                </>
              )}
            </div>

            <div className="flex items-center gap-3">
              {asciiResult && (
                <span>
                  SPEED: <b className="text-theme-text">{asciiResult.stats.processTimeMs}ms</b> ({fps} fps)
                </span>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
