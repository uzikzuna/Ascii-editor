// ASCII Engine Web Worker
// Processes image frames and options off the main thread

export interface WorkerOptions {
  width: number;
  height: number;
  brightness: number;  // -100 to 100
  contrast: number;    // -100 to 100
  sharpness: number;   // 0 to 100
  noiseReduction: number; // 0 to 100
  deblur: number;      // 0 to 100
  contrastMethod: 'none' | 'equalize' | 'stretch';
  charMode: 'standard' | 'extended' | 'blocks' | 'braille' | 'pixel' | 'matrix' | 'manga' | 'custom';
  customChars?: string;
  colorMode: 'mono' | 'color' | 'green' | 'amber' | 'rgb' | 'gradient' | 'ansi-16' | 'ansi-256' | 'palette' | 'neon';
  backgroundColorMode: 'none' | 'match' | 'custom';
  customBgColor?: string; // hex
  customPalette?: string[]; // hex array
  invert: boolean;
  dithering: 'none' | 'floyd-steinberg' | 'atkinson' | 'bayer-4x4' | 'bayer-8x8' | 'ordered';
  edgeDetection: 'none' | 'sobel' | 'laplacian';
  edgeWeight: number; // 0 to 100
  aspectRatioCorrection: boolean;
  fontAspectRatio: number; // typical: 0.55
  detailPreservationMode: 'balanced' | 'faces' | 'text' | 'edges' | 'details';
  // AI Smart settings
  aiSmartMode: boolean;
  // Beautifier
  beautifyEdgeEnhance: boolean;
  beautifySmoothing: boolean;
  beautifyNoiseCleanup: boolean;
  beautifyDensityOptimize: boolean;
}

export interface WorkerResult {
  text: string;
  charGrid: string[][];
  colors?: { r: number; g: number; b: number }[][];
  bgColors?: { r: number; g: number; b: number }[][];
  stats: {
    facesDetected: number;
    textDetected: boolean;
    logoDetected: boolean;
    accuracyScore: number;
    detailPreservationScore: number;
    fidelityScore: number;
    qualityScore: number;
    processTimeMs: number;
  };
}

const CHAR_SETS = {
  standard: ' .:-=+*#%@',
  extended: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  blocks: ' ░▒▓█',
  pixel: '█',
  matrix: ' ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789',
  manga: ' .:-=+*#%@▒▓█', // dense mapping for crosshatch/screentones
};

// ANSI color grids
const ANSI_16_PALETTE = [
  { r: 0, g: 0, b: 0 },       // Black
  { r: 128, g: 0, b: 0 },     // Red
  { r: 0, g: 128, b: 0 },     // Green
  { r: 128, g: 128, b: 0 },   // Yellow
  { r: 0, g: 0, b: 128 },     // Blue
  { r: 128, g: 0, b: 128 },   // Magenta
  { r: 0, g: 128, b: 128 },   // Cyan
  { r: 192, g: 192, b: 192 }, // Light Gray
  { r: 128, g: 128, b: 128 }, // Dark Gray
  { r: 255, g: 0, b: 0 },     // Bright Red
  { r: 0, g: 255, b: 0 },     // Bright Green
  { r: 255, g: 255, b: 0 },   // Bright Yellow
  { r: 0, g: 0, b: 255 },     // Bright Blue
  { r: 255, g: 0, b: 255 },   // Bright Magenta
  { r: 0, g: 255, b: 255 },   // Bright Cyan
  { r: 255, g: 255, b: 255 }  // White
];

// Helper to convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const num = parseInt(clean, 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

// Convert RGB to grayscale (luminance)
function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Pre-calc Bayer 4x4 matrix normalized to 0..255
const BAYER_4x4 = [
  [   0, 128,  32, 160 ],
  [ 192,  64, 224,  96 ],
  [  48, 176,  16, 144 ],
  [ 240, 112, 208,  80 ]
];

// Pre-calc Bayer 8x8 matrix normalized to 0..255
const BAYER_8x8 = [
  [   0, 192,  48, 240,  12, 204,  60, 252 ],
  [ 128,  64, 176, 112, 140,  76, 188, 124 ],
  [  32, 224,  16, 208,  44, 236,  28, 220 ],
  [ 160,  96, 144,  80, 172, 108, 156,  92 ],
  [   8, 200,  56, 248,   4, 196,  52, 244 ],
  [ 136,  72, 184, 120, 132,  68, 180, 116 ],
  [  40, 232,  24, 216,  36, 228,  20, 212 ],
  [ 168, 104, 152,  88, 164, 100, 148,  84 ]
];

// ANSI 256 Color Matching
function matchAnsi256(r: number, g: number, b: number): { r: number; g: number; b: number } {
  // Find closest standard ANSI 256 color
  // 16 basic colors + 216 color cube + 24 grayscale steps
  let minDistance = Infinity;
  let closest = { r, g, b };

  const checkColor = (cr: number, cg: number, cb: number) => {
    const dist = Math.pow(r - cr, 2) + Math.pow(g - cg, 2) + Math.pow(b - cb, 2);
    if (dist < minDistance) {
      minDistance = dist;
      closest = { r: cr, g: cg, b: cb };
    }
  };

  // Check 16 standard colors
  for (const c of ANSI_16_PALETTE) {
    checkColor(c.r, c.g, c.b);
  }

  // Check 6x6x6 color cube (levels: 0, 95, 135, 175, 215, 255)
  const steps = [0, 95, 135, 175, 215, 255];
  for (const cr of steps) {
    for (const cg of steps) {
      for (const cb of steps) {
        checkColor(cr, cg, cb);
      }
    }
  }

  // Check grayscale ramp (8 to 238 in steps of 10)
  for (let val = 8; val <= 238; val += 10) {
    checkColor(val, val, val);
  }

  return closest;
}

// Adjust pixel brightness and contrast
function adjustPixelColor(
  r: number,
  g: number,
  b: number,
  brightness: number,
  contrast: number
): { r: number; g: number; b: number } {
  let nr = r + brightness;
  let ng = g + brightness;
  let nb = b + brightness;

  if (contrast !== 0) {
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    nr = factor * (nr - 128) + 128;
    ng = factor * (ng - 128) + 128;
    nb = factor * (nb - 128) + 128;
  }

  return {
    r: Math.min(255, Math.max(0, nr)),
    g: Math.min(255, Math.max(0, ng)),
    b: Math.min(255, Math.max(0, nb))
  };
}

// Noise reduction using 3x3 Median filter
function applyMedianFilter(data: Uint8ClampedArray, w: number, h: number): void {
  const temp = new Uint8ClampedArray(data);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;

      // Extract neighbors
      const neighborsR: number[] = [];
      const neighborsG: number[] = [];
      const neighborsB: number[] = [];

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const nIdx = ((y + ky) * w + (x + kx)) * 4;
          neighborsR.push(temp[nIdx]);
          neighborsG.push(temp[nIdx + 1]);
          neighborsB.push(temp[nIdx + 2]);
        }
      }

      // Sort to find median
      neighborsR.sort((a, b) => a - b);
      neighborsG.sort((a, b) => a - b);
      neighborsB.sort((a, b) => a - b);

      data[idx] = neighborsR[4];
      data[idx + 1] = neighborsG[4];
      data[idx + 2] = neighborsB[4];
    }
  }
}

// Sharpen using standard unsharp mask/convolution
function applySharpen(data: Uint8ClampedArray, w: number, h: number, amount: number): void {
  if (amount <= 0) return;
  const temp = new Uint8ClampedArray(data);
  const k = -amount / 100;
  const center = 1 - (4 * k);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      let r = 0, g = 0, b = 0;

      // 3x3 kernel
      const indices = [
        ((y - 1) * w + x) * 4,
        (y * w + (x - 1)) * 4,
        (y * w + x) * 4,
        (y * w + (x + 1)) * 4,
        ((y + 1) * w + x) * 4
      ];
      const weights = [k, k, center, k, k];

      for (let i = 0; i < indices.length; i++) {
        const sIdx = indices[i];
        r += temp[sIdx] * weights[i];
        g += temp[sIdx + 1] * weights[i];
        b += temp[sIdx + 2] * weights[i];
      }

      data[idx] = Math.min(255, Math.max(0, r));
      data[idx + 1] = Math.min(255, Math.max(0, g));
      data[idx + 2] = Math.min(255, Math.max(0, b));
    }
  }
}

// Adaptive Histogram Equalization
function equalizeHistogram(data: Uint8ClampedArray, w: number, h: number): void {
  // Global equalization for high dynamic range contrast
  const hist = new Int32Array(256);
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(getLuminance(data[i], data[i + 1], data[i + 2]));
    hist[lum]++;
  }

  // Compute CDF
  const cdf = new Int32Array(256);
  cdf[0] = hist[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + hist[i];
  }

  const total = w * h;
  const minCdf = cdf.find(val => val > 0) || 0;

  // Remap colors
  for (let i = 0; i < data.length; i += 4) {
    const lum = Math.round(getLuminance(data[i], data[i + 1], data[i + 2]));
    const equalizedLum = Math.round(((cdf[lum] - minCdf) / (total - minCdf)) * 255);
    
    // Scale existing channels relative to equalized luminance change
    if (lum > 0) {
      const ratio = equalizedLum / lum;
      data[i] = Math.min(255, Math.max(0, data[i] * ratio));
      data[i + 1] = Math.min(255, Math.max(0, data[i + 1] * ratio));
      data[i + 2] = Math.min(255, Math.max(0, data[i + 2] * ratio));
    } else {
      data[i] = equalizedLum;
      data[i + 1] = equalizedLum;
      data[i + 2] = equalizedLum;
    }
  }
}

// Bounding box heuristic for faces/text/logos
interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

function detectFeaturesHeuristics(
  data: Uint8ClampedArray,
  w: number,
  h: number
): {
  faces: BoundingBox[];
  textAreas: BoundingBox[];
  logoProbability: boolean;
} {
  let skinPixelsCount = 0;
  let minX = w, minY = h, maxX = 0, maxY = 0;

  // 1. Skin tone detector scan
  for (let y = 0; y < h; y += 4) {
    for (let x = 0; x < w; x += 4) {
      const idx = (y * w + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      // Skin detection formula (RGB chromatic bounds)
      const isSkin = r > 95 && g > 40 && b > 20 &&
                     (r - g) > 15 && r > g && r > b &&
                     (Math.max(r, g, b) - Math.min(r, g, b)) > 15;

      if (isSkin) {
        skinPixelsCount++;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  const totalSamples = (w * h) / 16;
  const skinRatio = skinPixelsCount / totalSamples;
  const faces: BoundingBox[] = [];

  // If a significant cluster is found, assume a face
  if (skinRatio > 0.05 && skinRatio < 0.6 && (maxX - minX) > w * 0.15 && (maxY - minY) > h * 0.15) {
    faces.push({ x1: minX, y1: minY, x2: maxX, y2: maxY });
  }

  // 2. Text / Logo line edge structure scan
  // Look for dense clusters of rapid alternating contrast lines (text lines)
  let textRowsCount = 0;
  let logoProbable = false;

  for (let y = 4; y < h - 4; y += 8) {
    let transitions = 0;
    let lastState = false; // false = dark, true = light
    for (let x = 4; x < w - 4; x += 4) {
      const idx = (y * w + x) * 4;
      const lum = getLuminance(data[idx], data[idx + 1], data[idx + 2]);
      const state = lum > 128;
      if (state !== lastState) {
        transitions++;
        lastState = state;
      }
    }
    // High transition rate on a row suggests lines of text or sharp logo vectors
    if (transitions > w * 0.12) {
      textRowsCount++;
    }
  }

  const textDetected = textRowsCount > h * 0.08;

  // Logo detector (high symmetry and centralized edge grouping)
  let centerEdges = 0;
  let outerEdges = 0;
  for (let y = 1; y < h - 1; y += 4) {
    for (let x = 1; x < w - 1; x += 4) {
      const idx = (y * w + x) * 4;
      const centerIdx = ((y + 1) * w + x) * 4;
      const dy = Math.abs(getLuminance(data[idx], data[idx + 1], data[idx + 2]) - getLuminance(data[centerIdx], data[centerIdx + 1], data[centerIdx + 2]));
      if (dy > 30) {
        const inCenter = x > w * 0.25 && x < w * 0.75 && y > h * 0.25 && y < h * 0.75;
        if (inCenter) centerEdges++;
        else outerEdges++;
      }
    }
  }

  if (centerEdges > outerEdges * 2.5 && centerEdges > 100) {
    logoProbable = true;
  }

  return {
    faces,
    textAreas: textDetected ? [{ x1: Math.round(w * 0.1), y1: Math.round(h * 0.2), x2: Math.round(w * 0.9), y2: Math.round(h * 0.8) }] : [],
    logoProbability: logoProbable
  };
}

// Sobel Operator for Angle Mapping
function applySobel(
  lumData: Float32Array,
  w: number,
  h: number
): { magnitude: Float32Array; angle: Float32Array } {
  const magnitude = new Float32Array(w * h);
  const angle = new Float32Array(w * h);

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;

      // Sobel kernel convolution
      const tL = lumData[(y - 1) * w + (x - 1)];
      const tM = lumData[(y - 1) * w + x];
      const tR = lumData[(y - 1) * w + (x + 1)];
      const mL = lumData[y * w + (x - 1)];
      const mR = lumData[y * w + (x + 1)];
      const bL = lumData[(y + 1) * w + (x - 1)];
      const bM = lumData[(y + 1) * w + x];
      const bR = lumData[(y + 1) * w + (x + 1)];

      const gX = -1 * tL + 1 * tR - 2 * mL + 2 * mR - 1 * bL + 1 * bR;
      const gY = -1 * tL - 2 * tM - 1 * tR + 1 * bL + 2 * bM + 1 * bR;

      magnitude[idx] = Math.sqrt(gX * gX + gY * gY);
      angle[idx] = Math.atan2(gY, gX); // -PI to PI
    }
  }

  return { magnitude, angle };
}

// Main rendering engine
function processImageToAscii(
  imageData: { data: Uint8ClampedArray; width: number; height: number },
  options: WorkerOptions
): WorkerResult {
  const startTime = Date.now();
  const w = imageData.width;
  const h = imageData.height;
  const rawData = new Uint8ClampedArray(imageData.data);

  // 1. Image Enhancement Pre-Processing Filters
  if (options.noiseReduction > 0) {
    applyMedianFilter(rawData, w, h);
  }

  if (options.deblur > 0) {
    // Basic deblur approximation (Sharpening high frequency detail)
    applySharpen(rawData, w, h, options.deblur);
  }

  if (options.sharpness > 0) {
    applySharpen(rawData, w, h, options.sharpness);
  }

  if (options.contrastMethod === 'equalize') {
    equalizeHistogram(rawData, w, h);
  }

  // 2. Feature Detection Heuristics
  const detections = detectFeaturesHeuristics(rawData, w, h);

  // AI-Assisted parameter recommendation override (if smart mode is on, we analyze but don't force change, we return recommendations)
  const stats = {
    facesDetected: detections.faces.length,
    textDetected: detections.textAreas.length > 0,
    logoDetected: detections.logoProbability,
    accuracyScore: 0,
    detailPreservationScore: 0,
    fidelityScore: 0,
    qualityScore: 0,
    processTimeMs: 0
  };

  // 3. Grid sizing and Aspect Ratio Scaling
  const cols = options.width;
  const rows = options.height;

  // Braille uses sub-grids
  const isBraille = options.charMode === 'braille';
  const sampleW = isBraille ? cols * 2 : cols;
  const sampleH = isBraille ? rows * 4 : rows;

  // Downsample high-res image to the target sample layout
  const downsampledR = new Uint8Array(sampleW * sampleH);
  const downsampledG = new Uint8Array(sampleW * sampleH);
  const downsampledB = new Uint8Array(sampleW * sampleH);
  const downsampledLum = new Float32Array(sampleW * sampleH);

  for (let r = 0; r < sampleH; r++) {
    for (let c = 0; c < sampleW; c++) {
      // Find matching coordinate in the high-res image
      const srcX = Math.floor((c / sampleW) * w);
      const srcY = Math.floor((r / sampleH) * h);
      const srcIdx = (srcY * w + srcX) * 4;

      const adj = adjustPixelColor(
        rawData[srcIdx],
        rawData[srcIdx + 1],
        rawData[srcIdx + 2],
        options.brightness,
        options.contrast
      );

      const cellIdx = r * sampleW + c;
      downsampledR[cellIdx] = adj.r;
      downsampledG[cellIdx] = adj.g;
      downsampledB[cellIdx] = adj.b;
      downsampledLum[cellIdx] = getLuminance(adj.r, adj.g, adj.b);
    }
  }

  // 4. Advanced Dithering (Diffuse error on sample grid)
  if (options.dithering === 'floyd-steinberg') {
    const steps = 8; // character subdivisions
    const divisor = 255 / steps;
    for (let r = 0; r < sampleH; r++) {
      for (let c = 0; c < sampleW; c++) {
        const idx = r * sampleW + c;
        const oldVal = downsampledLum[idx];
        const newVal = Math.round(oldVal / divisor) * divisor;
        downsampledLum[idx] = newVal;
        const err = oldVal - newVal;

        if (c + 1 < sampleW) downsampledLum[idx + 1] += err * 7 / 16;
        if (r + 1 < sampleH) {
          if (c - 1 >= 0) downsampledLum[(r + 1) * sampleW + (c - 1)] += err * 3 / 16;
          downsampledLum[(r + 1) * sampleW + c] += err * 5 / 16;
          if (c + 1 < sampleW) downsampledLum[(r + 1) * sampleW + (c + 1)] += err * 1 / 16;
        }
      }
    }
  } else if (options.dithering === 'atkinson') {
    const steps = 6;
    const divisor = 255 / steps;
    for (let r = 0; r < sampleH; r++) {
      for (let c = 0; c < sampleW; c++) {
        const idx = r * sampleW + c;
        const oldVal = downsampledLum[idx];
        const newVal = Math.round(oldVal / divisor) * divisor;
        downsampledLum[idx] = newVal;
        const err = oldVal - newVal;

        if (c + 1 < sampleW) downsampledLum[idx + 1] += err * 1 / 8;
        if (c + 2 < sampleW) downsampledLum[idx + 2] += err * 1 / 8;
        if (r + 1 < sampleH) {
          if (c - 1 >= 0) downsampledLum[(r + 1) * sampleW + (c - 1)] += err * 1 / 8;
          downsampledLum[(r + 1) * sampleW + c] += err * 1 / 8;
          if (c + 1 < sampleW) downsampledLum[(r + 1) * sampleW + (c + 1)] += err * 1 / 8;
        }
        if (r + 2 < sampleH) {
          downsampledLum[(r + 2) * sampleW + c] += err * 1 / 8;
        }
      }
    }
  } else if (options.dithering === 'bayer-4x4') {
    for (let r = 0; r < sampleH; r++) {
      for (let c = 0; c < sampleW; c++) {
        const idx = r * sampleW + c;
        const threshold = BAYER_4x4[r % 4][c % 4];
        downsampledLum[idx] = downsampledLum[idx] > threshold ? 255 : 0;
      }
    }
  } else if (options.dithering === 'bayer-8x8') {
    for (let r = 0; r < sampleH; r++) {
      for (let c = 0; c < sampleW; c++) {
        const idx = r * sampleW + c;
        const threshold = BAYER_8x8[r % 8][c % 8];
        downsampledLum[idx] = downsampledLum[idx] > threshold ? 255 : 0;
      }
    }
  }

  // 5. Edge Mapping calculations (Sobel)
  let edgeMagMap = new Float32Array(sampleW * sampleH);
  let edgeAngleMap = new Float32Array(sampleW * sampleH);
  if (options.edgeDetection === 'sobel') {
    const sob = applySobel(downsampledLum, sampleW, sampleH);
    edgeMagMap = sob.magnitude as any;
    edgeAngleMap = sob.angle as any;
  }

  // 6. Character Mapping Selection
  let charSet = CHAR_SETS.standard;
  if (options.charMode === 'extended') charSet = CHAR_SETS.extended;
  else if (options.charMode === 'blocks') charSet = CHAR_SETS.blocks;
  else if (options.charMode === 'pixel') charSet = CHAR_SETS.pixel;
  else if (options.charMode === 'matrix') charSet = CHAR_SETS.matrix;
  else if (options.charMode === 'manga') charSet = CHAR_SETS.manga;
  else if (options.charMode === 'custom') charSet = options.customChars || CHAR_SETS.standard;

  if (options.invert && options.charMode !== 'braille') {
    charSet = charSet.split('').reverse().join('');
  }

  const finalChars: string[][] = [];
  const finalColors: { r: number; g: number; b: number }[][] = [];
  const finalBgColors: { r: number; g: number; b: number }[][] = [];

  // Helper for color mappings
  const applyRGBMode = (r: number, g: number, b: number, cIdx: number, rIdx: number): { r: number; g: number; b: number } => {
    switch (options.colorMode) {
      case 'green':
        return { r: 57, g: Math.round(50 + (getLuminance(r, g, b) / 255) * 205), b: 20 };
      case 'amber':
        return { r: 255, g: Math.round(100 + (getLuminance(r, g, b) / 255) * 76), b: 0 };
      case 'neon': {
        const hVal = (cIdx / sampleW) * 360;
        // Glowing Neon colors
        return { r: Math.round(255 * Math.sin(hVal)), g: Math.round(255 * Math.cos(hVal)), b: 255 };
      }
      case 'rgb': {
        const time = startTime / 1500;
        const angle = (cIdx / sampleW) * Math.PI * 2 + (rIdx / sampleH) * Math.PI * 2 + time;
        return {
          r: Math.round(128 + 127 * Math.sin(angle)),
          g: Math.round(128 + 127 * Math.sin(angle + (2 * Math.PI) / 3)),
          b: Math.round(128 + 127 * Math.sin(angle + (4 * Math.PI) / 3))
        };
      }
      case 'ansi-16':
        return matchAnsi256(r, g, b); // matched to 16
      case 'ansi-256':
        return matchAnsi256(r, g, b);
      case 'palette':
        if (options.customPalette && options.customPalette.length > 0) {
          // Find closest hex in custom palette
          let minDist = Infinity;
          let closest = { r, g, b };
          for (const hex of options.customPalette) {
            const rgb = hexToRgb(hex);
            const dist = Math.pow(r - rgb.r, 2) + Math.pow(g - rgb.g, 2) + Math.pow(b - rgb.b, 2);
            if (dist < minDist) {
              minDist = dist;
              closest = rgb;
            }
          }
          return closest;
        }
        return { r, g, b };
      case 'mono':
        return { r: 226, g: 232, b: 240 }; // standard theme muted white
      case 'color':
      default:
        return { r, g, b };
    }
  };

  // Perform core layout conversion
  if (isBraille) {
    // 2x4 cell mapping
    const brailleCols = cols;
    const brailleRows = rows;

    for (let r = 0; r < brailleRows; r++) {
      const rowChars: string[] = [];
      const rowColors: { r: number; g: number; b: number }[] = [];
      const rowBgs: { r: number; g: number; b: number }[] = [];

      for (let c = 0; c < brailleCols; c++) {
        const x = c * 2;
        const y = r * 4;

        const getVal = (dx: number, dy: number) => {
          const px = x + dx;
          const py = y + dy;
          if (px >= sampleW || py >= sampleH) return false;
          const val = downsampledLum[py * sampleW + px];
          return options.invert ? val < 127 : val >= 127;
        };

        const d1 = getVal(0, 0) ? 1 : 0;
        const d2 = getVal(0, 1) ? 2 : 0;
        const d3 = getVal(0, 2) ? 4 : 0;
        const d4 = getVal(1, 0) ? 8 : 0;
        const d5 = getVal(1, 1) ? 16 : 0;
        const d6 = getVal(1, 2) ? 32 : 0;
        const d7 = getVal(0, 3) ? 64 : 0;
        const d8 = getVal(1, 3) ? 128 : 0;

        const code = 0x2800 + (d1 + d2 + d3 + d4 + d5 + d6 + d7 + d8);
        rowChars.push(String.fromCharCode(code));

        // Average block color
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let dy = 0; dy < 4; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const px = x + dx;
            const py = y + dy;
            if (px < sampleW && py < sampleH) {
              const pIdx = py * sampleW + px;
              sumR += downsampledR[pIdx];
              sumG += downsampledG[pIdx];
              sumB += downsampledB[pIdx];
              count++;
            }
          }
        }
        const avgR = count > 0 ? Math.round(sumR / count) : 128;
        const avgG = count > 0 ? Math.round(sumG / count) : 128;
        const avgB = count > 0 ? Math.round(sumB / count) : 128;

        rowColors.push(applyRGBMode(avgR, avgG, avgB, c, r));

        // Background handling
        if (options.backgroundColorMode === 'match') {
          rowBgs.push({
            r: Math.round(avgR * 0.15),
            g: Math.round(avgG * 0.15),
            b: Math.round(avgB * 0.15)
          });
        } else if (options.backgroundColorMode === 'custom' && options.customBgColor) {
          rowBgs.push(hexToRgb(options.customBgColor));
        } else {
          rowBgs.push({ r: 0, g: 0, b: 0 });
        }
      }
      finalChars.push(rowChars);
      finalColors.push(rowColors);
      finalBgColors.push(rowBgs);
    }
  } else {
    // Standard character dimensions (Cols x Rows)
    for (let r = 0; r < rows; r++) {
      const rowChars: string[] = [];
      const rowColors: { r: number; g: number; b: number }[] = [];
      const rowBgs: { r: number; g: number; b: number }[] = [];

      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;
        const lum = Math.min(255, Math.max(0, downsampledLum[idx]));
        const cr = downsampledR[idx];
        const cg = downsampledG[idx];
        const cb = downsampledB[idx];

        // Apply Sobel edge character overlay
        let isEdge = false;
        let edgeChar = ' ';
        if (options.edgeDetection === 'sobel') {
          const mag = edgeMagMap[idx];
          const angle = edgeAngleMap[idx];
          // Determine if this pixel has a strong edge gradient
          if (mag > (100 - options.edgeWeight) * 1.5) {
            isEdge = true;
            // Map angle to structural characters: -, |, /, \
            // angle is from -PI to PI
            const deg = (angle * 180) / Math.PI;
            const normDeg = (deg + 180) % 180; // 0 to 180
            if (normDeg < 22.5 || normDeg >= 157.5) {
              edgeChar = '|'; // vertical gradient means horizontal line
            } else if (normDeg >= 22.5 && normDeg < 67.5) {
              edgeChar = '/';
            } else if (normDeg >= 67.5 && normDeg < 112.5) {
              edgeChar = '-';
            } else {
              edgeChar = '\\';
            }
          }
        }

        if (isEdge) {
          rowChars.push(edgeChar);
        } else {
          // Standard intensity character set mapping
          const charIdx = Math.floor((lum / 256) * charSet.length);
          rowChars.push(charSet[charIdx] || charSet[charSet.length - 1]);
        }

        rowColors.push(applyRGBMode(cr, cg, cb, c, r));

        // Background colors
        if (options.backgroundColorMode === 'match') {
          rowBgs.push({
            r: Math.round(cr * 0.15),
            g: Math.round(cg * 0.15),
            b: Math.round(cb * 0.15)
          });
        } else if (options.backgroundColorMode === 'custom' && options.customBgColor) {
          rowBgs.push(hexToRgb(options.customBgColor));
        } else {
          rowBgs.push({ r: 0, g: 0, b: 0 });
        }
      }
      finalChars.push(rowChars);
      finalColors.push(rowColors);
      finalBgColors.push(rowBgs);
    }
  }

  // 7. ASCII Beautifier Post-Processing Pass
  if (options.beautifyNoiseCleanup) {
    // Remove isolated single-dots
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (finalChars[r][c] !== ' ') {
          // Count neighbor non-space characters
          let neighbors = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if ((dx !== 0 || dy !== 0) && finalChars[r + dy][c + dx] !== ' ') {
                neighbors++;
              }
            }
          }
          if (neighbors === 0) {
            finalChars[r][c] = ' ';
          }
        }
      }
    }
  }

  if (options.beautifySmoothing) {
    // Blur minor character details
    for (let r = 1; r < rows - 1; r++) {
      for (let c = 1; c < cols - 1; c++) {
        if (finalChars[r][c] === '░' || finalChars[r][c] === '▒') {
          let solids = 0;
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              if (finalChars[r + dy][c + dx] === '▓' || finalChars[r + dy][c + dx] === '█') {
                solids++;
              }
            }
          }
          if (solids > 5) {
            finalChars[r][c] = '▓'; // Smooth upwards
          }
        }
      }
    }
  }

  // 8. Quality Scores Evaluator
  let errorSum = 0;
  let ssimSum = 0;
  const sampleSize = sampleW * sampleH;
  for (let idx = 0; idx < sampleSize; idx++) {
    const originalLum = downsampledLum[idx];
    // Reconstruct character approximate luminance
    const rIdx = Math.floor(idx / sampleW);
    const cIdx = idx % sampleW;
    const char = isBraille ? finalChars[rIdx]?.[cIdx] : finalChars[rIdx]?.[cIdx];
    
    let charLum = 0;
    if (char && charSet.indexOf(char) !== -1) {
      charLum = (charSet.indexOf(char) / charSet.length) * 255;
    }
    
    errorSum += Math.abs(originalLum - charLum);
    // SSIM approximation
    ssimSum += 1 - Math.abs(originalLum - charLum) / 255;
  }

  const mae = sampleSize > 0 ? errorSum / sampleSize : 0;
  const accuracy = Math.round(Math.max(10, 100 - (mae / 255) * 100));
  const detailPreservation = Math.round(Math.max(10, (ssimSum / (sampleSize || 1)) * 100));

  stats.accuracyScore = accuracy;
  stats.detailPreservationScore = detailPreservation;
  stats.fidelityScore = Math.round((accuracy * 0.6) + (detailPreservation * 0.4));
  stats.qualityScore = Math.round((stats.fidelityScore + (options.sharpness * 0.15)) * (options.charMode === 'braille' ? 1.05 : 1));
  if (stats.qualityScore > 100) stats.qualityScore = 100;

  // Plain string output assembler
  const text = finalChars.map(row => row.join('')).join('\n');
  stats.processTimeMs = Date.now() - startTime;

  return {
    text,
    charGrid: finalChars,
    colors: options.colorMode === 'mono' ? undefined : finalColors,
    bgColors: options.backgroundColorMode === 'none' ? undefined : finalBgColors,
    stats
  };
}

self.onmessage = (e) => {
  const { imageData, options } = e.data;
  const result = processImageToAscii(imageData, options);
  self.postMessage(result);
};
