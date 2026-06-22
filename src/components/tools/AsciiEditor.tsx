import React, { useState, useRef } from 'react';
import { 
  Brush, PaintBucket, Eraser, Square as SquareIcon,
  Undo2, Redo2, ZoomIn, ZoomOut, Grid, Type, Download, Save
} from 'lucide-react';
import { Button, useToast } from '../shared/Widgets';
import { saveProject } from '../../utils/history';
import type { AsciiProject } from '../../utils/history';

export const AsciiEditor: React.FC = () => {
  const COLS = 80;
  const ROWS = 40;
  
  // Grid states
  const [grid, setGrid] = useState<string[][]>(() => Array(ROWS).fill(null).map(() => Array(COLS).fill(' ')));
  const [colorGrid, setColorGrid] = useState<{ r: number; g: number; b: number }[][]>(() => 
    Array(ROWS).fill(null).map(() => Array(COLS).fill({ r: 56, g: 189, b: 248 })) // Jarvis cyan
  );

  // Tools configuration
  const [activeTool, setActiveTool] = useState<'brush' | 'eraser' | 'fill' | 'line' | 'rect' | 'text'>('brush');
  const [selectedChar, setSelectedChar] = useState('#');
  const [brushColor, setBrushColor] = useState('#38bdf8'); // hex code
  const [showGridLines, setShowGridLines] = useState(true);
  const [editorZoom, setEditorZoom] = useState(100);
  
  // Shape drawing states
  const [dragStart, setDragStart] = useState<{ r: number; c: number } | null>(null);
  const [hoverPos, setHoverPos] = useState<{ r: number; c: number } | null>(null);

  // Undo/Redo lists
  const [undoStack, setUndoStack] = useState<{ grid: string[][]; colors: { r: number; g: number; b: number }[][] }[]>([]);
  const [redoStack, setRedoStack] = useState<{ grid: string[][]; colors: { r: number; g: number; b: number }[][] }[]>([]);

  const containerRef = useRef<HTMLDivElement>(null);
  const { showToast } = useToast();

  const colorsPalette = [
    '#38bdf8', '#39ff14', '#ffb000', '#f43f5e', '#ec4899', 
    '#a855f7', '#e2e8f0', '#000000', '#ffffff', '#eab308'
  ];

  // Hex to RGB parser
  const hexToRgb = (hex: string) => {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  };

  // Push to history
  const pushState = () => {
    setUndoStack(prev => [...prev, {
      grid: grid.map(r => [...r]),
      colors: colorGrid.map(r => r.map(c => ({ ...c })))
    }]);
    setRedoStack([]); // clear redo
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const prev = undoStack[undoStack.length - 1];
    setUndoStack(prevStack => prevStack.slice(0, -1));
    setRedoStack(prevStack => [...prevStack, {
      grid: grid.map(r => [...r]),
      colors: colorGrid.map(r => r.map(c => ({ ...c })))
    }]);

    setGrid(prev.grid);
    setColorGrid(prev.colors);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setRedoStack(prevStack => prevStack.slice(0, -1));
    setUndoStack(prevStack => [...prevStack, {
      grid: grid.map(r => [...r]),
      colors: colorGrid.map(r => r.map(c => ({ ...c })))
    }]);

    setGrid(next.grid);
    setColorGrid(next.colors);
  };

  // Standard Mouse drawing events
  const handleCellMouseDown = (r: number, c: number) => {
    if (activeTool === 'brush' || activeTool === 'eraser') {
      pushState();
      drawCell(r, c);
    } else if (activeTool === 'fill') {
      pushState();
      floodFill(r, c);
    } else if (activeTool === 'line' || activeTool === 'rect') {
      setDragStart({ r, c });
      setHoverPos({ r, c });
    } else if (activeTool === 'text') {
      pushState();
      const text = prompt('Enter text to stamp on grid:');
      if (text) {
        stampText(r, c, text);
      }
    }
  };

  const handleCellMouseEnter = (r: number, c: number, e: React.MouseEvent) => {
    if (e.buttons === 1) { // Left mouse button clicked
      if (activeTool === 'brush' || activeTool === 'eraser') {
        drawCell(r, c);
      } else if (dragStart) {
        setHoverPos({ r, c });
      }
    }
  };

  const handleCellMouseUp = () => {
    if (dragStart && hoverPos) {
      pushState();
      applyShapeDrawing();
      setDragStart(null);
      setHoverPos(null);
    }
  };

  const drawCell = (r: number, c: number) => {
    const char = activeTool === 'eraser' ? ' ' : selectedChar;
    const rgb = hexToRgb(brushColor);
    
    setGrid(prev => {
      const copy = prev.map(row => [...row]);
      copy[r][c] = char;
      return copy;
    });

    setColorGrid(prev => {
      const copy = prev.map(row => row.map(col => ({ ...col })));
      copy[r][c] = rgb;
      return copy;
    });
  };

  // Stamp inline text
  const stampText = (r: number, c: number, text: string) => {
    const rgb = hexToRgb(brushColor);
    setGrid(prev => {
      const copy = prev.map(row => [...row]);
      for (let i = 0; i < text.length; i++) {
        if (c + i < COLS) {
          copy[r][c + i] = text[i];
        }
      }
      return copy;
    });

    setColorGrid(prev => {
      const copy = prev.map(row => row.map(col => ({ ...col })));
      for (let i = 0; i < text.length; i++) {
        if (c + i < COLS) {
          copy[r][c + i] = rgb;
        }
      }
      return copy;
    });
  };

  // Flood fill algorithm
  const floodFill = (startRow: number, startCol: number) => {
    const targetChar = grid[startRow][startCol];
    const fillChar = selectedChar;
    const fillRgb = hexToRgb(brushColor);

    if (targetChar === fillChar) return;

    const gridCopy = grid.map(row => [...row]);
    const colorCopy = colorGrid.map(row => row.map(col => ({ ...col })));

    const queue: [number, number][] = [[startRow, startCol]];

    while (queue.length > 0) {
      const [r, c] = queue.shift()!;

      if (r < 0 || r >= ROWS || c < 0 || c >= COLS) continue;
      if (gridCopy[r][c] !== targetChar) continue;

      gridCopy[r][c] = fillChar;
      colorCopy[r][c] = fillRgb;

      queue.push([r + 1, c]);
      queue.push([r - 1, c]);
      queue.push([r, c + 1]);
      queue.push([r, c - 1]);
    }

    setGrid(gridCopy);
    setColorGrid(colorCopy);
  };

  // Shapes builder
  const applyShapeDrawing = () => {
    if (!dragStart || !hoverPos) return;
    const rgb = hexToRgb(brushColor);

    setGrid(prevGrid => {
      const gCopy = prevGrid.map(row => [...row]);
      setColorGrid(prevCol => {
        const cCopy = prevCol.map(row => row.map(col => ({ ...col })));
        
        if (activeTool === 'line') {
          // Bresenham's Line Algorithm
          let x0 = dragStart.c;
          let y0 = dragStart.r;
          const x1 = hoverPos.c;
          const y1 = hoverPos.r;
          
          const dx = Math.abs(x1 - x0);
          const dy = Math.abs(y1 - y0);
          const sx = x0 < x1 ? 1 : -1;
          const sy = y0 < y1 ? 1 : -1;
          let err = dx - dy;

          while (true) {
            if (y0 >= 0 && y0 < ROWS && x0 >= 0 && x0 < COLS) {
              gCopy[y0][x0] = selectedChar;
              cCopy[y0][x0] = rgb;
            }
            if (x0 === x1 && y0 === y1) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
              err -= dy;
              x0 += sx;
            }
            if (e2 < dx) {
              err += dx;
              y0 += sy;
            }
          }
        } else if (activeTool === 'rect') {
          const r0 = Math.min(dragStart.r, hoverPos.r);
          const r1 = Math.max(dragStart.r, hoverPos.r);
          const c0 = Math.min(dragStart.c, hoverPos.c);
          const c1 = Math.max(dragStart.c, hoverPos.c);

          for (let r = r0; r <= r1; r++) {
            for (let c = c0; c <= c1; c++) {
              if (r === r0 || r === r1 || c === c0 || c === c1) {
                gCopy[r][c] = selectedChar;
                cCopy[r][c] = rgb;
              }
            }
          }
        }

        return cCopy;
      });
      return gCopy;
    });
  };

  const handleSaveToLocalStorage = () => {
    const proj: AsciiProject = {
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      name: `ASCII Art drawing`,
      type: 'editor',
      lastModified: Date.now(),
      options: { width: COLS, height: ROWS },
      data: { grid, colors: colorGrid }
    };
    saveProject(proj);
    showToast('Saved to recent projects dashboard!', 'success');
  };

  const handleExportText = () => {
    const text = grid.map(row => row.join('')).join('\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ascii_editor_art.txt';
    a.click();
    showToast('Downloaded text canvas!', 'success');
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
      
      {/* Settings Side Panel */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-theme-border/60 bg-theme-panel/40 backdrop-blur-md flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-theme-border/40 flex items-center justify-between bg-black/10">
          <span className="text-xs font-mono font-bold tracking-widest text-theme-muted uppercase flex items-center gap-1.5">
            <Brush className="w-4 h-4 text-theme-accent" />
            CANVAS CREATIVE TOOLS
          </span>
        </div>

        <div className="p-4 flex flex-col gap-5 overflow-y-auto flex-1">
          {/* Tool selectors */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-sans font-medium text-theme-muted">ACTIVE TOOL</span>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'brush', label: 'Brush', icon: <Brush className="w-4 h-4" /> },
                { id: 'eraser', label: 'Eraser', icon: <Eraser className="w-4 h-4" /> },
                { id: 'fill', label: 'Bucket', icon: <PaintBucket className="w-4 h-4" /> },
                { id: 'line', label: 'Line', icon: <span className="text-sm font-semibold font-mono">/</span> },
                { id: 'rect', label: 'Box', icon: <SquareIcon className="w-4 h-4" /> },
                { id: 'text', label: 'Text', icon: <Type className="w-4 h-4" /> }
              ].map((tool) => (
                <button
                  key={tool.id}
                  onClick={() => setActiveTool(tool.id as any)}
                  className={`flex flex-col items-center gap-1 py-2 rounded-lg border text-xs font-semibold font-sans ${
                    activeTool === tool.id 
                      ? 'border-theme-accent bg-theme-accent/15 text-theme-accent shadow-neon' 
                      : 'border-theme-border bg-theme-panel text-theme-muted hover:text-theme-text'
                  }`}
                >
                  {tool.icon}
                  <span>{tool.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Characters palette */}
          <div className="border-t border-theme-border/20 pt-4 flex flex-col gap-2">
            <span className="text-xs font-sans font-medium text-theme-muted">BRUSH CHARACTER</span>
            <div className="flex flex-wrap gap-1.5">
              {['#', '@', '%', '*', '+', '=', ':', '-', '.', '░', '▒', '▓', '█'].map((char) => (
                <button
                  key={char}
                  onClick={() => setSelectedChar(char)}
                  className={`w-8 h-8 rounded border flex items-center justify-center font-mono text-sm ${
                    selectedChar === char 
                      ? 'border-theme-accent bg-theme-accent/20 text-theme-accent shadow-neon' 
                      : 'border-theme-border bg-theme-panel/60 text-theme-text hover:border-theme-muted'
                  }`}
                >
                  {char}
                </button>
              ))}
            </div>
            
            <input
              type="text"
              maxLength={1}
              value={selectedChar}
              onChange={(e) => setSelectedChar(e.target.value || '#')}
              placeholder="Custom"
              className="mt-1 px-3 py-1.5 bg-theme-bg border border-theme-border text-center rounded text-sm text-theme-text font-mono focus:outline-none w-16"
            />
          </div>

          {/* Color palette */}
          <div className="border-t border-theme-border/20 pt-4 flex flex-col gap-2">
            <span className="text-xs font-sans font-medium text-theme-muted">PALETTE CHROMA</span>
            <div className="grid grid-cols-5 gap-2">
              {colorsPalette.map((col) => (
                <button
                  key={col}
                  onClick={() => setBrushColor(col)}
                  className={`h-7 rounded-full border-2 transition-transform hover:scale-110 ${
                    brushColor === col ? 'border-theme-text scale-105' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: col }}
                />
              ))}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-8 h-8 rounded cursor-pointer border border-theme-border"
              />
              <span className="text-xs font-mono text-theme-muted uppercase">{brushColor}</span>
            </div>
          </div>

          {/* Clear board */}
          <div className="border-t border-theme-border/20 pt-4 flex gap-2">
            <Button
              variant="danger"
              size="sm"
              className="w-full"
              onClick={() => {
                if (confirm('Clear entire canvas?')) {
                  pushState();
                  setGrid(Array(ROWS).fill(null).map(() => Array(COLS).fill(' ')));
                }
              }}
            >
              Clear Canvas
            </Button>
          </div>
        </div>
      </div>

      {/* Main Preview Board */}
      <div className="flex-1 flex flex-col h-full bg-black/40 overflow-hidden relative">
        {/* Toolbar Header */}
        <div className="h-12 border-b border-theme-border/40 bg-theme-panel/60 backdrop-blur-sm px-4 flex items-center justify-between z-10">
          {/* History control */}
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={handleUndo} disabled={undoStack.length === 0} className="p-1.5">
              <Undo2 className="w-3.5 h-3.5" />
            </Button>
            <Button variant="secondary" size="sm" onClick={handleRedo} disabled={redoStack.length === 0} className="p-1.5">
              <Redo2 className="w-3.5 h-3.5" />
            </Button>
            
            <div className="w-px h-4 bg-theme-border/60 mx-1.5" />

            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setShowGridLines(prev => !prev)}
              className="p-1.5"
              title="Toggle Grid Lines"
            >
              <Grid className={`w-3.5 h-3.5 ${showGridLines ? 'text-theme-accent' : ''}`} />
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={() => setEditorZoom(prev => Math.max(50, prev - 10))} className="p-1.5">
              <ZoomOut className="w-3.5 h-3.5" />
            </Button>
            <span className="text-xs font-mono text-theme-muted">{editorZoom}%</span>
            <Button variant="secondary" size="sm" onClick={() => setEditorZoom(prev => Math.min(200, prev + 10))} className="p-1.5">
              <ZoomIn className="w-3.5 h-3.5" />
            </Button>

            <div className="w-px h-4 bg-theme-border/60 mx-1.5" />

            <Button variant="secondary" size="sm" onClick={handleSaveToLocalStorage}>
              <Save className="w-3.5 h-3.5 text-theme-accent" />
              <span>Save</span>
            </Button>
            <Button variant="glow" size="sm" onClick={handleExportText}>
              <Download className="w-3.5 h-3.5" />
              <span>Export</span>
            </Button>
          </div>
        </div>

        {/* Drawing Screen viewports */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 relative">
          <div 
            ref={containerRef}
            style={{ transform: `scale(${editorZoom / 100})`, transition: 'transform 0.15s ease' }}
            className="origin-center select-none"
          >
            {/* Grid grid cells container */}
            <div 
              className="grid border border-theme-border/60 bg-[#080e1a] rounded shadow-2xl relative"
              style={{
                gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
                width: `${COLS * 9}px`,
                height: `${ROWS * 12}px`
              }}
            >
              {grid.map((row, r) => 
                row.map((char, c) => {
                  const color = colorGrid[r][c];
                  const isHovered = hoverPos && hoverPos.r === r && hoverPos.c === c;
                  
                  return (
                    <div
                      key={`${r}-${c}`}
                      onMouseDown={() => handleCellMouseDown(r, c)}
                      onMouseEnter={(e) => handleCellMouseEnter(r, c, e)}
                      onMouseUp={() => handleCellMouseUp()}
                      className={`font-mono text-[9px] flex items-center justify-center cursor-crosshair leading-none border-collapse transition-all duration-100 ${
                        showGridLines ? 'border-[0.25px] border-theme-border/20' : 'border-none'
                      } ${isHovered ? 'bg-theme-accent/25' : ''}`}
                      style={{
                        color: `rgb(${color.r}, ${color.g}, ${color.b})`,
                        width: '9px',
                        height: '12px'
                      }}
                    >
                      {char}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
