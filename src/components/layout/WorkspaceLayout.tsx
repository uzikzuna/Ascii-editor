import React, { useState, useEffect } from 'react';
import { Navbar } from './Navbar';
import { Sidebar } from './Sidebar';
import { CommandPalette } from './CommandPalette';

interface WorkspaceLayoutProps {
  children: React.ReactNode;
  currentPage: string;
  setPage: (page: string) => void;
  activeTheme: string;
  onChangeTheme: (theme: string) => void;
}

export const WorkspaceLayout: React.FC<WorkspaceLayoutProps> = ({
  children,
  currentPage,
  setPage,
  activeTheme,
  onChangeTheme
}) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl + K toggles Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
      
      // Ctrl + B toggles Sidebar collapse
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setIsSidebarCollapsed(prev => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-theme-bg text-theme-text transition-colors duration-300">
      
      {/* Dynamic scanline visual effect */}
      <div className="crt-effect fixed inset-0 z-50 pointer-events-none opacity-[0.07] mix-blend-overlay" />
      <div className="scanline-bar fixed inset-y-0 right-0 w-2.5 z-40" />

      {/* Global Navbar */}
      <Navbar
        onToggleSidebar={() => setIsSidebarOpen(prev => !prev)}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        activeTheme={activeTheme}
        onChangeTheme={onChangeTheme}
      />

      {/* Main Layout Area */}
      <div className="flex flex-1 relative">
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          currentPage={currentPage}
          setPage={setPage}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(prev => !prev)}
        />

        {/* Dynamic Workspace Panel */}
        <main className="flex-1 min-w-0 flex flex-col relative overflow-hidden">
          {children}
        </main>
      </div>

      {/* Command Palette System */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setPage={setPage}
        setTheme={onChangeTheme}
      />

    </div>
  );
};
