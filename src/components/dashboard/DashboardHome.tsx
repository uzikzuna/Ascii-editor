import React, { useState, useEffect } from 'react';
import { 
  FolderPlus, Upload, Trash2, Edit2, Copy, FileJson, 
  Cpu, Clock, Activity, ArrowRight 
} from 'lucide-react';
import { 
  loadProjects, saveProject, deleteProject, 
  duplicateProject, renameProject, exportProjectFile
} from '../../utils/history';
import type { AsciiProject } from '../../utils/history';
import { Button, useToast } from '../shared/Widgets';

interface DashboardHomeProps {
  onLoadProject: (project: AsciiProject) => void;
  onNavigateToConverter: (page: string) => void;
  onSelectUploadFile: (file: File, type: string) => void;
}

export const DashboardHome: React.FC<DashboardHomeProps> = ({
  onLoadProject,
  onNavigateToConverter,
  onSelectUploadFile
}) => {
  const [projects, setProjects] = useState<AsciiProject[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [stats, setStats] = useState({
    totalConversions: 1024,
    uptime: '00:00:00',
    engineFps: 60,
    storageUsage: '0.0 KB'
  });
  const { showToast } = useToast();

  // Load projects on mount
  useEffect(() => {
    setProjects(loadProjects());
    
    // Simulate real-time stats updates
    const interval = setInterval(() => {
      setStats(prev => ({
        ...prev,
        engineFps: Math.round(58 + Math.random() * 2),
        totalConversions: prev.totalConversions + (Math.random() > 0.7 ? 1 : 0)
      }));
    }, 3000);

    // System uptime counter
    const startTime = Date.now();
    const uptimeInterval = setInterval(() => {
      const diff = Date.now() - startTime;
      const hours = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setStats(prev => ({ ...prev, uptime: `${hours}:${mins}:${secs}` }));
    }, 1000);

    // Calculate local storage size
    try {
      const raw = localStorage.getItem('ascii-forge-projects') || '';
      const kb = (raw.length * 2 / 1024).toFixed(2);
      setStats(prev => ({ ...prev, storageUsage: `${kb} KB` }));
    } catch(e) {}

    return () => {
      clearInterval(interval);
      clearInterval(uptimeInterval);
    };
  }, []);

  const handleCreateNewProject = (type: 'image' | 'gif' | 'video' | 'text' | 'editor' | 'animation' | 'visualizer') => {
    const defaultNames = {
      image: 'New Image Vector',
      gif: 'New Animated GIF Project',
      video: 'New Video Stream',
      text: 'New Banner Text',
      editor: 'New ASCII Canvas',
      animation: 'New Frame Animation',
      visualizer: 'New Spectrum Analyzer'
    };
    
    const newProj: AsciiProject = {
      id: 'proj_' + Math.random().toString(36).substring(2, 9),
      name: defaultNames[type] || 'Unnamed Project',
      type,
      lastModified: Date.now(),
      options: {
        width: 80,
        height: 40,
        brightness: 0,
        contrast: 0,
        sharpness: 0,
        charMode: 'standard',
        colorMode: 'color',
        invert: false,
        dithering: 'none'
      }
    };
    
    const updated = saveProject(newProj);
    setProjects(updated);
    showToast(`Created new ${type} project!`, 'success');
    onLoadProject(newProj);
  };

  const handleDelete = (id: string, name: string) => {
    const updated = deleteProject(id);
    setProjects(updated);
    showToast(`Deleted project: ${name}`, 'info');
  };

  const handleDuplicate = (project: AsciiProject) => {
    const updated = duplicateProject(project);
    setProjects(updated);
    showToast(`Duplicated: ${project.name}`, 'success');
  };

  const handleStartRename = (project: AsciiProject) => {
    setEditId(project.id);
    setNewName(project.name);
  };

  const handleSaveRename = (id: string) => {
    if (!newName.trim()) return;
    const updated = renameProject(id, newName.trim());
    setProjects(updated);
    setEditId(null);
    showToast(`Renamed project to "${newName}"`, 'success');
  };

  // Drag and Drop files
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const mime = file.type;
    if (mime.startsWith('image/gif')) {
      onSelectUploadFile(file, 'gif');
    } else if (mime.startsWith('image/')) {
      onSelectUploadFile(file, 'image');
    } else if (mime.startsWith('video/')) {
      onSelectUploadFile(file, 'video');
    } else if (mime.startsWith('audio/')) {
      onSelectUploadFile(file, 'visualizer');
    } else {
      showToast('Unsupported file type dropped.', 'error');
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const mime = file.type;
    if (mime.startsWith('image/gif')) {
      onSelectUploadFile(file, 'gif');
    } else if (mime.startsWith('image/')) {
      onSelectUploadFile(file, 'image');
    } else if (mime.startsWith('video/')) {
      onSelectUploadFile(file, 'video');
    } else if (mime.startsWith('audio/')) {
      onSelectUploadFile(file, 'visualizer');
    } else {
      showToast('Unsupported file type selected.', 'error');
    }
  };

  return (
    <div className="flex-1 overflow-y-auto px-4 py-6 md:px-8 grid-bg">
      <div className="max-w-6xl mx-auto flex flex-col gap-8">
        
        {/* Welcome Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-theme-border/30 pb-6">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight text-theme-text bg-gradient-to-r from-theme-text via-theme-accent to-theme-text bg-clip-text text-transparent">
              ASCII FORGE CREATIVE STUDIO
            </h1>
            <p className="text-sm text-theme-muted mt-1.5 font-sans">
              Welcome back, technician. The holographic compiler is fully calibrated and operational.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="glow" size="sm" onClick={() => handleCreateNewProject('editor')}>
              <FolderPlus className="w-4 h-4" />
              <span>New ASCII Canvas</span>
            </Button>
          </div>
        </div>

        {/* Real-time Diagnostics Matrix (Stats) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'CONVERSION CYCLES', value: stats.totalConversions, desc: '+1.4% cycle count', icon: <Activity className="w-5 h-5 text-theme-accent" /> },
            { label: 'SAVED PROJECTS', value: projects.length, desc: stats.storageUsage, icon: <FolderPlus className="w-5 h-5 text-theme-accent" /> },
            { label: 'RENDER STABILITY', value: `${stats.engineFps} FPS`, desc: 'Delta ~0.2ms jitter', icon: <Cpu className="w-5 h-5 text-theme-accent" /> },
            { label: 'CORE UPTIME', value: stats.uptime, desc: 'Hologram persistence active', icon: <Clock className="w-5 h-5 text-theme-accent" /> }
          ].map((stat, idx) => (
            <div key={idx} className="glass p-4 rounded-xl border border-theme-border/50 relative overflow-hidden group">
              <div className="flex justify-between items-start">
                <span className="text-[10px] font-mono font-bold tracking-widest text-theme-muted">{stat.label}</span>
                {stat.icon}
              </div>
              <p className="text-2xl font-bold font-mono text-theme-text mt-2 tracking-tight group-hover:text-theme-accent transition-colors">
                {stat.value}
              </p>
              <span className="text-[10px] font-mono text-theme-muted/75 mt-1 block">
                {stat.desc}
              </span>
              {/* Pulsing neon corner */}
              <div className="absolute top-0 right-0 w-12 h-12 bg-theme-accent/5 rounded-full blur-xl group-hover:bg-theme-accent/15 transition-all duration-300" />
            </div>
          ))}
        </div>

        {/* Drag and Drop Zone */}
        <div 
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className="glass border-2 border-dashed border-theme-border/60 hover:border-theme-accent/50 rounded-2xl p-8 text-center cursor-pointer transition-all duration-300 bg-theme-panel/20 hover:bg-theme-panel/40 flex flex-col items-center justify-center min-h-[220px]"
        >
          <input
            id="quick-upload-input"
            type="file"
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,video/*,audio/*"
          />
          <label htmlFor="quick-upload-input" className="cursor-pointer flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-theme-accent/15 border border-theme-accent/30 shadow-neon flex items-center justify-center text-theme-accent mb-4 hover:scale-105 transition-transform duration-300">
              <Upload className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-semibold text-theme-text">Drag & drop files here to convert</h3>
            <p className="text-xs text-theme-muted max-w-sm mt-2">
              Supports PNG, JPG, WEBP, GIFs, MP4/WEBM videos, and audio spectrum analysis.
            </p>
            <Button variant="secondary" size="sm" className="mt-4 pointer-events-none">
              Or browse files on system
            </Button>
          </label>
        </div>

        {/* Recent Projects Grid */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-theme-border/20 pb-2">
            <h2 className="text-lg font-bold text-theme-text font-sans">RECENT PROJECTS</h2>
            <span className="text-xs font-mono text-theme-muted">{projects.length} PROJECTS INDEXED</span>
          </div>

          {projects.length === 0 ? (
            <div className="glass border border-theme-border/40 rounded-xl p-12 text-center text-theme-muted flex flex-col items-center gap-3">
              <FolderPlus className="w-12 h-12 text-theme-border" />
              <div>
                <p className="text-sm font-semibold">No recent projects found</p>
                <p className="text-xs text-theme-muted mt-1">Create one from the top bar or drag a file to get started.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {projects.map((proj) => (
                <div 
                  key={proj.id}
                  className="glass border border-theme-border/50 hover:border-theme-accent/40 rounded-xl p-4 flex flex-col justify-between transition-all duration-300 relative group bg-theme-panel/30 hover:bg-theme-panel/50"
                >
                  <div>
                    {/* Project Header */}
                    <div className="flex justify-between items-start gap-2">
                      {editId === proj.id ? (
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onBlur={() => handleSaveRename(proj.id)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSaveRename(proj.id)}
                          className="w-full bg-theme-bg text-theme-text font-sans text-sm font-semibold border border-theme-accent px-2 py-0.5 rounded focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <h3 
                          onClick={() => onLoadProject(proj)}
                          className="text-sm font-semibold text-theme-text hover:text-theme-accent transition-colors truncate cursor-pointer font-sans"
                        >
                          {proj.name}
                        </h3>
                      )}
                      
                      <span className="text-[9px] font-mono border border-theme-border px-1.5 py-0.5 rounded text-theme-muted uppercase">
                        {proj.type}
                      </span>
                    </div>

                    <p className="text-[10px] text-theme-muted mt-1 font-mono">
                      MODIFIED: {new Date(proj.lastModified).toLocaleString()}
                    </p>
                  </div>

                  {/* Actions footer */}
                  <div className="flex items-center justify-between border-t border-theme-border/30 pt-3 mt-4">
                    <button
                      onClick={() => onLoadProject(proj)}
                      className="text-xs text-theme-accent hover:text-theme-text flex items-center gap-1 font-bold"
                    >
                      <span>LOAD SOURCE</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => handleStartRename(proj)}
                        title="Rename"
                        className="p-1 rounded hover:bg-white/5 text-theme-muted hover:text-theme-text"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDuplicate(proj)}
                        title="Duplicate"
                        className="p-1 rounded hover:bg-white/5 text-theme-muted hover:text-theme-text"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => exportProjectFile(proj)}
                        title="Download JSON Project"
                        className="p-1 rounded hover:bg-white/5 text-theme-muted hover:text-theme-text"
                      >
                        <FileJson className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(proj.id, proj.name)}
                        title="Delete"
                        className="p-1 rounded hover:bg-white/5 text-rose-400/80 hover:text-rose-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Feature quick access section */}
        <div className="flex flex-col gap-4 border-t border-theme-border/20 pt-6">
          <h3 className="text-sm font-mono font-bold tracking-widest text-theme-muted uppercase">CREATIVE SUITE MODULES</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { id: 'image', title: 'IMAGE MATRIX', desc: 'Vectorize static images' },
              { id: 'gif', title: 'GIF TIMELINE', desc: 'Animate frame-by-frame' },
              { id: 'video', title: 'VIDEO STREAM', desc: 'Real-time video inputs' },
              { id: 'webcam', title: 'WEBCAM STUDIO', desc: 'Holographic interactive lens' },
              { id: 'screen', title: 'SCREEN SHADOW', desc: 'Render display captures' },
              { id: 'text', title: 'BANNER FONTS', desc: 'Generate figlet typography' },
              { id: 'editor', title: 'CANVAS CANVAS', desc: 'Freehand block painting' },
              { id: 'visualizer', title: 'SPECTRUM AUDIO', desc: 'Acoustic wave frequencies' }
            ].map((module) => (
              <div 
                key={module.id}
                onClick={() => onNavigateToConverter(module.id)}
                className="glass p-3 rounded-lg border border-theme-border/30 hover:border-theme-accent/50 bg-theme-panel/10 hover:bg-theme-panel/40 cursor-pointer transition-all duration-200 group text-left"
              >
                <h4 className="text-xs font-bold text-theme-text group-hover:text-theme-accent transition-colors font-sans">{module.title}</h4>
                <p className="text-[10px] text-theme-muted mt-0.5 truncate">{module.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
