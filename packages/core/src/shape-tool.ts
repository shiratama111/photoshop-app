/**
 * Shape Drawing Engine for Photoshop-like Application
 * All functions operate on ImageData at the pixel level
 */

export interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface DrawOptions {
  filled?: boolean;
  lineWidth?: number;
  cornerRadius?: number;
}

/**
 * Helper: Alpha-composite a pixel onto the imageData
 */
function setPixelBlend(data: Uint8ClampedArray, width: number, x: number, y: number, color: Color): void {
  const index = (y * width + x) * 4;

  if (x < 0 || y < 0 || x >= width || y >= data.length / width / 4) {
    return;
  }

  const srcAlpha = color.a / 255;
  const dstAlpha = data[index + 3] / 255;
  const outAlpha = srcAlpha + dstAlpha * (1 - srcAlpha);

  if (outAlpha === 0) {
    return;
  }

  data[index] = (color.r * srcAlpha + data[index] * dstAlpha * (1 - srcAlpha)) / outAlpha;
  data[index + 1] = (color.g * srcAlpha + data[index + 1] * dstAlpha * (1 - srcAlpha)) / outAlpha;
  data[index + 2] = (color.b * srcAlpha + data[index + 2] * dstAlpha * (1 - srcAlpha)) / outAlpha;
  data[index + 3] = outAlpha * 255;
}

/**
 * Helper: Clone ImageData
 */
function cloneImageData(imageData: ImageData): ImageData {
  const cloned = new ImageData(imageData.width, imageData.height);
  cloned.data.set(imageData.data);
  return cloned;
}

/**
 * Draws a rectangle on the imageData
 */
export function drawRectangle(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number,
  color: Color,
  options: DrawOptions = {}
): ImageData {
  const result = cloneImageData(imageData);
  const { filled = false, lineWidth = 1, cornerRadius = 0 } = options;

  if (cornerRadius > 0) {
    return drawRoundedRect(result, x, y, width, height, cornerRadius, color, { filled, lineWidth });
  }

  x = Math.round(x);
  y = Math.round(y);
  width = Math.round(width);
  height = Math.round(height);

  if (filled) {
    // Fill the rectangle
    for (let py = y; py < y + height; py++) {
      for (let px = x; px < x + width; px++) {
        setPixelBlend(result.data, result.width, px, py, color);
      }
    }
  } else {
    // Draw outline
    const halfWidth = Math.floor(lineWidth / 2);

    // Top and bottom edges
    for (let i = 0; i < width; i++) {
      for (let w = -halfWidth; w <= halfWidth; w++) {
        setPixelBlend(result.data, result.width, x + i, y + w, color);
        setPixelBlend(result.data, result.width, x + i, y + height - 1 + w, color);
      }
    }

    // Left and right edges
    for (let i = 0; i < height; i++) {
      for (let w = -halfWidth; w <= halfWidth; w++) {
        setPixelBlend(result.data, result.width, x + w, y + i, color);
        setPixelBlend(result.data, result.width, x + width - 1 + w, y + i, color);
      }
    }
  }

  return result;
}

/**
 * Draws an ellipse on the imageData
 */
export function drawEllipse(
  imageData: ImageData,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: Color,
  options: DrawOptions = {}
): ImageData {
  const result = cloneImageData(imageData);
  const { filled = false, lineWidth = 1 } = options;

  cx = Math.round(cx);
  cy = Math.round(cy);
  rx = Math.round(rx);
  ry = Math.round(ry);

  if (filled) {
    // Scanline fill algorithm
    for (let y = -ry; y <= ry; y++) {
      const xRadius = Math.sqrt((1 - (y * y) / (ry * ry)) * rx * rx);
      const x1 = Math.round(cx - xRadius);
      const x2 = Math.round(cx + xRadius);

      for (let x = x1; x <= x2; x++) {
        setPixelBlend(result.data, result.width, x, cy + y, color);
      }
    }
  } else {
    // Midpoint ellipse algorithm for outline
    const drawEllipsePoints = (x: number, y: number): void => {
      const halfWidth = Math.floor(lineWidth / 2);
      for (let w = -halfWidth; w <= halfWidth; w++) {
        setPixelBlend(result.data, result.width, cx + x, cy + y + w, color);
        setPixelBlend(result.data, result.width, cx - x, cy + y + w, color);
        setPixelBlend(result.data, result.width, cx + x, cy - y + w, color);
        setPixelBlend(result.data, result.width, cx - x, cy - y + w, color);
      }
    };

    let x = 0;
    let y = ry;
    const rx2 = rx * rx;
    const ry2 = ry * ry;
    const twoRx2 = 2 * rx2;
    const twoRy2 = 2 * ry2;
    let px = 0;
    let py = twoRx2 * y;

    // Region 1
    let p = Math.round(ry2 - (rx2 * ry) + (0.25 * rx2));
    while (px < py) {
      drawEllipsePoints(x, y);
      x++;
      px += twoRy2;
      if (p < 0) {
        p += ry2 + px;
      } else {
        y--;
        py -= twoRx2;
        p += ry2 + px - py;
      }
    }

    // Region 2
    p = Math.round(ry2 * (x + 0.5) * (x + 0.5) + rx2 * (y - 1) * (y - 1) - rx2 * ry2);
    while (y >= 0) {
      drawEllipsePoints(x, y);
      y--;
      py -= twoRx2;
      if (p > 0) {
        p += rx2 - py;
      } else {
        x++;
        px += twoRy2;
        p += rx2 - py + px;
      }
    }
  }

  return result;
}

/**
 * Draws a line using Bresenham's algorithm
 */
export function drawLine(
  imageData: ImageData,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: Color,
  lineWidth: number = 1
): ImageData {
  const result = cloneImageData(imageData);

  x1 = Math.round(x1);
  y1 = Math.round(y1);
  x2 = Math.round(x2);
  y2 = Math.round(y2);

  const dx = Math.abs(x2 - x1);
  const dy = Math.abs(y2 - y1);
  const sx = x1 < x2 ? 1 : -1;
  const sy = y1 < y2 ? 1 : -1;
  let err = dx - dy;

  const halfWidth = Math.floor(lineWidth / 2);

  for (;;) {
    // Draw thick line by drawing multiple pixels
    for (let wy = -halfWidth; wy <= halfWidth; wy++) {
      for (let wx = -halfWidth; wx <= halfWidth; wx++) {
        setPixelBlend(result.data, result.width, x1 + wx, y1 + wy, color);
      }
    }

    if (x1 === x2 && y1 === y2) break;

    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x1 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y1 += sy;
    }
  }

  return result;
}

/**
 * Draws a polygon from an array of points
 */
export function drawPolygon(
  imageData: ImageData,
  points: Point[],
  color: Color,
  options: DrawOptions = {}
): ImageData {
  let result = cloneImageData(imageData);
  const { filled = false, lineWidth = 1 } = options;

  if (points.length < 2) {
    return result;
  }

  if (filled) {
    // Scanline fill algorithm
    const minY = Math.floor(Math.min(...points.map(p => p.y)));
    const maxY = Math.ceil(Math.max(...points.map(p => p.y)));

    for (let y = minY; y <= maxY; y++) {
      const intersections: number[] = [];

      // Find all edge intersections with this scanline
      for (let i = 0; i < points.length; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % points.length];

        if ((p1.y <= y && p2.y > y) || (p2.y <= y && p1.y > y)) {
          const t = (y - p1.y) / (p2.y - p1.y);
          const x = p1.x + t * (p2.x - p1.x);
          intersections.push(x);
        }
      }

      // Sort intersections and fill between pairs
      intersections.sort((a, b) => a - b);
      for (let i = 0; i < intersections.length; i += 2) {
        if (i + 1 < intersections.length) {
          const x1 = Math.ceil(intersections[i]);
          const x2 = Math.floor(intersections[i + 1]);
          for (let x = x1; x <= x2; x++) {
            setPixelBlend(result.data, result.width, x, y, color);
          }
        }
      }
    }
  } else {
    // Draw outline by connecting points
    for (let i = 0; i < points.length; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % points.length];
      result = drawLine(result, p1.x, p1.y, p2.x, p2.y, color, lineWidth);
    }
  }

  return result;
}

/**
 * Draws a rectangle with rounded corners
 */
export function drawRoundedRect(
  imageData: ImageData,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: Color,
  options: DrawOptions = {}
): ImageData {
  let result = cloneImageData(imageData);
  const { filled = false, lineWidth = 1 } = options;

  x = Math.round(x);
  y = Math.round(y);
  width = Math.round(width);
  height = Math.round(height);
  radius = Math.min(radius, Math.min(width, height) / 2);

  if (filled) {
    // Fill main rectangles
    // Top and bottom rectangles
    for (let py = y + radius; py < y + height - radius; py++) {
      for (let px = x; px < x + width; px++) {
        setPixelBlend(result.data, result.width, px, py, color);
      }
    }

    // Top rectangle
    for (let py = y; py < y + radius; py++) {
      for (let px = x + radius; px < x + width - radius; px++) {
        setPixelBlend(result.data, result.width, px, py, color);
      }
    }

    // Bottom rectangle
    for (let py = y + height - radius; py < y + height; py++) {
      for (let px = x + radius; px < x + width - radius; px++) {
        setPixelBlend(result.data, result.width, px, py, color);
      }
    }

    // Fill corner circles
    const corners = [
      { cx: x + radius, cy: y + radius },
      { cx: x + width - radius, cy: y + radius },
      { cx: x + radius, cy: y + height - radius },
      { cx: x + width - radius, cy: y + height - radius }
    ];

    for (const corner of corners) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (dx * dx + dy * dy <= radius * radius) {
            setPixelBlend(result.data, result.width, corner.cx + dx, corner.cy + dy, color);
          }
        }
      }
    }
  } else {
    // Draw lines for the sides
    result = drawLine(result, x + radius, y, x + width - radius, y, color, lineWidth);
    result = drawLine(result, x + width, y + radius, x + width, y + height - radius, color, lineWidth);
    result = drawLine(result, x + width - radius, y + height, x + radius, y + height, color, lineWidth);
    result = drawLine(result, x, y + height - radius, x, y + radius, color, lineWidth);

    // Draw corner arcs
    const corners = [
      { cx: x + radius, cy: y + radius, start: Math.PI, end: Math.PI * 1.5 },
      { cx: x + width - radius, cy: y + radius, start: Math.PI * 1.5, end: Math.PI * 2 },
      { cx: x + radius, cy: y + height - radius, start: Math.PI * 0.5, end: Math.PI },
      { cx: x + width - radius, cy: y + height - radius, start: 0, end: Math.PI * 0.5 }
    ];

    for (const corner of corners) {
      const steps = Math.ceil(radius * Math.PI / 2);
      const angleStep = (corner.end - corner.start) / steps;

      for (let i = 0; i <= steps; i++) {
        const angle = corner.start + i * angleStep;
        const px = Math.round(corner.cx + Math.cos(angle) * radius);
        const py = Math.round(corner.cy + Math.sin(angle) * radius);

        const halfWidth = Math.floor(lineWidth / 2);
        for (let wy = -halfWidth; wy <= halfWidth; wy++) {
          for (let wx = -halfWidth; wx <= halfWidth; wx++) {
            setPixelBlend(result.data, result.width, px + wx, py + wy, color);
          }
        }
      }
    }
  }

  return result;
}
