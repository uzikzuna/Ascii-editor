import { useState, useEffect, lazy, Suspense } from 'react';
import { WorkspaceLayout } from './components/layout/WorkspaceLayout';
import { DashboardHome } from './components/dashboard/DashboardHome';
import { ToastProvider, useToast } from './components/shared/Widgets';
import type { AsciiProject } from './utils/history';

// Lazy load large editor/converter files for optimal load speeds and chunking
const ImageConverter = lazy(() => import('./components/converters/ImageConverter').then(m => ({ default: m.ImageConverter })));
const GifConverter = lazy(() => import('./components/converters/GifConverter').then(m => ({ default: m.GifConverter })));
const VideoConverter = lazy(() => import('./components/converters/VideoConverter').then(m => ({ default: m.VideoConverter })));
const WebcamConverter = lazy(() => import('./components/converters/WebcamConverter').then(m => ({ default: m.WebcamConverter })));
const ScreenCaptureConverter = lazy(() => import('./components/converters/ScreenCaptureConverter').then(m => ({ default: m.ScreenCaptureConverter })));
const TextGenerator = lazy(() => import('./components/tools/TextGenerator').then(m => ({ default: m.TextGenerator })));
const ProStudioWorkspace = lazy(() => import('./components/tools/ProStudioWorkspace').then(m => ({ default: m.ProStudioWorkspace })));
const Settings = lazy(() => import('./components/tools/Settings').then(m => ({ default: m.Settings })));

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
      case 'animation':
      case 'visualizer':
        return (
          <ProStudioWorkspace 
            initialFile={transferFile} 
            onClearInitialFile={handleClearTransferFile} 
          />
        );
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
      <Suspense fallback={
        <div className="flex-grow flex flex-col justify-center items-center h-full text-theme-accent gap-2 bg-theme-bg">
          <div className="w-8 h-8 rounded-full border-2 border-theme-accent border-t-transparent animate-spin" />
          <span className="font-mono text-xs">CALIBRATING INTERFACE...</span>
        </div>
      }>
        {renderActivePage()}
      </Suspense>
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
