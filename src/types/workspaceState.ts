export interface Layer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'soft-light' | 'hard-light' | 'difference' | 'additive';
  grid: string[][];
  colors: { r: number; g: number; b: number }[][];
  bgColors?: { r: number; g: number; b: number }[][];
}

export interface AnimFrame {
  id: string;
  layers: Layer[];
  durationMs?: number;
}

export interface Keyframe {
  frameIdx: number;
  property: string; // e.g. 'brightness', 'contrast', 'edgeWeight', 'particleRate'
  value: number;
}

export interface TimelineData {
  isPlaying: boolean;
  fps: number;
  activeFrameIdx: number;
  frames: AnimFrame[];
  effects: string[]; // e.g. 'crt', 'matrix', 'neon', 'cyberpunk', 'retro', 'blueprint', 'hologram', 'vhs'
  particleType: 'none' | 'rain' | 'snow' | 'sparks' | 'fire' | 'smoke' | 'stars' | 'matrix-rain' | 'glitch';
  keyframes: Keyframe[];
}

export interface Document {
  id: string;
  name: string;
  type: 'paint' | 'image' | 'gif' | 'video' | 'webcam' | 'screen' | 'text' | 'animation' | 'visualizer';
  width: number;
  height: number;
  layers: Layer[];
  activeLayerId: string;
  zoom: number;
  pan: { x: number; y: number };
  options: Record<string, any>; // Context-dependent options (e.g. videoSrc, gifFrames, text options)
  timeline: TimelineData;
}

export interface PanelState {
  id: string;
  title: string;
  docked: boolean;
  open: boolean;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WorkspaceLayout {
  id: string;
  name: string;
  panels: PanelState[];
}
