import fontData from './hershey-futural.json';

interface CharData {
  bounds: { minX: number; maxX: number; minY: number; maxY: number };
  paths: Array<Array<[number, number]>>;
}

// Pre-extracted Hershey futural font data (y increases downward, canvas convention).
// minY = top of character, maxY = bottom of character.
const FONT = fontData as unknown as Record<string, CharData>;
const SPACE = FONT[' '];

// Total character height in Hershey units (same for all characters in this font).
const FONT_HEIGHT = SPACE.bounds.maxY - SPACE.bounds.minY; // 21

// Minimum accumulated path length (Hershey units) before a segment is committed.
// Higher = coarser, more angular letterforms. Font height is 21 units.
export const FONT_COARSENESS = 5;

/**
 * Renders text using the Hershey vector font — line segments only, no fills.
 * Authentic to the vector display aesthetic of classic arcade games.
 */
export class StrokeFont {
  /**
   * Draw text on a canvas context.
   *
   * @param ctx        Canvas 2D rendering context
   * @param text       String to render
   * @param x          Left edge of the text in canvas pixels
   * @param y          Top edge of the text in canvas pixels
   * @param size       Total character height in pixels
   * @param color      Stroke color (default white)
   * @param lineWidth  Line thickness (default 1.5)
   * @param coarseness Minimum accumulated path length (in Hershey units) before a
   *                   segment is committed. Higher values skip more intermediate
   *                   vertices, producing a coarser, lower-resolution look.
   *                   0 (default) draws every vertex exactly.
   * @returns Width of the rendered text in pixels
   */
  static draw(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    size: number,
    color = '#ffffff',
    lineWidth = 1.5,
    coarseness = 0,
  ): number {
    if (!text.length) return 0;

    const scale = FONT_HEIGHT > 0 ? size / FONT_HEIGHT : 1;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    let cursorX = 0;
    for (const ch of text) {
      const glyph = FONT[ch] ?? SPACE;
      const glyphLeft = glyph.bounds.minX;
      const glyphMaxY = glyph.bounds.maxY;

      for (const path of glyph.paths) {
        if (path.length < 2) continue;

        // Map a Hershey point to canvas coordinates.
        const cx = (pt: [number, number]) => x + (cursorX + pt[0] - glyphLeft) * scale;
        const cy = (pt: [number, number]) => y + (glyphMaxY - pt[1]) * scale;

        ctx.beginPath();
        ctx.moveTo(cx(path[0]), cy(path[0]));

        if (coarseness <= 0) {
          // Full-resolution: emit every vertex.
          for (let i = 1; i < path.length; i++) {
            ctx.lineTo(cx(path[i]), cy(path[i]));
          }
        } else {
          // Coarse mode: accumulate segment lengths and only commit a new
          // line segment once the threshold is reached.
          let lastPt = path[0];
          let acc = 0;
          for (let i = 1; i < path.length; i++) {
            const dx = path[i][0] - path[i - 1][0];
            const dy = path[i][1] - path[i - 1][1];
            acc += Math.sqrt(dx * dx + dy * dy);
            const isLast = i === path.length - 1;
            if (acc >= coarseness || isLast) {
              ctx.moveTo(cx(lastPt), cy(lastPt));
              ctx.lineTo(cx(path[i]), cy(path[i]));
              lastPt = path[i];
              acc = 0;
            }
          }
        }

        ctx.stroke();
      }

      cursorX += glyph.bounds.maxX - glyph.bounds.minX;
    }

    ctx.restore();

    return cursorX * scale;
  }

  /**
   * Measure the rendered width of a string without drawing it.
   */
  static measure(text: string, size: number): number {
    if (!text.length) return 0;
    const scale = FONT_HEIGHT > 0 ? size / FONT_HEIGHT : 1;
    let width = 0;
    for (const ch of text) {
      const glyph = FONT[ch] ?? SPACE;
      width += glyph.bounds.maxX - glyph.bounds.minX;
    }
    return width * scale;
  }
}
