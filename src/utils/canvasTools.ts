import { generateTextBanner } from './figletFonts';

// Selections
export function getRectSelection(w: number, h: number, r1: number, c1: number, r2: number, c2: number): boolean[][] {
  const mask = Array(h).fill(null).map(() => Array(w).fill(false));
  const minR = Math.max(0, Math.min(r1, r2));
  const maxR = Math.min(h - 1, Math.max(r1, r2));
  const minC = Math.max(0, Math.min(c1, c2));
  const maxC = Math.min(w - 1, Math.max(c1, c2));

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      mask[r][c] = true;
    }
  }
  return mask;
}

export function getCircleSelection(w: number, h: number, centerR: number, centerC: number, radius: number): boolean[][] {
  const mask = Array(h).fill(null).map(() => Array(w).fill(false));
  const r2 = radius * radius;

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const dr = r - centerR;
      const dc = c - centerC;
      // Compensate for font aspect ratio (typical 9px width vs 12px height)
      const dist = dr * dr * (0.55 * 0.55) + dc * dc;
      if (dist <= r2) {
        mask[r][c] = true;
      }
    }
  }
  return mask;
}

export function getMagicWandSelection(
  grid: string[][],
  colors: { r: number; g: number; b: number }[][],
  startR: number,
  startC: number,
  tolerance: number
): boolean[][] {
  const h = grid.length;
  const w = grid[0]?.length || 0;
  const mask = Array(h).fill(null).map(() => Array(w).fill(false));

  if (startR < 0 || startR >= h || startC < 0 || startC >= w) return mask;

  const targetChar = grid[startR][startC];
  const targetCol = colors[startR][startC];
  const targetLum = 0.299 * targetCol.r + 0.587 * targetCol.g + 0.114 * targetCol.b;

  const visited = Array(h).fill(null).map(() => Array(w).fill(false));
  const queue: [number, number][] = [[startR, startC]];
  visited[startR][startC] = true;

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const curCol = colors[r][c];
    const curLum = 0.299 * curCol.r + 0.587 * curCol.g + 0.114 * curCol.b;

    // Check match criteria
    const matchChar = grid[r][c] === targetChar;
    const matchLum = Math.abs(curLum - targetLum) <= tolerance;

    if (matchChar || matchLum) {
      mask[r][c] = true;

      const neighbors = [
        [r + 1, c],
        [r - 1, c],
        [r, c + 1],
        [r, c - 1]
      ];

      for (const [nr, nc] of neighbors) {
        if (nr >= 0 && nr < h && nc >= 0 && nc < w && !visited[nr][nc]) {
          visited[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }
    }
  }
  return mask;
}

export function getColorSelection(
  grid: string[][],
  colors: { r: number; g: number; b: number }[][],
  startR: number,
  startC: number,
  tolerance: number
): boolean[][] {
  const h = grid.length;
  const w = grid[0]?.length || 0;
  const mask = Array(h).fill(null).map(() => Array(w).fill(false));

  if (startR < 0 || startR >= h || startC < 0 || startC >= w) return mask;

  const targetCol = colors[startR][startC];
  const targetLum = 0.299 * targetCol.r + 0.587 * targetCol.g + 0.114 * targetCol.b;

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const curCol = colors[r][c];
      const curLum = 0.299 * curCol.r + 0.587 * curCol.g + 0.114 * curCol.b;
      if (Math.abs(curLum - targetLum) <= tolerance) {
        mask[r][c] = true;
      }
    }
  }
  return mask;
}

// Drawing operations
export function drawBrush(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  r: number,
  c: number,
  char: string,
  color: { r: number; g: number; b: number },
  brushSize: number,
  brushType: 'pencil' | 'brush' | 'airbrush' | 'calligraphy' | 'ink-pen',
  mask?: boolean[][]
) {
  const h = grid.length;
  const w = grid[0]?.length || 0;

  const inBounds = (row: number, col: number) => row >= 0 && row < h && col >= 0 && col < w;
  const matchesMask = (row: number, col: number) => !mask || mask[row]?.[col];

  if (brushType === 'pencil') {
    if (inBounds(r, c) && matchesMask(r, c)) {
      grid[r][c] = char;
      colorGrid[r][c] = color;
    }
    return;
  }

  const radius = Math.floor(brushSize / 2);

  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const nr = r + dr;
      const nc = c + dc;

      if (!inBounds(nr, nc) || !matchesMask(nr, nc)) continue;

      // Distance checking
      const dist = Math.sqrt(dr * dr * (0.55 * 0.55) + dc * dc);
      if (dist > radius) continue;

      if (brushType === 'brush' || brushType === 'ink-pen') {
        grid[nr][nc] = char;
        colorGrid[nr][nc] = color;
      } else if (brushType === 'airbrush') {
        // Random spray distribution
        if (Math.random() < 0.25) {
          grid[nr][nc] = char;
          colorGrid[nr][nc] = color;
        }
      } else if (brushType === 'calligraphy') {
        // Calligraphy has a linear slash brush angle (45 degrees)
        if (Math.abs(dr - dc) <= 1) {
          grid[nr][nc] = char;
          colorGrid[nr][nc] = color;
        }
      }
    }
  }
}

// Flood Fill Operation
export function floodFill(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  startRow: number,
  startCol: number,
  fillChar: string,
  fillColor: { r: number; g: number; b: number },
  mask?: boolean[][]
) {
  const ROWS = grid.length;
  const COLS = grid[0]?.length || 0;
  const targetChar = grid[startRow]?.[startCol];

  if (targetChar === fillChar) return;

  const inBounds = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
  const matchesMask = (r: number, c: number) => !mask || mask[r]?.[c];

  const queue: [number, number][] = [[startRow, startCol]];
  const visited = Array(ROWS).fill(null).map(() => Array(COLS).fill(false));
  visited[startRow][startCol] = true;

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    if (grid[r][c] === targetChar && matchesMask(r, c)) {
      grid[r][c] = fillChar;
      colorGrid[r][c] = fillColor;

      const neighbors = [
        [r + 1, c],
        [r - 1, c],
        [r, c + 1],
        [r, c - 1]
      ];
      for (const [nr, nc] of neighbors) {
        if (inBounds(nr, nc) && !visited[nr][nc]) {
          visited[nr][nc] = true;
          queue.push([nr, nc]);
        }
      }
    }
  }
}

// Gradient Fill
export function gradientFill(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  color1: { r: number; g: number; b: number },
  color2: { r: number; g: number; b: number },
  char: string,
  mask?: boolean[][]
) {
  const h = grid.length;
  const w = grid[0]?.length || 0;

  const dx = c2 - c1;
  const dy = r2 - r1;
  const lenSq = dx * dx + dy * dy;

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (mask && !mask[r][c]) continue;

      let pct = 0.5;
      if (lenSq > 0) {
        // Project vector (c - c1, r - r1) onto (dx, dy)
        const vx = c - c1;
        const vy = r - r1;
        const proj = (vx * dx + vy * dy) / lenSq;
        pct = Math.max(0, Math.min(1, proj));
      }

      grid[r][c] = char;
      colorGrid[r][c] = {
        r: Math.round(color1.r + (color2.r - color1.r) * pct),
        g: Math.round(color1.g + (color2.g - color1.g) * pct),
        b: Math.round(color1.b + (color2.b - color1.b) * pct)
      };
    }
  }
}

// Blur filter
export function blurCells(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  row: number,
  col: number,
  size: number,
  mask?: boolean[][]
) {
  const ROWS = grid.length;
  const COLS = grid[0]?.length || 0;
  const radius = Math.floor(size / 2);

  const copyCols = colorGrid.map((r) => r.map((c) => ({ ...c })));

  for (let r = Math.max(0, row - radius); r <= Math.min(ROWS - 1, row + radius); r++) {
    for (let c = Math.max(0, col - radius); c <= Math.min(COLS - 1, col + radius); c++) {
      if (mask && !mask[r][c]) continue;

      let sumR = 0, sumG = 0, sumB = 0, count = 0;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
            sumR += copyCols[nr][nc].r;
            sumG += copyCols[nr][nc].g;
            sumB += copyCols[nr][nc].b;
            count++;
          }
        }
      }

      if (count > 0) {
        colorGrid[r][c] = {
          r: Math.round(sumR / count),
          g: Math.round(sumG / count),
          b: Math.round(sumB / count)
        };
      }
    }
  }
}

// Sharpen Filter
export function sharpenCells(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  row: number,
  col: number,
  size: number,
  mask?: boolean[][]
) {
  const ROWS = grid.length;
  const COLS = grid[0]?.length || 0;
  const radius = Math.floor(size / 2);

  const copyCols = colorGrid.map((r) => r.map((c) => ({ ...c })));

  for (let r = Math.max(0, row - radius); r <= Math.min(ROWS - 1, row + radius); r++) {
    for (let c = Math.max(0, col - radius); c <= Math.min(COLS - 1, col + radius); c++) {
      if (mask && !mask[r][c]) continue;

      // Unsharp mask approximation: Center * 5 - (sum of neighbors)
      const ctr = copyCols[r][c];
      let sumR = 0, sumG = 0, sumB = 0, count = 0;

      const neighbors = [
        [r + 1, c],
        [r - 1, c],
        [r, c + 1],
        [r, c - 1]
      ];

      for (const [nr, nc] of neighbors) {
        if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
          sumR += copyCols[nr][nc].r;
          sumG += copyCols[nr][nc].g;
          sumB += copyCols[nr][nc].b;
          count++;
        }
      }

      if (count > 0) {
        colorGrid[r][c] = {
          r: Math.min(255, Math.max(0, ctr.r * 1.5 - (sumR / count) * 0.5)),
          g: Math.min(255, Math.max(0, ctr.g * 1.5 - (sumG / count) * 0.5)),
          b: Math.min(255, Math.max(0, ctr.b * 1.5 - (sumB / count) * 0.5))
        };
      }
    }
  }
}

// Smudge Filter (move details along drag direction)
export function smudgeCells(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  r: number,
  c: number,
  prevR: number,
  prevC: number,
  brushSize: number,
  mask?: boolean[][]
) {
  const ROWS = grid.length;
  const COLS = grid[0]?.length || 0;

  if (prevR === r && prevC === c) return;
  const radius = Math.floor(brushSize / 2);

  const inBounds = (row: number, col: number) => row >= 0 && row < ROWS && col >= 0 && col < COLS;

  for (let dr = -radius; dr <= radius; dr++) {
    for (let dc = -radius; dc <= radius; dc++) {
      const srcR = prevR + dr;
      const srcC = prevC + dc;
      const destR = r + dr;
      const destC = c + dc;

      if (inBounds(srcR, srcC) && inBounds(destR, destC)) {
        if (mask && !mask[destR][destC]) continue;
        // Blend src into dest
        grid[destR][destC] = grid[srcR][srcC];
        colorGrid[destR][destC] = {
          r: Math.round(colorGrid[destR][destC].r * 0.4 + colorGrid[srcR][srcC].r * 0.6),
          g: Math.round(colorGrid[destR][destC].g * 0.4 + colorGrid[srcR][srcC].g * 0.6),
          b: Math.round(colorGrid[destR][destC].b * 0.4 + colorGrid[srcR][srcC].b * 0.6)
        };
      }
    }
  }
}

// Transform: Rotate
export function rotateGrid(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  angleDeg: number
) {
  const H = grid.length;
  const W = grid[0]?.length || 0;

  const copyGrid = grid.map((r) => [...r]);
  const copyColors = colorGrid.map((r) => r.map((c) => ({ ...c })));

  const centerR = H / 2;
  const centerC = W / 2;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  // Clear original
  for (let r = 0; r < H; r++) {
    grid[r].fill(' ');
    colorGrid[r].fill({ r: 56, g: 189, b: 248 });
  }

  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      const dr = r - centerR;
      const dc = c - centerC;

      // Perform back-rotation to map destination pixel to source
      // Compensate for font aspect ratio (1.33:1 height-to-width typical)
      const srcC = Math.round(centerC + dc * cos + dr * sin * 1.33);
      const srcR = Math.round(centerR - dc * sin / 1.33 + dr * cos);

      if (srcR >= 0 && srcR < H && srcC >= 0 && srcC < W) {
        grid[r][c] = copyGrid[srcR][srcC];
        colorGrid[r][c] = copyColors[srcR][srcC];
      }
    }
  }
}

// Flip operations
export function flipGrid(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  direction: 'horizontal' | 'vertical'
) {
  const H = grid.length;

  if (direction === 'horizontal') {
    for (let r = 0; r < H; r++) {
      grid[r].reverse();
      colorGrid[r].reverse();
    }
  } else {
    grid.reverse();
    colorGrid.reverse();
  }
}

// Shape Drawings
export function drawRectangle(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  char: string,
  color: { r: number; g: number; b: number },
  filled: boolean = false,
  mask?: boolean[][]
) {
  const H = grid.length;
  const W = grid[0]?.length || 0;

  const minR = Math.max(0, Math.min(r1, r2));
  const maxR = Math.min(H - 1, Math.max(r1, r2));
  const minC = Math.max(0, Math.min(c1, c2));
  const maxC = Math.min(W - 1, Math.max(c1, c2));

  for (let r = minR; r <= maxR; r++) {
    for (let c = minC; c <= maxC; c++) {
      if (mask && !mask[r][c]) continue;

      const isBorder = r === minR || r === maxR || c === minC || c === maxC;
      if (filled || isBorder) {
        grid[r][c] = char;
        colorGrid[r][c] = color;
      }
    }
  }
}

export function drawCircle(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  centerR: number,
  centerC: number,
  radius: number,
  char: string,
  color: { r: number; g: number; b: number },
  filled: boolean = false,
  mask?: boolean[][]
) {
  const H = grid.length;
  const W = grid[0]?.length || 0;

  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (mask && !mask[r][c]) continue;

      const dr = r - centerR;
      const dc = c - centerC;
      const dist = Math.sqrt(dr * dr * (0.55 * 0.55) + dc * dc);

      if (filled) {
        if (dist <= radius) {
          grid[r][c] = char;
          colorGrid[r][c] = color;
        }
      } else {
        // Draw a thin border outline
        if (Math.abs(dist - radius) < 0.75) {
          grid[r][c] = char;
          colorGrid[r][c] = color;
        }
      }
    }
  }
}

export function drawArrow(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  char: string,
  color: { r: number; g: number; b: number },
  mask?: boolean[][]
) {
  const H = grid.length;
  const W = grid[0]?.length || 0;

  // Bresenham's line for arrow shaft
  let x0 = c1, y0 = r1;
  const x1 = c2, y1 = r2;
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (y0 >= 0 && y0 < H && x0 >= 0 && x0 < W) {
      if (!mask || mask[y0][x0]) {
        grid[y0][x0] = char;
        colorGrid[y0][x0] = color;
      }
    }
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x0 += sx; }
    if (e2 < dx) { err += dx; y0 += sy; }
  }

  // Draw arrow head (primitive triangles)
  const angle = Math.atan2(r2 - r1, c2 - c1);
  const headLen = 4;
  const angleDiff = Math.PI / 6; // 30 degrees side spread

  const leftX = Math.round(c2 - headLen * Math.cos(angle - angleDiff));
  const leftY = Math.round(r2 - headLen * Math.sin(angle - angleDiff) * 0.75); // aspect ratio compensation
  const rightX = Math.round(c2 - headLen * Math.cos(angle + angleDiff));
  const rightY = Math.round(r2 - headLen * Math.sin(angle + angleDiff) * 0.75);

  const drawPoint = (y: number, x: number) => {
    if (y >= 0 && y < H && x >= 0 && x < W) {
      if (!mask || mask[y][x]) {
        grid[y][x] = char;
        colorGrid[y][x] = color;
      }
    }
  };

  drawPoint(leftY, leftX);
  drawPoint(rightY, rightX);
}

// Star Shape
export function drawStar(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  centerR: number,
  centerC: number,
  radius: number,
  char: string,
  color: { r: number; g: number; b: number },
  mask?: boolean[][]
) {
  const H = grid.length;
  const W = grid[0]?.length || 0;

  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      if (mask && !mask[r][c]) continue;

      const dr = r - centerR;
      const dc = c - centerC;
      const dist = Math.sqrt(dr * dr * (0.55 * 0.55) + dc * dc);
      if (dist > radius) continue;

      // Check angular vectors for 5-pointed star
      const angle = Math.atan2(dr, dc) + Math.PI / 2; // offset to point up
      const spikes = 5;
      const factor = (spikes * angle) / (2 * Math.PI);
      const k = factor - Math.floor(factor);
      const starRadius = radius * ( (1 - k) * 1 + k * 0.4 ); // interpolation of outer/inner radius

      if (dist <= starRadius) {
        grid[r][c] = char;
        colorGrid[r][c] = color;
      }
    }
  }
}

// Speech Bubble Outline
export function drawSpeechBubble(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  r1: number,
  c1: number,
  r2: number,
  c2: number,
  char: string,
  color: { r: number; g: number; b: number },
  mask?: boolean[][]
) {
  const minR = Math.min(r1, r2);
  const maxR = Math.max(r1, r2);
  const minC = Math.min(c1, c2);
  const maxC = Math.max(c1, c2);

  // Draw rounded rect outline
  drawRectangle(grid, colorGrid, minR, minC, maxR - 2, maxC, char, color, false, mask);

  // Draw pointer tail at bottom-left corner
  const tailRow = maxR - 1;
  const tailCol = minC + 3;
  if (tailRow < grid.length && tailCol < grid[0].length) {
    grid[tailRow][tailCol] = '\\';
    grid[tailRow][tailCol + 1] = '/';
  }
}

// Text System - WordArt Banner & Custom shapes
export function drawBannerText(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  startR: number,
  startC: number,
  text: string,
  fontName: string,
  color: { r: number; g: number; b: number }
) {
  const banner = generateTextBanner(text, fontName, 0);
  const lines = banner.split('\n');
  const H = grid.length;
  const W = grid[0]?.length || 0;

  for (let l = 0; l < lines.length; l++) {
    const line = lines[l];
    const r = startR + l;
    if (r >= H) break;
    for (let i = 0; i < line.length; i++) {
      const c = startC + i;
      if (c >= W) break;
      if (line[i] !== ' ') {
        grid[r][c] = line[i];
        colorGrid[r][c] = color;
      }
    }
  }
}

export function drawCurvedText(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  centerR: number,
  centerC: number,
  radius: number,
  text: string,
  color: { r: number; g: number; b: number }
) {
  const H = grid.length;
  const W = grid[0]?.length || 0;

  // Render text around a circle starting from the top-left quadrant
  const textLen = text.length;
  const stepAngle = Math.PI / textLen; // half-circle sweep

  for (let i = 0; i < textLen; i++) {
    const angle = -Math.PI + i * stepAngle;
    const r = Math.round(centerR + radius * Math.sin(angle) * 0.75); // aspect corrected
    const c = Math.round(centerC + radius * Math.cos(angle));

    if (r >= 0 && r < H && c >= 0 && c < W) {
      grid[r][c] = text[i];
      colorGrid[r][c] = color;
    }
  }
}

export function drawVerticalText(
  grid: string[][],
  colorGrid: { r: number; g: number; b: number }[][],
  startR: number,
  startC: number,
  text: string,
  color: { r: number; g: number; b: number }
) {
  const H = grid.length;

  for (let i = 0; i < text.length; i++) {
    const r = startR + i;
    if (r >= H) break;
    grid[r][startC] = text[i];
    colorGrid[r][startC] = color;
  }
}
