import React from 'react';
import { 
  LayoutDashboard, Image, Film, Video, Camera, Monitor, 
  Type, Brush, Layers, Volume2, Settings, ChevronLeft, ChevronRight 
} from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  setPage: (page: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onClose,
  currentPage,
  setPage,
  isCollapsed,
  onToggleCollapse
}) => {

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" />, category: 'Core' },
    { id: 'image', label: 'Image Converter', icon: <Image className="w-4 h-4" />, category: 'Converters' },
    { id: 'gif', label: 'GIF Converter', icon: <Film className="w-4 h-4" />, category: 'Converters' },
    { id: 'video', label: 'Video Converter', icon: <Video className="w-4 h-4" />, category: 'Converters' },
    { id: 'webcam', label: 'Webcam Studio', icon: <Camera className="w-4 h-4" />, category: 'Captures' },
    { id: 'screen', label: 'Screen Capture', icon: <Monitor className="w-4 h-4" />, category: 'Captures' },
    { id: 'text', label: 'Text Generator', icon: <Type className="w-4 h-4" />, category: 'Creative' },
    { id: 'editor', label: 'ASCII Editor', icon: <Brush className="w-4 h-4" />, category: 'Creative' },
    { id: 'animation', label: 'Animation Studio', icon: <Layers className="w-4 h-4" />, category: 'Creative' },
    { id: 'visualizer', label: 'Audio Visualizer', icon: <Volume2 className="w-4 h-4" />, category: 'Creative' },
    { id: 'settings', label: 'Settings', icon: <Settings className="w-4 h-4" />, category: 'System' }
  ];

  // Group items by category
  const categories = ['Core', 'Converters', 'Captures', 'Creative', 'System'];

  const handleNav = (page: string) => {
    setPage(page);
    onClose(); // close mobile side overlay
  };

  return (
    <>
      {/* Mobile Drawer Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
          onClick={onClose}
        />
      )}

      {/* Main Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-30 flex flex-col border-r border-theme-border bg-theme-panel/95 transition-all duration-300 md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } ${isCollapsed ? 'w-16' : 'w-64'}`}
      >
        {/* Collapse toggle (desktop only) */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex absolute top-3 -right-3.5 z-40 items-center justify-center w-7 h-7 rounded-full border border-theme-border bg-theme-panel text-theme-muted hover:text-theme-text shadow-md"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Scrollable Nav Area */}
        <div className="flex-1 overflow-y-auto px-3 py-4 select-none">
          {categories.map((cat) => {
            const items = menuItems.filter(item => item.category === cat);
            return (
              <div key={cat} className="mb-5">
                {/* Category Header */}
                {!isCollapsed && (
                  <h3 className="px-3 mb-2 text-[10px] font-mono font-bold tracking-wider text-theme-muted uppercase opacity-75">
                    {cat}
                  </h3>
                )}
                {isCollapsed && (
                  <div className="mx-2 mb-2 border-t border-theme-border/40" />
                )}

                {/* Items */}
                <div className="flex flex-col gap-0.5">
                  {items.map((item) => {
                    const isActive = currentPage === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => handleNav(item.id)}
                        title={isCollapsed ? item.label : undefined}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-sans font-medium transition-all ${
                          isActive 
                            ? 'bg-theme-accent/15 text-theme-accent border-l-2 border-theme-accent pl-2.5 shadow-neon' 
                            : 'text-theme-muted hover:text-theme-text hover:bg-white/5 border-l-2 border-transparent'
                        }`}
                      >
                        <span className={`transition-transform duration-200 ${isActive ? 'scale-110 text-theme-accent' : ''}`}>
                          {item.icon}
                        </span>
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Credits */}
        <div className="p-4 border-t border-theme-border/60 bg-black/10 text-center font-mono">
          {!isCollapsed ? (
            <p className="text-[10px] text-theme-muted">
              ASCII Forge Studio © 2026
            </p>
          ) : (
            <span className="text-xs font-bold text-theme-accent">A.F.</span>
          )}
        </div>
      </aside>
    </>
  );
};
