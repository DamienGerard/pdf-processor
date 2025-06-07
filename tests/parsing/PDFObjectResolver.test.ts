import { PDFObjectResolver } from '../../src/parsing/PDFObjectResolver';
import { PDFArray, PDFDictionary, PDFIndirectObject, PDFIndirectReference, PDFStream } from '../../src/types/PDFTypes';

describe('PDFObjectResolver', () => {
  // Setup test objects for all tests
  let testObjects: Map<string, PDFIndirectObject>;
  let resolver: PDFObjectResolver;

  beforeEach(() => {
    // Create a set of test objects that represent a typical PDF structure
    testObjects = new Map<string, PDFIndirectObject>();

    // Simple primitive objects
    testObjects.set('1 0', {
      objectNumber: 1,
      generationNumber: 0,
      value: 'Test String'
    });

    testObjects.set('2 0', {
      objectNumber: 2,
      generationNumber: 0,
      value: 42
    });

    testObjects.set('3 0', {
      objectNumber: 3,
      generationNumber: 0,
      value: true
    });

    testObjects.set('4 0', {
      objectNumber: 4,
      generationNumber: 0,
      value: null
    });

    // Array object
    testObjects.set('5 0', {
      objectNumber: 5,
      generationNumber: 0,
      value: [
        'Array Item',
        { objectNumber: 2, generationNumber: 0 } as PDFIndirectReference,
        [1, 2, 3]
      ]
    });

    // Dictionary object
    const catalogDict = new Map<string, any>();
    catalogDict.set('Type', '/Catalog');
    catalogDict.set('Pages', { objectNumber: 7, generationNumber: 0 } as PDFIndirectReference);
    
    testObjects.set('6 0', {
      objectNumber: 6,
      generationNumber: 0,
      value: catalogDict
    });

    // Pages dictionary with Kids array containing references
    const pagesDict = new Map<string, any>();
    pagesDict.set('Type', '/Pages');
    pagesDict.set('Count', 2);
    pagesDict.set('Kids', [
      { objectNumber: 8, generationNumber: 0 } as PDFIndirectReference,
      { objectNumber: 9, generationNumber: 0 } as PDFIndirectReference
    ]);
    
    testObjects.set('7 0', {
      objectNumber: 7,
      generationNumber: 0,
      value: pagesDict
    });

    // Page objects
    const pageDict1 = new Map<string, any>();
    pageDict1.set('Type', '/Page');
    pageDict1.set('Parent', { objectNumber: 7, generationNumber: 0 } as PDFIndirectReference);
    pageDict1.set('Contents', { objectNumber: 10, generationNumber: 0 } as PDFIndirectReference);
    
    testObjects.set('8 0', {
      objectNumber: 8,
      generationNumber: 0,
      value: pageDict1
    });

    const pageDict2 = new Map<string, any>();
    pageDict2.set('Type', '/Page');
    pageDict2.set('Parent', { objectNumber: 7, generationNumber: 0 } as PDFIndirectReference);
    pageDict2.set('Contents', { objectNumber: 11, generationNumber: 0 } as PDFIndirectReference);
    
    testObjects.set('9 0', {
      objectNumber: 9,
      generationNumber: 0,
      value: pageDict2
    });

    // Stream object
    const streamDict = new Map<string, any>();
    streamDict.set('Length', 44);
    
    testObjects.set('10 0', {
      objectNumber: 10,
      generationNumber: 0,
      value: {
        dictionary: streamDict,
        data: Buffer.from('BT /F1 12 Tf (Hello, World!) Tj ET')
      }
    });

    // Another stream object
    const streamDict2 = new Map<string, any>();
    streamDict2.set('Length', 22);
    
    testObjects.set('11 0', {
      objectNumber: 11,
      generationNumber: 0,
      value: {
        dictionary: streamDict2,
        data: Buffer.from('BT (Page 2 Content) Tj ET')
      }
    });

    // Objects with circular references
    const circularDict1 = new Map<string, any>();
    circularDict1.set('Reference', { objectNumber: 13, generationNumber: 0 } as PDFIndirectReference);
    
    testObjects.set('12 0', {
      objectNumber: 12,
      generationNumber: 0,
      value: circularDict1
    });

    const circularDict2 = new Map<string, any>();
    circularDict2.set('Reference', { objectNumber: 12, generationNumber: 0 } as PDFIndirectReference);
    
    testObjects.set('13 0', {
      objectNumber: 13,
      generationNumber: 0,
      value: circularDict2
    });

    // Object with nested references
    const nestedDict = new Map<string, any>();
    nestedDict.set('Level1', { objectNumber: 15, generationNumber: 0 } as PDFIndirectReference);
    
    testObjects.set('14 0', {
      objectNumber: 14,
      generationNumber: 0,
      value: nestedDict
    });

    const nestedDict2 = new Map<string, any>();
    nestedDict2.set('Level2', { objectNumber: 16, generationNumber: 0 } as PDFIndirectReference);
    
    testObjects.set('15 0', {
      objectNumber: 15,
      generationNumber: 0,
      value: nestedDict2
    });

    const nestedDict3 = new Map<string, any>();
    nestedDict3.set('Value', 'Deep nested value');
    
    testObjects.set('16 0', {
      objectNumber: 16,
      generationNumber: 0,
      value: nestedDict3
    });

    // Initialize the resolver with our test objects
    resolver = new PDFObjectResolver(testObjects);
  });

  test('should resolve primitive object references correctly', () => {
    // String object
    const stringRef = { objectNumber: 1, generationNumber: 0 } as PDFIndirectReference;
    const stringObj = resolver.resolveIndirectReference(stringRef);
    expect(stringObj.value).toBe('Test String');

    // Number object
    const numberRef = { objectNumber: 2, generationNumber: 0 } as PDFIndirectReference;
    const numberObj = resolver.resolveIndirectReference(numberRef);
    expect(numberObj.value).toBe(42);

    // Boolean object
    const boolRef = { objectNumber: 3, generationNumber: 0 } as PDFIndirectReference;
    const boolObj = resolver.resolveIndirectReference(boolRef);
    expect(boolObj.value).toBe(true);

    // Null object
    const nullRef = { objectNumber: 4, generationNumber: 0 } as PDFIndirectReference;
    const nullObj = resolver.resolveIndirectReference(nullRef);
    expect(nullObj.value).toBeNull();
  });

  test('should resolve array references correctly', () => {
    const arrayRef = { objectNumber: 5, generationNumber: 0 } as PDFIndirectReference;
    const arrayIndObj = resolver.resolveIndirectReference(arrayRef);
    const arrayObj = arrayIndObj.value as PDFArray;
    expect(Array.isArray(arrayObj)).toBe(true);
    expect(arrayObj[0]).toBe('Array Item');
    // Second item is an unresolved reference in regular resolution mode
    expect(arrayObj[1]).toEqual({ objectNumber: 2, generationNumber: 0 });
    expect(Array.isArray(arrayObj[2])).toBe(true);
    expect(arrayObj[2]).toEqual([1, 2, 3]);
  });

  test('should resolve dictionary references correctly', () => {
    const dictRef = { objectNumber: 6, generationNumber: 0 } as PDFIndirectReference;
    const dictIndObj = resolver.resolveIndirectReference(dictRef);
    const dictObj = dictIndObj.value as PDFDictionary;
    expect(dictObj instanceof Map).toBe(true);
    expect(dictObj.get('Type')).toBe('/Catalog');
    // Reference is not resolved in regular resolution mode
    expect(dictObj.get('Pages')).toEqual({ objectNumber: 7, generationNumber: 0 });
  });

  test('should resolve stream references correctly', () => {
    const streamRef = { objectNumber: 10, generationNumber: 0 } as PDFIndirectReference;
    const streamIndObj = resolver.resolveIndirectReference(streamRef);
    const streamObj = streamIndObj.value as PDFStream;
    expect(streamObj).toHaveProperty('dictionary');
    expect(streamObj).toHaveProperty('data');
    expect(streamObj.dictionary.get('Length')).toBe(44);
    expect(Buffer.from(streamObj.data).toString()).toBe('BT /F1 12 Tf (Hello, World!) Tj ET');
  });

  test('should throw error for unknown references', () => {
    const unknownRef = { objectNumber: 999, generationNumber: 0 } as PDFIndirectReference;
    expect(() => {
      resolver.resolveIndirectReference(unknownRef);
    }).toThrow('Unknown reference: 999 0');
  });

  test('should cache resolved references', () => {
    const ref = { objectNumber: 1, generationNumber: 0 } as PDFIndirectReference;
    
    // First resolution
    const obj1 = resolver.resolveIndirectReference(ref, true);
    expect(obj1.value).toBe('Test String');
    
    // Spy on the map's get method
    const spy = jest.spyOn(testObjects, 'get');
    
    // Second resolution should use cache
    const obj2 = resolver.resolveIndirectReference(ref, true);
    expect(obj2.value).toBe('Test String');
    
    // Map.get should not be called again for the same reference
    expect(spy).not.toHaveBeenCalled();
  });

  test('should detect circular references', () => {
    const circularRef = { objectNumber: 12, generationNumber: 0 } as PDFIndirectReference;
    
    // When deep resolving, it should detect the circular reference
    expect(() => {
      resolver.resolveIndirectReference(circularRef, true, false);
    }).toThrow('Circular reference detected');
  });

  test('should deep resolve nested references', () => {
    const nestedRef = { objectNumber: 14, generationNumber: 0 } as PDFIndirectReference;
    
    // With deep resolve flag set to false, should only resolve one level
    const shallowIndObj = resolver.resolveIndirectReference(nestedRef, false);
    const shallowObj = shallowIndObj.value as PDFDictionary
    expect(shallowObj instanceof Map).toBe(true);
    expect(shallowObj.get('Level1')).toEqual({ objectNumber: 15, generationNumber: 0 });
    
    // With deep resolve flag set to true, should resolve all the way down
    const deepIndObj = resolver.resolveIndirectReference(nestedRef, true);
    const deepObj = deepIndObj.value as PDFDictionary
    expect(deepObj instanceof Map).toBe(true);
    
    const level1IndObj = deepObj.get('Level1') as PDFIndirectObject;
    const level1 = level1IndObj.value as PDFDictionary;
    expect(level1 instanceof Map).toBe(true);
    
    const level2IndObj = level1.get('Level2') as PDFIndirectObject;
    const level2 = level2IndObj.value as PDFDictionary;
    expect(level2 instanceof Map).toBe(true);
    expect(level2.get('Value')).toBe('Deep nested value');
  });

  test('should deep resolve complex document structures', () => {
    // Get the catalog object and deep resolve
    const catalogRef = { objectNumber: 6, generationNumber: 0 } as PDFIndirectReference;
    const deepCatalogIndObj = resolver.resolveIndirectReference(catalogRef, true);
    const deepCatalog = deepCatalogIndObj.value as PDFDictionary
    
    // The Pages reference should be resolved
    const pagesDict = (deepCatalog.get('Pages') as PDFIndirectObject).value as PDFDictionary;
    expect(pagesDict instanceof Map).toBe(true);
    expect(pagesDict.get('Type')).toBe('/Pages');
    expect(pagesDict.get('Count')).toBe(2);
    
    // The Kids array should contain resolved Page dictionaries
    const kidsArray = pagesDict.get('Kids') as PDFArray;
    expect(Array.isArray(kidsArray)).toBe(true);
    expect(kidsArray.length).toBe(2);
    
    // Check first page
    const page1 = (kidsArray[0] as PDFIndirectObject).value as PDFDictionary;
    expect(page1 instanceof Map).toBe(true);
    expect(page1.get('Type')).toBe('/Page');
    
    // Contents should be resolved to the actual stream
    const contents1 = (page1.get('Contents') as PDFIndirectObject).value as PDFStream;
    expect(contents1).toHaveProperty('dictionary');
    expect(contents1).toHaveProperty('data');
    expect(Buffer.from(contents1.data).toString()).toBe('BT /F1 12 Tf (Hello, World!) Tj ET');
    
    // Parent reference should point back to Pages dictionary
    // In deep resolution, this would normally cause an infinite loop,
    // but your resolver should have handled this properly
    const parent1 = (page1.get('Parent') as PDFIndirectObject).value as PDFDictionary;
    expect(parent1 instanceof Map).toBe(true);
    expect(parent1.get('Type')).toBe('/Pages');
  });

  test('should handle array deep resolution correctly', () => {
    const arrayRef = { objectNumber: 5, generationNumber: 0 } as PDFIndirectReference;
    const deepArrayIndObj = resolver.resolveIndirectReference(arrayRef, true)
    const deepArray = deepArrayIndObj.value as PDFArray;
    
    expect(Array.isArray(deepArray)).toBe(true);
    expect(deepArray[0]).toBe('Array Item');
    // Second item should be resolved to the number 42
    expect((deepArray[1] as PDFIndirectObject).value).toBe(42);
    expect(deepArray[2]).toEqual([1, 2, 3]);
  });

  test('should handle object generation numbers correctly', () => {
    // Add an object with a non-zero generation number
    testObjects.set('20 1', {
      objectNumber: 20,
      generationNumber: 1,
      value: 'Object with generation 1'
    });
    
    // Recreate resolver with updated objects
    resolver = new PDFObjectResolver(testObjects);
    
    const ref = { objectNumber: 20, generationNumber: 1 } as PDFIndirectReference;
    const obj = resolver.resolveIndirectReference(ref);
    expect(obj.value).toBe('Object with generation 1');
  });

  test('should handle nested indirect objects correctly', () => {
    // Create an indirect object that contains another indirect object
    const nestedIndirectObj = {
      objectNumber: 30,
      generationNumber: 0,
      value: {
        objectNumber: 31,
        generationNumber: 0
      } as PDFIndirectReference
    } as PDFIndirectObject;
    
    testObjects.set('30 0', nestedIndirectObj);
    testObjects.set('31 0', {
      objectNumber: 31,
      generationNumber: 0,
      value: 'Nested indirect object'
    });
    
    // Recreate resolver with updated objects
    resolver = new PDFObjectResolver(testObjects);
    
    const ref = { objectNumber: 30, generationNumber: 0 } as PDFIndirectReference;
    
    // Without deep resolve, should just get the nested indirect object
    const shallowObj = resolver.resolveIndirectReference(ref, false) as PDFIndirectObject;
    expect(PDFObjectResolver.getPDFObjectType(shallowObj.value)).toBe('reference');
    expect((shallowObj.value as PDFIndirectReference).objectNumber).toBe(31);
    expect((shallowObj.value as PDFIndirectReference).generationNumber).toBe(0);
    
    // With deep resolve, should get the final value
    const deepObj = resolver.resolveIndirectReference(ref, true);
    expect(PDFObjectResolver.getPDFObjectType(shallowObj.value)).toBe('indirect-object');
    expect((deepObj.value as PDFIndirectObject).value).toBe('Nested indirect object');
  });
});