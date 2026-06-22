import React, { useState, useEffect, useRef } from 'react';
import { 
  Clock, Calendar as CalendarIcon, CloudRain, Sparkles, Tv
} from 'lucide-react';
import { generateTextBanner } from '../../utils/figletFonts';

export const FunTools: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'matrix' | 'clock' | 'calendar' | 'weather'>('matrix');
  const [timeStr, setTimeStr] = useState('');
  
  // Matrix rain canvas
  const matrixCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Time updater
  useEffect(() => {
    const updateTime = () => {
      const date = new Date();
      const hours = date.getHours().toString().padStart(2, '0');
      const mins = date.getMinutes().toString().padStart(2, '0');
      const secs = date.getSeconds().toString().padStart(2, '0');
      
      // Render using figlet Slant font
      const banner = generateTextBanner(`${hours}:${mins}:${secs}`, 'Slant', 1);
      setTimeStr(banner);
    };

    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  // Matrix Rain Animator
  useEffect(() => {
    if (activeTab !== 'matrix') return;

    const canvas = matrixCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = 600;
    canvas.height = 360;

    const katakana = 'ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const alphabet = katakana.split('');

    const fontSize = 10;
    const columns = canvas.width / fontSize;

    const rainDrops: number[] = [];
    for (let x = 0; x < columns; x++) {
      rainDrops[x] = Math.random() * -100;
    }

    // Determine colors based on active theme
    const activeTheme = document.documentElement.getAttribute('data-theme') || 'jarvis';
    let textCol = '#00ff00'; // default green
    if (activeTheme === 'amber-crt') textCol = '#ffb000';
    else if (activeTheme === 'cyberpunk') textCol = '#ec4899';
    else if (activeTheme === 'jarvis') textCol = '#00f0ff';
    else if (activeTheme === 'monochrome-white') textCol = '#555555';
    else if (activeTheme === 'light-mode') textCol = '#2563eb';

    const draw = () => {
      ctx.fillStyle = 'rgba(8, 14, 26, 0.08)'; // JARVIS bg fade
      if (activeTheme === 'green-terminal' || activeTheme === 'oled-dark') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.font = fontSize + 'px "JetBrains Mono", monospace';

      for (let i = 0; i < rainDrops.length; i++) {
        const text = alphabet[Math.floor(Math.random() * alphabet.length)];
        
        // Highlight top character in white
        if (Math.random() > 0.98) {
          ctx.fillStyle = '#ffffff';
        } else {
          ctx.fillStyle = textCol;
        }

        ctx.fillText(text, i * fontSize, rainDrops[i] * fontSize);

        if (rainDrops[i] * fontSize > canvas.height && Math.random() > 0.975) {
          rainDrops[i] = 0;
        }
        rainDrops[i]++;
      }
    };

    const interval = setInterval(draw, 33); // ~30fps
    return () => clearInterval(interval);
  }, [activeTab]);

  // Generate ASCII calendar grid
  const getCalendarAscii = () => {
    const date = new Date();
    const year = date.getFullYear();
    const monthIdx = date.getMonth();
    
    const monthNames = [
      "JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE",
      "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"
    ];

    const firstDay = new Date(year, monthIdx, 1).getDay();
    const numDays = new Date(year, monthIdx + 1, 0).getDate();

    let cal = `+-------------------------------------+
|            ${monthNames[monthIdx]} ${year}             |
+-------------------------------------+
|  SUN  MON  TUE  WED  THU  FRI  SAT  |
+-------------------------------------+\n|`;

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      cal += '     ';
    }

    // Days numbers
    for (let day = 1; day <= numDays; day++) {
      const cell = day.toString().padStart(3, ' ') + '  ';
      cal += cell;

      if ((firstDay + day) % 7 === 0) {
        cal += '|\n|';
      }
    }

    // Empty cells at the end of last week
    const lastWeekCells = (firstDay + numDays) % 7;
    if (lastWeekCells !== 0) {
      for (let i = lastWeekCells; i < 7; i++) {
        cal += '     ';
      }
    }
    
    // Clean up trailing slash
    cal = cal.endsWith('\n|') ? cal.substring(0, cal.length - 2) : cal + '|';
    cal += '\n+-------------------------------------+';
    
    return cal;
  };

  const weatherAscii = `
     _  _
   (   )  )
  (  (    ) )     SYSTEM ENVIRONMENT STATUS:
 (__________ )    --------------------------
  / / / / / /     * LENS HUMIDITY: 40% (STABLE)
 / / / / / /      * TEMPERATURE:   22.4°C (NOMINAL)
                  * PHOSPHOR HEAT: COOL
                  * ATMOS DENSITY: 1.013 BAR
  `;

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden">
      
      {/* Settings Side Panel */}
      <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-theme-border/60 bg-theme-panel/40 backdrop-blur-md flex flex-col flex-shrink-0">
        <div className="p-4 border-b border-theme-border/40 flex items-center justify-between bg-black/10">
          <span className="text-xs font-mono font-bold tracking-widest text-theme-muted uppercase flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-theme-accent" />
            FUN MODULES PANEL
          </span>
        </div>

        <div className="p-4 flex flex-col gap-2.5">
          {[
            { id: 'matrix', label: 'Matrix Rain Screen', icon: <Tv className="w-4 h-4" /> },
            { id: 'clock', label: 'Holographic Clock', icon: <Clock className="w-4 h-4" /> },
            { id: 'calendar', label: 'Calendar Grid', icon: <CalendarIcon className="w-4 h-4" /> },
            { id: 'weather', label: 'Weather Telemetry', icon: <CloudRain className="w-4 h-4" /> }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-sm font-sans font-medium transition-all text-left ${
                activeTab === tab.id 
                  ? 'border-theme-accent bg-theme-accent/15 text-theme-accent shadow-neon' 
                  : 'border-theme-border bg-theme-panel text-theme-muted hover:text-theme-text'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview Output Frame */}
      <div className="flex-1 flex flex-col h-full bg-black/40 overflow-hidden relative">
        <div className="h-12 border-b border-theme-border/40 bg-theme-panel/60 backdrop-blur-sm px-4 flex items-center justify-between z-10">
          <span className="text-xs font-mono text-theme-muted uppercase tracking-widest">
            {activeTab} CONSOLE LINK
          </span>
        </div>

        <div className="flex-1 overflow-auto flex items-center justify-center p-6 bg-theme-bg/25">
          {activeTab === 'matrix' && (
            <div className="glass border border-theme-border rounded-2xl overflow-hidden shadow-2xl relative">
              <canvas ref={matrixCanvasRef} className="block shadow-[0_0_50px_rgba(0,0,0,0.8)]" />
            </div>
          )}

          {activeTab === 'clock' && (
            <pre className="ascii-font text-theme-accent text-sm md:text-base leading-none p-6 rounded-xl border border-theme-border bg-theme-panel/40 backdrop-blur-md overflow-auto max-w-full shadow-neon font-bold">
              {timeStr}
            </pre>
          )}

          {activeTab === 'calendar' && (
            <pre className="ascii-font text-theme-accent text-sm md:text-base leading-relaxed p-6 rounded-xl border border-theme-border bg-theme-panel/40 backdrop-blur-md overflow-auto max-w-full shadow-neon font-bold">
              {getCalendarAscii()}
            </pre>
          )}

          {activeTab === 'weather' && (
            <pre className="ascii-font text-theme-accent text-sm md:text-base leading-relaxed p-6 rounded-xl border border-theme-border bg-theme-panel/40 backdrop-blur-md overflow-auto max-w-full shadow-neon font-bold">
              {weatherAscii}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};
