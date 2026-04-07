declare module 'hershey' {
  interface HersheyBounds {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  }

  interface HersheyResult {
    bounds: HersheyBounds;
    paths: Array<Array<[number, number]>>;
  }

  interface HersheyOptions {
    font?: string;
  }

  export function stringToPaths(text: string, options?: HersheyOptions): HersheyResult;
  export function parseCharacterDescriptor(descriptor: string): unknown;
}
