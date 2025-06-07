export type PDFObject = 
  | number 
  | boolean 
  | string 
  | null 
  | PDFArray 
  | PDFDictionary 
  | PDFIndirectObject 
  | PDFStream 
  | PDFIndirectReference;

export interface PDFArray extends Array<PDFObject> {}

export interface PDFDictionary extends Map<string, PDFObject> { }

export interface PDFIndirectObject {
  objectNumber: number;
  generationNumber: number;
  value: PDFObject;
}

export interface PDFStream {
  dictionary: PDFDictionary;
  data: Uint8Array | string;
}

export interface PDFIndirectReference {
  objectNumber: number;
  generationNumber: number;
}

/**
 * PDF Resources dictionary structure
 */
export interface PDFResources {
    // Font resources
    Font?: PDFDictionary;
    
    // XObject resources (images, forms)
    XObject?: PDFDictionary;
    
    // Graphics state parameter dictionaries
    ExtGState?: PDFDictionary;
    
    // Color space resources
    ColorSpace?: PDFDictionary;
    
    // Pattern resources
    Pattern?: PDFDictionary;
    
    // Shading resources
    Shading?: PDFDictionary;
    
    // Procedure set (legacy)
    ProcSet?: PDFArray;
    
    // Properties for marked content
    Properties?: PDFDictionary;
  }