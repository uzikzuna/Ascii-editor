import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, Pause, Music, Radio
} from 'lucide-react';
import { Button, Select, useToast } from '../shared/Widgets';

export const AudioVisualizer: React.FC = () => {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [visType, setVisType] = useState<'bars' | 'wave' | 'circle'>('bars');
  const columns = 72;
  const rows = 28;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Web Audio Nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const requestRef = useRef<number | null>(null);
  
  // Output canvas
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { showToast } = useToast();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
      if (audioContextRef.current) audioContextRef.current.close();
    };
  }, []);

  // Setup analyzer loops when playing
  useEffect(() => {
    if (isPlaying && audioUrl) {
      // Initialize Audio Context on first play (user interaction)
      if (!audioContextRef.current) {
        setupAudioContext();
      }
      
      const renderLoop = () => {
        analyzeAndDraw();
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
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPlaying, audioUrl, visType, columns, rows]);

  function setupAudioContext() {
    const audio = audioRef.current;
    if (!audio) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256; // 128 frequency bins
      
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyser);
      analyser.connect(ctx.destination);

      audioContextRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
    } catch (err) {
      console.error('AudioContext configuration error:', err);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsPlaying(false);
    if (audioUrl) URL.revokeObjectURL(audioUrl);

    // Reset Context to bind to new element if needed
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
      analyserRef.current = null;
      sourceRef.current = null;
    }

    const url = URL.createObjectURL(file);
    setAudioUrl(url);
    showToast('Loaded audio track successfully!', 'success');
  };

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      // Resume AudioContext if suspended
      if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
        audioContextRef.current.resume();
      }
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch(() => {
        showToast('Playback blocked. Ensure user interacted.', 'error');
      });
    }
  };

  function analyzeAndDraw() {
    const analyser = analyserRef.current;
    const canvas = canvasRef.current;
    if (!analyser || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    if (visType === 'wave') {
      analyser.getByteTimeDomainData(dataArray);
    } else {
      analyser.getByteFrequencyData(dataArray);
    }

    const charWidth = 7;
    const charHeight = 10;
    canvas.width = columns * charWidth;
    canvas.height = rows * charHeight;

    const activeTheme = document.documentElement.getAttribute('data-theme') || 'jarvis';
    let bg = '#080e1a';
    let activeColor = '#38bdf8';
    let rgbGlow = '56, 189, 248';
    
    if (activeTheme === 'green-terminal' || activeTheme === 'oled-dark') bg = '#000000';
    else if (activeTheme === 'amber-crt') bg = '#0c0600';
    else if (activeTheme === 'cyberpunk') bg = '#120a18';
    else if (activeTheme === 'monochrome-white') bg = '#ffffff';
    else if (activeTheme === 'light-mode') bg = '#f0f4f8';

    if (activeTheme === 'green-terminal') { activeColor = '#39ff14'; rgbGlow = '57, 255, 20'; }
    else if (activeTheme === 'amber-crt') { activeColor = '#ffb000'; rgbGlow = '255, 176, 0'; }
    else if (activeTheme === 'cyberpunk') { activeColor = '#ec4899'; rgbGlow = '236, 72, 153'; }
    else if (activeTheme === 'monochrome-white') { activeColor = '#000000'; rgbGlow = '0,0,0'; }
    else if (activeTheme === 'light-mode') { activeColor = '#2563eb'; rgbGlow = '37, 99, 235'; }

    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.font = '500 10px "JetBrains Mono", monospace';
    ctx.textBaseline = 'top';


    if (visType === 'bars') {
      // Frequency equalizer columns
      const colStep = bufferLength / columns;
      
      for (let c = 0; c < columns; c++) {
        // Average frequency bins in range
        let sum = 0;
        const startBin = Math.floor(c * colStep);
        const endBin = Math.min(bufferLength, Math.floor((c + 1) * colStep));
        const count = endBin - startBin || 1;
        for (let b = startBin; b < endBin; b++) {
          sum += dataArray[b];
        }
        const val = sum / count; // 0 to 255
        
        // Convert to row height
        const activeRows = Math.round((val / 255) * rows);
        
        for (let r = 0; r < rows; r++) {
          const rowFromBottom = rows - 1 - r;
          
          if (rowFromBottom < activeRows) {
            ctx.fillStyle = activeColor;
            // Draw a solid block
            ctx.fillText('█', c * charWidth, r * charHeight);
          }
        }
      }
    } else if (visType === 'wave') {
      // Waveform oscilloscope line
      for (let c = 0; c < columns; c++) {
        const bin = Math.floor((c / columns) * bufferLength);
        const val = dataArray[bin]; // 0 to 255 (128 is center)
        
        const rowIdx = Math.round((val / 255) * rows);
        
        if (rowIdx >= 0 && rowIdx < rows) {
          ctx.fillStyle = activeColor;
          ctx.fillText('█', c * charWidth, rowIdx * charHeight);
        }
      }
    } else if (visType === 'circle') {
      // Radar grid circular visualizer mapping
      const centerX = Math.floor(columns / 2);
      const centerY = Math.floor(rows / 2);
      const maxRadius = Math.min(centerX, centerY) - 2;

      // Draw static circular rings
      ctx.fillStyle = `rgba(${rgbGlow}, 0.2)`;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < columns; c++) {
          const dx = (c - centerX);
          const dy = (r - centerY) * 1.8; // compensate aspect ratio
          const dist = Math.sqrt(dx*dx + dy*dy);
          
          if (Math.abs(dist - maxRadius * 0.7) < 0.5) {
            ctx.fillText('.', c * charWidth, r * charHeight);
          }
          if (Math.abs(dist - maxRadius * 0.4) < 0.5) {
            ctx.fillText('.', c * charWidth, r * charHeight);
          }
        }
      }

      // Draw reactive frequencies as dots extending outward in angles
      const numRays = bufferLength;
      ctx.fillStyle = activeColor;

      for (let i = 0; i < numRays; i++) {
        const val = dataArray[i];
        if (val < 10) continue;

        const magnitude = (val / 255) * maxRadius;
        const angle = (i / numRays) * Math.PI * 2;
        const targetX = Math.round(centerX + magnitude * Math.cos(angle));
        const targetY = Math.round(centerY + magnitude * Math.sin(angle) / 1.8);

        if (targetX >= 0 && targetX < columns && targetY >= 0 && targetY < rows) {
          ctx.fillText('*', targetX * charWidth, targetY * charHeight);
        }
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
      
      {/* Hidden Audio element */}
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}

      {/* Settings Side Panel */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-theme-border/60 bg-theme-panel/40 backdrop-blur-md flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-theme-border/40 flex items-center justify-between bg-black/10">
          <span className="text-xs font-mono font-bold tracking-widest text-theme-muted uppercase flex items-center gap-1.5">
            <Radio className="w-4 h-4 text-theme-accent" />
            ACOUSTIC ANALYZER
          </span>
        </div>

        <div className="p-4 flex flex-col gap-5">
          {/* File select */}
          <div className="glass border border-theme-border/40 p-3 rounded-lg flex flex-col gap-2 bg-theme-panel/20">
            <input
              id="audio-upload-input"
              ref={fileInputRef}
              type="file"
              accept="audio/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <label htmlFor="audio-upload-input" className="cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded bg-theme-accent/15 border border-theme-accent/30 flex items-center justify-center text-theme-accent flex-shrink-0">
                  <Music className="w-5 h-5 animate-pulse" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold text-theme-text truncate font-sans">
                    {audioUrl ? 'ACTIVE SONG CACHED' : 'NO AUDIO LOADED'}
                  </p>
                  <p className="text-[10px] text-theme-accent hover:text-theme-text underline mt-0.5">
                    Click to load track
                  </p>
                </div>
              </div>
            </label>
          </div>

          {/* Visualization type */}
          <Select
            label="VISUALIZATION DESIGN"
            value={visType}
            onChange={(val) => setVisType(val as any)}
            options={[
              { value: 'bars', label: 'Frequency Equalizer' },
              { value: 'wave', label: 'Waveform Oscilloscope' },
              { value: 'circle', label: 'Circular Radar Spectrogram' }
            ]}
          />
        </div>
      </div>

      {/* Main Workspace (Preview Area) */}
      <div className="flex-1 flex flex-col h-full bg-black/40 overflow-hidden relative">
        <div className="h-12 border-b border-theme-border/40 bg-theme-panel/60 backdrop-blur-sm px-4 flex items-center justify-between z-10">
          <span className="text-xs font-mono text-theme-muted">ACOUSTIC ASCII RADAR PREVIEW</span>
        </div>

        {/* Output Screen */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-6 relative bg-theme-bg/25">
          {audioUrl ? (
            <div className="origin-center shadow-2xl relative">
              <canvas ref={canvasRef} className="max-w-none shadow-[0_0_50px_rgba(0,0,0,0.8)] rounded-xl" />
            </div>
          ) : (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="glass border border-theme-border/40 rounded-xl p-12 text-center cursor-pointer flex flex-col items-center gap-4 max-w-md hover:bg-white/5 hover:border-theme-accent/30 transition-all duration-300"
            >
              <div className="w-16 h-16 rounded-full bg-theme-accent/15 border border-theme-accent/30 shadow-neon flex items-center justify-center text-theme-accent">
                <Music className="w-7 h-7" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-theme-text">Upload Music File</h3>
                <p className="text-xs text-theme-muted mt-2">
                  Select an MP3, WAV, or audio track from your system. Playback streams frequencies into reactive block designs.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Timeline Control Footer Bar */}
        {audioUrl && (
          <div className="h-16 border-t border-theme-border/40 bg-theme-panel/75 backdrop-blur-md px-6 flex items-center justify-center z-10 flex-shrink-0">
            <Button variant="primary" size="sm" onClick={togglePlay} className="px-6 py-2.5 shadow-neon">
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isPlaying ? 'PAUSE MUSIC' : 'PLAY TRACK'}</span>
            </Button>
          </div>
        )}

      </div>
    </div>
  );
};
