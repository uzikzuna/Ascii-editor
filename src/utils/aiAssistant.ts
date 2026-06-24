import type { WorkerOptions } from './asciiWorker';

export interface AISuggestion {
  message: string;
  actionId: string;
  parameters: Partial<WorkerOptions>;
}

export function analyzeAsciiMetrics(
  stats: {
    accuracyScore: number;
    detailPreservationScore: number;
    facesDetected: number;
    textDetected: boolean;
    logoDetected: boolean;
  },
  options: WorkerOptions
): AISuggestion[] {
  const suggestions: AISuggestion[] = [];

  if (stats.accuracyScore < 70) {
    suggestions.push({
      message: "The accuracy score is low. Try increasing contrast and using the 'extended' character set.",
      actionId: 'increase_contrast',
      parameters: { contrast: Math.min(100, options.contrast + 15), charMode: 'extended' }
    });
  }

  if (stats.facesDetected > 0 && options.charMode !== 'manga') {
    suggestions.push({
      message: `${stats.facesDetected} skin/face regions detected! The 'manga' character mode is highly optimized for skin tones.`,
      actionId: 'set_manga_mode',
      parameters: { charMode: 'manga', brightness: options.brightness + 5 }
    });
  }

  if (stats.textDetected && options.edgeDetection !== 'sobel') {
    suggestions.push({
      message: "Typography/Text elements detected. Sobel Edge Mapping will align characters along lines.",
      actionId: 'enable_sobel',
      parameters: { edgeDetection: 'sobel', edgeWeight: 60, sharpness: Math.max(options.sharpness, 40) }
    });
  }

  if (options.brightness < -10) {
    suggestions.push({
      message: "The canvas is dark. Apply a slight brightness boost to reveal shadows.",
      actionId: 'boost_brightness',
      parameters: { brightness: 10 }
    });
  }

  if (stats.detailPreservationScore < 50 && options.dithering === 'none') {
    suggestions.push({
      message: "Fine textures are losing detail. Enable Floyd-Steinberg dithering for smooth gradients.",
      actionId: 'enable_dithering',
      parameters: { dithering: 'floyd-steinberg' }
    });
  }

  return suggestions;
}

export function handleAIChatCommand(
  input: string,
  currentOptions: WorkerOptions
): { reply: string; updatedOptions?: Partial<WorkerOptions> } {
  const query = input.toLowerCase();

  if (query.includes('contrast') || query.includes('pop') || query.includes('punchy')) {
    return {
      reply: "Calibrating sensor contrast profile (+20). This stretches the dynamic range to make edges pop.",
      updatedOptions: { contrast: Math.min(100, currentOptions.contrast + 20) }
    };
  }

  if (query.includes('bright') || query.includes('dark') || query.includes('light')) {
    return {
      reply: "Recalibrating brightness (+15) to reveal shadows and middle-tones.",
      updatedOptions: { brightness: Math.min(100, currentOptions.brightness + 15) }
    };
  }

  if (query.includes('green') || query.includes('retro') || query.includes('terminal')) {
    return {
      reply: "Recalibrating phosphor output: switching chromatic theme to classic Green Terminal.",
      updatedOptions: { colorMode: 'green' }
    };
  }

  if (query.includes('matrix') || query.includes('digital rain')) {
    return {
      reply: "Injecting code matrix overlay. Character mode calibrated to Matrix glyphs.",
      updatedOptions: { charMode: 'matrix', colorMode: 'green', backgroundColorMode: 'match' }
    };
  }

  if (query.includes('cyberpunk') || query.includes('neon')) {
    return {
      reply: "Applying Cyberpunk spectrum loop (magenta/cyan neon saturation levels).",
      updatedOptions: { colorMode: 'neon', backgroundColorMode: 'custom', customBgColor: '#0a0512' }
    };
  }

  if (query.includes('sharp') || query.includes('blurry') || query.includes('detail')) {
    return {
      reply: "Injecting unsharp convolution filters. Fine edge tracking is boosted.",
      updatedOptions: { sharpness: 60, deblur: 40 }
    };
  }

  if (query.includes('clean') || query.includes('noise')) {
    return {
      reply: "Activating 3x3 Median noise dampener to clear single isolated pixel debris.",
      updatedOptions: { noiseReduction: 50, beautifyNoiseCleanup: true }
    };
  }

  return {
    reply: "ASCII Forge AI standing by. I can optimize contrast, apply themes (Green, Matrix, Cyberpunk), clean up noise, or sharpen blurry edges. Try asking 'make it sharper' or 'set green screen'."
  };
}
