// src/core/__tests__/PDFPage.test.ts
import { PDFPage, RenderOptions } from '../../src/core/PDFPage';
import { PDFDictionary, PDFIndirectObject, PDFIndirectReference, PDFResources, PDFStream } from '../../src/types/PDFTypes';
import { Rectangle, Matrix } from '../../src/types/ContentTypes';
import { ContentStreamParser } from '../../src/content/ContentStreamParser';
import { GraphicsEngine } from '../../src/renderer/GraphicsEngine';
import { PDFRenderer } from '../../src/renderer/PDFRenderer';
import { PDFObjectResolver } from '../../src/parsing/PDFObjectResolver';
import { PDFSecurityHandler } from '../../src/security/PDFSecurityHandler';

// Mock dependencies
jest.mock('../../src/content/ContentStreamParser');
jest.mock('../../src/renderer/GraphicsEngine');
jest.mock('../../src/renderer/PDFRenderer');
jest.mock('console', () => ({
  assert: jest.fn()
}));

describe('PDFPage', () => {
  let resolver: PDFObjectResolver;
  let mockStreamParser: jest.Mocked<ContentStreamParser>;
  let mockGraphicsEngine: jest.Mocked<GraphicsEngine>;
  let mockRenderer: jest.Mocked<PDFRenderer>;
  let mockCanvas: jest.Mocked<HTMLCanvasElement>;
  let mockContext: jest.Mocked<CanvasRenderingContext2D>;

  // Sample PDF data - represents a simple PDF page object
  const samplePDFData = createSamplePDFData();

  const mockObjectRef: PDFIndirectReference = { objectNumber: 1, generationNumber: 0 };
  const mockMediaBox: Rectangle = [0, 0, 612, 792];
  const mockCropBox: Rectangle = [10, 10, 602, 782];
  const mockContents: PDFIndirectReference = { objectNumber: 2, generationNumber: 0 };

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Create a real PDFObjectResolver with sample data
    resolver = new PDFObjectResolver(samplePDFData);

   // Mock only the rendering components
   mockStreamParser = {
    parse: jest.fn(),
    extractText: jest.fn()
  } as any;

  mockGraphicsEngine = {
    render: jest.fn()
  } as any;

  mockContext = {} as any;
  mockCanvas = {} as any;
  mockRenderer = {
    getCanvasContext: jest.fn().mockReturnValue(mockContext)
  } as any;

  (ContentStreamParser as jest.Mock).mockReturnValue(mockStreamParser);
  (GraphicsEngine as jest.Mock).mockReturnValue(mockGraphicsEngine);
  (PDFRenderer as jest.Mock).mockReturnValue(mockRenderer);

  // Setup default mock behaviors
  mockStreamParser.parse.mockResolvedValue(['mock', 'content', 'operations']);
  mockStreamParser.extractText.mockReturnValue('Sample text content from PDF');
});

describe('Real PDF Object Integration', () => {
  it('should create PDFPage from actual PDF dictionary structure', () => {
    const pageRef: PDFIndirectReference = { objectNumber: 4, generationNumber: 0 };
    const pageDict = resolver.resolveIndirectReference(pageRef).value as PDFDictionary;

    const page = new PDFPage(pageRef, pageDict, resolver);

    expect(page.objectRef).toEqual(pageRef);
    expect(page.mediaBox).toEqual([0, 0, 612, 792]); // US Letter size
    expect(page.cropBox).toEqual([0, 0, 612, 792]);
    expect(page.rotate).toBe(0);
    expect(page.userUnit).toBe(1.0);
    expect(page.getWidth()).toBe(612);
    expect(page.getHeight()).toBe(792);
  });

  it('should resolve resources from actual PDF structure', () => {
    const pageRef: PDFIndirectReference = { objectNumber: 4, generationNumber: 0 };
    const pageDict = resolver.resolveIndirectReference(pageRef).value as PDFDictionary;

    const page = new PDFPage(pageRef, pageDict, resolver);
    const resources = page.getResources();

    expect(resources).toBeDefined();
    expect(resources.Font).toBeDefined();
    expect(resources.ProcSet).toBeDefined();
    expect(Array.isArray(resources.ProcSet)).toBe(true);
  });

  it('should handle multiple content streams', () => {
    const pageRef: PDFIndirectReference = { objectNumber: 5, generationNumber: 0 }; // Page with multiple streams
    const pageDict = resolver.resolveIndirectReference(pageRef).value as PDFDictionary;

    const page = new PDFPage(pageRef, pageDict, resolver);
    const contents = page.getContents();

    expect(Array.isArray(contents)).toBe(true);
    expect((contents as PDFIndirectReference[]).length).toBe(2);
  });

  it('should handle rotated pages correctly', () => {
    const pageRef: PDFIndirectReference = { objectNumber: 6, generationNumber: 0 }; // Rotated page
    const pageDict = resolver.resolveIndirectReference(pageRef).value as PDFDictionary;

    const page = new PDFPage(pageRef, pageDict, resolver);

    expect(page.getRotation()).toBe(90);
    expect(page.isLandscape()).toBe(true);
  });

  it('should parse page with custom crop box', () => {
    const pageRef: PDFIndirectReference = { objectNumber: 7, generationNumber: 0 }; // Page with crop box
    const pageDict = resolver.resolveIndirectReference(pageRef).value as PDFDictionary;

    const page = new PDFPage(pageRef, pageDict, resolver);

    expect(page.getCropBox()).toEqual([50, 50, 562, 742]);
    expect(page.getWidth()).toBe(512); // 562 - 50
    expect(page.getHeight()).toBe(692); // 742 - 50
  });

  it('should handle page with annotations', () => {
    const pageRef: PDFIndirectReference = { objectNumber: 8, generationNumber: 0 }; // Page with annotations
    const pageDict = resolver.resolveIndirectReference(pageRef).value as PDFDictionary;

    const page = new PDFPage(pageRef, pageDict, resolver);
    const annotations = page.getAnnotations();

    expect(annotations).toBeDefined();
    expect(Array.isArray(annotations)).toBe(true);
    expect(annotations!.length).toBe(2);
  });

  it('should inherit resources from parent page tree', () => {
    const pageRef: PDFIndirectReference = { objectNumber: 9, generationNumber: 0 }; // Child page
    const pageDict = resolver.resolveIndirectReference(pageRef).value as PDFDictionary;

    const page = new PDFPage(pageRef, pageDict, resolver);
    const resources = page.getResources();

    // Should have inherited font from parent
    expect(resources.Font).toBeDefined();
    expect(page.validateResources()).toBe(true);
  });
});

describe('Integration with Real Content Streams', () => {
  it('should render page with actual content stream references', async () => {
    const pageRef: PDFIndirectReference = { objectNumber: 4, generationNumber: 0 };
    const pageDict = resolver.resolveIndirectReference(pageRef).value as PDFDictionary;
    const page = new PDFPage(pageRef, pageDict, resolver);

    await page.render(mockRenderer);

    expect(mockStreamParser.parse).toHaveBeenCalledWith(
      { objectNumber: 10, generationNumber: 0 }, // Content stream reference
      page.getResources()
    );
    expect(mockGraphicsEngine.render).toHaveBeenCalled();
  });

  it('should extract text from real content streams', async () => {
    const pageRef: PDFIndirectReference = { objectNumber: 4, generationNumber: 0 };
    const pageDict = resolver.resolveIndirectReference(pageRef).value as PDFDictionary;
    const page = new PDFPage(pageRef, pageDict, resolver);

    const text = await page.getTextContent();

    expect(mockStreamParser.parse).toHaveBeenCalled();
    expect(mockStreamParser.extractText).toHaveBeenCalledWith(['mock', 'content', 'operations']);
    expect(text).toBe('Sample text content from PDF');
  });

  it('should handle rendering with custom options on real page', async () => {
    const pageRef: PDFIndirectReference = { objectNumber: 6, generationNumber: 0 }; // Rotated page
    const pageDict = resolver.resolveIndirectReference(pageRef).value as PDFDictionary;
    const page = new PDFPage(pageRef, pageDict, resolver);

    const options: RenderOptions = {
      scale: 1.5,
      rotation: 180,
      backgroundColor: '#ffffff'
    };

    await page.render(mockRenderer, options);

    const renderCall = mockGraphicsEngine.render.mock.calls[0];
    expect(renderCall[2]).toEqual(page.getCropBox()); // cropBox
    expect(renderCall[4]).toEqual(expect.objectContaining(options)); // options
  });
});

describe('Real PDF Edge Cases', () => {
  it('should handle page with missing optional properties', () => {
    const pageRef: PDFIndirectReference = { objectNumber: 11, generationNumber: 0 }; // Minimal page
    const pageDict = resolver.resolveIndirectReference(pageRef).value as PDFDictionary;

    const page = new PDFPage(pageRef, pageDict, resolver);

    expect(page.getBleedBox()).toBeUndefined();
    expect(page.getTrimBox()).toBeUndefined();
    expect(page.getArtBox()).toBeUndefined();
    expect(page.getAnnotations()).toBeUndefined();
  });

  it('should handle page with UserUnit scaling', () => {
    const pageRef: PDFIndirectReference = { objectNumber: 12, generationNumber: 0 }; // Page with UserUnit
    const pageDict = resolver.resolveIndirectReference(pageRef).value as PDFDictionary;

    const page = new PDFPage(pageRef, pageDict, resolver);

    expect(page.getUserUnit()).toBe(2.0);
    expect(page.getWidth()).toBe(1224); // 612 * 2.0
    expect(page.getHeight()).toBe(1584); // 792 * 2.0
  });

  it('should provide accurate debug information for real page', () => {
    const pageRef: PDFIndirectReference = { objectNumber: 8, generationNumber: 0 }; // Page with annotations
    const pageDict = resolver.resolveIndirectReference(pageRef).value as PDFDictionary;

    const page = new PDFPage(pageRef, pageDict, resolver);
    const debugInfo = page.getDebugInfo();

    expect(debugInfo).toEqual({
      objectRef: pageRef,
      mediaBox: [0, 0, 612, 792],
      cropBox: [0, 0, 612, 792],
      rotation: 0,
      userUnit: 1.0,
      hasAnnotations: true,
      hasContent: true,
      isContentCached: false,
      resourceKeys: expect.arrayContaining(['Font', 'ProcSet'])
    });
  });
});

describe('Matrix Transformations with Real Data', () => {
  it('should calculate correct transformations for rotated page', async () => {
    const pageRef: PDFIndirectReference = { objectNumber: 6, generationNumber: 0 }; // 90° rotated page
    const pageDict = resolver.resolveIndirectReference(pageRef).value as PDFDictionary;
    const page = new PDFPage(pageRef, pageDict, resolver);

    await page.render(mockRenderer);

    const renderCall = mockGraphicsEngine.render.mock.calls[0];
    const transform = renderCall[3] as Matrix;

    // Should include rotation from page dictionary
    expect(transform[0]).toBeCloseTo(0, 5); // cos(90°)
    expect(transform[1]).toBeCloseTo(1, 5); // sin(90°)
    expect(transform[2]).toBeCloseTo(-1, 5); // -sin(90°)
    expect(transform[3]).toBeCloseTo(0, 5); // cos(90°)
  });
});
});

// Helper function to create sample PDF data structure
// Helper function to create sample PDF data structure
function createSamplePDFData(): Map<string, PDFIndirectObject> {
  // Create PDF dictionaries that match real PDF structure
  const createDict = (entries: [string, any][]): PDFDictionary => {
    const dict = new Map<string, any>();
    entries.forEach(([key, value]) => dict.set(key, value));
    return dict as PDFDictionary;
  };

  // Helper to create PDF reference
  const ref = (objNum: number, genNum: number = 0): PDFIndirectReference => ({
    objectNumber: objNum,
    generationNumber: genNum
  });

  // Root Catalog (object 1)
  const catalogDict = createDict([
    ['Type', 'Catalog'],
    ['Version', '1.7'],
    ['Pages', ref(2)],
    ['PageMode', 'UseNone'],
    ['PageLayout', 'SinglePage']
  ]);

  // Root Pages object (object 2)
  const pagesDict = createDict([
    ['Type', 'Pages'],
    ['Kids', [
      ref(4), ref(5), ref(6), ref(7), 
      ref(8), ref(9), ref(11), ref(12)
    ]],
    ['Count', 8],
    ['Resources', ref(3)]
  ]);

  // Resources object (object 3)
  const resourcesDict = createDict([
    ['Font', createDict([
      ['F1', ref(14)],
      ['F2', ref(25)]
    ])],
    ['ProcSet', ['PDF', 'Text', 'ImageC']],
    ['XObject', createDict([
      ['Im1', ref(26)]
    ])],
    ['ExtGState', createDict([
      ['GS1', ref(27)]
    ])]
  ]);

  // Font objects
  const font1Dict = createDict([
    ['Type', 'Font'],
    ['Subtype', 'Type1'],
    ['BaseFont', 'Helvetica'],
    ['Encoding', 'WinAnsiEncoding']
  ]);

  const font2Dict = createDict([
    ['Type', 'Font'],
    ['Subtype', 'Type1'],
    ['BaseFont', 'Times-Roman'],
    ['Encoding', 'WinAnsiEncoding']
  ]);

  // Graphics State object
  const gstateDict = createDict([
    ['Type', 'ExtGState'],
    ['CA', 0.5],  // Stroke alpha
    ['ca', 0.5]   // Fill alpha
  ]);

  // Image XObject (placeholder)
  const imageDict = createDict([
    ['Type', 'XObject'],
    ['Subtype', 'Image'],
    ['Width', 100],
    ['Height', 100],
    ['ColorSpace', 'DeviceRGB'],
    ['BitsPerComponent', 8],
    ['Length', 30000]
  ]);

  // Standard page (US Letter) - object 4
  const page1Dict = createDict([
    ['Type', 'Page'],
    ['Parent', ref(2)],
    ['MediaBox', [0, 0, 612, 792]],
    ['Resources', ref(3)],
    ['Contents', ref(10)],
    ['Rotate', 0],
    ['UserUnit', 1.0]
  ]);

  // Page with multiple content streams - object 5
  const page2Dict = createDict([
    ['Type', 'Page'],
    ['Parent', ref(2)],
    ['MediaBox', [0, 0, 612, 792]],
    ['Resources', ref(3)],
    ['Contents', [ref(15), ref(16)]]
  ]);

  // Rotated page (90 degrees) - object 6
  const page3Dict = createDict([
    ['Type', 'Page'],
    ['Parent', ref(2)],
    ['MediaBox', [0, 0, 612, 792]],
    ['Resources', ref(3)],
    ['Contents', ref(17)],
    ['Rotate', 90]
  ]);

  // Page with custom crop box - object 7
  const page4Dict = createDict([
    ['Type', 'Page'],
    ['Parent', ref(2)],
    ['MediaBox', [0, 0, 612, 792]],
    ['CropBox', [50, 50, 562, 742]], // 1 inch margins
    ['Resources', ref(3)],
    ['Contents', ref(18)]
  ]);

  // Page with annotations - object 8
  const page5Dict = createDict([
    ['Type', 'Page'],
    ['Parent', ref(2)],
    ['MediaBox', [0, 0, 612, 792]],
    ['Resources', ref(3)],
    ['Contents', ref(19)],
    ['Annots', [ref(20), ref(21)]]
  ]);

  // Child page (inherits resources from parent) - object 9
  const page6Dict = createDict([
    ['Type', 'Page'],
    ['Parent', ref(2)],
    ['MediaBox', [0, 0, 612, 792]],
    ['Contents', ref(22)]
    // No Resources - should inherit from parent
  ]);

  // A4 page with different dimensions - object 11
  const page7Dict = createDict([
    ['Type', 'Page'],
    ['Parent', ref(2)],
    ['MediaBox', [0, 0, 595, 842]], // A4 dimensions
    ['Resources', ref(3)],
    ['Contents', ref(23)]
  ]);

  // Page with UserUnit scaling - object 12
  const page8Dict = createDict([
    ['Type', 'Page'],
    ['Parent', ref(2)],
    ['MediaBox', [0, 0, 612, 792]],
    ['Resources', ref(3)],
    ['Contents', ref(24)],
    ['UserUnit', 2.0] // Scale up by 2x
  ]);

  // Annotation objects
  const linkAnnotDict = createDict([
    ['Type', 'Annot'],
    ['Subtype', 'Link'],
    ['Rect', [100, 700, 200, 720]],
    ['Border', [0, 0, 1]],
    ['A', createDict([
      ['Type', 'Action'],
      ['S', 'URI'],
      ['URI', 'https://example.com']
    ])]
  ]);

  const textAnnotDict = createDict([
    ['Type', 'Annot'],
    ['Subtype', 'Text'],
    ['Rect', [300, 700, 320, 720]],
    ['Contents', 'This is a text annotation'],
    ['Open', false]
  ]);

  // Content streams with realistic PDF content
  const createContentStream = (content: string): PDFStream => {
    const data = Buffer.from(content);
    return {
      dictionary: createDict([
        ['Length', data.length],
        ['Filter', 'FlateDecode'] // Compression filter (optional)
      ]),
      data
    };
  };

  // Create objects map with all required objects
  const objects = new Map<string, PDFIndirectObject>([
    // Core PDF structure
    ['1 0', { objectNumber: 1, generationNumber: 0, value: catalogDict }],
    ['2 0', { objectNumber: 2, generationNumber: 0, value: pagesDict }],
    ['3 0', { objectNumber: 3, generationNumber: 0, value: resourcesDict }],
    
    // Pages
    ['4 0', { objectNumber: 4, generationNumber: 0, value: page1Dict }],
    ['5 0', { objectNumber: 5, generationNumber: 0, value: page2Dict }],
    ['6 0', { objectNumber: 6, generationNumber: 0, value: page3Dict }],
    ['7 0', { objectNumber: 7, generationNumber: 0, value: page4Dict }],
    ['8 0', { objectNumber: 8, generationNumber: 0, value: page5Dict }],
    ['9 0', { objectNumber: 9, generationNumber: 0, value: page6Dict }],
    ['11 0', { objectNumber: 11, generationNumber: 0, value: page7Dict }],
    ['12 0', { objectNumber: 12, generationNumber: 0, value: page8Dict }],

    // Content streams with realistic PDF operators
    ['10 0', { 
      objectNumber: 10, 
      generationNumber: 0, 
      value: createContentStream(`BT
/F1 12 Tf
100 700 Td
(Hello World - Page 1) Tj
0 -20 Td
(This is the first page of our test PDF.) Tj
ET`)
    }],
    ['15 0', { 
      objectNumber: 15, 
      generationNumber: 0, 
      value: createContentStream(`BT
/F1 14 Tf
100 700 Td
(Multiple Content Streams - Part 1) Tj
ET`)
    }],
    ['16 0', { 
      objectNumber: 16, 
      generationNumber: 0, 
      value: createContentStream(`BT
/F2 12 Tf
100 650 Td
(This is part 2 of the content.) Tj
0 -20 Td
(Different font and position.) Tj
ET`)
    }],
    ['17 0', { 
      objectNumber: 17, 
      generationNumber: 0, 
      value: createContentStream(`q
90 0 0 90 306 0 cm
BT
/F1 12 Tf
100 100 Td
(Rotated Page Content) Tj
ET
Q`)
    }],
    ['18 0', { 
      objectNumber: 18, 
      generationNumber: 0, 
      value: createContentStream(`BT
/F1 12 Tf
75 675 Td
(Cropped Page - Content within crop boundaries) Tj
ET`)
    }],
    ['19 0', { 
      objectNumber: 19, 
      generationNumber: 0, 
      value: createContentStream(`BT
/F1 12 Tf
100 700 Td
(Page with Annotations) Tj
0 -20 Td
(Click the link or view the text annotation.) Tj
ET`)
    }],
    ['20 0', { objectNumber: 20, generationNumber: 0, value: linkAnnotDict }],
    ['21 0', { objectNumber: 21, generationNumber: 0, value: textAnnotDict }],
    ['22 0', { 
      objectNumber: 22, 
      generationNumber: 0, 
      value: createContentStream(`BT
/F1 12 Tf
100 700 Td
(Child Page - Inherits Resources) Tj
ET`)
    }],
    ['23 0', { 
      objectNumber: 23, 
      generationNumber: 0, 
      value: createContentStream(`BT
/F1 12 Tf
100 700 Td
(A4 Page Format) Tj
0 -20 Td
(Different page dimensions: 595 x 842 points) Tj
ET`)
    }],
    ['24 0', { 
      objectNumber: 24, 
      generationNumber: 0, 
      value: createContentStream(`BT
/F1 12 Tf
50 175 Td
(Scaled Page with UserUnit=2.0) Tj
0 -10 Td
(Coordinates are scaled by factor of 2) Tj
ET`)
    }],
    
    // Resource objects
    ['14 0', { objectNumber: 14, generationNumber: 0, value: font1Dict }],
    ['25 0', { objectNumber: 25, generationNumber: 0, value: font2Dict }],
    ['26 0', { objectNumber: 26, generationNumber: 0, value: imageDict }],
    ['27 0', { objectNumber: 27, generationNumber: 0, value: gstateDict }]
  ]);

  return objects;
}