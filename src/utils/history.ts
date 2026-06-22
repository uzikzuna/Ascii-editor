export interface AsciiProject {
  id: string;
  name: string;
  type: 'image' | 'gif' | 'video' | 'webcam' | 'screen' | 'text' | 'editor' | 'animation' | 'visualizer';
  lastModified: number;
  options: any;
  data?: any; // e.g. drawing layers or animation timeline frames
}

const STORAGE_KEY = 'ascii-forge-projects';

export function loadProjects(): AsciiProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultProjects();
    const parsed = JSON.parse(raw);
    if (parsed.length === 0) return getDefaultProjects();
    return parsed;
  } catch (e) {
    console.error('Failed to load projects:', e);
    return getDefaultProjects();
  }
}

export function saveProjects(projects: AsciiProject[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  } catch (e) {
    console.error('Failed to save projects:', e);
  }
}

export function saveProject(project: AsciiProject): AsciiProject[] {
  const projects = loadProjects();
  const index = projects.findIndex(p => p.id === project.id);
  
  const updated = {
    ...project,
    lastModified: Date.now()
  };

  if (index >= 0) {
    projects[index] = updated;
  } else {
    projects.unshift(updated);
  }
  
  saveProjects(projects);
  return projects;
}

export function deleteProject(id: string): AsciiProject[] {
  const projects = loadProjects();
  const filtered = projects.filter(p => p.id !== id);
  saveProjects(filtered);
  return filtered;
}

export function duplicateProject(project: AsciiProject): AsciiProject[] {
  const duplicated: AsciiProject = {
    ...project,
    id: 'proj_' + Math.random().toString(36).substr(2, 9),
    name: `${project.name} (Copy)`,
    lastModified: Date.now()
  };
  return saveProject(duplicated);
}

export function renameProject(id: string, newName: string): AsciiProject[] {
  const projects = loadProjects();
  const index = projects.findIndex(p => p.id === id);
  if (index >= 0) {
    projects[index].name = newName;
    projects[index].lastModified = Date.now();
    saveProjects(projects);
  }
  return projects;
}

export function exportProjectFile(project: AsciiProject): void {
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(project));
  const downloadAnchor = document.createElement('a');
  downloadAnchor.setAttribute("href", dataStr);
  downloadAnchor.setAttribute("download", `${project.name.toLowerCase().replace(/\s+/g, '_')}_project.json`);
  document.body.appendChild(downloadAnchor);
  downloadAnchor.click();
  downloadAnchor.remove();
}

function getDefaultProjects(): AsciiProject[] {
  return [
    {
      id: 'demo_jarvis',
      name: 'JARVIS Interface Blueprint',
      type: 'editor',
      lastModified: Date.now() - 3600000,
      options: { width: 80, height: 40, theme: 'jarvis' },
      data: {
        grid: Array(40).fill(null).map((_, r) => 
          Array(80).fill(null).map((_, c) => {
            if (r === 0 || r === 39) return '-';
            if (c === 0 || c === 79) return '|';
            if (r === 2 && c === 5) return 'J';
            if (r === 2 && c === 6) return 'A';
            if (r === 2 && c === 7) return 'R';
            if (r === 2 && c === 8) return 'V';
            if (r === 2 && c === 9) return 'I';
            if (r === 2 && c === 10) return 'S';
            if (r === 2 && c === 11) return ' ';
            if (r === 2 && c === 12) return 'v';
            if (r === 2 && c === 13) return '1';
            if (r === 2 && c === 14) return '.';
            if (r === 2 && c === 15) return '0';
            
            // Draw a futuristic hologram wireframe look
            if (r === 10 && c > 15 && c < 65) return '=';
            if (r === 30 && c > 15 && c < 65) return '=';
            if (c === 15 && r > 10 && r < 30) return '|';
            if (c === 65 && r > 10 && r < 30) return '|';
            
            // Inner core reactor circle
            const dx = (c - 40);
            const dy = (r - 20) * 2; // compensate aspect ratio
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (Math.abs(dist - 12) < 0.6) return 'o';
            if (Math.abs(dist - 6) < 0.6) return '*';
            if (Math.abs(dist - 2) < 0.6) return '#';
            
            return ' ';
          })
        ),
        colors: Array(40).fill(null).map((_, r) => 
          Array(80).fill(null).map((_, c) => {
            const dx = (c - 40);
            const dy = (r - 20) * 2;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < 4) return { r: 255, g: 0, b: 128 }; // Pink center
            if (dist < 8) return { r: 56, g: 189, b: 248 }; // Blue core
            if (dist < 14) return { r: 14, g: 165, b: 233 }; // Cyan outer
            return { r: 30, g: 58, b: 138 }; // Muted blue for borders
          })
        )
      }
    },
    {
      id: 'demo_matrix',
      name: 'Matrix Digital Rain Config',
      type: 'text',
      lastModified: Date.now() - 7200000,
      options: { font: 'Slant', text: 'NEO' },
    }
  ];
}
