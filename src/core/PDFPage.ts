// src/core/PDFPage.ts
import { PDFArray, PDFDictionary, PDFIndirectReference, PDFResources } from '../types/PDFTypes';
import { Rectangle, Matrix } from '../types/ContentTypes';
import { ContentStreamParser } from '../content/ContentStreamParser';
import { GraphicsEngine } from '../renderer/GraphicsEngine';
import { PDFRenderer } from '../renderer/PDFRenderer';
import { PDFSecurityHandler } from '../security/PDFSecurityHandler';
import { PDFObjectResolver } from '../parsing/PDFObjectResolver';
import { assert } from 'console';

export interface RenderOptions {
  scale?: number;
  rotation?: number;
  cropBox?: Rectangle;
  backgroundColor?: string;
  transparency?: boolean;
}

export class PDFPage {
  readonly objectRef: PDFIndirectReference;
  readonly rawDict: PDFDictionary;
  readonly mediaBox: Rectangle;
  readonly cropBox: Rectangle;
  readonly bleedBox?: Rectangle;
  readonly trimBox?: Rectangle;
  readonly artBox?: Rectangle;
  readonly resources: PDFResources;
  readonly contents: PDFIndirectReference | PDFIndirectReference[];
  readonly annots?: PDFIndirectReference[];
  readonly rotate: number;
  readonly userUnit: number;
  readonly parent?: PDFIndirectReference;
  
  private streamParser: ContentStreamParser;
  private graphicsEngine: GraphicsEngine;
  private _parsedContent?: any[]; // Cache parsed content
  private _isContentParsed: boolean = false;

  constructor(
    objectRef: PDFIndirectReference,
    dict: PDFDictionary,
    resolver: PDFObjectResolver,
    securityHandler?: PDFSecurityHandler
  ) {
    this.objectRef = objectRef;
    this.rawDict = dict;
    
    // Parse required and optional box properties
    this.mediaBox = this.resolveBox(dict, 'MediaBox', resolver)!;
    this.cropBox = this.resolveBox(dict, 'CropBox', resolver) || this.mediaBox;
    this.bleedBox = this.resolveBox(dict, 'BleedBox', resolver);
    this.trimBox = this.resolveBox(dict, 'TrimBox', resolver);
    this.artBox = this.resolveBox(dict, 'ArtBox', resolver);
    
    // Parse other properties
    this.parent = dict.get('Parent') as PDFIndirectReference;
    this.resources = this.resolveResources(dict, resolver);
    this.contents = dict.get('Contents') as PDFIndirectReference | PDFIndirectReference[];
    this.annots = dict.get('Annots') as PDFIndirectReference[];
    this.rotate = (dict.get('Rotate') as number) || 0;
    this.userUnit = (dict.get('UserUnit') as number) || 1.0;
    
    this.streamParser = new ContentStreamParser(resolver, securityHandler);
    this.graphicsEngine = new GraphicsEngine();
  }

  private resolveBox(dict: PDFDictionary, boxName: string, resolver: PDFObjectResolver): Rectangle | undefined {
    const boxRef = dict.get(boxName) as number[];
    if (!boxRef) return undefined;
    assert(boxRef.length===4)
    return [boxRef[0], boxRef[1], boxRef[2], boxRef[3]];
  }

  private resolveResources(dict: PDFDictionary, resolver: PDFObjectResolver): PDFResources {
    let resourcesRef = dict.get('Resources') as PDFIndirectReference;
    
    // If no resources in current page, inherit from parent
    if (!resourcesRef && this.parent) {
      const parentDict = resolver.resolveIndirectReference(this.parent).value as PDFDictionary;
      if (parentDict) {
        resourcesRef = parentDict.get('Resources') as PDFIndirectReference;
      }
    }
    let resourcesDict = resolver.resolveIndirectReference(resourcesRef, true).value as PDFDictionary;
    let resources: PDFResources = {};
    resources.Font = resourcesDict.get('Font') as PDFDictionary ?? null;
    resources.XObject = resourcesDict.get('XObject') as PDFDictionary ?? null;
    resources.ExtGState = resourcesDict.get('ExtGState') as PDFDictionary ?? null;
    resources.ColorSpace = resourcesDict.get('ColorSpace') as PDFDictionary ?? null;
    resources.Pattern = resourcesDict.get('Pattern') as PDFDictionary ?? null;
    resources.Shading = resourcesDict.get('Shading') as PDFDictionary ?? null;
    resources.ProcSet = resourcesDict.get('ProcSet') as PDFArray ?? null;
    resources.Properties = resourcesDict.get('Properties') as PDFDictionary ?? null;

    return resources;
  }

  async render(renderer: PDFRenderer, options: RenderOptions = {}): Promise<void> {
    const scale = options.scale || 1.0;
    const rotation = options.rotation || this.rotate;
    const cropBox = options.cropBox || this.cropBox;
    
    // Parse content streams if not already done
    if (!this._isContentParsed) {
      this._parsedContent = await this.streamParser.parse(this.contents, this.resources);
      this._isContentParsed = true;
    }
    
    // Apply transformations
    const transform = this.calculateRenderTransform(scale, rotation, cropBox);
    
    // Render with graphics engine
    await this.graphicsEngine.render(
      this._parsedContent!,
      renderer.getCanvasContext(),
      cropBox,
      transform,
      options
    );
  }

  private calculateRenderTransform(scale: number, rotation: number, cropBox: Rectangle): Matrix {
    // Calculate transformation matrix based on scale, rotation, and crop box
    const width = this.getWidth();
    const height = this.getHeight();
    
    let matrix: Matrix = [scale, 0, 0, scale, 0, 0]; // Scale matrix
    
    // Apply rotation if needed
    if (rotation !== 0) {
      const rad = (rotation * Math.PI) / 180;
      const cos = Math.cos(rad);
      const sin = Math.sin(rad);
      
      // Rotation matrix
      const rotMatrix: Matrix = [cos, sin, -sin, cos, 0, 0];
      matrix = this.multiplyMatrices(matrix, rotMatrix);
      
      // Adjust for rotation center
      if (rotation === 90) {
        matrix[4] = height * scale;
      } else if (rotation === 180) {
        matrix[4] = width * scale;
        matrix[5] = height * scale;
      } else if (rotation === 270) {
        matrix[5] = width * scale;
      }
    }
    
    return matrix;
  }

  private multiplyMatrices(a: Matrix, b: Matrix): Matrix {
    return [
      a[0] * b[0] + a[2] * b[1],
      a[1] * b[0] + a[3] * b[1],
      a[0] * b[2] + a[2] * b[3],
      a[1] * b[2] + a[3] * b[3],
      a[0] * b[4] + a[2] * b[5] + a[4],
      a[1] * b[4] + a[3] * b[5] + a[5]
    ];
  }

  async renderToCanvas(canvas: HTMLCanvasElement, options: RenderOptions = {}): Promise<void> {
    const renderer = new PDFRenderer(canvas);
    await this.render(renderer, options);
  }

  async getTextContent(): Promise<string> {
    if (!this._isContentParsed) {
      this._parsedContent = await this.streamParser.parse(this.contents, this.resources);
      this._isContentParsed = true;
    }
    
    // Extract text from parsed content operations
    return this.streamParser.extractText(this._parsedContent!);
  }

  // Dimension getters
  getWidth(): number {
    return (this.cropBox[2] - this.cropBox[0]) * this.userUnit;
  }

  getHeight(): number {
    return (this.cropBox[3] - this.cropBox[1]) * this.userUnit;
  }

  getMediaBoxWidth(): number {
    return (this.mediaBox[2] - this.mediaBox[0]) * this.userUnit;
  }

  getMediaBoxHeight(): number {
    return (this.mediaBox[3] - this.mediaBox[1]) * this.userUnit;
  }

  // Property getters
  getMediaBox(): Rectangle {
    return [...this.mediaBox] as Rectangle;
  }

  getCropBox(): Rectangle {
    return [...this.cropBox] as Rectangle;
  }

  getBleedBox(): Rectangle | undefined {
    return this.bleedBox ? [...this.bleedBox] as Rectangle : undefined;
  }

  getTrimBox(): Rectangle | undefined {
    return this.trimBox ? [...this.trimBox] as Rectangle : undefined;
  }

  getArtBox(): Rectangle | undefined {
    return this.artBox ? [...this.artBox] as Rectangle : undefined;
  }

  getResources(): PDFResources {
    return this.resources;
  }

  getContents(): PDFIndirectReference | PDFIndirectReference[] {
    return this.contents;
  }

  getAnnotations(): PDFIndirectReference[] | undefined {
    return this.annots;
  }

  getRotation(): number {
    return this.rotate;
  }

  getUserUnit(): number {
    return this.userUnit;
  }

  getObjectRef(): PDFIndirectReference {
    return this.objectRef;
  }

  getRawDictionary(): PDFDictionary {
    return this.rawDict;
  }

  // Utility methods
  isLandscape(): boolean {
    const effectiveRotation = this.rotate % 180;
    const width = this.getWidth();
    const height = this.getHeight();
    
    return effectiveRotation === 0 ? width > height : height > width;
  }

  hasTransparency(): boolean {
    // Check if page has transparency groups or blend modes
    return this.rawDict.has('Group') || this.hasTransparentContent();
  }

  private hasTransparentContent(): boolean {
    // This would need to analyze the content stream for transparency
    // Placeholder implementation
    return false;
  }

  // Content caching control
  clearContentCache(): void {
    this._parsedContent = undefined;
    this._isContentParsed = false;
  }

  isContentCached(): boolean {
    return this._isContentParsed;
  }

  // Resource validation
  validateResources(): boolean {
    try {
      // Basic validation that required resources exist
      return this.resources !== null && typeof this.resources === 'object';
    } catch (error) {
      return false;
    }
  }

  // Debug information
  getDebugInfo(): object {
    return {
      objectRef: this.objectRef,
      mediaBox: this.mediaBox,
      cropBox: this.cropBox,
      rotation: this.rotate,
      userUnit: this.userUnit,
      hasAnnotations: !!this.annots?.length,
      hasContent: !!this.contents,
      isContentCached: this._isContentParsed,
      resourceKeys: this.resources ? Object.keys(this.resources) : []
    };
  }
}