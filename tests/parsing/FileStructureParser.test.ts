import { PDFToken, PDFTokenizer, TokenType } from '../../src/parsing/PDFTokenizer';
import { FileStructureParser, XRefTable, TrailerDictionary } from '../../src/parsing/FileStructureParser';
import * as fs from 'fs';
import * as path from 'path';

describe('FileStructureParser', () => {
  // Sample minimal PDF content for testing
  const samplePDF = Buffer.from(`%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf (Hello, PDF!) Tj ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f
0000000010 00000 n
0000000077 00000 n
0000000173 00000 n
0000000261 00000 n
0000000345 00000 n
trailer
<< /Size 6 /Root 1 0 R >>
startxref
420
%%EOF`);

  let parser: FileStructureParser;
  let tokens: PDFToken[];

  beforeEach(() => {
    const tokenizer = new PDFTokenizer(samplePDF);
    tokens = [];
    let token: PDFToken | null;
    while ((token = tokenizer.nextToken()) !== null) {
      tokens.push(token);
      if (token.type === TokenType.EOF) break;
    }
    parser = new FileStructureParser(tokens);
  });

  test('should parse PDF version correctly', () => {
    parser.parse();
    expect(parser.getVersion()).toBe('1.7');
  });

  test('should parse objects correctly', () => {
    parser.parse();
    const objects = parser.getObjects();
    
    // We expect 5 objects in our sample PDF
    expect(objects.length).toBe(5);
    
    // Check if specific object exists - assuming getIndirectObject method exists
    const catalogObj = parser.getIndirectObjects().get('1 0');
    expect(catalogObj).toBeTruthy();
    
    // Check catalog object properties
    if (catalogObj) {
      expect(catalogObj.objectNumber).toBe(1);
      expect(catalogObj.generationNumber).toBe(0);
      
      // Assuming the value is a dictionary
      const dict = catalogObj.value as { [key: string]: any };
      expect(dict['Type']).toBe('/Catalog');
      expect(dict['Pages']).toEqual({ objectNumber: 2, generationNumber: 0 }); // Indirect reference
    }
  });

  test('should parse xref table correctly', () => {
    parser.parse();
    const xrefTable = parser.getXRefTable();
    
    // Check if the xref table has entries for all objects
    expect(Object.keys(xrefTable).length).toBe(6); // 0-5 entries
    
    // Check a specific entry
    expect(xrefTable[1]).toEqual({
      offset: 10,
      generationNumber: 0,
      inUse: true
    });
    
    // Object 0 should be free
    expect(xrefTable[0].inUse).toBe(false);
  });

  test('should parse trailer dictionary correctly', () => {
    parser.parse();
    const trailer = parser.getTrailer();
    
    expect(trailer).toBeTruthy();
    if (trailer) {
      expect(trailer.Size).toBe(6);
      expect(trailer.Root).toEqual({objectNumber:1, generationNumber:0}); // Reference to root object
    }
  });

  test('should correctly handle indirect references', () => {
    parser.parse();
    
    // Get the Pages object (obj 2)
    const pagesObj = parser.getIndirectObjects().get("2 0");
    expect(pagesObj).toBeTruthy();
    
    if (pagesObj) {
      const pagesDict = pagesObj.value as { [key: string]: any };
      
      // Kids array should contain an indirect reference
      const kids = pagesDict['Kids'] as any[];
      expect(kids).toBeInstanceOf(Array);
      expect(kids.length).toBe(1);
      
      // The reference should be to object 3
      const pageRef = kids[0];
      expect(pageRef).toEqual({ objectNumber: 3, generationNumber: 0 });
    }
  });

  test('should parse stream objects correctly', () => {
    parser.parse();
    
    // Get the content stream object (obj 4)
    const contentObj = parser.getIndirectObjects().get("4 0");
    expect(contentObj).toBeTruthy();
    
    if (contentObj) {
      // It should be a stream object
      const stream = contentObj.value as { dictionary: any, data: any };
      expect(stream.dictionary).toBeTruthy();
      expect(stream.dictionary['Length']).toBe(44);
      
      // Check the stream content
      expect(stream.data).toBeDefined();
      const streamText = (typeof stream.data === 'string') 
        ? stream.data 
        : Buffer.from(stream.data).toString('utf-8');
      expect(streamText).toContain('BT /F1 12 Tf (Hello, PDF!) Tj ET\n');
    }
  });
  
  test('should throw error on invalid PDF header', () => {
    // Create a PDF with invalid header
    const invalidPDF = Buffer.from(`NOT-A-PDF-1.7
1 0 obj
<< /Type /Catalog >>
endobj`);
    
    expect(() => {const invalidParser = new FileStructureParser(invalidPDF);}).toThrow("PDF header '%PDF-' not found");
  });

  test('should handle incremental updates if present', () => {
    // Create a PDF with multiple xref sections (incremental update)
    const incrementalPDF = Buffer.from(`%PDF-1.7
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Count 0 >>
endobj
xref
0 3
0000000000 65535 f
0000000010 00000 n
0000000074 00000 n
trailer
<< /Size 3 /Root 1 0 R >>
startxref
120
%%EOF
3 0 obj
<< /Type /Page /Parent 2 0 R >>
endobj
2 1 obj
<< /Type /Pages /Count 1 /Kids [3 0 R] >>
endobj
xref
0 1
0000000000 65535 f
2 2
0000000154 00001 n
0000000210 00000 n
trailer
<< /Size 4 /Root 1 0 R /Prev 120 >>
startxref
290
%%EOF`);

    const incrementalParser = new FileStructureParser(incrementalPDF);
    incrementalParser.parse();
    
    // Should have processed both xref sections
    const xrefTable = incrementalParser.getXRefTable();
    expect(Object.keys(xrefTable).length).toBe(4); // Objects 0-3
    
    // Object 2 should have generation number 1 (updated version)
    const obj2 = incrementalParser.getIndirectObjects().get("2 1");
    expect(obj2).toBeTruthy();
    
    // Check that trailer has Prev pointing to previous xref
    const trailer = incrementalParser.getTrailer();
    expect(trailer?.Prev).toBe(120);
  });

  /*test('should resolve object references correctly', () => {
    parser.parse();
    
    // Assuming you have a method to resolve references
    const resolvedRoot = parser.resolveReference({ objectNumber: 1, generationNumber: 0 });
    expect(resolvedRoot).toBeTruthy();
    
    if (resolvedRoot) {
      const rootDict = resolvedRoot as { [key: string]: any };
      expect(rootDict['/Type']).toBe('/Catalog');
    }
  });*/

  /*test('should extract document structure correctly', () => {
    parser.parse();
    
    // Assuming you have a method to get the catalog
    const catalog = parser.getCatalog();
    expect(catalog).toBeTruthy();
    
    // Get the page tree
    const pages = parser.getPages();
    expect(pages).toBeTruthy();
    expect(pages?.length).toBe(1); // Should have 1 page
    
    // Check the first page
    if (pages && pages.length > 0) {
      const page = pages[0];
      expect(page['/Type']).toBe('/Page');
      
      // Check if page has content
      const contents = parser.getPageContents(page);
      expect(contents).toBeTruthy();
    }
  });*/
});