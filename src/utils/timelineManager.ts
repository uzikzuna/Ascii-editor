
// Update particle engine cells on a grid
export function applyParticles(
  particleType: 'none' | 'rain' | 'snow' | 'sparks' | 'fire' | 'smoke' | 'stars' | 'matrix-rain' | 'glitch',
  grid: string[][],
  colors: { r: number; g: number; b: number }[][],
  frameIdx: number,
  density: number = 5
) {
  const h = grid.length;
  const w = grid[0]?.length || 0;
  if (h === 0 || w === 0) return;

  switch (particleType) {
    case 'rain': {
      // Rain particles fall down
      const rainChars = ['|', '.', ':', '`'];
      for (let r = h - 1; r >= 0; r--) {
        for (let c = 0; c < w; c++) {
          if (r > 0) {
            // Cascade down
            const prevVal = grid[r - 1][c];
            if (rainChars.includes(prevVal)) {
              grid[r][c] = prevVal;
              colors[r][c] = { r: 100, g: 149, b: 237 }; // Cornflower blue
              grid[r - 1][c] = ' ';
            }
          }
        }
      }
      // Spawns
      for (let i = 0; i < density; i++) {
        const c = Math.floor(Math.random() * w);
        grid[0][c] = rainChars[Math.floor(Math.random() * rainChars.length)];
        colors[0][c] = { r: 100, g: 149, b: 237 };
      }
      break;
    }

    case 'snow': {
      // Snow falls down slowly with wind drift
      const snowChars = ['*', '.', 'o', '°'];
      for (let r = h - 1; r >= 0; r--) {
        for (let c = 0; c < w; c++) {
          if (r > 0) {
            const prevVal = grid[r - 1][c];
            if (snowChars.includes(prevVal)) {
              const drift = Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0;
              const nextC = Math.max(0, Math.min(w - 1, c + drift));
              grid[r][nextC] = prevVal;
              colors[r][nextC] = { r: 240, g: 248, b: 255 }; // Alice blue
              grid[r - 1][c] = ' ';
            }
          }
        }
      }
      // Spawns
      for (let i = 0; i < density; i++) {
        const c = Math.floor(Math.random() * w);
        grid[0][c] = snowChars[Math.floor(Math.random() * snowChars.length)];
        colors[0][c] = { r: 240, g: 248, b: 255 };
      }
      break;
    }

    case 'fire': {
      // Heat rising from the bottom
      const fireChars = ['█', '▓', '▒', '░', 'x', '*', '.', ' '];
      // Shift upwards
      for (let r = 0; r < h - 1; r++) {
        for (let c = 0; c < w; c++) {
          // Pull from bottom with random drift
          const drift = Math.floor(Math.random() * 3) - 1; // -1, 0, 1
          const srcC = Math.max(0, Math.min(w - 1, c + drift));
          const belowChar = grid[r + 1][srcC];

          if (belowChar !== ' ') {
            // Degrade character density as it rises
            const charIdx = fireChars.indexOf(belowChar);
            const newCharIdx = Math.min(fireChars.length - 1, charIdx + (Math.random() > 0.5 ? 1 : 0));
            grid[r][c] = fireChars[newCharIdx];

            // Blend colors from yellow at bottom to red/gray at top
            const pct = r / h; // 0 (top) to 1 (bottom)
            if (pct > 0.8) {
              colors[r][c] = { r: 255, g: 220, b: 0 }; // Yellow
            } else if (pct > 0.5) {
              colors[r][c] = { r: 255, g: 100, b: 0 }; // Orange
            } else if (pct > 0.2) {
              colors[r][c] = { r: 230, g: 0, b: 0 }; // Red
            } else {
              colors[r][c] = { r: 100, g: 100, b: 100 }; // Smoke gray
            }
          } else {
            grid[r][c] = ' ';
          }
        }
      }
      // Base generation at bottom row
      for (let c = 0; c < w; c++) {
        if (Math.random() < 0.6) {
          grid[h - 1][c] = '█';
          colors[h - 1][c] = { r: 255, g: 255, b: 0 };
        } else {
          grid[h - 1][c] = ' ';
        }
      }
      break;
    }

    case 'smoke': {
      // Rising smoke columns
      const smokeChars = ['░', 'o', '.', ' '];
      for (let r = 0; r < h - 1; r++) {
        for (let c = 0; c < w; c++) {
          const drift = Math.random() > 0.5 ? 1 : 0; // drift right
          const srcC = Math.max(0, Math.min(w - 1, c - drift));
          const belowChar = grid[r + 1][srcC];

          if (smokeChars.includes(belowChar) && belowChar !== ' ') {
            const charIdx = smokeChars.indexOf(belowChar);
            const newCharIdx = Math.min(smokeChars.length - 1, charIdx + (Math.random() > 0.7 ? 1 : 0));
            grid[r][c] = smokeChars[newCharIdx];
            colors[r][c] = { r: 120, g: 120, b: 130 }; // Gray
          } else {
            grid[r][c] = ' ';
          }
        }
      }
      // Spawns
      for (let c = 0; c < w; c++) {
        if (Math.random() < 0.1) {
          grid[h - 1][c] = '░';
          colors[h - 1][c] = { r: 100, g: 100, b: 100 };
        }
      }
      break;
    }

    case 'matrix-rain': {
      // Falling matrix digital codes
      const codes = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZｦｧｨｩｪｫｬｭｮｯｰｱ';
      for (let r = h - 1; r >= 0; r--) {
        for (let c = 0; c < w; c++) {
          if (r > 0) {
            const prevVal = grid[r - 1][c];
            if (prevVal !== ' ' && prevVal !== '█') {
              grid[r][c] = codes[Math.floor(Math.random() * codes.length)];
              colors[r][c] = { r: 34, g: 197, b: 94 }; // Classic green
              
              // Fade trailing cells
              const pct = (h - r) / h;
              colors[r][c] = {
                r: Math.round(34 * pct),
                g: Math.round(197 * pct),
                b: Math.round(94 * pct)
              };

              grid[r - 1][c] = ' ';
            }
          }
        }
      }
      // Spawns at top
      for (let i = 0; i < density; i++) {
        const c = Math.floor(Math.random() * w);
        grid[0][c] = codes[Math.floor(Math.random() * codes.length)];
        colors[0][c] = { r: 220, g: 252, b: 231 }; // Bright head spark
      }
      break;
    }

    case 'sparks': {
      // Exploding center sparkles
      const centerR = Math.floor(h / 2);
      const centerC = Math.floor(w / 2);
      const sparkChars = ['.', ':', '*', 'x', '+'];

      // Simple radial simulation
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          const dr = r - centerR;
          const dc = c - centerC;
          const dist = Math.sqrt(dr * dr * (0.55 * 0.55) + dc * dc);
          
          // Speed expansion step
          const waveRadius = (frameIdx % 15) * 1.5;
          if (Math.abs(dist - waveRadius) < 0.8 && Math.random() < 0.4) {
            grid[r][c] = sparkChars[Math.floor(Math.random() * sparkChars.length)];
            colors[r][c] = { r: 255, g: 165, b: 0 }; // Neon orange sparks
          } else {
            // Keep some background
          }
        }
      }
      break;
    }

    case 'stars': {
      // Twinkle random background stars
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (grid[r][c] === ' ' && Math.random() < 0.005) {
            grid[r][c] = Math.random() > 0.8 ? '*' : '.';
            colors[r][c] = Math.random() > 0.5 ? { r: 255, g: 255, b: 255 } : { r: 253, g: 224, b: 71 };
          } else if ((grid[r][c] === '*' || grid[r][c] === '.') && Math.random() < 0.2) {
            grid[r][c] = ' '; // disappear
          }
        }
      }
      break;
    }

    case 'glitch': {
      // Horizontal slice shifting
      if (frameIdx % 5 === 0) {
        const sliceRow = Math.floor(Math.random() * h);
        const shift = Math.floor(Math.random() * 8) - 4;
        const rowChars = [...grid[sliceRow]];
        const rowColors = [...colors[sliceRow]];

        for (let c = 0; c < w; c++) {
          const srcC = (c - shift + w) % w;
          grid[sliceRow][c] = rowChars[srcC];
          colors[sliceRow][c] = rowColors[srcC];
          // Color glitching
          if (Math.random() > 0.8) {
            colors[sliceRow][c] = { r: 255, g: 0, b: 128 }; // Magenta glitch tint
          }
        }
      }
      break;
    }

    case 'none':
    default:
      break;
  }
}

// Apply Video effect stack filters on a grid
export function applyVideoEffect(
  effect: string,
  grid: string[][],
  colors: { r: number; g: number; b: number }[][],
  frameIdx: number
) {
  const h = grid.length;
  const w = grid[0]?.length || 0;

  switch (effect) {
    case 'crt': {
      // SCANLINE Filter: Darken odd rows
      for (let r = 0; r < h; r++) {
        if (r % 2 === 1) {
          for (let c = 0; c < w; c++) {
            colors[r][c] = {
              r: Math.round(colors[r][c].r * 0.4),
              g: Math.round(colors[r][c].g * 0.4),
              b: Math.round(colors[r][c].b * 0.4)
            };
          }
        }
      }
      break;
    }

    case 'matrix': {
      // Tint everything green and filter characters to binary/symbols
      const binary = '01#$*@+:-. ';
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (grid[r][c] !== ' ') {
            grid[r][c] = binary[Math.floor(Math.random() * binary.length)];
            const lum = 0.299 * colors[r][c].r + 0.587 * colors[r][c].g + 0.114 * colors[r][c].b;
            colors[r][c] = { r: 0, g: Math.round(50 + lum * 0.8), b: 0 };
          }
        }
      }
      break;
    }

    case 'cyberpunk': {
      // Hot pink and neon blue/purple color mapping
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (grid[r][c] !== ' ') {
            const lum = 0.299 * colors[r][c].r + 0.587 * colors[r][c].g + 0.114 * colors[r][c].b;
            if (lum > 180) {
              colors[r][c] = { r: 255, g: 0, b: 128 }; // Cyber Magenta
            } else if (lum > 100) {
              colors[r][c] = { r: 0, g: 245, b: 255 }; // Cyber Cyan
            } else {
              colors[r][c] = { r: 120, g: 0, b: 220 }; // Cyber Purple
            }
          }
        }
      }
      break;
    }

    case 'retro': {
      // Phosphor amber glow
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          const lum = 0.299 * colors[r][c].r + 0.587 * colors[r][c].g + 0.114 * colors[r][c].b;
          colors[r][c] = { r: Math.round(lum), g: Math.round(lum * 0.5), b: 0 };
        }
      }
      break;
    }

    case 'blueprint': {
      // Blue background color & white outline/text
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (grid[r][c] !== ' ') {
            colors[r][c] = { r: 255, g: 255, b: 255 }; // pure white vectors
          }
        }
      }
      break;
    }

    case 'hologram': {
      // Tint cyan, scanlines, and jitter horizontal shifts
      const shift = frameIdx % 12 === 0 ? Math.floor(Math.sin(frameIdx) * 2) : 0;
      const copyRow = (rowIdx: number) => [...grid[rowIdx]];
      const copyRowCol = (rowIdx: number) => [...colors[rowIdx]];

      for (let r = 0; r < h; r++) {
        const rowGrid = copyRow(r);
        const rowCol = copyRowCol(r);

        // Apply scanline tint
        const scale = r % 3 === 0 ? 0.3 : 1;

        for (let c = 0; c < w; c++) {
          const targetC = (c - shift + w) % w;
          const char = rowGrid[targetC];
          grid[r][c] = char;

          if (char !== ' ') {
            const lum = 0.299 * rowCol[targetC].r + 0.587 * rowCol[targetC].g + 0.114 * rowCol[targetC].b;
            colors[r][c] = {
              r: Math.round(lum * 0.15 * scale),
              g: Math.round(lum * 0.85 * scale),
              b: Math.round(lum * 0.95 * scale) // Cyan glow
            };
          }
        }
      }
      break;
    }

    case 'vhs': {
      // VHS tracking line distortions + chromatic aberration color channel split
      const vhsLine = Math.floor((frameIdx * 3) % h);
      for (let r = 0; r < h; r++) {
        const isGlitchRow = Math.abs(r - vhsLine) < 3;
        const offset = isGlitchRow ? 3 : 1;

        for (let c = 0; c < w; c++) {
          if (grid[r][c] !== ' ') {
            const current = colors[r][c];
            const leftCol = colors[r][Math.max(0, c - offset)] || current;
            const rightCol = colors[r][Math.min(w - 1, c + offset)] || current;

            // Chromatic aberration: take red from left, green from center, blue from right
            colors[r][c] = {
              r: leftCol.r,
              g: current.g,
              b: rightCol.b
            };
          }
        }
      }
      break;
    }

    case 'neon': {
      // Glow filter: elevate saturated colors, dim whites
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          if (grid[r][c] !== ' ') {
            const cVal = colors[r][c];
            const maxVal = Math.max(cVal.r, cVal.g, cVal.b);
            if (maxVal > 0) {
              // Push saturation
              colors[r][c] = {
                r: cVal.r === maxVal ? 255 : Math.round(cVal.r * 0.5),
                g: cVal.g === maxVal ? 255 : Math.round(cVal.g * 0.5),
                b: cVal.b === maxVal ? 255 : Math.round(cVal.b * 0.5)
              };
            }
          }
        }
      }
      break;
    }

    default:
      break;
  }
}
