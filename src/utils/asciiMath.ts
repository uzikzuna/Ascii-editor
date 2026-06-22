export interface AsciiOptions {
  width: number;
  height: number;
  brightness: number;  // -100 to 100
  contrast: number;    // -100 to 100
  sharpness: number;   // 0 to 100
  charMode: 'standard' | 'extended' | 'blocks' | 'braille' | 'pixel' | 'matrix' | 'custom';
  customChars?: string;
  colorMode: 'mono' | 'color' | 'green' | 'amber' | 'rgb' | 'gradient';
  gradientColors?: string[]; // e.g. [start, mid, end]
  invert: boolean;
  dithering: 'none' | 'floyd-steinberg';
}

// Default character sets sorted from darkest to brightest (relative to dark background)
export const CHAR_SETS = {
  standard: ' .:-=+*#%@',
  extended: ' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$',
  blocks: ' ░▒▓█',
  pixel: '█',
  matrix: ' ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ0123456789',
};

// Apply brightness and contrast adjustment
export function adjustPixel(
  r: number,
  g: number,
  b: number,
  brightness: number,
  contrast: number
): { r: number; g: number; b: number } {
  // Brightness offset
  let nr = r + brightness;
  let ng = g + brightness;
  let nb = b + brightness;

  // Contrast scale factor
  if (contrast !== 0) {
    const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));
    nr = factor * (nr - 128) + 128;
    ng = factor * (ng - 128) + 128;
    nb = factor * (nb - 128) + 128;
  }

  return {
    r: Math.min(255, Math.max(0, nr)),
    g: Math.min(255, Math.max(0, ng)),
    b: Math.min(255, Math.max(0, nb)),
  };
}

// Sharpen image using a convolution matrix
export function sharpenImageData(imageData: ImageData, amount: number): ImageData {
  if (amount <= 0) return imageData;
  
  const w = imageData.width;
  const h = imageData.height;
  const src = imageData.data;
  const output = new ImageData(new Uint8ClampedArray(src), w, h);
  const dst = output.data;
  
  // Sharpen kernel
  const k = -amount / 100;
  const center = 1 - (4 * k);
  const kernel = [
    0, k, 0,
    k, center, k,
    0, k, 0
  ];
  
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      let r = 0, g = 0, b = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const sIdx = ((y + ky) * w + (x + kx)) * 4;
          const weight = kernel[(ky + 1) * 3 + (kx + 1)];
          r += src[sIdx] * weight;
          g += src[sIdx + 1] * weight;
          b += src[sIdx + 2] * weight;
        }
      }
      
      dst[idx] = Math.min(255, Math.max(0, r));
      dst[idx + 1] = Math.min(255, Math.max(0, g));
      dst[idx + 2] = Math.min(255, Math.max(0, b));
    }
  }
  return output;
}

// Convert RGB to grayscale (luminance)
export function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Helper to map color to a custom gradient
function getGradientColor(val: number, colors: string[]): { r: number; g: number; b: number } {
  if (colors.length < 2) return { r: val, g: val, b: val };
  
  // val is 0 to 255. Map to range 0 to colors.length - 1
  const pct = val / 255;
  const segments = colors.length - 1;
  const exactIdx = pct * segments;
  const idx1 = Math.floor(exactIdx);
  const idx2 = Math.min(segments, idx1 + 1);
  const localPct = exactIdx - idx1;
  
  const parseHex = (hex: string) => {
    const clean = hex.replace('#', '');
    const num = parseInt(clean, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255
    };
  };
  
  const c1 = parseHex(colors[idx1]);
  const c2 = parseHex(colors[idx2]);
  
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * localPct),
    g: Math.round(c1.g + (c2.g - c1.g) * localPct),
    b: Math.round(c1.b + (c2.b - c1.b) * localPct)
  };
}

// Main processing function for image to ASCII mapping
export function imageToAscii(
  canvas: HTMLCanvasElement,
  options: AsciiOptions
): {
  text: string;
  colors?: { r: number; g: number; b: number }[][];
  charGrid: string[][];
} {
  const ctx = canvas.getContext('2d');
  if (!ctx) return { text: '', charGrid: [] };

  // 1. Get raw image data
  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  // 2. Apply sharpness convolution
  if (options.sharpness > 0) {
    imageData = sharpenImageData(imageData, options.sharpness);
  }

  const { width: w, height: h } = canvas;
  const src = imageData.data;

  // Select character set
  let charSet = CHAR_SETS.standard;
  if (options.charMode === 'extended') charSet = CHAR_SETS.extended;
  else if (options.charMode === 'blocks') charSet = CHAR_SETS.blocks;
  else if (options.charMode === 'pixel') charSet = CHAR_SETS.pixel;
  else if (options.charMode === 'matrix') charSet = CHAR_SETS.matrix;
  else if (options.charMode === 'custom') charSet = options.customChars || CHAR_SETS.standard;

  if (options.invert && options.charMode !== 'braille') {
    charSet = charSet.split('').reverse().join('');
  }

  // Pre-calculate variables
  const charGrid: string[][] = [];
  const colorGrid: { r: number; g: number; b: number }[][] = [];

  // 3. For Braille mode, we require processing in 2x4 sub-pixel blocks
  if (options.charMode === 'braille') {
    // Braille requires W to be multiple of 2, H to be multiple of 4
    const cols = Math.floor(w / 2);
    const rows = Math.floor(h / 4);
    
    // Create grayscale threshold grid first
    const lums = new Float32Array(w * h);
    const rawR = new Uint8Array(w * h);
    const rawG = new Uint8Array(w * h);
    const rawB = new Uint8Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const adj = adjustPixel(src[idx], src[idx + 1], src[idx + 2], options.brightness, options.contrast);
        lums[y * w + x] = getLuminance(adj.r, adj.g, adj.b);
        rawR[y * w + x] = adj.r;
        rawG[y * w + x] = adj.g;
        rawB[y * w + x] = adj.b;
      }
    }

    // Apply Floyd-Steinberg dithering on lums if requested
    if (options.dithering === 'floyd-steinberg') {
      const threshold = 127;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          const oldVal = lums[idx];
          const newVal = oldVal > threshold ? 255 : 0;
          lums[idx] = newVal;
          const err = oldVal - newVal;
          
          if (x + 1 < w) lums[idx + 1] += err * 7 / 16;
          if (y + 1 < h) {
            if (x - 1 >= 0) lums[(y + 1) * w + (x - 1)] += err * 3 / 16;
            lums[(y + 1) * w + x] += err * 5 / 16;
            if (x + 1 < w) lums[(y + 1) * w + (x + 1)] += err * 1 / 16;
          }
        }
      }
    }

    // Group into 2x4 cells to create Braille characters
    const threshold = 127;
    for (let r = 0; r < rows; r++) {
      const rowChars: string[] = [];
      const rowColors: { r: number; g: number; b: number }[] = [];
      
      for (let c = 0; c < cols; c++) {
        const x = c * 2;
        const y = r * 4;
        
        // Braille dot layout offsets:
        // Dot 1: (0,0)  Dot 4: (1,0)
        // Dot 2: (0,1)  Dot 5: (1,1)
        // Dot 3: (0,2)  Dot 6: (1,2)
        // Dot 7: (0,3)  Dot 8: (1,3)
        const getVal = (dx: number, dy: number) => {
          const px = x + dx;
          const py = y + dy;
          if (px >= w || py >= h) return false;
          const val = lums[py * w + px];
          return options.invert ? val < threshold : val >= threshold;
        };

        const dot1 = getVal(0, 0) ? 1 : 0;
        const dot2 = getVal(0, 1) ? 2 : 0;
        const dot3 = getVal(0, 2) ? 4 : 0;
        const dot4 = getVal(1, 0) ? 8 : 0;
        const dot5 = getVal(1, 1) ? 16 : 0;
        const dot6 = getVal(1, 2) ? 32 : 0;
        const dot7 = getVal(0, 3) ? 64 : 0;
        const dot8 = getVal(1, 3) ? 128 : 0;

        const code = 0x2800 + (dot1 + dot2 + dot3 + dot4 + dot5 + dot6 + dot7 + dot8);
        const char = String.fromCharCode(code);
        rowChars.push(char);

        // Average colors in the 2x4 block for color modes
        let sumR = 0, sumG = 0, sumB = 0, count = 0;
        for (let dy = 0; dy < 4; dy++) {
          for (let dx = 0; dx < 2; dx++) {
            const px = x + dx;
            const py = y + dy;
            if (px < w && py < h) {
              const idx = py * w + px;
              sumR += rawR[idx];
              sumG += rawG[idx];
              sumB += rawB[idx];
              count++;
            }
          }
        }

        const avgR = count > 0 ? Math.round(sumR / count) : 0;
        const avgG = count > 0 ? Math.round(sumG / count) : 0;
        const avgB = count > 0 ? Math.round(sumB / count) : 0;

        rowColors.push(applyColorMode(avgR, avgG, avgB, options));
      }
      charGrid.push(rowChars);
      colorGrid.push(rowColors);
    }

  } else {
    // 4. Standard character-mapping mode (width x height)
    // Convert source pixel data to custom adjustments grid
    const rGrid = new Uint8Array(w * h);
    const gGrid = new Uint8Array(w * h);
    const bGrid = new Uint8Array(w * h);
    const lumGrid = new Float32Array(w * h);

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = (y * w + x) * 4;
        const adj = adjustPixel(src[idx], src[idx + 1], src[idx + 2], options.brightness, options.contrast);
        rGrid[y * w + x] = adj.r;
        gGrid[y * w + x] = adj.g;
        bGrid[y * w + x] = adj.b;
        lumGrid[y * w + x] = getLuminance(adj.r, adj.g, adj.b);
      }
    }

    // Apply dithering on luminance grid
    if (options.dithering === 'floyd-steinberg') {
      const step = 255 / (charSet.length - 1);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = y * w + x;
          const oldLum = lumGrid[idx];
          // Find closest discrete luminance mapping
          const newLum = Math.round(oldLum / step) * step;
          lumGrid[idx] = newLum;
          const err = oldLum - newLum;

          if (x + 1 < w) lumGrid[idx + 1] += err * 7 / 16;
          if (y + 1 < h) {
            if (x - 1 >= 0) lumGrid[(y + 1) * w + (x - 1)] += err * 3 / 16;
            lumGrid[(y + 1) * w + x] += err * 5 / 16;
            if (x + 1 < w) lumGrid[(y + 1) * w + (x + 1)] += err * 1 / 16;
          }
        }
      }
    }

    // Generate characters and colors
    for (let y = 0; y < h; y++) {
      const rowChars: string[] = [];
      const rowColors: { r: number; g: number; b: number }[] = [];
      
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const lum = Math.min(255, Math.max(0, lumGrid[idx]));
        const charIdx = Math.floor((lum / 256) * charSet.length);
        rowChars.push(charSet[charIdx] || charSet[charSet.length - 1]);

        rowColors.push(applyColorMode(rGrid[idx], gGrid[idx], bGrid[idx], options));
      }
      charGrid.push(rowChars);
      colorGrid.push(rowColors);
    }
  }

  // Generate plain string output
  const text = charGrid.map(row => row.join('')).join('\n');

  return {
    text,
    charGrid,
    colors: options.colorMode === 'mono' ? undefined : colorGrid,
  };
}

// Subroutine to apply theme/color filter to active pixels
function applyColorMode(
  r: number,
  g: number,
  b: number,
  options: AsciiOptions
): { r: number; g: number; b: number } {
  const lum = getLuminance(r, g, b);
  switch (options.colorMode) {
    case 'green':
      // Retro green terminal
      return { r: 57, g: Math.round(50 + (lum / 255) * 205), b: 20 };
    case 'amber':
      // Retro amber terminal
      return { r: 255, g: Math.round(100 + (lum / 255) * 76), b: 0 };
    case 'rgb': {
      // Shifting RGB spectrum based on luminance and position
      const t = Date.now() / 2000;
      const angle = (lum / 255) * Math.PI * 2 + t;
      return {
        r: Math.round(128 + 127 * Math.sin(angle)),
        g: Math.round(128 + 127 * Math.sin(angle + (2 * Math.PI) / 3)),
        b: Math.round(128 + 127 * Math.sin(angle + (4 * Math.PI) / 3)),
      };
    }
    case 'gradient':
      if (options.gradientColors && options.gradientColors.length >= 2) {
        return getGradientColor(lum, options.gradientColors);
      }
      return { r, g, b };
    case 'color':
    default:
      return { r, g, b };
  }
}
