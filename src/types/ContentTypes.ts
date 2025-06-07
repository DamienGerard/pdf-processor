// src/types/ContentTypes.ts

/**
 * Rectangle represented as [x1, y1, x2, y2] where (x1,y1) is bottom-left and (x2,y2) is top-right
 */
export type Rectangle = [number, number, number, number];

/**
 * Point in 2D space
 */
export interface Point {
  x: number;
  y: number;
}

/**
 * Size dimensions
 */
export interface Size {
  width: number;
  height: number;
}

/**
 * 2D Transformation Matrix [a, b, c, d, e, f]
 * Represents the transformation: x' = a*x + c*y + e, y' = b*x + d*y + f
 */
export type Matrix = [number, number, number, number, number, number];

/**
 * Color representation
 */
export interface Color {
  type: 'rgb' | 'cmyk' | 'gray' | 'pattern' | 'indexed';
  values: number[];
  alpha?: number;
}

/**
 * RGB Color
 */
export interface RGBColor {
  r: number; // 0-1
  g: number; // 0-1
  b: number; // 0-1
  alpha?: number; // 0-1
}

/**
 * CMYK Color
 */
export interface CMYKColor {
  c: number; // 0-1
  m: number; // 0-1
  y: number; // 0-1
  k: number; // 0-1
  alpha?: number; // 0-1
}

/**
 * Graphics State parameters
 */
export interface GraphicsState {
  // Current transformation matrix
  ctm: Matrix;
  
  // Color state
  fillColor: Color;
  strokeColor: Color;
  fillColorSpace?: string;
  strokeColorSpace?: string;
  
  // Line style
  lineWidth: number;
  lineCap: number; // 0=butt, 1=round, 2=square
  lineJoin: number; // 0=miter, 1=round, 2=bevel
  miterLimit: number;
  dashArray: number[];
  dashPhase: number;
  
  // Text state
  font?: string;
  fontSize: number;
  textMatrix: Matrix;
  textLineMatrix: Matrix;
  characterSpacing: number;
  wordSpacing: number;
  horizontalScaling: number;
  leading: number;
  textRise: number;
  textRenderingMode: number;
  
  // Rendering intent
  renderingIntent: string;
  
  // Transparency
  fillAlpha: number;
  strokeAlpha: number;
  blendMode: string;
  
  // Clipping path
  clippingPath?: Path2D;
  
  // Soft mask
  softMask?: any;
}

/**
 * Content Stream Operation
 */
export interface ContentOperation {
  operator: string;
  operands: any[];
  position?: number; // Position in stream for debugging
}

/**
 * Text Object state
 */
export interface TextObject {
  matrix: Matrix;
  lineMatrix: Matrix;
  x: number;
  y: number;
  isActive: boolean;
}

/**
 * Path construction commands
 */
export enum PathCommand {
  MOVE_TO = 'm',
  LINE_TO = 'l', 
  CURVE_TO = 'c',
  CLOSE = 'h',
  RECTANGLE = 're'
}

/**
 * Path segment
 */
export interface PathSegment {
  command: PathCommand;
  points: Point[];
}

/**
 * Complete path definition
 */
export interface PathDefinition {
  segments: PathSegment[];
  closed: boolean;
}

/**
 * Image data representation
 */
export interface ImageData {
  width: number;
  height: number;
  bitsPerComponent: number;
  colorSpace: string;
  data: Uint8Array;
  decode?: number[];
  imageMask?: boolean;
  mask?: Uint8Array;
  interpolate?: boolean;
}

/**
 * Font metrics
 */
export interface FontMetrics {
  ascent: number;
  descent: number;
  capHeight: number;
  xHeight: number;
  italicAngle: number;
  stemV: number;
  stemH: number;
  avgWidth: number;
  maxWidth: number;
  missingWidth: number;
  leading: number;
  bbox: Rectangle;
}

/**
 * Font descriptor
 */
export interface FontDescriptor {
  fontName: string;
  fontFamily?: string;
  fontStretch?: string;
  fontWeight?: number;
  flags: number;
  bbox: Rectangle;
  italicAngle: number;
  ascent: number;
  descent: number;
  leading: number;
  capHeight: number;
  xHeight: number;
  stemV: number;
  stemH: number;
  avgWidth: number;
  maxWidth: number;
  missingWidth: number;
  fontFile?: Uint8Array;
  fontFile2?: Uint8Array;
  fontFile3?: Uint8Array;
}

/**
 * Character metrics
 */
export interface CharacterMetrics {
  width: number;
  bbox?: Rectangle;
  name?: string;
  unicode?: string;
}

/**
 * Glyph representation
 */
export interface Glyph {
  unicode: string;
  width: number;
  bbox: Rectangle;
  path?: PathDefinition;
}

/**
 * Text span for rendering
 */
export interface TextSpan {
  text: string;
  font: string;
  fontSize: number;
  x: number;
  y: number;
  width: number;
  color: Color;
  transform?: Matrix;
}

/**
 * Annotation types
 */
export enum AnnotationType {
  TEXT = 'Text',
  LINK = 'Link',
  FREE_TEXT = 'FreeText',
  LINE = 'Line',
  SQUARE = 'Square',
  CIRCLE = 'Circle',
  POLYGON = 'Polygon',
  POLYLINE = 'PolyLine',
  HIGHLIGHT = 'Highlight',
  UNDERLINE = 'Underline',
  SQUIGGLY = 'Squiggly',
  STRIKEOUT = 'StrikeOut',
  STAMP = 'Stamp',
  CARET = 'Caret',
  INK = 'Ink',
  POPUP = 'Popup',
  FILE_ATTACHMENT = 'FileAttachment',
  SOUND = 'Sound',
  MOVIE = 'Movie',
  WIDGET = 'Widget',
  SCREEN = 'Screen',
  PRINTER_MARK = 'PrinterMark',
  TRAP_NET = 'TrapNet',
  WATERMARK = 'Watermark',
  THREE_D = '3D'
}

/**
 * Utility functions for working with rectangles
 */
export const RectangleUtils = {
  /**
   * Create rectangle from coordinates
   */
  create(x1: number, y1: number, x2: number, y2: number): Rectangle {
    return [x1, y1, x2, y2];
  },

  /**
   * Get width of rectangle
   */
  getWidth(rect: Rectangle): number {
    return rect[2] - rect[0];
  },

  /**
   * Get height of rectangle
   */
  getHeight(rect: Rectangle): number {
    return rect[3] - rect[1];
  },

  /**
   * Check if rectangles intersect
   */
  intersects(rect1: Rectangle, rect2: Rectangle): boolean {
    return !(rect1[2] < rect2[0] || rect2[2] < rect1[0] || 
             rect1[3] < rect2[1] || rect2[3] < rect1[1]);
  },

  /**
   * Get intersection of two rectangles
   */
  intersection(rect1: Rectangle, rect2: Rectangle): Rectangle | null {
    const x1 = Math.max(rect1[0], rect2[0]);
    const y1 = Math.max(rect1[1], rect2[1]);
    const x2 = Math.min(rect1[2], rect2[2]);
    const y2 = Math.min(rect1[3], rect2[3]);
    
    if (x1 >= x2 || y1 >= y2) return null;
    return [x1, y1, x2, y2];
  },

  /**
   * Check if point is inside rectangle
   */
  containsPoint(rect: Rectangle, point: Point): boolean {
    return point.x >= rect[0] && point.x <= rect[2] && 
           point.y >= rect[1] && point.y <= rect[3];
  },

  /**
   * Transform rectangle by matrix
   */
  transform(rect: Rectangle, matrix: Matrix): Rectangle {
    const corners = [
      { x: rect[0], y: rect[1] },
      { x: rect[2], y: rect[1] },
      { x: rect[2], y: rect[3] },
      { x: rect[0], y: rect[3] }
    ];

    const transformed = corners.map(corner => 
      MatrixUtils.transformPoint(corner, matrix)
    );

    const xs = transformed.map(p => p.x);
    const ys = transformed.map(p => p.y);

    return [
      Math.min(...xs),
      Math.min(...ys), 
      Math.max(...xs),
      Math.max(...ys)
    ];
  }
};

/**
 * Utility functions for working with matrices
 */
export const MatrixUtils = {
  /**
   * Identity matrix
   */
  identity(): Matrix {
    return [1, 0, 0, 1, 0, 0];
  },

  /**
   * Translation matrix
   */
  translate(tx: number, ty: number): Matrix {
    return [1, 0, 0, 1, tx, ty];
  },

  /**
   * Scale matrix
   */
  scale(sx: number, sy: number): Matrix {
    return [sx, 0, 0, sy, 0, 0];
  },

  /**
   * Rotation matrix
   */
  rotate(angle: number): Matrix {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [cos, sin, -sin, cos, 0, 0];
  },

  /**
   * Multiply two matrices
   */
  multiply(a: Matrix, b: Matrix): Matrix {
    return [
      a[0] * b[0] + a[2] * b[1],
      a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3],
      a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4],
      a[1] * b[4] + a[3] * b[5] + a[5]
    ];
  },

  /**
   * Transform point by matrix
   */
  transformPoint(point: Point, matrix: Matrix): Point {
    return {
      x: matrix[0] * point.x + matrix[2] * point.y + matrix[4],
      y: matrix[1] * point.x + matrix[3] * point.y + matrix[5]
    };
  },

  /**
   * Get matrix determinant
   */
  determinant(matrix: Matrix): number {
    return matrix[0] * matrix[3] - matrix[1] * matrix[2];
  },

  /**
   * Invert matrix
   */
  invert(matrix: Matrix): Matrix | null {
    const det = this.determinant(matrix);
    if (Math.abs(det) < 1e-10) return null;

    return [
      matrix[3] / det,
      -matrix[1] / det,
      -matrix[2] / det,
      matrix[0] / det,
      (matrix[2] * matrix[5] - matrix[3] * matrix[4]) / det,
      (matrix[1] * matrix[4] - matrix[0] * matrix[5]) / det
    ];
  }
};

/**
 * Color utility functions
 */
export const ColorUtils = {
  /**
   * Create RGB color
   */
  rgb(r: number, g: number, b: number, alpha: number = 1): RGBColor {
    return { r: Math.max(0, Math.min(1, r)), 
             g: Math.max(0, Math.min(1, g)), 
             b: Math.max(0, Math.min(1, b)), 
             alpha };
  },

  /**
   * Convert RGB to hex string
   */
  rgbToHex(color: RGBColor): string {
    const r = Math.round(color.r * 255);
    const g = Math.round(color.g * 255);
    const b = Math.round(color.b * 255);
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  },

  /**
   * Convert CMYK to RGB (basic conversion)
   */
  cmykToRgb(color: CMYKColor): RGBColor {
    const r = 1 - Math.min(1, color.c * (1 - color.k) + color.k);
    const g = 1 - Math.min(1, color.m * (1 - color.k) + color.k);
    const b = 1 - Math.min(1, color.y * (1 - color.k) + color.k);
    return { r, g, b, alpha: color.alpha };
  }
};