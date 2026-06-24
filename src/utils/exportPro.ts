
export function exportToTxt(grid: string[][], options?: Record<string, any>): string {
  const art = grid.map((row) => row.join('')).join('\n');
  if (options) {
    const meta = `/* ASCII FORGE PRO PROJECT METADATA\n${JSON.stringify(options, null, 2)}\n*/\n`;
    return meta + art;
  }
  return art;
}

export function exportToHtml(
  grid: string[][],
  colors: { r: number; g: number; b: number }[][],
  bgColors: { r: number; g: number; b: number }[][],
  fontFamily: string = 'monospace'
): string {
  const h = grid.length;
  const w = grid[0]?.length || 0;

  let body = '';
  for (let r = 0; r < h; r++) {
    let line = '';
    for (let c = 0; c < w; c++) {
      const char = grid[r][c];
      const fg = colors[r]?.[c] ?? { r: 255, g: 255, b: 255 };
      const bg = bgColors[r]?.[c];
      const escapedChar = char
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

      const style = bg
        ? `color: rgb(${fg.r},${fg.g},${fg.b}); background-color: rgb(${bg.r},${bg.g},${bg.b});`
        : `color: rgb(${fg.r},${fg.g},${fg.b});`;

      line += `<span style="${style}">${escapedChar === ' ' ? '&nbsp;' : escapedChar}</span>`;
    }
    body += line + '\n';
  }

  return `<!DOCTYPE html>
<html>
<head>
  <title>ASCII Forge Pro Export</title>
  <style>
    body {
      background-color: #030712;
      color: #f3f4f6;
      margin: 0;
      padding: 20px;
      font-family: ${fontFamily};
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 90vh;
    }
    pre {
      font-size: 10px;
      line-height: 10px;
      letter-spacing: 0;
      word-spacing: 0;
      white-space: pre-wrap;
      font-family: ${fontFamily}, monospace;
      padding: 10px;
      border-radius: 8px;
      border: 1px solid #1f2937;
      background-color: #080e1a;
      box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.5);
    }
  </style>
</head>
<body>
  <pre>${body}</pre>
</body>
</html>`;
}

export function exportToSvg(
  grid: string[][],
  colors: { r: number; g: number; b: number }[][],
  bgColors: { r: number; g: number; b: number }[][],
  fontFamily: string = 'monospace'
): string {
  const h = grid.length;
  const w = grid[0]?.length || 0;
  const charWidth = 7;
  const charHeight = 11;
  const svgWidth = w * charWidth;
  const svgHeight = h * charHeight;

  let textNodes = '';
  // Draw background color rects if exists
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const bg = bgColors[r]?.[c];
      if (bg) {
        textNodes += `<rect x="${c * charWidth}" y="${r * charHeight}" width="${charWidth}" height="${charHeight}" fill="rgb(${bg.r},${bg.g},${bg.b})" />\n`;
      }
    }
  }

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const char = grid[r][c];
      if (char === ' ') continue;
      const fg = colors[r]?.[c] ?? { r: 255, g: 255, b: 255 };
      const escapedChar = char
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      
      textNodes += `<text x="${c * charWidth}" y="${r * charHeight + charHeight - 2}" fill="rgb(${fg.r},${fg.g},${fg.b})" font-size="10" font-family="${fontFamily}" font-weight="bold">${escapedChar}</text>\n`;
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}">
  <style>
    text {
      dominant-baseline: alphabetic;
      white-space: pre;
    }
  </style>
  <rect width="100%" height="100%" fill="#030712" />
  ${textNodes}
</svg>`;
}

// Client-side MP4/WebM recording for Canvas Animations using MediaRecorder API
export function recordCanvasTimeline(
  canvas: HTMLCanvasElement,
  fps: number,
  durationMs: number,
  onProgress: (pct: number) => void,
  onComplete: (blob: Blob) => void
) {
  const stream = canvas.captureStream(fps);
  const chunks: Blob[] = [];

  const mediaRecorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp9'
  });

  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  mediaRecorder.onstop = () => {
    const finalBlob = new Blob(chunks, { type: 'video/webm' });
    onComplete(finalBlob);
  };

  // Start recording
  mediaRecorder.start();

  const startTime = Date.now();
  const interval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const progress = Math.min(100, (elapsed / durationMs) * 100);
    onProgress(progress);

    if (elapsed >= durationMs) {
      clearInterval(interval);
      mediaRecorder.stop();
    }
  }, 100);
}
