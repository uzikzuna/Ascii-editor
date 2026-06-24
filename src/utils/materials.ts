// Material shaders mapped to ASCII characters and color gradients
export function applyMaterial(
  material: 'metal' | 'chrome' | 'glass' | 'wood' | 'stone' | 'carbon-fiber' | 'neon' | 'plasma',
  grid: string[][],
  colors: { r: number; g: number; b: number }[][],
  mask?: boolean[][]
) {
  const h = grid.length;
  const w = grid[0]?.length || 0;

  const inBounds = (r: number, c: number) => r >= 0 && r < h && c >= 0 && c < w;

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (mask && !mask[r][c]) continue;
      if (!inBounds(r, c)) continue;

      switch (material) {
        case 'chrome':
        case 'metal': {
          // Metal reflection (diagonal highlights)
          const val = (r * 1.5 + c) % 15;
          if (val < 2) {
            grid[r][c] = '█';
            colors[r][c] = { r: 255, g: 255, b: 255 }; // specular highlight
          } else if (val < 5) {
            grid[r][c] = '▓';
            colors[r][c] = { r: 200, g: 200, b: 210 };
          } else if (val < 9) {
            grid[r][c] = '▒';
            colors[r][c] = { r: 140, g: 140, b: 150 };
          } else if (val < 13) {
            grid[r][c] = '░';
            colors[r][c] = { r: 80, g: 80, b: 90 };
          } else {
            grid[r][c] = '.';
            colors[r][c] = { r: 40, g: 40, b: 45 };
          }
          break;
        }

        case 'glass': {
          // Glass: maintain base structure, apply diagonal glare reflection
          const isGlare = (r + c) % 20 === 0 || (r + c - 1) % 20 === 0;
          if (isGlare) {
            grid[r][c] = '/';
            colors[r][c] = { r: 230, g: 245, b: 255 }; // Light cyan glow
          } else {
            // Semi-transparent: wash color slightly towards light blue
            colors[r][c] = {
              r: Math.round(colors[r][c].r * 0.7 + 100 * 0.3),
              g: Math.round(colors[r][c].g * 0.7 + 180 * 0.3),
              b: Math.round(colors[r][c].b * 0.7 + 230 * 0.3)
            };
          }
          break;
        }

        case 'wood': {
          // Wood grain circles/veins
          const dx = c - w / 2;
          const dy = r - h / 2;
          const dist = Math.sqrt(dx * dx * (0.55 * 0.55) + dy * dy);
          const ring = Math.sin(dist * 0.7);

          if (ring > 0.6) {
            grid[r][c] = '▓';
            colors[r][c] = { r: 120, g: 70, b: 30 }; // Dark wood brown
          } else if (ring > 0.0) {
            grid[r][c] = '▒';
            colors[r][c] = { r: 150, g: 90, b: 40 }; // Mid wood brown
          } else {
            grid[r][c] = '░';
            colors[r][c] = { r: 180, g: 120, b: 60 }; // Light wood brown
          }
          break;
        }

        case 'stone': {
          // Organic rocky noise
          const noise = Math.random();
          if (noise > 0.85) {
            grid[r][c] = '▓';
            colors[r][c] = { r: 100, g: 100, b: 105 }; // granite grey
          } else if (noise > 0.6) {
            grid[r][c] = '▒';
            colors[r][c] = { r: 130, g: 130, b: 135 };
          } else if (noise > 0.3) {
            grid[r][c] = '░';
            colors[r][c] = { r: 160, g: 160, b: 165 };
          } else {
            grid[r][c] = '.';
            colors[r][c] = { r: 80, g: 80, b: 85 };
          }
          break;
        }

        case 'carbon-fiber': {
          // Checkered weave pattern
          const check = (Math.floor(r / 2) + Math.floor(c / 2)) % 2 === 0;
          grid[r][c] = check ? '▒' : '░';
          colors[r][c] = check ? { r: 30, g: 30, b: 32 } : { r: 50, g: 50, b: 52 };
          break;
        }

        case 'neon': {
          // Glow effect on contours
          if (grid[r][c] !== ' ') {
            grid[r][c] = '█';
            colors[r][c] = { r: 255, g: 0, b: 180 }; // Saturated hot pink
          }
          break;
        }

        case 'plasma': {
          // Shifting fluid heat map
          const time = Date.now() / 1500;
          const cx = w / 2;
          const cy = h / 2;
          const v = Math.sin(c / 8 + time) + Math.sin((r / 6 + time) / 2.0) + Math.sin(Math.sqrt((c - cx) * (c - cx) + (r - cy) * (r - cy)) / 8.0 - time);
          const mapped = Math.round((v + 3.0) * 42.5); // 0 to 255
          
          if (mapped > 200) {
            grid[r][c] = '█';
            colors[r][c] = { r: 255, g: 0, b: 0 };
          } else if (mapped > 150) {
            grid[r][c] = '▓';
            colors[r][c] = { r: 255, g: 128, b: 0 };
          } else if (mapped > 100) {
            grid[r][c] = '▒';
            colors[r][c] = { r: 0, g: 255, b: 255 };
          } else {
            grid[r][c] = '░';
            colors[r][c] = { r: 0, g: 0, b: 255 };
          }
          break;
        }

        default:
          break;
      }
    }
  }
}
