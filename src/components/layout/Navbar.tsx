import React, { useState, useEffect } from 'react';
import { Menu, Terminal, Search, Palette } from 'lucide-react';

interface NavbarProps {
  onToggleSidebar: () => void;
  onOpenCommandPalette: () => void;
  activeTheme: string;
  onChangeTheme: (theme: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onToggleSidebar,
  onOpenCommandPalette,
  activeTheme,
  onChangeTheme
}) => {
  const [time, setTime] = useState(new Date());

  // Keep clock running
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const themes = [
    { value: 'jarvis', label: 'JARVIS Blue', bg: 'bg-cyan-500' },
    { value: 'green-terminal', label: 'Classic Green', bg: 'bg-emerald-500' },
    { value: 'amber-crt', label: 'Amber CRT', bg: 'bg-amber-500' },
    { value: 'cyberpunk', label: 'Cyberpunk', bg: 'bg-pink-500' },
    { value: 'monochrome-white', label: 'Mono White', bg: 'bg-slate-200 border border-slate-400' },
    { value: 'oled-dark', label: 'OLED Dark', bg: 'bg-white border border-slate-700' },
    { value: 'light-mode', label: 'Light Mode', bg: 'bg-blue-600' }
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-theme-border/60 bg-theme-panel/75 backdrop-blur-md transition-all duration-300">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        
        {/* Left Side: Brand and Mobile Toggle */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg border border-theme-border/50 bg-theme-bg/60 text-theme-text md:hidden hover:bg-white/5 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-2 select-none">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-theme-accent/15 border border-theme-accent/40 shadow-neon">
              <Terminal className="w-4.5 h-4.5 text-theme-accent" />
            </div>
            <div>
              <span className="font-sans font-bold text-base bg-gradient-to-r from-theme-text via-theme-accent to-theme-text bg-clip-text text-transparent">
                ASCII FORGE
              </span>
              <span className="hidden sm:inline-block ml-2 text-[9px] font-mono border border-theme-accent/20 px-1 py-0.5 rounded text-theme-accent/80 tracking-wider">
                CORE_SYS_v2.0
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Search, Clock, Theme selection */}
        <div className="flex items-center gap-3 md:gap-5">
          
          {/* Quick command search shortcut */}
          <button
            onClick={onOpenCommandPalette}
            className="hidden sm:flex items-center gap-2.5 px-3 py-1.5 rounded-lg border border-theme-border/40 bg-theme-bg/60 text-xs text-theme-muted hover:border-theme-accent/40 hover:text-theme-text transition-all duration-200"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search console...</span>
            <kbd className="px-1 border border-theme-border bg-theme-panel rounded text-[9px] font-mono leading-none">
              Ctrl K
            </kbd>
          </button>

          {/* Holographic Diagnostic Clock */}
          <div className="hidden lg:flex flex-col items-end justify-center select-none font-mono">
            <span className="text-[10px] text-theme-muted uppercase tracking-widest leading-none">SYSTEM TIME</span>
            <span className="text-sm font-semibold text-theme-accent mt-0.5">
              {time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>

          {/* Theme Quick Switcher dropdown/dots */}
          <div className="flex items-center gap-1.5 border-l border-theme-border/40 pl-3 md:pl-5">
            <div className="hidden xl:flex items-center gap-1">
              {themes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => onChangeTheme(t.value)}
                  title={t.label}
                  className={`w-3.5 h-3.5 rounded-full ${t.bg} transition-all duration-200 hover:scale-120 ${
                    activeTheme === t.value 
                      ? 'ring-2 ring-offset-2 ring-offset-theme-bg ring-theme-accent scale-110' 
                      : 'opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>
            
            {/* Fallback for smaller screens */}
            <div className="xl:hidden relative group">
              <button className="p-1.5 rounded-lg border border-theme-border/50 bg-theme-bg/60 text-theme-muted hover:text-theme-text hover:border-theme-accent/30 transition-colors">
                <Palette className="w-4 h-4" />
              </button>
              <div className="absolute right-0 top-full mt-1.5 hidden group-hover:block w-40 rounded-lg border border-theme-border/60 bg-theme-panel p-1.5 shadow-2xl glass animate-in fade-in slide-in-from-top-1 duration-150">
                {themes.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => onChangeTheme(t.value)}
                    className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded text-xs font-sans hover:bg-white/5 transition-colors text-left ${
                      activeTheme === t.value ? 'text-theme-accent bg-theme-accent/5' : 'text-theme-text'
                    }`}
                  >
                    <span className={`w-2.5 h-2.5 rounded-full ${t.bg} inline-block`} />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

        </div>

      </div>
    </header>
  );
};
