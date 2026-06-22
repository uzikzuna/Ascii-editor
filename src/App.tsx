import { useState, useEffect } from 'react';
import { WorkspaceLayout } from './components/layout/WorkspaceLayout';
import { DashboardHome } from './components/dashboard/DashboardHome';
import { ImageConverter } from './components/converters/ImageConverter';
import { GifConverter } from './components/converters/GifConverter';
import { VideoConverter } from './components/converters/VideoConverter';
import { WebcamConverter } from './components/converters/WebcamConverter';
import { ScreenCaptureConverter } from './components/converters/ScreenCaptureConverter';
import { TextGenerator } from './components/tools/TextGenerator';
import { AsciiEditor } from './components/tools/AsciiEditor';
import { AnimationStudio } from './components/tools/AnimationStudio';
import { AudioVisualizer } from './components/tools/AudioVisualizer';
import { Settings } from './components/tools/Settings';
import { ToastProvider, useToast } from './components/shared/Widgets';
import type { AsciiProject } from './utils/history';

function AppContent() {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [activeTheme, setActiveTheme] = useState(() => {
    return localStorage.getItem('ascii-forge-theme') || 'jarvis';
  });

  // Transfer files from dashboard drop triggers
  const [transferFile, setTransferFile] = useState<File | null>(null);

  const { showToast } = useToast();

  // Apply theme class/attribute on html tag
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', activeTheme);
    localStorage.setItem('ascii-forge-theme', activeTheme);
  }, [activeTheme]);

  const handleLoadProject = (project: AsciiProject) => {
    showToast(`Loaded project: ${project.name}`, 'info');
    
    // Redirect user to correct tool workspace
    if (project.type === 'editor') setCurrentPage('editor');
    else if (project.type === 'text') setCurrentPage('text');
    else if (project.type === 'animation') setCurrentPage('animation');
    else if (project.type === 'image') setCurrentPage('image');
    else if (project.type === 'gif') setCurrentPage('gif');
    else if (project.type === 'video') setCurrentPage('video');
    else if (project.type === 'webcam') setCurrentPage('webcam');
    else if (project.type === 'screen') setCurrentPage('screen');
    else if (project.type === 'visualizer') setCurrentPage('visualizer');
  };

  const handleSelectUploadFile = (file: File, type: string) => {
    setTransferFile(file);
    setCurrentPage(type);
  };

  const handleClearTransferFile = () => {
    setTransferFile(null);
  };

  const handleChangeTheme = (theme: string) => {
    setActiveTheme(theme);
    showToast(`Styling profile calibrated to: ${theme.toUpperCase()}`, 'success');
  };

  const renderActivePage = () => {
    switch (currentPage) {
      case 'image':
        return (
          <ImageConverter 
            initialFile={transferFile} 
            onClearInitialFile={handleClearTransferFile} 
          />
        );
      case 'gif':
        return (
          <GifConverter 
            initialFile={transferFile} 
            onClearInitialFile={handleClearTransferFile} 
          />
        );
      case 'video':
        return (
          <VideoConverter 
            initialFile={transferFile} 
            onClearInitialFile={handleClearTransferFile} 
          />
        );
      case 'webcam':
        return <WebcamConverter />;
      case 'screen':
        return <ScreenCaptureConverter />;
      case 'text':
        return <TextGenerator />;
      case 'editor':
        return <AsciiEditor />;
      case 'animation':
        return <AnimationStudio />;
      case 'visualizer':
        return <AudioVisualizer />;
      case 'settings':
        return (
          <Settings 
            activeTheme={activeTheme} 
            onChangeTheme={handleChangeTheme} 
          />
        );
      case 'dashboard':
      default:
        return (
          <DashboardHome
            onLoadProject={handleLoadProject}
            onNavigateToConverter={setCurrentPage}
            onSelectUploadFile={handleSelectUploadFile}
          />
        );
    }
  };

  return (
    <WorkspaceLayout
      currentPage={currentPage}
      setPage={setCurrentPage}
      activeTheme={activeTheme}
      onChangeTheme={handleChangeTheme}
    >
      {renderActivePage()}
    </WorkspaceLayout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}
