import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Terminal, Laptop, Palette, Compass, Star, Settings } from 'lucide-react';

interface CommandItem {
  id: string;
  category: 'navigation' | 'theme' | 'action';
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  setPage: (page: string) => void;
  setTheme: (theme: string) => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  setPage,
  setTheme
}) => {
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when palette opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const commands: CommandItem[] = [
    // Navigation
    { id: 'nav_dash', category: 'navigation', title: 'Go to Dashboard', subtitle: 'View project list and convert statistics', icon: <Compass className="w-4 h-4" />, action: () => setPage('dashboard') },
    { id: 'nav_img', category: 'navigation', title: 'Go to Image Converter', subtitle: 'Upload photos and render static ASCII', icon: <Terminal className="w-4 h-4" />, action: () => setPage('image') },
    { id: 'nav_gif', category: 'navigation', title: 'Go to GIF Converter', subtitle: 'Parse and animate GIF files frame-by-frame', icon: <Terminal className="w-4 h-4" />, action: () => setPage('gif') },
    { id: 'nav_vid', category: 'navigation', title: 'Go to Video Converter', subtitle: 'Real-time HTML5 video to ASCII rendering', icon: <Terminal className="w-4 h-4" />, action: () => setPage('video') },
    { id: 'nav_webcam', category: 'navigation', title: 'Go to Webcam Studio', subtitle: 'Interactive live camera ASCII feeds', icon: <Terminal className="w-4 h-4" />, action: () => setPage('webcam') },
    { id: 'nav_screen', category: 'navigation', title: 'Go to Screen Capture Studio', subtitle: 'Cast window captures into text output', icon: <Laptop className="w-4 h-4" />, action: () => setPage('screen') },
    { id: 'nav_text', category: 'navigation', title: 'Go to Text Generator', subtitle: 'Render banner fonts and large letters', icon: <Terminal className="w-4 h-4" />, action: () => setPage('text') },
    { id: 'nav_editor', category: 'navigation', title: 'Go to ASCII Editor', subtitle: 'Freehand canvas drawing using characters', icon: <Terminal className="w-4 h-4" />, action: () => setPage('editor') },
    { id: 'nav_anim', category: 'navigation', title: 'Go to Animation Studio', subtitle: 'Keyframe timeline and onion skinning tools', icon: <Terminal className="w-4 h-4" />, action: () => setPage('animation') },
    { id: 'nav_vis', category: 'navigation', title: 'Go to Audio Visualizer', subtitle: 'Spectrograph analyzer responding to audio', icon: <Terminal className="w-4 h-4" />, action: () => setPage('visualizer') },
    { id: 'nav_settings', category: 'navigation', title: 'Go to General Settings', subtitle: 'Configure user options and variables', icon: <Settings className="w-4 h-4" />, action: () => setPage('settings') },

    // Themes
    { id: 'theme_jarvis', category: 'theme', title: 'Switch Theme: JARVIS Blue', subtitle: 'Deep navy and holographic cyan HUD design', icon: <Palette className="w-4 h-4 text-cyan-400" />, action: () => setTheme('jarvis') },
    { id: 'theme_green', category: 'theme', title: 'Switch Theme: Classic Green Terminal', subtitle: 'Vintage green screen phosphor aesthetic', icon: <Palette className="w-4 h-4 text-emerald-400" />, action: () => setTheme('green-terminal') },
    { id: 'theme_amber', category: 'theme', title: 'Switch Theme: Amber CRT', subtitle: 'Warm amber glow with scanline grids', icon: <Palette className="w-4 h-4 text-amber-500" />, action: () => setTheme('amber-crt') },
    { id: 'theme_cyber', category: 'theme', title: 'Switch Theme: Cyberpunk Purple', subtitle: 'Synthwave hot pink glow over dark purple', icon: <Palette className="w-4 h-4 text-pink-400" />, action: () => setTheme('cyberpunk') },
    { id: 'theme_mono', category: 'theme', title: 'Switch Theme: Monochrome White', subtitle: 'Minimalist high-contrast industrial white design', icon: <Palette className="w-4 h-4 text-slate-800" />, action: () => setTheme('monochrome-white') },
    { id: 'theme_oled', category: 'theme', title: 'Switch Theme: OLED Dark', subtitle: 'Pure black panel layout for high contrast', icon: <Palette className="w-4 h-4 text-white" />, action: () => setTheme('oled-dark') },
    { id: 'theme_light', category: 'theme', title: 'Switch Theme: Light Mode', subtitle: 'Frosted steel blue gradient background', icon: <Palette className="w-4 h-4 text-blue-600" />, action: () => setTheme('light-mode') },

    // Quick Actions
    { id: 'act_clear', category: 'action', title: 'Clear Local Storage Cache', subtitle: 'Remove saved projects and restore defaults', icon: <Star className="w-4 h-4 text-rose-400" />, action: () => { localStorage.clear(); window.location.reload(); } }
  ];

  // Filter commands
  const filtered = commands.filter(cmd => 
    cmd.title.toLowerCase().includes(search.toLowerCase()) ||
    (cmd.subtitle && cmd.subtitle.toLowerCase().includes(search.toLowerCase())) ||
    cmd.category.toLowerCase().includes(search.toLowerCase())
  );

  // Key Event Handling inside Command Palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filtered[selectedIndex]) {
          filtered[selectedIndex].action();
          onClose();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filtered, onClose]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Dialog Panel */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="w-full max-w-xl border border-theme-border rounded-xl shadow-2xl overflow-hidden glass z-10 bg-theme-panel/90"
          >
            {/* Input bar */}
            <div className="flex items-center gap-3 px-4 border-b border-theme-border bg-black/20">
              <Search className="w-5 h-5 text-theme-muted flex-shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder="Type a command, theme, or tool name..."
                className="w-full py-4 bg-transparent text-theme-text text-sm font-sans focus:outline-none placeholder-theme-muted"
              />
              <span className="px-2 py-0.5 border border-theme-border rounded text-[10px] font-mono text-theme-muted flex-shrink-0 bg-theme-bg">
                ESC
              </span>
            </div>

            {/* Results list */}
            <div 
              ref={listRef}
              className="max-h-[320px] overflow-y-auto py-2 divide-y divide-theme-border/20"
            >
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-theme-muted">
                  No commands found matching "{search}"
                </div>
              ) : (
                filtered.map((cmd, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={cmd.id}
                      onClick={() => {
                        cmd.action();
                        onClose();
                      }}
                      className={`flex items-center justify-between gap-3 px-4 py-3 cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-theme-accent/15 border-l-2 border-theme-accent' 
                          : 'hover:bg-white/5 border-l-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`p-2 rounded-lg ${isSelected ? 'bg-theme-accent/20 text-theme-accent' : 'bg-theme-bg text-theme-muted'}`}>
                          {cmd.icon}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold truncate ${isSelected ? 'text-theme-accent' : 'text-theme-text'}`}>
                            {cmd.title}
                          </p>
                          {cmd.subtitle && (
                            <p className="text-xs text-theme-muted truncate">
                              {cmd.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-[10px] font-mono text-theme-muted uppercase px-1.5 py-0.5 bg-theme-bg/60 border border-theme-border/40 rounded flex-shrink-0">
                        {cmd.category}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
            
            {/* Command palette footer info */}
            <div className="flex justify-between items-center px-4 py-2 border-t border-theme-border/40 bg-black/10 text-[10px] font-mono text-theme-muted">
              <div className="flex items-center gap-3">
                <span>↑↓ Navigate</span>
                <span>ENTER Select</span>
              </div>
              <span>ASCII FORGE CONSOLE</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
