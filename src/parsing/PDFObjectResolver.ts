import {PDFDictionary, PDFIndirectObject, PDFIndirectReference, PDFObject} from './FileStructureParser';

export class PDFObjectResolver{
    private indirectObjectsMap: Map<string, PDFIndirectObject>; // key: "objectId generationNumber"
    private resolvingStack: Set<string>; // for cycle detection
    private resolvedCache: Map<string, PDFIndirectObject>; // cache for deeply resolved objects

    constructor(indirectObjectsMap: Map<string, PDFIndirectObject>){
        this.indirectObjectsMap = indirectObjectsMap;
        this.resolvingStack = new Set<string>();
        this.resolvedCache = new Map<string, PDFIndirectObject>();
    }

    public resolveIndirectReference(indirectReference: PDFIndirectReference, isDeepResolve: boolean = false, silentlyResolveCircularReference = true): PDFIndirectObject {
      const key = `${indirectReference.objectNumber} ${indirectReference.generationNumber}`;
        
        if (this.resolvedCache.has(key)) {
            return this.resolvedCache.get(key)!; // Return cached result
        } 

        if (!this.indirectObjectsMap.has(key)) {
            throw new Error(`Unknown reference: ${key}`);
        }

        if (this.resolvingStack.has(key)) {
          if(silentlyResolveCircularReference){
            return this.indirectObjectsMap.get(key)!;
          }else{
            throw new Error(`Circular reference detected for object ${key}`);
          }
        }else{
          this.resolvingStack.add(key);
        }

        let pdfObject: PDFIndirectObject = this.indirectObjectsMap.get(key)!;

        if(isDeepResolve){
          pdfObject.value = this.deepResolve(pdfObject.value, silentlyResolveCircularReference)
          this.resolvedCache.set(key, pdfObject);
        }
        
        this.resolvingStack.delete(key);
        return pdfObject;
    }

    private deepResolve(pdfObject: PDFObject, silentlyResolveCircularReference = true): PDFObject {
      const pdfObjectType = PDFObjectResolver.getPDFObjectType(pdfObject);

      if(pdfObjectType == "string" || pdfObjectType == "boolean" || pdfObjectType == "null" || pdfObjectType == "number" || pdfObjectType == "stream"){
        return pdfObject;
      }else if(pdfObjectType == "array"){
        return (pdfObject as Array<PDFObject>).map(item => this.deepResolve(item, silentlyResolveCircularReference));
      }else if(pdfObjectType == "dictionary"){
        return new Map(
          Array.from(pdfObject as PDFDictionary).map(([key, value]) => [key, this.deepResolve(value, silentlyResolveCircularReference)])
        );
      }else if(pdfObjectType == "indirect-object"){
        let pdfIndirectObject = pdfObject as PDFIndirectObject;
        return {
          objectNumber: pdfIndirectObject.objectNumber,
          generationNumber: pdfIndirectObject.generationNumber,
          value: pdfIndirectObject.value
        } as PDFIndirectObject
      }else if(pdfObjectType == "reference"){
        let pdfIndirectReference = pdfObject as PDFIndirectReference;
        return this.resolveIndirectReference(pdfIndirectReference, true, silentlyResolveCircularReference);
      }else{
        throw new Error(`Unknown PDF object type: ${pdfObjectType}`);
      }
    } 

    public static getPDFObjectType(pdfObject: PDFObject): 
    | 'null' 
    | 'number' 
    | 'boolean' 
    | 'string'
    | 'array'
    | 'dictionary'
    | 'indirect-object'
    | 'reference'
    | 'stream' {
    
    // Check primitive types first (fastest checks)
    if (pdfObject === null) return 'null';
    
    const typeOf = typeof pdfObject;
    if (typeOf === 'number') return 'number';
    if (typeOf === 'boolean') return 'boolean';
    if (typeOf === 'string') return 'string';
    
    // For objects, optimize by checking distinctive properties
    if (Array.isArray(pdfObject)) return 'array';
    
    let obj = pdfObject as object;
    // Each of these checks is fast because it only looks for one property
    // Order from most likely to least likely for better performance
    if ('data' in obj && 'dictionary' in obj) return 'stream';
    if ('value' in obj && 'objectNumber' in obj) return 'indirect-object';
    if ('objectNumber' in obj && 'generationNumber' in obj) return 'reference';
    
    // If it's an object but not any of the above, it must be a dictionary
    return 'dictionary';
  }
}