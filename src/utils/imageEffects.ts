// ============================================================================
// imageEffects.ts — Post-Conversion Effects Pipeline for Image Converter Pro
// Operates on ASCII char/color grids AFTER worker conversion completes.
// ============================================================================

// ---------------------------------------------------------------------------
// TYPES
// ---------------------------------------------------------------------------

export interface GlowConfig {
  enabled: boolean;
  radius: number;      // 1–8 blur kernel radius
  intensity: number;   // 0–100 glow strength
  threshold: number;   // 0–255 brightness threshold for bloom detection
  color: 'auto' | 'warm' | 'cool' | 'neon' | 'custom';
  customColor?: string; // hex
}

export interface BackgroundRemovalConfig {
  enabled: boolean;
  threshold: number;        // 0–255 luminance cutoff
  edgeBlur: number;         // 0–20 edge refinement radius
  mode: 'dark' | 'light' | 'auto';  // remove dark or light backgrounds
  replacement: 'transparent' | 'solid' | 'gradient';
  replacementColor: string;  // hex
  gradientColor2: string;    // hex
  invertMask: boolean;
}

export interface ParticleConfig {
  type: 'none' | 'rain' | 'snow' | 'sparks' | 'fire' | 'smoke' | 'stars' | 'matrix-rain' | 'glitch';
  rate: number;        // 0–100 density
  speed: number;       // 0–100 animation speed
  color: 'auto' | 'white' | 'custom';
  customColor?: string; // hex
}

export interface ColorGradingConfig {
  temperature: number;  // -100 (cool) to 100 (warm)
  tint: number;         // -100 (green) to 100 (magenta)
  vibrance: number;     // -100 to 100
  hueShift: number;     // 0–360 degrees
  saturation: number;   // -100 to 100
  lightness: number;    // -100 to 100
}

export interface PostProcessConfig {
  crtScanlines: boolean;
  crtIntensity: number;     // 0–100
  vignette: boolean;
  vignetteIntensity: number; // 0–100
  filmGrain: boolean;
  grainIntensity: number;   // 0–100
  chromaticAberration: boolean;
  aberrationOffset: number; // 0–10 pixel offset
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  char: string;
  size: number;
}

type RGB = { r: number; g: number; b: number };

// ---------------------------------------------------------------------------
// 1. GLOW / BLOOM SYSTEM
// ---------------------------------------------------------------------------

/**
 * Applies a bloom/glow effect to the color grid.
 * Detects bright pixels above threshold, then diffuses their color outward
 * using a box blur kernel, blending the result additively onto the original.
 */
export function applyGlow(
  colors: RGB[][],
  config: GlowConfig
): RGB[][] {
  if (!config.enabled || config.intensity <= 0) return colors;

  const rows = colors.length;
  const cols = colors[0]?.length || 0;
  if (rows === 0 || cols === 0) return colors;

  const result: RGB[][] = colors.map(row => row.map(c => ({ ...c })));
  const intensity = config.intensity / 100;
  const radius = Math.max(1, Math.min(8, config.radius));

  // Step 1: Extract bright pixels above threshold
  const bloom: RGB[][] = Array(rows).fill(null).map(() =>
    Array(cols).fill(null).map(() => ({ r: 0, g: 0, b: 0 }))
  );

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const col = colors[r][c];
      const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
      if (lum > config.threshold) {
        // Apply optional color tinting
        let tintR = col.r, tintG = col.g, tintB = col.b;
        if (config.color === 'warm') {
          tintR = Math.min(255, col.r * 1.3);
          tintG = col.g * 0.9;
          tintB = col.b * 0.7;
        } else if (config.color === 'cool') {
          tintR = col.r * 0.7;
          tintG = col.g * 0.9;
          tintB = Math.min(255, col.b * 1.3);
        } else if (config.color === 'neon') {
          tintR = Math.min(255, col.r * 1.4);
          tintG = Math.min(255, col.g * 1.2);
          tintB = Math.min(255, col.b * 1.4);
        } else if (config.color === 'custom' && config.customColor) {
          const parsed = hexToRgb(config.customColor);
          tintR = (col.r + parsed.r) / 2;
          tintG = (col.g + parsed.g) / 2;
          tintB = (col.b + parsed.b) / 2;
        }
        bloom[r][c] = { r: tintR, g: tintG, b: tintB };
      }
    }
  }

  // Step 2: Box blur the bloom map
  const blurred = boxBlur(bloom, radius);

  // Step 3: Additive blend bloom onto result
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      result[r][c] = {
        r: Math.min(255, Math.round(result[r][c].r + blurred[r][c].r * intensity)),
        g: Math.min(255, Math.round(result[r][c].g + blurred[r][c].g * intensity)),
        b: Math.min(255, Math.round(result[r][c].b + blurred[r][c].b * intensity))
      };
    }
  }

  return result;
}

function boxBlur(grid: RGB[][], radius: number): RGB[][] {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const temp: RGB[][] = Array(rows).fill(null).map(() =>
    Array(cols).fill(null).map(() => ({ r: 0, g: 0, b: 0 }))
  );
  const result: RGB[][] = Array(rows).fill(null).map(() =>
    Array(cols).fill(null).map(() => ({ r: 0, g: 0, b: 0 }))
  );

  // Horizontal pass
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sr = 0, sg = 0, sb = 0, count = 0;
      for (let dc = -radius; dc <= radius; dc++) {
        const nc = c + dc;
        if (nc >= 0 && nc < cols) {
          sr += grid[r][nc].r;
          sg += grid[r][nc].g;
          sb += grid[r][nc].b;
          count++;
        }
      }
      temp[r][c] = { r: sr / count, g: sg / count, b: sb / count };
    }
  }

  // Vertical pass
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let sr = 0, sg = 0, sb = 0, count = 0;
      for (let dr = -radius; dr <= radius; dr++) {
        const nr = r + dr;
        if (nr >= 0 && nr < rows) {
          sr += temp[nr][c].r;
          sg += temp[nr][c].g;
          sb += temp[nr][c].b;
          count++;
        }
      }
      result[r][c] = { r: sr / count, g: sg / count, b: sb / count };
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// 2. BACKGROUND REMOVAL (Luminance Threshold)
// ---------------------------------------------------------------------------

/**
 * Generates a binary foreground mask based on luminance thresholding.
 * Returns a 2D boolean array where `true` = foreground (keep), `false` = background (remove).
 */
export function generateBackgroundMask(
  colors: RGB[][],
  config: BackgroundRemovalConfig
): boolean[][] {
  const rows = colors.length;
  const cols = colors[0]?.length || 0;
  const mask: boolean[][] = Array(rows).fill(null).map(() => Array(cols).fill(false));

  if (!config.enabled) {
    // Return all-true mask (keep everything)
    return mask.map(row => row.map(() => true));
  }

  // Compute luminance for each cell
  const lumGrid: number[][] = [];
  let minLum = 255, maxLum = 0;

  for (let r = 0; r < rows; r++) {
    lumGrid[r] = [];
    for (let c = 0; c < cols; c++) {
      const col = colors[r][c];
      const lum = 0.299 * col.r + 0.587 * col.g + 0.114 * col.b;
      lumGrid[r][c] = lum;
      if (lum < minLum) minLum = lum;
      if (lum > maxLum) maxLum = lum;
    }
  }

  // Auto mode: detect whether background is dark or light
  let mode = config.mode;
  if (mode === 'auto') {
    // Sample corners and edges to determine background luminance
    const samples: number[] = [];
    const samplePositions = [
      [0, 0], [0, Math.floor(cols / 2)], [0, cols - 1],
      [Math.floor(rows / 2), 0], [Math.floor(rows / 2), cols - 1],
      [rows - 1, 0], [rows - 1, Math.floor(cols / 2)], [rows - 1, cols - 1]
    ];
    for (const [sr, sc] of samplePositions) {
      if (sr >= 0 && sr < rows && sc >= 0 && sc < cols) {
        samples.push(lumGrid[sr][sc]);
      }
    }
    const avgEdgeLum = samples.reduce((a, b) => a + b, 0) / (samples.length || 1);
    mode = avgEdgeLum < 128 ? 'dark' : 'light';
  }

  // Apply threshold
  const threshold = config.threshold;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lum = lumGrid[r][c];
      if (mode === 'dark') {
        // Dark background: keep pixels brighter than threshold
        mask[r][c] = lum > threshold;
      } else {
        // Light background: keep pixels darker than (255 - threshold)
        mask[r][c] = lum < (255 - threshold);
      }
    }
  }

  // Invert if requested
  if (config.invertMask) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        mask[r][c] = !mask[r][c];
      }
    }
  }

  // Edge refinement: dilate/erode to clean up edges
  if (config.edgeBlur > 0) {
    return refineMaskEdges(mask, config.edgeBlur);
  }

  return mask;
}

function refineMaskEdges(mask: boolean[][], radius: number): boolean[][] {
  const rows = mask.length;
  const cols = mask[0]?.length || 0;

  // Morphological closing (dilate then erode) to clean noise
  let working = mask.map(row => [...row]);

  // Dilate
  const dilated: boolean[][] = working.map(row => [...row]);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (working[r][c]) continue;
      let neighborCount = 0;
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && working[nr][nc]) {
            neighborCount++;
          }
        }
      }
      // If enough neighbors are foreground, include this pixel
      const kernelSize = (2 * radius + 1) * (2 * radius + 1);
      if (neighborCount > kernelSize * 0.3) {
        dilated[r][c] = true;
      }
    }
  }

  // Erode
  const eroded: boolean[][] = dilated.map(row => [...row]);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!dilated[r][c]) continue;
      let neighborCount = 0;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr, nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && dilated[nr][nc]) {
            neighborCount++;
          }
        }
      }
      if (neighborCount < 4) {
        eroded[r][c] = false;
      }
    }
  }

  return eroded;
}

/**
 * Apply background removal mask to the ASCII grid.
 * Replaces masked-out cells with replacement chars/colors.
 */
export function applyBackgroundMask(
  grid: string[][],
  colors: RGB[][],
  mask: boolean[][],
  config: BackgroundRemovalConfig
): { grid: string[][]; colors: RGB[][] } {
  const rows = grid.length;
  const cols = grid[0]?.length || 0;
  const outGrid = grid.map(row => [...row]);
  const outColors = colors.map(row => row.map(c => ({ ...c })));

  const replColor = hexToRgb(config.replacementColor);
  const gradColor2 = hexToRgb(config.gradientColor2);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!mask[r][c]) {
        // This is background — replace
        if (config.replacement === 'transparent') {
          outGrid[r][c] = ' ';
          outColors[r][c] = { r: 0, g: 0, b: 0 };
        } else if (config.replacement === 'solid') {
          outGrid[r][c] = '░';
          outColors[r][c] = replColor;
        } else if (config.replacement === 'gradient') {
          const pct = rows > 1 ? r / (rows - 1) : 0;
          outGrid[r][c] = '░';
          outColors[r][c] = {
            r: Math.round(replColor.r + (gradColor2.r - replColor.r) * pct),
            g: Math.round(replColor.g + (gradColor2.g - replColor.g) * pct),
            b: Math.round(replColor.b + (gradColor2.b - replColor.b) * pct)
          };
        }
      }
    }
  }

  return { grid: outGrid, colors: outColors };
}

// ---------------------------------------------------------------------------
// 3. PARTICLE SYSTEM
// ---------------------------------------------------------------------------

const PARTICLE_CHARS: Record<string, string[]> = {
  'rain':        ['|', '│', '┃', '╎'],
  'snow':        ['*', '❄', '·', '°', '✦'],
  'sparks':      ['✦', '✧', '*', '·', '°'],
  'fire':        ['▓', '▒', '░', '^', '~'],
  'smoke':       ['░', '▒', '·', '°', '~'],
  'stars':       ['✦', '✧', '*', '+', '·'],
  'matrix-rain': ['0', '1', 'ｦ', 'ｱ', 'ｲ', 'ｳ', 'ﾀ', 'ﾅ'],
  'glitch':      ['█', '▓', '▒', '░', '#', '%', '&']
};

const PARTICLE_COLORS: Record<string, RGB[]> = {
  'rain':        [{ r: 100, g: 160, b: 255 }, { r: 80, g: 140, b: 220 }],
  'snow':        [{ r: 220, g: 230, b: 255 }, { r: 200, g: 215, b: 240 }],
  'sparks':      [{ r: 255, g: 200, b: 50 }, { r: 255, g: 150, b: 20 }, { r: 255, g: 100, b: 0 }],
  'fire':        [{ r: 255, g: 80, b: 0 }, { r: 255, g: 180, b: 20 }, { r: 255, g: 255, b: 100 }],
  'smoke':       [{ r: 120, g: 120, b: 130 }, { r: 80, g: 80, b: 90 }],
  'stars':       [{ r: 255, g: 255, b: 200 }, { r: 200, g: 220, b: 255 }],
  'matrix-rain': [{ r: 0, g: 255, b: 70 }, { r: 0, g: 200, b: 50 }, { r: 0, g: 130, b: 30 }],
  'glitch':      [{ r: 255, g: 0, b: 100 }, { r: 0, g: 255, b: 200 }, { r: 255, g: 255, b: 0 }]
};

/**
 * Creates an initial particle array given grid dimensions and config.
 */
export function initParticles(
  cols: number,
  rows: number,
  config: ParticleConfig
): Particle[] {
  if (config.type === 'none') return [];

  const count = Math.floor((config.rate / 100) * cols * 1.5);
  const particles: Particle[] = [];
  const chars = PARTICLE_CHARS[config.type] || ['*'];

  for (let i = 0; i < count; i++) {
    particles.push(createParticle(cols, rows, config.type, chars));
  }

  return particles;
}

function createParticle(cols: number, rows: number, type: string, chars: string[]): Particle {
  const char = chars[Math.floor(Math.random() * chars.length)];
  const baseSpeed = 0.3;

  switch (type) {
    case 'rain':
      return {
        x: Math.random() * cols,
        y: -Math.random() * rows,
        vx: -0.05,
        vy: baseSpeed + Math.random() * 0.5,
        life: 0,
        maxLife: rows * 3,
        char,
        size: 1
      };
    case 'snow':
      return {
        x: Math.random() * cols,
        y: -Math.random() * rows,
        vx: (Math.random() - 0.5) * 0.15,
        vy: baseSpeed * 0.4 + Math.random() * 0.15,
        life: 0,
        maxLife: rows * 5,
        char,
        size: 1
      };
    case 'sparks':
    case 'fire':
      return {
        x: Math.random() * cols,
        y: rows + Math.random() * 5,
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(baseSpeed * 0.5 + Math.random() * 0.3),
        life: 0,
        maxLife: rows * 2,
        char,
        size: 1
      };
    case 'smoke':
      return {
        x: cols / 2 + (Math.random() - 0.5) * cols * 0.3,
        y: rows,
        vx: (Math.random() - 0.5) * 0.1,
        vy: -(baseSpeed * 0.3 + Math.random() * 0.1),
        life: 0,
        maxLife: rows * 4,
        char,
        size: 1
      };
    case 'stars':
      return {
        x: Math.random() * cols,
        y: Math.random() * rows,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 60 + Math.random() * 120,
        char,
        size: 1
      };
    case 'matrix-rain':
      return {
        x: Math.floor(Math.random() * cols),
        y: -Math.random() * rows,
        vx: 0,
        vy: baseSpeed + Math.random() * 0.4,
        life: 0,
        maxLife: rows * 3,
        char,
        size: Math.floor(3 + Math.random() * 8)
      };
    case 'glitch':
      return {
        x: Math.random() * cols,
        y: Math.random() * rows,
        vx: (Math.random() - 0.5) * 2,
        vy: 0,
        life: 0,
        maxLife: 10 + Math.random() * 20,
        char,
        size: Math.floor(2 + Math.random() * 8)
      };
    default:
      return {
        x: Math.random() * cols,
        y: Math.random() * rows,
        vx: 0, vy: 0.2,
        life: 0, maxLife: 100,
        char, size: 1
      };
  }
}

/**
 * Advance particle simulation by one tick.
 * Returns updated particle array.
 */
export function tickParticles(
  particles: Particle[],
  cols: number,
  rows: number,
  config: ParticleConfig
): Particle[] {
  if (config.type === 'none') return [];

  const speedMult = config.speed / 50; // normalized: 50 = 1x
  const chars = PARTICLE_CHARS[config.type] || ['*'];
  const result: Particle[] = [];

  for (const p of particles) {
    const updated = { ...p };
    updated.x += updated.vx * speedMult;
    updated.y += updated.vy * speedMult;
    updated.life++;

    // Randomize char for glitch/matrix effect
    if (config.type === 'glitch' || config.type === 'matrix-rain') {
      if (Math.random() > 0.7) {
        updated.char = chars[Math.floor(Math.random() * chars.length)];
      }
    }

    // Twinkling for stars
    if (config.type === 'stars') {
      if (updated.life > updated.maxLife) {
        // Respawn
        result.push(createParticle(cols, rows, config.type, chars));
        continue;
      }
    }

    // Check bounds / life
    if (updated.life > updated.maxLife ||
        updated.y > rows + 5 ||
        updated.y < -rows ||
        updated.x < -5 ||
        updated.x > cols + 5) {
      // Respawn
      result.push(createParticle(cols, rows, config.type, chars));
    } else {
      result.push(updated);
    }
  }

  return result;
}

/**
 * Render particles onto a canvas context on top of the existing ASCII render.
 */
export function renderParticles(
  ctx: CanvasRenderingContext2D,
  particles: Particle[],
  config: ParticleConfig,
  charWidth: number,
  charHeight: number
) {
  if (config.type === 'none' || particles.length === 0) return;

  const typeColors = config.color === 'custom' && config.customColor
    ? [hexToRgb(config.customColor)]
    : PARTICLE_COLORS[config.type] || [{ r: 255, g: 255, b: 255 }];

  for (const p of particles) {
    const col = typeColors[Math.floor(Math.random() * typeColors.length)];
    const fadeFactor = config.type === 'stars'
      ? Math.abs(Math.sin((p.life / p.maxLife) * Math.PI))  // pulse
      : Math.max(0, 1 - p.life / p.maxLife);                // fade out

    const alpha = Math.max(0.1, fadeFactor);

    ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${alpha})`;
    const px = p.x * charWidth;
    const py = p.y * charHeight;

    if (config.type === 'matrix-rain') {
      // Draw a trail of chars
      for (let i = 0; i < p.size; i++) {
        const trailAlpha = alpha * (1 - i / p.size);
        ctx.fillStyle = `rgba(${col.r}, ${col.g}, ${col.b}, ${trailAlpha})`;
        const trailChar = PARTICLE_CHARS['matrix-rain'][Math.floor(Math.random() * PARTICLE_CHARS['matrix-rain'].length)];
        ctx.fillText(trailChar, px, py - i * charHeight);
      }
    } else if (config.type === 'glitch') {
      // Draw horizontal glitch bar
      ctx.fillRect(px, py, p.size * charWidth, charHeight * 0.6);
    } else {
      ctx.fillText(p.char, px, py);
    }
  }
}

// ---------------------------------------------------------------------------
// 4. COLOR GRADING ENGINE
// ---------------------------------------------------------------------------

/**
 * Applies color grading to the entire color grid.
 * Operations: temperature, tint, vibrance, HSL adjustments.
 */
export function applyColorGrading(
  colors: RGB[][],
  config: ColorGradingConfig
): RGB[][] {
  const rows = colors.length;
  const cols = colors[0]?.length || 0;

  const isNeutral = config.temperature === 0 && config.tint === 0 &&
    config.vibrance === 0 && config.hueShift === 0 &&
    config.saturation === 0 && config.lightness === 0;

  if (isNeutral) return colors;

  const result: RGB[][] = Array(rows).fill(null).map(() => Array(cols).fill(null).map(() => ({ r: 0, g: 0, b: 0 })));

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      let col = { ...colors[r][c] };

      // Temperature (shift R/B balance)
      if (config.temperature !== 0) {
        const t = config.temperature / 100;
        col.r = clamp(col.r + t * 40);
        col.b = clamp(col.b - t * 40);
      }

      // Tint (shift G/M balance)
      if (config.tint !== 0) {
        const t = config.tint / 100;
        col.g = clamp(col.g - t * 30);
        col.r = clamp(col.r + t * 15);
        col.b = clamp(col.b + t * 15);
      }

      // Convert to HSL for hue/sat/lightness adjustments
      let [h, s, l] = rgbToHsl(col.r, col.g, col.b);

      // Hue shift
      if (config.hueShift !== 0) {
        h = (h + config.hueShift) % 360;
        if (h < 0) h += 360;
      }

      // Saturation
      if (config.saturation !== 0) {
        s = clamp01(s + config.saturation / 200);
      }

      // Vibrance (boost low-saturation colors more than already-saturated ones)
      if (config.vibrance !== 0) {
        const vibranceAmount = config.vibrance / 100;
        const boost = vibranceAmount * (1 - s); // More boost for less saturated
        s = clamp01(s + boost * 0.5);
      }

      // Lightness
      if (config.lightness !== 0) {
        l = clamp01(l + config.lightness / 200);
      }

      const [nr, ng, nb] = hslToRgb(h, s, l);
      result[r][c] = { r: nr, g: ng, b: nb };
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// 5. POST-PROCESSING OVERLAYS (Canvas-level)
// ---------------------------------------------------------------------------

/**
 * Apply CRT scanline effect directly to the canvas.
 */
export function applyCrtScanlines(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number
) {
  const alpha = (intensity / 100) * 0.35;
  ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;

  for (let y = 0; y < height; y += 3) {
    ctx.fillRect(0, y, width, 1);
  }

  // Subtle horizontal line distortion
  ctx.fillStyle = `rgba(0, 255, 100, ${alpha * 0.15})`;
  for (let y = 1; y < height; y += 6) {
    ctx.fillRect(0, y, width, 1);
  }
}

/**
 * Apply vignette darkening to canvas edges.
 */
export function applyVignette(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number
) {
  const cx = width / 2;
  const cy = height / 2;
  const maxRadius = Math.sqrt(cx * cx + cy * cy);
  const alpha = (intensity / 100) * 0.8;

  const gradient = ctx.createRadialGradient(cx, cy, maxRadius * 0.4, cx, cy, maxRadius);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(0.7, `rgba(0, 0, 0, ${alpha * 0.3})`);
  gradient.addColorStop(1, `rgba(0, 0, 0, ${alpha})`);

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Apply film grain noise to canvas.
 */
export function applyFilmGrain(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number
) {
  const alpha = (intensity / 100) * 0.15;
  const step = 3; // Sample every N pixels for performance

  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      const val = Math.floor(Math.random() * 255);
      ctx.fillStyle = `rgba(${val}, ${val}, ${val}, ${alpha})`;
      ctx.fillRect(x, y, step, step);
    }
  }
}

/**
 * Apply chromatic aberration by re-drawing offset color channels.
 * This is applied at the canvas pixel level for realistic effect.
 */
export function applyChromaticAberration(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  offset: number
) {
  if (offset <= 0) return;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;
  const copy = new Uint8ClampedArray(data);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;

      // Shift red channel left
      const redSrcX = Math.min(width - 1, x + offset);
      const redIdx = (y * width + redSrcX) * 4;
      data[idx] = copy[redIdx]; // R from shifted position

      // Shift blue channel right
      const blueSrcX = Math.max(0, x - offset);
      const blueIdx = (y * width + blueSrcX) * 4;
      data[idx + 2] = copy[blueIdx + 2]; // B from shifted position

      // Green stays in place
    }
  }

  ctx.putImageData(imageData, 0, 0);
}

// ---------------------------------------------------------------------------
// HELPER UTILITIES
// ---------------------------------------------------------------------------

function hexToRgb(hex: string): RGB {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function clamp(val: number, min = 0, max = 255): number {
  return Math.max(min, Math.min(max, Math.round(val)));
}

function clamp01(val: number): number {
  return Math.max(0, Math.min(1, val));
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) * 60; break;
      case g: h = ((b - r) / d + 2) * 60; break;
      case b: h = ((r - g) / d + 4) * 60; break;
    }
  }
  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };

    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h / 360 + 1 / 3);
    g = hue2rgb(p, q, h / 360);
    b = hue2rgb(p, q, h / 360 - 1 / 3);
  }

  return [clamp(r * 255), clamp(g * 255), clamp(b * 255)];
}

// Default configs
export const DEFAULT_GLOW_CONFIG: GlowConfig = {
  enabled: false,
  radius: 3,
  intensity: 50,
  threshold: 150,
  color: 'auto'
};

export const DEFAULT_BG_REMOVAL_CONFIG: BackgroundRemovalConfig = {
  enabled: false,
  threshold: 40,
  edgeBlur: 2,
  mode: 'auto',
  replacement: 'transparent',
  replacementColor: '#080e1a',
  gradientColor2: '#1a0530',
  invertMask: false
};

export const DEFAULT_PARTICLE_CONFIG: ParticleConfig = {
  type: 'none',
  rate: 40,
  speed: 50,
  color: 'auto'
};

export const DEFAULT_COLOR_GRADING_CONFIG: ColorGradingConfig = {
  temperature: 0,
  tint: 0,
  vibrance: 0,
  hueShift: 0,
  saturation: 0,
  lightness: 0
};

export const DEFAULT_POST_PROCESS_CONFIG: PostProcessConfig = {
  crtScanlines: false,
  crtIntensity: 50,
  vignette: false,
  vignetteIntensity: 50,
  filmGrain: false,
  grainIntensity: 30,
  chromaticAberration: false,
  aberrationOffset: 2
};
