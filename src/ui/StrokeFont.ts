import { stringToPaths } from 'hershey';

/**
 * Renders text using the Hershey vector font — line segments only, no fills.
 * Authentic to the vector display aesthetic of classic arcade games.
 *
 * Hershey coordinate system: y increases upward, y=12 is cap height, y=-9 is
 * descender. We flip y when rendering to canvas (y increases downward).
 */
export class StrokeFont {
  /**
   * Draw text on a canvas context.
   *
   * @param ctx   Canvas 2D rendering context
   * @param text  String to render
   * @param x     Left edge of the text in canvas pixels
   * @param y     Top edge of the text in canvas pixels
   * @param size  Total character height in pixels
   * @param color Stroke color (default white)
   * @param lineWidth Line thickness (default 1.5)
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
  ): number {
    if (!text.length) return 0;

    const result = stringToPaths(text, { font: 'futural' });
    const { minX, maxX, minY, maxY } = result.bounds;
    const hersheyHeight = maxY - minY;
    const scale = hersheyHeight > 0 ? size / hersheyHeight : 1;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    for (const path of result.paths) {
      if (path.length < 2) continue;
      ctx.beginPath();
      // Flip y: canvas_y = y + (maxY - py) * scale
      ctx.moveTo(
        x + (path[0][0] - minX) * scale,
        y + (maxY - path[0][1]) * scale,
      );
      for (let i = 1; i < path.length; i++) {
        ctx.lineTo(
          x + (path[i][0] - minX) * scale,
          y + (maxY - path[i][1]) * scale,
        );
      }
      ctx.stroke();
    }

    ctx.restore();

    return (maxX - minX) * scale;
  }

  /**
   * Measure the rendered width of a string without drawing it.
   */
  static measure(text: string, size: number): number {
    if (!text.length) return 0;
    const result = stringToPaths(text, { font: 'futural' });
    const { minX, maxX, minY, maxY } = result.bounds;
    const hersheyHeight = maxY - minY;
    const scale = hersheyHeight > 0 ? size / hersheyHeight : 1;
    return (maxX - minX) * scale;
  }
}
