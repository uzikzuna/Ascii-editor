import type { Layer } from '../types/workspaceState';

export function blendChannel(bg: number, fg: number, mode: string): number {
  switch (mode) {
    case 'multiply':
      return Math.round((bg * fg) / 255);
    case 'screen':
      return Math.round(255 - ((255 - bg) * (255 - fg)) / 255);
    case 'overlay':
      return bg < 128
        ? Math.round((2 * bg * fg) / 255)
        : Math.round(255 - (2 * (255 - bg) * (255 - fg)) / 255);
    case 'soft-light': {
      const b = bg / 255;
      const f = fg / 255;
      const res = f < 0.5
        ? b - (1 - 2 * f) * b * (1 - b)
        : b + (2 * f - 1) * (Math.sqrt(b) - b);
      return Math.round(res * 255);
    }
    case 'hard-light':
      return fg < 128
        ? Math.round((2 * bg * fg) / 255)
        : Math.round(255 - (2 * (255 - bg) * (255 - fg)) / 255); // fg-based overlay
    case 'difference':
      return Math.abs(bg - fg);
    case 'additive':
      return Math.min(255, bg + fg);
    case 'normal':
    default:
      return fg;
  }
}

export function blendColors(
  bg: { r: number; g: number; b: number },
  fg: { r: number; g: number; b: number },
  mode: string,
  opacity: number
): { r: number; g: number; b: number } {
  const r = blendChannel(bg.r, fg.r, mode);
  const g = blendChannel(bg.g, fg.g, mode);
  const b = blendChannel(bg.b, fg.b, mode);

  return {
    r: Math.round(opacity * r + (1 - opacity) * bg.r),
    g: Math.round(opacity * g + (1 - opacity) * bg.g),
    b: Math.round(opacity * b + (1 - opacity) * bg.b),
  };
}

export function compositeLayers(
  layers: Layer[],
  width: number,
  height: number,
  themeBg: string = '#080e1a'
): {
  grid: string[][];
  colors: { r: number; g: number; b: number }[][];
  bgColors: { r: number; g: number; b: number }[][];
} {
  // Initialize composited outputs
  const grid: string[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill(' '));

  // Parse default theme background hex
  const parseHex = (hex: string) => {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  };
  const defaultBg = parseHex(themeBg);

  const colors: { r: number; g: number; b: number }[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill({ r: 226, g: 232, b: 240 })); // default text color

  const bgColors: { r: number; g: number; b: number }[][] = Array(height)
    .fill(null)
    .map(() => Array(width).fill(defaultBg));

  // Blend from bottom layer (index 0) to top layer
  const visibleLayers = layers.filter((l) => l.visible);

  for (const layer of visibleLayers) {
    const opacity = layer.opacity;
    if (opacity <= 0) continue;

    for (let r = 0; r < height; r++) {
      for (let c = 0; c < width; c++) {
        // Safe check
        const char = layer.grid[r]?.[c] ?? ' ';
        const fg = layer.colors[r]?.[c] ?? { r: 226, g: 232, b: 240 };
        const bg = layer.bgColors?.[r]?.[c];

        // 1. Blend background colors if layer has them
        if (bg) {
          bgColors[r][c] = blendColors(bgColors[r][c], bg, layer.blendMode, opacity);
        }

        // 2. Blend characters and foreground colors
        if (char !== ' ') {
          grid[r][c] = char;
          colors[r][c] = blendColors(colors[r][c], fg, layer.blendMode, opacity);
        }
      }
    }
  }

  return { grid, colors, bgColors };
}
