declare module 'gifuct-js' {
  export interface GIFFrame {
    pixels: number[] | Uint8ClampedArray;
    dims: {
      width: number;
      height: number;
      top: number;
      left: number;
    };
    delay?: number;
    disposalType: number;
    transparentIndex: number;
    colorTable: number[][];
    patch?: Uint8ClampedArray;
    gce?: {
      delay: number;
      disposalMethod: number;
      transparentFlag: boolean;
      transparentIndex: number;
    };
  }

  export function parseGIF(buffer: ArrayBuffer): any;
  export function decompressFrames(parsedGif: any, buildPatch: boolean): GIFFrame[];
}
