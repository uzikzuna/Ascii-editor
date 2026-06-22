import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Plus, Trash2, Copy, Film,
  ChevronLeft, ChevronRight, Brush, Eraser, ZoomIn, ZoomOut, Save
} from 'lucide-react';
import { Button, Slider, Switch, useToast } from '../shared/Widgets';
import { saveProject } from '../../utils/history';
import type { AsciiProject } from '../../utils/history';

interface AnimFrame {
  chars: string[][];
  colors: { r: number; g: number; b: number }[][];
}

export const AnimationStudio: React.FC = () => {
  const COLS = 60;
  const ROWS = 30;

  // Timeline state
  const [frames, setFrames] = useState<AnimFrame[]>(() => [
    {
      chars: Array(ROWS).fill(null).map(() => Array(COLS).fill(' ')),
      colors: Array(ROWS).fill(null).map(() => Array(COLS).fill({ r: 56, g: 189, b: 248 }))
    }
  ]);
  const [activeFrameIdx, setActiveFrameIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [fps, setFps] = useState(6);
  const [onionSkin, setOnionSkin] = useState(true);
  const [activeTool, setActiveTool] = useState<'brush' | 'eraser'>('brush');
  const [brushChar, setBrushChar] = useState('#');
  const [brushColor, setBrushColor] = useState('#38bdf8');
  const [studioZoom, setStudioZoom] = useState(100);

  const timerRef = useRef<number | null>(null);
  const { showToast } = useToast();

  const colors = [
    '#38bdf8', '#39ff14', '#ffb000', '#f43f5e', '#ec4899', 
    '#a855f7', '#ffffff'
  ];

  const hexToRgb = (hex: string) => {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  };

  // Play animation loop
  useEffect(() => {
    if (isPlaying) {
      const delay = 1000 / fps;
      timerRef.current = window.setTimeout(() => {
        setActiveFrameIdx(prev => (prev + 1) % frames.length);
      }, delay);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, activeFrameIdx, frames.length, fps]);

  const handleCellDraw = (r: number, c: number, buttons: number) => {
    if (buttons !== 1 || isPlaying) return;

    const char = activeTool === 'eraser' ? ' ' : brushChar;
    const rgb = hexToRgb(brushColor);

    setFrames(prev => {
      const updated = prev.map((f, idx) => {
        if (idx !== activeFrameIdx) return f;
        
        const charsCopy = f.chars.map(row => [...row]);
        const colorsCopy = f.colors.map(row => row.map(col => ({ ...col })));

        charsCopy[r][c] = char;
        colorsCopy[r][c] = rgb;

        return { chars: charsCopy, colors: colorsCopy };
      });
      return updated;
    });
  };

  const handleAddFrame = () => {
    setIsPlaying(false);
    const newFrame: AnimFrame = {
      chars: Array(ROWS).fill(null).map(() => Array(COLS).fill(' ')),
      colors: Array(ROWS).fill(null).map(() => Array(COLS).fill({ r: 56, g: 189, b: 248 }))
    };

    setFrames(prev => [...prev, newFrame]);
    setActiveFrameIdx(prev => prev + 1);
    showToast('Appended new blank frame!', 'success');
  };

  const handleDuplicateFrame = () => {
    setIsPlaying(false);
    const active = frames[activeFrameIdx];
    const duplicated: AnimFrame = {
      chars: active.chars.map(r => [...r]),
      colors: active.colors.map(r => r.map(c => ({ ...c })))
    };

    setFrames(prev => {
      const copy = [...prev];
      copy.splice(activeFrameIdx + 1, 0, duplicated);
      return copy;
    });
    setActiveFrameIdx(prev => prev + 1);
    showToast('Duplicated active frame!', 'success');
  };

  const handleDeleteFrame = () => {
    if (frames.length <= 1) {
      showToast('Cannot delete last remaining frame.', 'warning');
      return;
    }
    setIsPlaying(false);
    setFrames(prev => prev.filter((_, idx) => idx !== activeFrameIdx));
    setActiveFrameIdx(prev => Math.max(0, prev - 1));
    showToast('Removed active frame.', 'info');
  };

  const saveToHistory = () => {
    const proj: AsciiProject = {
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      name: `ASCII Animation Project`,
      type: 'animation',
      lastModified: Date.now(),
      options: { frames: frames.length, fps },
      data: { frames }
    };
    saveProject(proj);
    showToast('Animation project saved to local storage.', 'success');
  };

  const activeFrame = frames[activeFrameIdx];
  const previousFrame = activeFrameIdx > 0 ? frames[activeFrameIdx - 1] : null;

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      
      {/* Workspace Panel */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">
        
        {/* Settings Side Panel */}
        <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-theme-border/60 bg-theme-panel/40 backdrop-blur-md flex flex-col flex-shrink-0">
          <div className="p-4 border-b border-theme-border/40 flex items-center justify-between bg-black/10">
            <span className="text-xs font-mono font-bold tracking-widest text-theme-muted uppercase flex items-center gap-1.5">
              <Film className="w-4 h-4 text-theme-accent" />
              ANIMATION PANEL
            </span>
          </div>

          <div className="p-4 flex flex-col gap-5 overflow-y-auto flex-1">
            {/* Draw controls */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-sans font-medium text-theme-muted">DRAW BRUSH</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setActiveTool('brush')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-semibold font-sans ${
                    activeTool === 'brush' 
                      ? 'border-theme-accent bg-theme-accent/15 text-theme-accent' 
                      : 'border-theme-border bg-theme-panel text-theme-muted hover:text-theme-text'
                  }`}
                >
                  <Brush className="w-4 h-4" />
                  <span>Brush</span>
                </button>
                <button
                  onClick={() => setActiveTool('eraser')}
                  className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-semibold font-sans ${
                    activeTool === 'eraser' 
                      ? 'border-theme-accent bg-theme-accent/15 text-theme-accent' 
                      : 'border-theme-border bg-theme-panel text-theme-muted hover:text-theme-text'
                  }`}
                >
                  <Eraser className="w-4 h-4" />
                  <span>Eraser</span>
                </button>
              </div>
            </div>

            {/* Character palette */}
            <div className="border-t border-theme-border/20 pt-4 flex flex-col gap-2">
              <span className="text-xs font-sans font-medium text-theme-muted">CHAR ACTIVES</span>
              <div className="flex flex-wrap gap-1.5">
                {['#', '@', '%', '*', '+', '=', ':', '-', '.', '░', '▒', '▓', '█'].map((char) => (
                  <button
                    key={char}
                    onClick={() => setBrushChar(char)}
                    className={`w-7 h-7 rounded border flex items-center justify-center font-mono text-sm ${
                      brushChar === char 
                        ? 'border-theme-accent bg-theme-accent/20 text-theme-accent' 
                        : 'border-theme-border bg-theme-panel/60 text-theme-text'
                    }`}
                  >
                    {char}
                  </button>
                ))}
              </div>
            </div>

            {/* Color select */}
            <div className="border-t border-theme-border/20 pt-4 flex flex-col gap-2">
              <span className="text-xs font-sans font-medium text-theme-muted">BRUSH CHROMATIC</span>
              <div className="flex gap-2 flex-wrap">
                {colors.map((col) => (
                  <button
                    key={col}
                    onClick={() => setBrushColor(col)}
                    className={`w-7 h-7 rounded-full border-2 ${
                      brushColor === col ? 'border-theme-text' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: col }}
                  />
                ))}
              </div>
            </div>

            {/* Onion Skin controls */}
            <div className="border-t border-theme-border/20 pt-4 flex flex-col gap-3">
              <Switch label="ONION SKINNING" checked={onionSkin} onChange={setOnionSkin} />
              
              <Slider label="TIMELINE PLAYBACK (FPS)" min={1} max={18} step={1} value={fps} onChange={setFps} />
            </div>
          </div>
        </div>

        {/* Studio Editor screen viewport */}
        <div className="flex-1 flex flex-col h-full bg-black/40 overflow-hidden relative">
          
          {/* Workspace mini nav */}
          <div className="h-12 border-b border-theme-border/40 bg-theme-panel/60 backdrop-blur-sm px-4 flex items-center justify-between z-10">
            <div className="flex items-center gap-1">
              <Button variant="secondary" size="sm" onClick={() => setStudioZoom(prev => Math.max(40, prev - 10))} className="p-1.5">
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-xs font-mono text-theme-muted min-w-[32px] text-center">{studioZoom}%</span>
              <Button variant="secondary" size="sm" onClick={() => setStudioZoom(prev => Math.min(180, prev + 10))} className="p-1.5">
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
            </div>

            <Button variant="secondary" size="sm" onClick={saveToHistory}>
              <Save className="w-4 h-4 text-theme-accent" />
              <span>Save Timeline</span>
            </Button>
          </div>

          <div className="flex-1 overflow-auto flex items-center justify-center p-6">
            <div 
              style={{ transform: `scale(${studioZoom / 100})`, transition: 'transform 0.15s ease' }}
              className="origin-center select-none"
            >
              {/* Canvas draw wrapper */}
              <div 
                className="grid border border-theme-border/50 bg-[#080e1a] rounded shadow-2xl relative"
                style={{
                  gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                  width: `${COLS * 9}px`,
                  height: `${ROWS * 12}px`
                }}
              >
                {activeFrame.chars.map((row, r) => 
                  row.map((char, c) => {
                    const color = activeFrame.colors[r][c];
                    
                    // Onion skin calculations
                    const prevChar = previousFrame?.chars[r][c];
                    const prevColor = previousFrame?.colors[r][c];
                    const isDrawActive = char !== ' ';
                    const showOnion = onionSkin && !isDrawActive && prevChar && prevChar !== ' ';

                    return (
                      <div
                        key={`${r}-${c}`}
                        onMouseDown={(e) => handleCellDraw(r, c, e.buttons)}
                        onMouseEnter={(e) => handleCellDraw(r, c, e.buttons)}
                        className="font-mono text-[9px] flex items-center justify-center cursor-crosshair leading-none border-[0.25px] border-theme-border/10 select-none"
                        style={{
                          width: '9px',
                          height: '12px',
                          color: showOnion && prevColor
                            ? `rgba(${prevColor.r}, ${prevColor.g}, ${prevColor.b}, 0.25)`
                            : `rgb(${color.r}, ${color.g}, ${color.b})`,
                          backgroundColor: showOnion ? 'rgba(56, 189, 248, 0.03)' : 'transparent'
                        }}
                      >
                        {isDrawActive ? char : (showOnion ? prevChar : '')}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Animation timeline footer track */}
      <div className="h-20 border-t border-theme-border/40 bg-theme-panel/75 backdrop-blur-md px-6 flex items-center justify-between gap-6 z-10 flex-shrink-0">
        
        {/* Play controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button variant="secondary" size="sm" onClick={() => setActiveFrameIdx(prev => Math.max(0, prev - 1))} disabled={isPlaying} className="p-2">
            <ChevronLeft className="w-4 h-4" />
          </Button>

          <Button variant="primary" size="sm" onClick={() => setIsPlaying(prev => !prev)} className="px-4 py-2">
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            <span>{isPlaying ? 'PAUSE' : 'PLAY'}</span>
          </Button>

          <Button variant="secondary" size="sm" onClick={() => setActiveFrameIdx(prev => (prev + 1) % frames.length)} disabled={isPlaying} className="p-2">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Timeline keyframe list */}
        <div className="flex-1 flex items-center gap-2 overflow-x-auto py-1">
          {frames.map((_, idx) => (
            <button
              key={idx}
              onClick={() => {
                setIsPlaying(false);
                setActiveFrameIdx(idx);
              }}
              className={`w-9 h-9 rounded flex-shrink-0 border flex flex-col items-center justify-center font-mono text-[10px] transition-all ${
                activeFrameIdx === idx 
                  ? 'border-theme-accent bg-theme-accent/20 text-theme-accent font-bold shadow-neon' 
                  : 'border-theme-border bg-theme-bg/60 text-theme-muted hover:border-theme-muted'
              }`}
            >
              <span className="text-[8px] opacity-75">FRM</span>
              <span>{idx + 1}</span>
            </button>
          ))}
        </div>

        {/* Frame operational controls */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button variant="secondary" size="sm" onClick={handleAddFrame} title="Append blank frame" className="p-2">
            <Plus className="w-4 h-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={handleDuplicateFrame} title="Duplicate active frame" className="p-2">
            <Copy className="w-4 h-4" />
          </Button>
          <Button variant="danger" size="sm" onClick={handleDeleteFrame} title="Delete active frame" className="p-2">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>

      </div>
    </div>
  );
};
