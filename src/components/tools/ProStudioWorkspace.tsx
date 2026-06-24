import React, { useState, useEffect, useRef } from 'react';
import { 
  Layers as LayersIcon, Paintbrush, Square, Circle as CircleIcon, 
  Play, Pause, Plus, Trash2, Copy, Download, 
  ZoomIn, ZoomOut, 
  Tv, Cpu, Shield, Settings, Sliders, Type, RotateCw, 
  Sparkles, MessageSquare, Eye, EyeOff, Lock, Unlock
} from 'lucide-react';
import { Button, useToast, Slider, Select, Switch } from '../shared/Widgets';
import type { Document, Layer, AnimFrame } from '../../types/workspaceState';
import { compositeLayers } from '../../utils/layersHelper';
import { 
  drawBrush, floodFill, gradientFill, blurCells, 
  sharpenCells, smudgeCells, 
  drawRectangle, drawCircle, drawArrow, drawStar, 
  drawSpeechBubble, drawBannerText, drawCurvedText, drawVerticalText,
  getRectSelection, getCircleSelection, getMagicWandSelection, getColorSelection
} from '../../utils/canvasTools';
import { applyMaterial } from '../../utils/materials';
import { analyzeAsciiMetrics, handleAIChatCommand } from '../../utils/aiAssistant';
import type { AISuggestion } from '../../utils/aiAssistant';
import { exportToTxt, exportToHtml, exportToSvg } from '../../utils/exportPro';

interface ProStudioWorkspaceProps {
  initialFile?: File | null;
  onClearInitialFile?: () => void;
}

export const ProStudioWorkspace: React.FC<ProStudioWorkspaceProps> = ({
  initialFile,
  onClearInitialFile
}) => {
  const { showToast } = useToast();

  // Multi-document states
  const [documents, setDocuments] = useState<Document[]>([]);
  const [activeDocId, setActiveDocId] = useState<string>('');

  // Active document reference
  const activeDoc = documents.find(d => d.id === activeDocId);

  // Panel layout states (docked vs floating layout)
  const [panels, setPanels] = useState([
    { id: 'toolbar', title: 'Toolbar', docked: true, open: true, x: 20, y: 80, w: 60, h: 500 },
    { id: 'layers', title: 'Layers Manager', docked: true, open: true, x: 1200, y: 80, w: 280, h: 300 },
    { id: 'properties', title: 'Properties Inspector', docked: true, open: true, x: 1200, y: 400, w: 280, h: 350 },
    { id: 'timeline', title: 'Timeline & Keyframes', docked: true, open: true, x: 300, y: 550, w: 880, h: 220 },
    { id: 'ai-assistant', title: 'AI Assistant', docked: false, open: false, x: 800, y: 150, w: 320, h: 420 },
    { id: 'stats', title: 'Stats HUD', docked: true, open: true, x: 200, y: 80, w: 200, h: 120 },
    { id: 'brush-presets', title: 'Brush Preset Library', docked: true, open: true, x: 1200, y: 760, w: 280, h: 250 }
  ]);

  // Active Tool configuration
  const [activeTool, setActiveTool] = useState<string>('brush');
  const [brushChar, setBrushChar] = useState<string>('#');
  const [brushColor, setBrushColor] = useState<string>('#38bdf8');
  const [brushSize, setBrushSize] = useState<number>(3);
  const [brushType, setBrushType] = useState<'pencil' | 'brush' | 'airbrush' | 'calligraphy' | 'ink-pen'>('brush');
  const [tolerance, setTolerance] = useState<number>(20);
  const [gradientChar, setGradientChar] = useState<string>('░');
  const [gradientCol2, setGradientCol2] = useState<string>('#ec4899');
  
  // Selection Mask
  const [selectionMask, setSelectionMask] = useState<boolean[][] | undefined>(undefined);
  const [selectionStart, setSelectionStart] = useState<{ r: number; c: number } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{ r: number; c: number } | null>(null);

  // Drag-and-drop state
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [prevCell, setPrevCell] = useState<{ r: number; c: number } | null>(null);

  // Shape drawing target outline
  const [shapeTool, setShapeTool] = useState<string>('rect');
  const [shapeFilled, setShapeFilled] = useState<boolean>(false);

  // Text Stamp
  const [textVal, setTextVal] = useState<string>('ASCII');
  const [textFont, setTextFont] = useState<string>('Slant');
  const [textStyle, setTextStyle] = useState<'standard' | 'curved' | 'vertical'>('standard');

  // Materials
  const [activeMaterial, setActiveMaterial] = useState<'metal' | 'chrome' | 'glass' | 'wood' | 'stone' | 'carbon-fiber' | 'neon' | 'plasma'>('metal');

  // AI Chat states
  const [chatInput, setChatInput] = useState<string>('');
  const [chatLog, setChatLog] = useState<{ sender: 'user' | 'ai'; text: string }[]>([
    { sender: 'ai', text: 'System calibrated. Specify optimizations like "boost contrast" or "make it neon".' }
  ]);

  const [brushPresets, setBrushPresets] = useState<{
    name: string;
    char: string;
    size: number;
    type: 'pencil' | 'brush' | 'airbrush' | 'calligraphy' | 'ink-pen';
    category: string;
  }[]>([
    { name: 'Grid cross', char: '+', size: 1, type: 'pencil', category: 'Technical' },
    { name: 'Detail dot', char: '.', size: 1, type: 'pencil', category: 'Technical' },
    { name: 'Dense mesh', char: '#', size: 3, type: 'brush', category: 'Manga' },
    { name: 'Screentone half', char: '▒', size: 3, type: 'airbrush', category: 'Manga' },
    { name: 'Solid block', char: '█', size: 3, type: 'brush', category: 'Pixel' },
    { name: 'Shading light', char: '░', size: 5, type: 'airbrush', category: 'Pixel' },
    { name: 'Calligraphy slash', char: '/', size: 3, type: 'calligraphy', category: 'Sketch' },
    { name: 'Inking line', char: '|', size: 1, type: 'pencil', category: 'Sketch' },
  ]);
  const [customBrushName, setCustomBrushName] = useState<string>('My Custom Brush');
  const [customBrushCategory, setCustomBrushCategory] = useState<string>('Custom');
  const [activeBrushCategoryTab, setActiveBrushCategoryTab] = useState<string>('All');

  // Screen captures & stream refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const webcamStreamRef = useRef<MediaStream | null>(null);
  const workerRef = useRef<Worker | null>(null);

  // Initialize canvas grid default helper
  const createBlankLayers = (w: number, h: number): Layer[] => {
    return [
      {
        id: 'bg_layer',
        name: 'Background Layer',
        visible: true,
        locked: false,
        opacity: 1,
        blendMode: 'normal',
        grid: Array(h).fill(null).map(() => Array(w).fill(' ')),
        colors: Array(h).fill(null).map(() => Array(w).fill({ r: 56, g: 189, b: 248 })),
        bgColors: Array(h).fill(null).map(() => Array(w).fill({ r: 8, g: 14, b: 26 }))
      }
    ];
  };

  // Initialize Worker on Mount
  useEffect(() => {
    workerRef.current = new Worker(new URL('../../utils/asciiWorker.ts', import.meta.url), { type: 'module' });
    
    // Add a default paint document
    handleCreateNewTab('paint', 'Studio Masterpiece');

    return () => {
      workerRef.current?.terminate();
      stopWebcam();
    };
  }, []);

  // Sync initial file upload from landing page drops
  useEffect(() => {
    if (initialFile) {
      const mime = initialFile.type;
      if (mime.startsWith('video/')) {
        handleCreateNewTab('video', initialFile.name, initialFile);
      } else if (mime.startsWith('image/gif')) {
        handleCreateNewTab('gif', initialFile.name, initialFile);
      } else if (mime.startsWith('image/')) {
        handleCreateNewTab('image', initialFile.name, initialFile);
      } else if (mime.startsWith('audio/')) {
        handleCreateNewTab('visualizer', initialFile.name, initialFile);
      }
      if (onClearInitialFile) onClearInitialFile();
    }
  }, [initialFile]);

  // Video processing interval loops
  const animationFrameId = useRef<number | null>(null);
  useEffect(() => {
    if (activeDoc?.type === 'video' && activeDoc.timeline.isPlaying && activeDoc.options?.videoUrl) {
      const processVideoFrame = () => {
        const video = videoRef.current;
        if (video && !video.paused && !video.ended) {
          triggerWorkerFrame(video);
        }
        animationFrameId.current = requestAnimationFrame(processVideoFrame);
      };
      animationFrameId.current = requestAnimationFrame(processVideoFrame);
    } else {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    }
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [activeDocId, activeDoc?.timeline.isPlaying, activeDoc?.options?.videoUrl]);

  // Webcam capturing logic
  useEffect(() => {
    if (activeDoc?.type === 'webcam' && activeDoc.timeline.isPlaying) {
      if (!webcamStreamRef.current) {
        startWebcam();
      }
      const captureWebcam = () => {
        const video = videoRef.current;
        if (video && video.readyState >= 2) {
          triggerWorkerFrame(video);
        }
        animationFrameId.current = requestAnimationFrame(captureWebcam);
      };
      animationFrameId.current = requestAnimationFrame(captureWebcam);
    } else {
      if (webcamStreamRef.current) {
        stopWebcam();
      }
    }
    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
    };
  }, [activeDocId, activeDoc?.type, activeDoc?.timeline.isPlaying]);

  // Audio spectrum visualizer canvas loop
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  useEffect(() => {
    if (activeDoc?.type === 'visualizer' && activeDoc.timeline.isPlaying && activeDoc.options?.audioUrl) {
      const audio = new Audio(activeDoc.options.audioUrl);
      audio.loop = true;
      audio.crossOrigin = 'anonymous';

      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = ctx;
      const analyser = ctx.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 64;

      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audio.play();

      const drawVisualizer = () => {
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // Map sound spectrum to height levels on active document
        setDocuments(prev => prev.map(d => {
          if (d.id !== activeDocId) return d;
          const copyLayers = d.layers.map(l => {
            const grid = l.grid.map(row => [...row]);
            const colors = l.colors.map(row => [...row]);
            const h = grid.length;
            const w = grid[0].length;

            // Clear old visualization
            for (let r = 0; r < h; r++) {
              grid[r].fill(' ');
            }

            // Draw sound spectrum columns
            for (let c = 0; c < Math.min(w, bufferLength); c++) {
              const val = dataArray[c] / 255;
              const barHeight = Math.round(val * h);

              for (let r = h - 1; r >= h - barHeight; r--) {
                grid[r][c] = '=';
                // Dynamic colors from base green to red peaks
                colors[r][c] = {
                  r: Math.round(255 * (1 - r / h)),
                  g: Math.round(255 * (r / h)),
                  b: 50
                };
              }
            }
            return { ...l, grid, colors };
          });
          return { ...d, layers: copyLayers };
        }));

        animationFrameId.current = requestAnimationFrame(drawVisualizer);
      };

      animationFrameId.current = requestAnimationFrame(drawVisualizer);

      return () => {
        audio.pause();
        ctx.close();
        if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
      };
    }
  }, [activeDocId, activeDoc?.type, activeDoc?.timeline.isPlaying, activeDoc?.options?.audioUrl]);

  // Push worker calculations
  const triggerWorkerFrame = (sourceEl: HTMLVideoElement | HTMLImageElement) => {
    if (!workerRef.current || !activeDoc) return;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = activeDoc.width;
    const h = activeDoc.height;
    canvas.width = w;
    canvas.height = h;

    ctx.drawImage(sourceEl, 0, 0, w, h);
    const imgData = ctx.getImageData(0, 0, w, h);

    const workerOptions = {
      width: w,
      height: h,
      brightness: activeDoc.options?.brightness ?? 0,
      contrast: activeDoc.options?.contrast ?? 0,
      sharpness: activeDoc.options?.sharpness ?? 0,
      noiseReduction: activeDoc.options?.noiseReduction ?? 0,
      deblur: activeDoc.options?.deblur ?? 0,
      contrastMethod: activeDoc.options?.contrastMethod ?? 'none',
      charMode: activeDoc.options?.charMode ?? 'standard',
      colorMode: activeDoc.options?.colorMode ?? 'color',
      backgroundColorMode: activeDoc.options?.backgroundColorMode ?? 'none',
      customBgColor: activeDoc.options?.customBgColor ?? '#080e1a',
      invert: activeDoc.options?.invert ?? false,
      dithering: activeDoc.options?.dithering ?? 'none',
      edgeDetection: activeDoc.options?.edgeDetection ?? 'none',
      edgeWeight: activeDoc.options?.edgeWeight ?? 50,
      aspectRatioCorrection: true,
      fontAspectRatio: 0.55,
      detailPreservationMode: 'balanced',
      aiSmartMode: false,
      beautifyEdgeEnhance: false,
      beautifySmoothing: false,
      beautifyNoiseCleanup: false,
      beautifyDensityOptimize: false
    };

    workerRef.current.postMessage({ imageData: imgData, options: workerOptions });
    workerRef.current.onmessage = (e) => {
      const result = e.data;
      setDocuments(prev => prev.map(d => {
        if (d.id !== activeDocId) return d;
        const copyLayers = d.layers.map((l, idx) => {
          if (idx !== 0) return l; // modify active background layer
          return {
            ...l,
            grid: result.charGrid,
            colors: result.colors ?? l.colors,
            bgColors: result.bgColors ?? l.bgColors
          };
        });
        return {
          ...d,
          layers: copyLayers,
          options: {
            ...d.options,
            stats: result.stats
          }
        };
      }));
    };
  };

  const handleCreateNewTab = (
    type: 'paint' | 'image' | 'gif' | 'video' | 'webcam' | 'screen' | 'text' | 'animation' | 'visualizer',
    name: string,
    file?: File
  ) => {
    const id = 'doc_' + Math.random().toString(36).substring(2, 9);
    const newDoc: Document = {
      id,
      name,
      type,
      width: 80,
      height: 40,
      layers: createBlankLayers(80, 40),
      activeLayerId: 'bg_layer',
      zoom: 100,
      pan: { x: 0, y: 0 },
      options: {
        brightness: 0,
        contrast: 0,
        sharpness: 0,
        noiseReduction: 0,
        deblur: 0,
        contrastMethod: 'none',
        charMode: 'standard',
        colorMode: 'color',
        backgroundColorMode: 'none',
        dithering: 'none',
        edgeDetection: 'none',
        edgeWeight: 50,
        invert: false,
        stats: {
          accuracyScore: 90,
          detailPreservationScore: 85,
          fidelityScore: 88,
          qualityScore: 90,
          processTimeMs: 15,
          facesDetected: 0,
          textDetected: false,
          logoDetected: false
        }
      },
      timeline: {
        isPlaying: false,
        fps: 6,
        activeFrameIdx: 0,
        frames: [
          {
            id: 'frm_0',
            layers: createBlankLayers(80, 40)
          }
        ],
        effects: [],
        particleType: 'none',
        keyframes: []
      }
    };

    if (file) {
      if (type === 'image') {
        const url = URL.createObjectURL(file);
        newDoc.options.imageUrl = url;
        // Trigger conversion once loaded
        const img = new Image();
        img.src = url;
        img.onload = () => triggerWorkerFrame(img);
      } else if (type === 'video') {
        newDoc.options.videoUrl = URL.createObjectURL(file);
      } else if (type === 'gif') {
        newDoc.options.gifUrl = URL.createObjectURL(file);
      } else if (type === 'visualizer') {
        newDoc.options.audioUrl = URL.createObjectURL(file);
      }
    }

    setDocuments(prev => [...prev, newDoc]);
    setActiveDocId(id);
    showToast(`Mounted ${type} document tab!`, 'success');
  };

  const handleCloseTab = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (documents.length <= 1) {
      showToast('Cannot close the last remaining document tab.', 'warning');
      return;
    }
    const filtered = documents.filter(d => d.id !== id);
    setDocuments(filtered);
    if (activeDocId === id) {
      setActiveDocId(filtered[filtered.length - 1].id);
    }
  };

  // Webcam actions
  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      webcamStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setDocuments(prev => prev.map(d => {
        if (d.id !== activeDocId) return d;
        return {
          ...d,
          timeline: { ...d.timeline, isPlaying: true }
        };
      }));
      showToast('Live Webcam link established.', 'success');
    } catch (e) {
      showToast('Failed to load webcam stream permission.', 'error');
    }
  }

  function stopWebcam() {
    if (webcamStreamRef.current) {
      webcamStreamRef.current.getTracks().forEach(track => track.stop());
      webcamStreamRef.current = null;
    }
  }

  // Brush preset handlers
  const applyBrushPreset = (preset: { name: string; char: string; size: number; type: 'pencil' | 'brush' | 'airbrush' | 'calligraphy' | 'ink-pen'; category: string }) => {
    setBrushChar(preset.char);
    setBrushSize(preset.size);
    setBrushType(preset.type);
    showToast(`Brush preset loaded: ${preset.name} (${preset.char})`, 'success');
  };

  const handleCreateCustomBrush = () => {
    if (!brushChar) return;
    const newPreset = {
      name: customBrushName || 'Untitled Brush',
      char: brushChar,
      size: brushSize,
      type: brushType,
      category: customBrushCategory
    };
    setBrushPresets(prev => [...prev, newPreset]);
    showToast(`Custom brush added: ${newPreset.name}`, 'success');
  };

  // Drawing mouse event handlers on ASCII art grid
  const getCellCoords = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const cellWidth = rect.width / (activeDoc?.width || 80);
    const cellHeight = rect.height / (activeDoc?.height || 40);
    return {
      r: Math.floor(y / cellHeight),
      c: Math.floor(x / cellWidth)
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeDoc) return;
    const coords = getCellCoords(e);
    setIsDrawing(true);
    setPrevCell(coords);

    if (activeTool === 'select-rect' || activeTool === 'select-circle') {
      setSelectionStart(coords);
      setSelectionEnd(coords);
    } else {
      applyCanvasDrawingTool(coords.r, coords.c);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!activeDoc || !isDrawing) return;
    const coords = getCellCoords(e);
    
    if (activeTool === 'select-rect' || activeTool === 'select-circle') {
      setSelectionEnd(coords);
    } else {
      if (prevCell && (prevCell.r !== coords.r || prevCell.c !== coords.c)) {
        applyCanvasDrawingTool(coords.r, coords.c);
        setPrevCell(coords);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setPrevCell(null);

    // Apply selection outlines
    if (activeDoc && selectionStart && selectionEnd) {
      let mask: boolean[][] | undefined = undefined;
      const w = activeDoc.width;
      const h = activeDoc.height;
      if (activeTool === 'select-rect') {
        mask = getRectSelection(w, h, selectionStart.r, selectionStart.c, selectionEnd.r, selectionEnd.c);
      } else if (activeTool === 'select-circle') {
        const radius = Math.round(Math.sqrt(Math.pow(selectionEnd.r - selectionStart.r, 2) + Math.pow(selectionEnd.c - selectionStart.c, 2)));
        mask = getCircleSelection(w, h, selectionStart.r, selectionStart.c, radius);
      }
      setSelectionMask(mask);
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  };

  const applyCanvasDrawingTool = (r: number, c: number) => {
    if (!activeDoc) return;
    const activeLayer = activeDoc.layers.find(l => l.id === activeDoc.activeLayerId);
    if (!activeLayer || activeLayer.locked || !activeLayer.visible) return;

    // Deep copy grids
    const gridCopy = activeLayer.grid.map(row => [...row]);
    const colorCopy = activeLayer.colors.map(row => row.map(col => ({ ...col })));

    const rgb = {
      r: parseInt(brushColor.slice(1, 3), 16),
      g: parseInt(brushColor.slice(3, 5), 16),
      b: parseInt(brushColor.slice(5, 7), 16)
    };

    if (activeTool === 'brush' || activeTool === 'eraser') {
      drawBrush(
        gridCopy,
        colorCopy,
        r,
        c,
        activeTool === 'eraser' ? ' ' : brushChar,
        rgb,
        brushSize,
        brushType,
        selectionMask
      );
    } else if (activeTool === 'fill') {
      floodFill(gridCopy, colorCopy, r, c, brushChar, rgb, selectionMask);
    } else if (activeTool === 'gradient') {
      if (prevCell) {
        const rgb2 = {
          r: parseInt(gradientCol2.slice(1, 3), 16),
          g: parseInt(gradientCol2.slice(3, 5), 16),
          b: parseInt(gradientCol2.slice(5, 7), 16)
        };
        gradientFill(gridCopy, colorCopy, prevCell.r, prevCell.c, r, c, rgb, rgb2, gradientChar, selectionMask);
      }
    } else if (activeTool === 'smudge' && prevCell) {
      smudgeCells(gridCopy, colorCopy, r, c, prevCell.r, prevCell.c, brushSize, selectionMask);
    } else if (activeTool === 'blur') {
      blurCells(gridCopy, colorCopy, r, c, brushSize, selectionMask);
    } else if (activeTool === 'sharpen') {
      sharpenCells(gridCopy, colorCopy, r, c, brushSize, selectionMask);
    } else if (activeTool === 'wand') {
      const mask = getMagicWandSelection(activeLayer.grid, activeLayer.colors, r, c, tolerance);
      setSelectionMask(mask);
    } else if (activeTool === 'color-select') {
      const mask = getColorSelection(activeLayer.grid, activeLayer.colors, r, c, tolerance);
      setSelectionMask(mask);
    } else if (activeTool === 'text') {
      if (textStyle === 'standard') {
        drawBannerText(gridCopy, colorCopy, r, c, textVal, textFont, rgb);
      } else if (textStyle === 'curved') {
        drawCurvedText(gridCopy, colorCopy, r, c, 12, textVal, rgb);
      } else {
        drawVerticalText(gridCopy, colorCopy, r, c, textVal, rgb);
      }
    } else if (activeTool === 'shape') {
      if (shapeTool === 'rect') {
        drawRectangle(gridCopy, colorCopy, r - 3, c - 5, r + 3, c + 5, brushChar, rgb, shapeFilled, selectionMask);
      } else if (shapeTool === 'circle') {
        drawCircle(gridCopy, colorCopy, r, c, 5, brushChar, rgb, shapeFilled, selectionMask);
      } else if (shapeTool === 'arrow') {
        drawArrow(gridCopy, colorCopy, r, c, r - 6, c + 8, brushChar, rgb, selectionMask);
      } else if (shapeTool === 'star') {
        drawStar(gridCopy, colorCopy, r, c, 6, brushChar, rgb, selectionMask);
      } else if (shapeTool === 'bubble') {
        drawSpeechBubble(gridCopy, colorCopy, r - 3, c - 6, r + 3, c + 6, brushChar, rgb, selectionMask);
      }
    } else if (activeTool === 'material') {
      applyMaterial(activeMaterial, gridCopy, colorCopy, selectionMask);
    }

    // Update active tab state
    setDocuments(prev => prev.map(d => {
      if (d.id !== activeDocId) return d;
      const layers = d.layers.map(l => {
        if (l.id !== d.activeLayerId) return l;
        return { ...l, grid: gridCopy, colors: colorCopy };
      });
      return { ...d, layers };
    }));
  };

  // Layers System helpers
  const handleAddLayer = () => {
    if (!activeDoc) return;
    const w = activeDoc.width;
    const h = activeDoc.height;
    const id = 'lay_' + Math.random().toString(36).substring(2, 9);
    const newLayer: Layer = {
      id,
      name: `Layer ${activeDoc.layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      blendMode: 'normal',
      grid: Array(h).fill(null).map(() => Array(w).fill(' ')),
      colors: Array(h).fill(null).map(() => Array(w).fill({ r: 56, g: 189, b: 248 }))
    };

    setDocuments(prev => prev.map(d => {
      if (d.id !== activeDocId) return d;
      return {
        ...d,
        layers: [...d.layers, newLayer],
        activeLayerId: id
      };
    }));
    showToast('Appended new editing layer.', 'success');
  };

  const handleDuplicateLayer = (layerId: string) => {
    if (!activeDoc) return;
    const layer = activeDoc.layers.find(l => l.id === layerId);
    if (!layer) return;

    const id = 'lay_' + Math.random().toString(36).substring(2, 9);
    const dup: Layer = {
      ...layer,
      id,
      name: `${layer.name} (Copy)`,
      grid: layer.grid.map(r => [...r]),
      colors: layer.colors.map(r => r.map(c => ({ ...c })))
    };

    setDocuments(prev => prev.map(d => {
      if (d.id !== activeDocId) return d;
      return {
        ...d,
        layers: [...d.layers, dup],
        activeLayerId: id
      };
    }));
    showToast('Layer duplicated.', 'success');
  };

  const handleDeleteLayer = (layerId: string) => {
    if (!activeDoc) return;
    if (activeDoc.layers.length <= 1) {
      showToast('Cannot delete last remaining layer.', 'warning');
      return;
    }

    setDocuments(prev => prev.map(d => {
      if (d.id !== activeDocId) return d;
      const layers = d.layers.filter(l => l.id !== layerId);
      return {
        ...d,
        layers,
        activeLayerId: layers[layers.length - 1].id
      };
    }));
    showToast('Layer removed.', 'info');
  };

  // Export handlers
  const triggerTextExport = () => {
    if (!activeDoc) return;
    const comp = compositeLayers(activeDoc.layers, activeDoc.width, activeDoc.height);
    const txt = exportToTxt(comp.grid, activeDoc.options);
    const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.name.toLowerCase().replace(/\s+/g, '_')}.txt`;
    a.click();
    showToast('Static TXT exported.', 'success');
  };

  const triggerHtmlExport = () => {
    if (!activeDoc) return;
    const comp = compositeLayers(activeDoc.layers, activeDoc.width, activeDoc.height);
    const html = exportToHtml(comp.grid, comp.colors, comp.bgColors);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.name.toLowerCase().replace(/\s+/g, '_')}.html`;
    a.click();
    showToast('Formatted HTML exported.', 'success');
  };

  const triggerSvgExport = () => {
    if (!activeDoc) return;
    const comp = compositeLayers(activeDoc.layers, activeDoc.width, activeDoc.height);
    const svg = exportToSvg(comp.grid, comp.colors, comp.bgColors);
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${activeDoc.name.toLowerCase().replace(/\s+/g, '_')}.svg`;
    a.click();
    showToast('Vector SVG exported.', 'success');
  };

  // AI chat handlers
  const handleSendChat = () => {
    if (!chatInput.trim() || !activeDoc) return;
    const msg = chatInput.trim();
    setChatLog(prev => [...prev, { sender: 'user', text: msg }]);
    setChatInput('');

    const currentOpt = {
      width: activeDoc.width,
      height: activeDoc.height,
      brightness: activeDoc.options?.brightness ?? 0,
      contrast: activeDoc.options?.contrast ?? 0,
      sharpness: activeDoc.options?.sharpness ?? 0,
      noiseReduction: activeDoc.options?.noiseReduction ?? 0,
      deblur: activeDoc.options?.deblur ?? 0,
      contrastMethod: activeDoc.options?.contrastMethod ?? 'none',
      charMode: activeDoc.options?.charMode ?? 'standard',
      colorMode: activeDoc.options?.colorMode ?? 'color',
      backgroundColorMode: activeDoc.options?.backgroundColorMode ?? 'none',
      dithering: activeDoc.options?.dithering ?? 'none',
      edgeDetection: activeDoc.options?.edgeDetection ?? 'none',
      edgeWeight: activeDoc.options?.edgeWeight ?? 50,
      invert: activeDoc.options?.invert ?? false,
      aiSmartMode: false,
      beautifyEdgeEnhance: false,
      beautifySmoothing: false,
      beautifyNoiseCleanup: false,
      beautifyDensityOptimize: false
    };

    const response = handleAIChatCommand(msg, currentOpt as any);
    setTimeout(() => {
      setChatLog(prev => [...prev, { sender: 'ai', text: response.reply }]);
      if (response.updatedOptions) {
        setDocuments(prev => prev.map(d => {
          if (d.id !== activeDocId) return d;
          return {
            ...d,
            options: {
              ...d.options,
              ...response.updatedOptions
            }
          };
        }));
      }
    }, 400);
  };

  // Timeline handlers
  const handlePlayTimeline = () => {
    if (!activeDoc) return;
    setDocuments(prev => prev.map(d => {
      if (d.id !== activeDocId) return d;
      return {
        ...d,
        timeline: {
          ...d.timeline,
          isPlaying: !d.timeline.isPlaying
        }
      };
    }));
  };

  // Composite active document layers
  const composited = activeDoc 
    ? compositeLayers(activeDoc.layers, activeDoc.width, activeDoc.height)
    : { grid: [] as string[][], colors: [] as { r: number; g: number; b: number }[][], bgColors: [] as { r: number; g: number; b: number }[][] };

  // Calculate AI Suggestions metrics list
  const activeStats = activeDoc?.options?.stats;
  const aiSuggestions: AISuggestion[] = activeStats 
    ? analyzeAsciiMetrics(activeStats, activeDoc.options as any)
    : [];

  return (
    <div className="flex-1 flex flex-col h-full bg-theme-bg overflow-hidden relative select-none">
      
      {/* Dynamic scanlines for retro HUD feeling */}
      <div className="crt-effect fixed inset-0 z-50 pointer-events-none opacity-[0.05] mix-blend-overlay" />

      {/* Tabs Menu Navigation Bar */}
      <div className="h-10 border-b border-theme-border/60 bg-theme-panel/70 flex items-center px-4 justify-between z-10">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {documents.map((doc) => {
            const isActive = doc.id === activeDocId;
            return (
              <div
                key={doc.id}
                onClick={() => setActiveDocId(doc.id)}
                className={`h-7 px-3 flex items-center gap-2 rounded-t-md text-xs font-semibold cursor-pointer border-t border-x transition-colors ${
                  isActive 
                    ? 'bg-theme-bg border-theme-border text-theme-accent font-bold shadow-neon' 
                    : 'bg-black/20 border-transparent text-theme-muted hover:text-theme-text'
                }`}
              >
                <span className="text-[9px] px-1 bg-white/5 border border-theme-border rounded select-none opacity-60">
                  {doc.type.toUpperCase()}
                </span>
                <span className="truncate max-w-[120px]">{doc.name}</span>
                <button
                  onClick={(e) => handleCloseTab(doc.id, e)}
                  className="p-0.5 rounded hover:bg-rose-500/10 text-theme-muted hover:text-rose-400"
                >
                  ×
                </button>
              </div>
            );
          })}
          
          <button
            onClick={() => handleCreateNewTab('paint', 'Untitled Art')}
            className="p-1 rounded border border-theme-border/40 hover:border-theme-accent/40 text-theme-muted hover:text-theme-text ml-2 bg-black/10"
            title="Create blank painting canvas"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Global Settings & Quick Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              const panelId = 'ai-assistant';
              setPanels(prev => prev.map(p => p.id === panelId ? { ...p, open: !p.open } : p));
            }}
          >
            <MessageSquare className="w-3.5 h-3.5 text-theme-accent" />
            <span>AI Assistant</span>
          </Button>
          <Button variant="glow" size="sm" onClick={triggerTextExport} title="Export plain text ASCII representation">
            <Download className="w-3.5 h-3.5" />
            <span>TXT</span>
          </Button>
          <Button variant="glow" size="sm" onClick={triggerHtmlExport} title="Export pre-formatted color HTML representation">
            <Download className="w-3.5 h-3.5" />
            <span>HTML</span>
          </Button>
          <Button variant="glow" size="sm" onClick={triggerSvgExport} title="Export vector SVG graphic Representation">
            <Download className="w-3.5 h-3.5" />
            <span>SVG</span>
          </Button>
        </div>
      </div>

      {/* Main Workspace Frame split into panels */}
      <div className="flex-1 flex min-h-0 relative overflow-hidden">

        {/* 1. Left Toolbar Side Panel (Docked) */}
        {panels.find(p => p.id === 'toolbar')?.open && (
          <div className="w-14 border-r border-theme-border/60 bg-theme-panel/40 backdrop-blur-md flex flex-col items-center py-4 gap-4 z-10">
            {[
              { id: 'brush', title: 'Brush Tool', icon: <Paintbrush className="w-4 h-4" /> },
              { id: 'eraser', title: 'Eraser', icon: <Trash2 className="w-4 h-4" /> },
              { id: 'fill', title: 'Flood Fill', icon: <Sliders className="w-4 h-4" /> },
              { id: 'gradient', title: 'Gradient Fill', icon: <Sparkles className="w-4 h-4" /> },
              { id: 'select-rect', title: 'Rectangle Selection', icon: <Square className="w-4 h-4" /> },
              { id: 'select-circle', title: 'Circular Selection', icon: <CircleIcon className="w-4 h-4" /> },
              { id: 'wand', title: 'Magic Wand Selection', icon: <Tv className="w-4 h-4" /> },
              { id: 'color-select', title: 'Color Select', icon: <Cpu className="w-4 h-4" /> },
              { id: 'text', title: 'Typography tool', icon: <Type className="w-4 h-4" /> },
              { id: 'shape', title: 'Vector Shapes', icon: <RotateCw className="w-4 h-4" /> },
              { id: 'material', title: 'Materials Shader', icon: <Shield className="w-4 h-4" /> }
            ].map((tool) => (
              <button
                key={tool.id}
                onClick={() => {
                  setActiveTool(tool.id);
                  if (tool.id !== 'select-rect' && tool.id !== 'select-circle') {
                    setSelectionMask(undefined);
                  }
                }}
                title={tool.title}
                className={`p-2 rounded-lg border transition-all ${
                  activeTool === tool.id
                    ? 'border-theme-accent bg-theme-accent/15 text-theme-accent shadow-neon scale-105'
                    : 'border-transparent text-theme-muted hover:text-theme-text hover:bg-white/5'
                }`}
              >
                {tool.icon}
              </button>
            ))}
          </div>
        )}

        {/* 2. Middle ASCII Art Canvas Area */}
        <div className="flex-1 flex flex-col bg-black/40 overflow-hidden relative justify-center items-center p-6">
          {activeDoc ? (
            <div 
              style={{ transform: `scale(${(activeDoc.zoom ?? 100) / 100})`, transition: 'transform 0.1s ease' }}
              className="origin-center select-none"
            >
              {/* Actual ASCII Forge Render Canvas */}
              <div
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="grid border border-theme-border/60 bg-[#080e1a] rounded-lg shadow-2xl relative select-none"
                style={{
                  gridTemplateColumns: `repeat(${activeDoc.width}, minmax(0, 1fr))`,
                  width: `${activeDoc.width * 9}px`,
                  height: `${activeDoc.height * 12}px`
                }}
              >
                {composited.grid.map((row, r) => 
                  row.map((char, c) => {
                    const color = composited.colors[r]?.[c] ?? { r: 255, g: 255, b: 255 };
                    const bg = composited.bgColors[r]?.[c];
                    
                    const isMasked = selectionMask?.[r]?.[c];

                    return (
                      <div
                        key={`${r}-${c}`}
                        className={`font-mono text-[9px] flex items-center justify-center cursor-crosshair leading-none select-none border-collapse ${
                          isMasked ? 'bg-theme-accent/20 border border-theme-accent/30' : ''
                        }`}
                        style={{
                          width: '9px',
                          height: '12px',
                          color: `rgb(${color.r}, ${color.g}, ${color.b})`,
                          backgroundColor: bg ? `rgb(${bg.r}, ${bg.g}, ${bg.b})` : 'transparent'
                        }}
                      >
                        {char}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ) : (
            <div className="text-center text-theme-muted">Select or create a document tab.</div>
          )}

          {/* Mini zoom floating controls */}
          <div className="absolute bottom-4 left-4 h-8 bg-theme-panel/85 backdrop-blur-md rounded-lg border border-theme-border/40 px-3 flex items-center gap-3 z-10">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!activeDoc) return;
                setDocuments(prev => prev.map(d => d.id === activeDocId ? { ...d, zoom: Math.max(25, d.zoom - 25) } : d));
              }}
              className="p-1"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="text-[10px] font-mono font-bold text-theme-muted">{activeDoc?.zoom ?? 100}%</span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (!activeDoc) return;
                setDocuments(prev => prev.map(d => d.id === activeDocId ? { ...d, zoom: Math.min(300, d.zoom + 25) } : d));
              }}
              className="p-1"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>

        {/* 3. Right Inspectors: Properties, Layers, Shapes */}
        <div className="w-80 border-l border-theme-border/60 bg-theme-panel/30 backdrop-blur-md flex flex-col flex-shrink-0 z-10 divide-y divide-theme-border/40 overflow-y-auto">
          
          {/* Active Tool Settings Inspector */}
          {panels.find(p => p.id === 'properties')?.open && (
            <div className="p-4 flex flex-col gap-4">
              <span className="text-[10px] font-mono font-bold tracking-widest text-theme-muted uppercase flex items-center gap-1.5">
                <Settings className="w-4 h-4 text-theme-accent" />
                PROPERTIES INSPECTOR
              </span>

              {/* Tool properties */}
              <div className="flex flex-col gap-3">
                <label className="text-xs text-theme-muted font-sans font-medium">BRUSH CHARACTER</label>
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    maxLength={1}
                    value={brushChar}
                    onChange={(e) => setBrushChar(e.target.value || '#')}
                    className="w-10 h-8 rounded border border-theme-border bg-theme-bg text-center font-mono text-theme-text text-sm focus:outline-none"
                  />
                  <div className="flex flex-wrap gap-1">
                    {['#', '@', '%', '*', '+', '=', ':', '-', '.'].map(char => (
                      <button
                        key={char}
                        onClick={() => setBrushChar(char)}
                        className={`w-6 h-6 rounded border flex items-center justify-center font-mono text-xs ${
                          brushChar === char ? 'border-theme-accent bg-theme-accent/20 text-theme-accent' : 'border-theme-border bg-theme-panel'
                        }`}
                      >
                        {char}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs text-theme-muted font-sans font-medium">BRUSH CHROMA</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={brushColor}
                      onChange={(e) => setBrushColor(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-theme-border"
                    />
                    <span className="text-xs font-mono text-theme-text uppercase">{brushColor}</span>
                  </div>
                </div>

                {activeTool === 'brush' && (
                  <div className="flex flex-col gap-1.5">
                    <Select
                      label="BRUSH TYPE"
                      value={brushType}
                      onChange={(val) => setBrushType(val as any)}
                      options={[
                        { value: 'pencil', label: 'Hard Pencil (1px)' },
                        { value: 'brush', label: 'Soft Brush (Solid)' },
                        { value: 'airbrush', label: 'Spray Airbrush' },
                        { value: 'calligraphy', label: 'Calligraphy Slash' }
                      ]}
                    />
                    <Slider label="BRUSH SIZE" min={1} max={15} step={2} value={brushSize} onChange={setBrushSize} />
                  </div>
                )}

                {activeTool === 'gradient' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-theme-muted font-sans font-medium">GRADIENT COLOR 2</label>
                    <input
                      type="color"
                      value={gradientCol2}
                      onChange={(e) => setGradientCol2(e.target.value)}
                      className="w-8 h-8 rounded cursor-pointer border border-theme-border"
                    />
                    <input
                      type="text"
                      maxLength={1}
                      value={gradientChar}
                      onChange={(e) => setGradientChar(e.target.value || '░')}
                      placeholder="Grad Char"
                      className="w-12 px-2 py-1 bg-theme-bg border border-theme-border text-center rounded text-sm text-theme-text font-mono focus:outline-none"
                    />
                  </div>
                )}

                {activeTool === 'text' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-xs text-theme-muted font-sans font-medium">STAMP TEXT</label>
                    <input
                      type="text"
                      value={textVal}
                      onChange={(e) => setTextVal(e.target.value)}
                      className="px-3 py-1.5 bg-theme-bg border border-theme-border rounded text-sm text-theme-text focus:outline-none focus:border-theme-accent"
                    />
                    <Select
                      label="FIGLET FONT"
                      value={textFont}
                      onChange={setTextFont}
                      options={[
                        { value: 'Slant', label: 'Slant Banner' },
                        { value: 'Blocks', label: 'Unicode Blocks' },
                        { value: 'Cyber', label: 'Cyber Grid' },
                        { value: 'Mini', label: 'Mini Fonts' }
                      ]}
                    />
                    <Select
                      label="TYPOGRAPHY STYLE"
                      value={textStyle}
                      onChange={(val) => setTextStyle(val as any)}
                      options={[
                        { value: 'standard', label: 'Horizontal standard' },
                        { value: 'curved', label: 'Curved Sweep' },
                        { value: 'vertical', label: 'Vertical Stacking' }
                      ]}
                    />
                  </div>
                )}

                {activeTool === 'shape' && (
                  <div className="flex flex-col gap-2">
                    <Select
                      label="VECTOR SHAPE"
                      value={shapeTool}
                      onChange={setShapeTool}
                      options={[
                        { value: 'rect', label: 'Rectangle outline' },
                        { value: 'circle', label: 'Circular outline' },
                        { value: 'arrow', label: 'Directional Arrow' },
                        { value: 'star', label: '5-pointed Star' },
                        { value: 'bubble', label: 'Speech Bubble' }
                      ]}
                    />
                    <Switch label="FILLED RENDER" checked={shapeFilled} onChange={setShapeFilled} />
                  </div>
                )}

                {activeTool === 'material' && (
                  <div className="flex flex-col gap-1.5">
                    <Select
                      label="ASCII MATERIALS"
                      value={activeMaterial}
                      onChange={(val) => setActiveMaterial(val as any)}
                      options={[
                        { value: 'metal', label: 'Specular Metal' },
                        { value: 'chrome', label: 'Diagonal Chrome' },
                        { value: 'glass', label: 'Frosted Glass' },
                        { value: 'wood', label: 'Circular Wood Grain' },
                        { value: 'stone', label: 'Granite Stone' },
                        { value: 'carbon-fiber', label: 'Carbon Fiber Weave' },
                        { value: 'neon', label: 'Hot Pink Neon' },
                        { value: 'plasma', label: 'Plasma Fluid wave' }
                      ]}
                    />
                  </div>
                )}

                {(activeTool === 'wand' || activeTool === 'color-select') && (
                  <div className="flex flex-col gap-1.5">
                    <Slider 
                      label="SELECTION TOLERANCE" 
                      min={1} 
                      max={100} 
                      step={1} 
                      value={tolerance} 
                      onChange={setTolerance} 
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Layers Panel */}
          {panels.find(p => p.id === 'layers')?.open && (
            <div className="p-4 flex flex-col gap-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-mono font-bold tracking-widest text-theme-muted uppercase flex items-center gap-1.5">
                  <LayersIcon className="w-4 h-4 text-theme-accent" />
                  LAYERS MANAGER
                </span>
                <button
                  onClick={handleAddLayer}
                  className="p-1 rounded bg-theme-accent/10 border border-theme-accent/25 hover:bg-theme-accent/20 text-theme-accent"
                  title="Add new layer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {activeDoc ? (
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
                  {activeDoc.layers.map((layer) => {
                    const isActive = layer.id === activeDoc.activeLayerId;
                    return (
                      <div
                        key={layer.id}
                        onClick={() => setDocuments(prev => prev.map(d => d.id === activeDocId ? { ...d, activeLayerId: layer.id } : d))}
                        className={`p-2 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                          isActive
                            ? 'border-theme-accent bg-theme-accent/10'
                            : 'border-theme-border/40 bg-black/10 hover:border-theme-border'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDocuments(prev => prev.map(d => {
                                if (d.id !== activeDocId) return d;
                                return {
                                  ...d,
                                  layers: d.layers.map(l => l.id === layer.id ? { ...l, visible: !l.visible } : l)
                                };
                              }));
                            }}
                            className="p-0.5 hover:bg-white/5 rounded text-theme-muted"
                          >
                            {layer.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDocuments(prev => prev.map(d => {
                                if (d.id !== activeDocId) return d;
                                return {
                                  ...d,
                                  layers: d.layers.map(l => l.id === layer.id ? { ...l, locked: !l.locked } : l)
                                };
                              }));
                            }}
                            className="p-0.5 hover:bg-white/5 rounded text-theme-muted"
                          >
                            {layer.locked ? <Lock className="w-3.5 h-3.5 text-amber-500" /> : <Unlock className="w-3.5 h-3.5" />}
                          </button>
                          <span className="text-xs text-theme-text font-semibold truncate select-none">{layer.name}</span>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateLayer(layer.id);
                            }}
                            className="p-0.5 hover:bg-white/5 rounded text-theme-muted"
                            title="Duplicate Layer"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteLayer(layer.id);
                            }}
                            className="p-0.5 hover:bg-rose-500/10 rounded text-rose-400"
                            title="Delete Layer"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          )}

          {/* Performance stats HUD */}
          {panels.find(p => p.id === 'stats')?.open && activeDoc && (
            <div className="p-4 flex flex-col gap-2">
              <span className="text-[10px] font-mono font-bold tracking-widest text-theme-muted uppercase flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-theme-accent" />
                QUALITY SCORE ENGINE
              </span>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="border border-theme-border/40 p-2 rounded-lg bg-black/10 text-center">
                  <div className="text-[9px] text-theme-muted uppercase font-mono">Accuracy</div>
                  <div className="text-sm font-bold font-mono text-theme-accent">{activeStats?.accuracyScore ?? 92}%</div>
                </div>
                <div className="border border-theme-border/40 p-2 rounded-lg bg-black/10 text-center">
                  <div className="text-[9px] text-theme-muted uppercase font-mono">Detail Pres.</div>
                  <div className="text-sm font-bold font-mono text-theme-accent">{activeStats?.detailPreservationScore ?? 88}%</div>
                </div>
                <div className="border border-theme-border/40 p-2 rounded-lg bg-black/10 text-center">
                  <div className="text-[9px] text-theme-muted uppercase font-mono">Latency</div>
                  <div className="text-sm font-bold font-mono text-theme-accent">{activeStats?.processTimeMs ?? 18}ms</div>
                </div>
                <div className="border border-theme-border/40 p-2 rounded-lg bg-black/10 text-center">
                  <div className="text-[9px] text-theme-muted uppercase font-mono">Render FPS</div>
                  <div className="text-sm font-bold font-mono text-theme-accent">{activeDoc.timeline.isPlaying ? 30 : 0} FPS</div>
                </div>
              </div>
            </div>
          )}

          {/* Brush Preset Library & Creator */}
          {panels.find(p => p.id === 'brush-presets')?.open && activeDoc && (
            <div className="p-4 flex flex-col gap-3">
              <span className="text-[10px] font-mono font-bold tracking-widest text-theme-muted uppercase flex items-center gap-1.5 border-b border-theme-border/20 pb-1.5">
                <Paintbrush className="w-4 h-4 text-theme-accent" />
                BRUSH PRESET LIBRARY
              </span>

              {/* Category tabs */}
              <div className="flex flex-wrap gap-1">
                {['All', 'Technical', 'Manga', 'Pixel', 'Sketch', 'Custom'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => setActiveBrushCategoryTab(cat)}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-colors ${
                      activeBrushCategoryTab === cat
                        ? 'border-theme-accent bg-theme-accent/20 text-theme-accent font-bold'
                        : 'border-theme-border/40 bg-black/20 text-theme-muted hover:border-theme-border'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Brush Grid */}
              <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto pr-1">
                {brushPresets
                  .filter(preset => activeBrushCategoryTab === 'All' || preset.category === activeBrushCategoryTab)
                  .map((preset, idx) => (
                    <button
                      key={idx}
                      onClick={() => applyBrushPreset(preset)}
                      className="border border-theme-border/40 hover:border-theme-accent/50 p-2 rounded-lg bg-black/10 text-left transition-colors flex items-center gap-2 group w-full"
                    >
                      <div className="w-7 h-7 rounded border border-theme-border flex items-center justify-center font-mono text-theme-accent bg-black/20 text-sm font-bold group-hover:bg-theme-accent/10">
                        {preset.char}
                      </div>
                      <div className="flex-1 truncate">
                        <div className="text-[10px] font-semibold text-theme-text truncate">{preset.name}</div>
                        <div className="text-[8px] text-theme-muted font-mono">{preset.type} ({preset.size}px)</div>
                      </div>
                    </button>
                  ))}
              </div>

              {/* Brush Creator form */}
              <div className="border border-theme-border/40 p-3 rounded-lg bg-black/15 flex flex-col gap-2 mt-1">
                <div className="text-[9px] text-theme-muted uppercase font-mono tracking-wider font-semibold">BRUSH GENERATOR</div>
                
                <input
                  type="text"
                  value={customBrushName}
                  onChange={(e) => setCustomBrushName(e.target.value)}
                  placeholder="Brush Name"
                  className="px-2 py-1 bg-theme-bg border border-theme-border/60 rounded text-[11px] text-theme-text focus:outline-none focus:border-theme-accent font-sans"
                />

                <div className="flex gap-2">
                  <Select
                    label="CATEGORY"
                    value={customBrushCategory}
                    onChange={setCustomBrushCategory}
                    options={[
                      { value: 'Technical', label: 'Technical' },
                      { value: 'Manga', label: 'Manga' },
                      { value: 'Pixel', label: 'Pixel' },
                      { value: 'Sketch', label: 'Sketch' },
                      { value: 'Custom', label: 'Custom' }
                    ]}
                  />
                  
                  <button
                    onClick={handleCreateCustomBrush}
                    className="flex-1 rounded bg-theme-accent hover:bg-theme-accent-hover text-black font-bold text-[10px] px-2 flex items-center justify-center transition-colors uppercase font-sans tracking-wide"
                  >
                    Forge Brush
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Floating Panel: AI Chatbot assistant window */}
      {panels.find(p => p.id === 'ai-assistant')?.open && (
        <div 
          className="absolute z-30 bg-theme-panel border border-theme-border rounded-xl shadow-2xl glass flex flex-col overflow-hidden"
          style={{
            top: `${panels.find(p => p.id === 'ai-assistant')?.y}px`,
            left: `${panels.find(p => p.id === 'ai-assistant')?.x}px`,
            width: `${panels.find(p => p.id === 'ai-assistant')?.w}px`,
            height: `${panels.find(p => p.id === 'ai-assistant')?.h}px`
          }}
        >
          <div className="h-10 bg-black/30 border-b border-theme-border/40 px-3 flex justify-between items-center cursor-move">
            <span className="text-xs font-mono font-bold tracking-widest text-theme-accent">AI CO-PILOT CONSULTATION</span>
            <button
              onClick={() => setPanels(prev => prev.map(p => p.id === 'ai-assistant' ? { ...p, open: false } : p))}
              className="text-theme-muted hover:text-theme-text font-bold"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3">
            {chatLog.map((chat, idx) => (
              <div key={idx} className={`max-w-[85%] rounded-lg p-2.5 text-xs font-sans ${
                chat.sender === 'user'
                  ? 'self-end bg-theme-accent/20 text-theme-text border border-theme-accent/30'
                  : 'self-start bg-black/20 text-theme-muted border border-theme-border/20'
              }`}>
                {chat.text}
              </div>
            ))}
          </div>

          {/* Quick AI Suggestions actions */}
          {aiSuggestions.length > 0 && (
            <div className="px-3 py-1.5 border-t border-theme-border/20 bg-black/10 flex flex-col gap-1 flex-shrink-0">
              <span className="text-[9px] font-mono text-theme-muted uppercase font-bold">Recommended Calibrations:</span>
              <div className="flex flex-wrap gap-1">
                {aiSuggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      if (sug.parameters) {
                        setDocuments(prev => prev.map(d => {
                          if (d.id !== activeDocId) return d;
                          return {
                            ...d,
                            options: { ...d.options, ...sug.parameters }
                          };
                        }));
                        showToast('AI calibration preset applied.', 'success');
                      }
                    }}
                    className="text-[9px] font-sans px-1.5 py-0.5 rounded border border-theme-accent/30 bg-theme-accent/5 hover:bg-theme-accent/15 text-theme-accent truncate max-w-[200px]"
                    title={sug.message}
                  >
                    {sug.actionId.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="h-12 border-t border-theme-border/40 bg-black/10 px-2.5 flex items-center gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendChat()}
              placeholder="Ask command or theme change..."
              className="flex-1 bg-theme-bg border border-theme-border/60 text-xs text-theme-text rounded px-3 py-1.5 focus:outline-none"
            />
            <Button variant="glow" size="sm" onClick={handleSendChat}>Send</Button>
          </div>
        </div>
      )}

      {/* 4. Bottom Timeline & Keyframes Panel */}
      {panels.find(p => p.id === 'timeline')?.open && activeDoc && (
        <div className="h-44 border-t border-theme-border/60 bg-theme-panel/75 backdrop-blur-md px-6 py-4 flex flex-col gap-3 z-10 flex-shrink-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-mono font-bold tracking-widest text-theme-muted uppercase flex items-center gap-1.5">
                <Play className="w-3.5 h-3.5 text-theme-accent" />
                TIMELINE ANIMATION TRACK
              </span>

              {/* Scrubber play controls */}
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handlePlayTimeline} className="p-1">
                  {activeDoc.timeline.isPlaying ? <Pause className="w-3.5 h-3.5 text-theme-accent" /> : <Play className="w-3.5 h-3.5" />}
                </Button>
                <span className="text-xs font-mono text-theme-muted">
                  FPS: {activeDoc.timeline.fps}
                </span>
              </div>
            </div>

            {/* Particle generator control panel */}
            <div className="flex items-center gap-3">
              <Select
                label="PARTICLE SYSTEM"
                value={activeDoc.timeline.particleType}
                onChange={(val) => {
                  setDocuments(prev => prev.map(d => {
                    if (d.id !== activeDocId) return d;
                    return {
                      ...d,
                      timeline: { ...d.timeline, particleType: val as any }
                    };
                  }));
                }}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'rain', label: 'Falling Rain' },
                  { value: 'snow', label: 'Soft Snow' },
                  { value: 'fire', label: 'Thermal Fire' },
                  { value: 'smoke', label: 'Drifting Smoke' },
                  { value: 'sparks', label: 'Sparkles Wave' },
                  { value: 'matrix-rain', label: 'Matrix Glyphs' },
                  { value: 'glitch', label: 'Grid Glitches' }
                ]}
              />

              <Select
                label="EFFECTS PRESET"
                value={activeDoc.options?.edgeDetection === 'sobel' ? 'blueprint' : 'none'}
                onChange={(val) => {
                  setDocuments(prev => prev.map(d => {
                    if (d.id !== activeDocId) return d;
                    return {
                      ...d,
                      options: {
                        ...d.options,
                        edgeDetection: val === 'blueprint' ? 'sobel' : 'none'
                      }
                    };
                  }));
                }}
                options={[
                  { value: 'none', label: 'No Screen filter' },
                  { value: 'blueprint', label: 'Engine blueprint' }
                ]}
              />
            </div>
          </div>

          {/* Timeline track timeline slots */}
          <div className="flex-1 flex gap-2 overflow-x-auto items-center py-2 border border-theme-border/20 rounded bg-black/10 px-3">
            {activeDoc.timeline.frames.map((frame, idx) => {
              const isActive = activeDoc.timeline.activeFrameIdx === idx;
              return (
                <button
                  key={frame.id}
                  onClick={() => {
                    setDocuments(prev => prev.map(d => {
                      if (d.id !== activeDocId) return d;
                      return {
                        ...d,
                        timeline: {
                          ...d.timeline,
                          activeFrameIdx: idx,
                          isPlaying: false
                        }
                      };
                    }));
                  }}
                  className={`w-12 h-12 rounded border flex flex-col justify-center items-center text-[10px] font-mono flex-shrink-0 transition-all ${
                    isActive
                      ? 'border-theme-accent bg-theme-accent/20 text-theme-accent font-bold shadow-neon'
                      : 'border-theme-border/40 bg-theme-bg/60 text-theme-muted hover:border-theme-border'
                  }`}
                >
                  <span className="text-[8px] opacity-60">FRM</span>
                  <span>{idx + 1}</span>
                </button>
              );
            })}
            
            <button
              onClick={() => {
                setDocuments(prev => prev.map(d => {
                  if (d.id !== activeDocId) return d;
                  const newFrame: AnimFrame = {
                    id: 'frm_' + Math.random().toString(36).substring(2, 9),
                    layers: createBlankLayers(d.width, d.height)
                  };
                  return {
                    ...d,
                    timeline: {
                      ...d.timeline,
                      frames: [...d.timeline.frames, newFrame],
                      activeFrameIdx: d.timeline.frames.length
                    }
                  };
                }));
              }}
              className="w-12 h-12 rounded border-2 border-dashed border-theme-border/50 hover:border-theme-accent/50 flex flex-col justify-center items-center text-theme-muted flex-shrink-0 hover:text-theme-text bg-transparent"
              title="Add frame"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Embedded hidden video for video/webcam processing */}
      <video
        ref={videoRef}
        className="hidden"
        loop
        muted
        playsInline
        crossOrigin="anonymous"
      />

    </div>
  );
};
