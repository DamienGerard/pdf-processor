import { assert } from 'console';
import { PDFToken, PDFTokenizer, TokenType } from './PDFTokenizer';
import { PDFArray, PDFDictionary, PDFIndirectObject, PDFIndirectReference, PDFObject, PDFStream } from '../types/PDFTypes';


/**
 * Represents a cross-reference entry in the PDF file
 */
export interface XRefEntry {
    offset: number;
    generationNumber: number;
    inUse: boolean;
}

/**
 * Represents a cross-reference table in the PDF file
 */
export interface XRefTable {
    [objectId: number]: XRefEntry;
}

/**
 * Represents the trailer dictionary of a PDF file
 */
export interface TrailerDictionary {
    Size: number;
    Root: PDFIndirectReference; // [objectId, generationNumber]
    Info?: PDFIndirectReference;
    ID?: string[];
    Encrypt?: any;
    Prev?: number;
    [key: string]: any;
}

/**
 * Parses the file structure of a PDF document from a list of tokens
 */
export class FileStructureParser {
    private tokens: PDFToken[];
    private currentTokenIndex: number = 0;
    private indirectObjectsMap: Map<string, PDFIndirectObject> = new Map();
    private objects: PDFObject[] = [];
    private xrefTable: XRefTable = {};
    private trailer: TrailerDictionary | null = null;
    private version: string = '';

    /**
     * Creates a new FileStructureParser
     * 
     * @param input Either a Buffer of PDF data, a PDFTokenizer instance, or a pre-generated array of PDFTokens
     */
    constructor(input: Buffer | PDFTokenizer | PDFToken[]) {
        if (Array.isArray(input)) {
            this.tokens = input;
        } else if (input instanceof PDFTokenizer) {
            this.tokens = this.getAllTokens(input);
        } else {
            const tokenizer = new PDFTokenizer(input);
            this.tokens = this.getAllTokens(tokenizer);
        }
    }

    /**
     * Extract all tokens from a tokenizer
     */
    private getAllTokens(tokenizer: PDFTokenizer): PDFToken[] {
        const tokens: PDFToken[] = [];
        let token: PDFToken | null;
        
        while ((token = tokenizer.nextToken()) !== null) {
            tokens.push(token);
            if (token.type === TokenType.EOF) {
                break;
            }
        }
        
        return tokens;
    }

    /**
     * Get the current token without advancing the position
     */
    private currentToken(): PDFToken | null {
        if (this.currentTokenIndex >= this.tokens.length) {
            return null;
        }
        return this.tokens[this.currentTokenIndex];
    }

    /**
     * Get the next token and advance the position
     */
    private nextToken(): PDFToken | null {
        if (this.currentTokenIndex >= this.tokens.length) {
            return null;
        }
        return this.tokens[this.currentTokenIndex++];
    }

    /**
     * Move the position back by one token
     */
    private backToken(): void {
        if (this.currentTokenIndex > 0) {
            this.currentTokenIndex--;
        }
    }

    /**
     * Parse the entire PDF file structure
     */
    public parse(): void {
        this.parseHeader();
        do{
            this.parseBody();
            this.parseXRefAndTrailer();
        }while((this.currentTokenIndex < this.tokens.length && this.tokens[this.currentTokenIndex].type !== TokenType.EOF));

        // Look for EOF marker
        var token = this.nextToken();
        if (!token || token.type !== TokenType.EOF) {
            throw new Error('Expected EOF marker');
        }
    }

    /**
     * Parse the PDF header to extract version information
     */
    private parseHeader(): void {
        const token = this.nextToken();
        if (token && token.type === TokenType.HEADER) {
            // Extract version from the header token value
            // Assuming format like "Token(HEADER, %PDF-1.7)"
            const headerValue = token.value.toString();
            const match = headerValue.match(/%PDF-(\d+\.\d+)/);
            if (match && match[1]) {
                this.version = match[1];
            } else {
                this.version = headerValue;
            }
        } else {
            throw new Error('Invalid PDF: Header not found');
        }
    }

    /**
     * Parse the body of the PDF file containing objects
     */
    private parseBody(): void {
        while (this.currentTokenIndex < this.tokens.length) {
            if (this.tokens[this.currentTokenIndex].type === TokenType.KEYWORD && this.tokens[this.currentTokenIndex].value === 'xref') {
                // We've reached the xref table, so we're done parsing objects
                break;
            }
            const object = this.parseNextObject();
            if (object !== null) {
                this.objects.push(object);
            }
        }
    }

    /**
     * Parse an object's value (could be a dictionary, array, or primitive)
     */
    private parseNextObject(): PDFObject {
        if (this.currentTokenIndex >= this.tokens.length) {
          return null;
        }
    
        const token = this.tokens[this.currentTokenIndex];
        
        switch (token.type) { 
          case TokenType.BOOLEAN:
          case TokenType.REAL:
          case TokenType.STRING:
          case TokenType.HEX_STRING:
          case TokenType.NULL:
            this.currentTokenIndex++;
            return token.value;
                        
          case TokenType.NAME:
            this.currentTokenIndex++;
            return '/' + token.value;
                        
          case TokenType.ARRAY_START:
            return this.parseArray();
            
          case TokenType.DICT_START:
            return this.parseDictionary();
            
          case TokenType.INTEGER:
            // Check if this is the start of an indirect object
            if (
              this.currentTokenIndex + 2 < this.tokens.length &&
              this.tokens[this.currentTokenIndex + 1].type === TokenType.INTEGER &&
              this.tokens[this.currentTokenIndex + 2].type === TokenType.OBJ_START
            ) {
              return this.parseIndirectObject();
            }
            
            // Check if this is the start of an indirect reference
            if (
              this.currentTokenIndex + 2 < this.tokens.length &&
              this.tokens[this.currentTokenIndex + 1].type === TokenType.INTEGER &&
              this.tokens[this.currentTokenIndex + 2].type === TokenType.INDIRECT_REFERENCE
            ) {
              return this.parseIndirectReference();
            }
            
            this.currentTokenIndex++;
            return parseInt(token.value, 10);
            
          default:
            // Skip unexpected tokens
            // this.currentTokenIndex++;
            // return this.parseNextObject();
            throw new Error(`Unexpected token in object value: ${token.toString()}`);
        }
    }

     /**
     * Parse a PDF array
     */
    private parseArray(): PDFArray {
        assert(this.tokens[this.currentTokenIndex].type === TokenType.ARRAY_START, `Failed assertion: Trying to parse array from ${this.tokens[this.currentTokenIndex].type}`)
        // Skip the array start token
        this.currentTokenIndex++;
        
        const array: PDFArray = [];
        
        while (
        this.currentTokenIndex < this.tokens.length &&
        this.tokens[this.currentTokenIndex].type !== TokenType.ARRAY_END
        ) {
            const item = this.parseNextObject();
            array.push(item);
        }
        
        // Skip the array end token
        if (this.currentTokenIndex < this.tokens.length) {
            this.currentTokenIndex++;
        }
        
        return array;
    }

    /**
     * Parse a PDF stream object
     */
    private parseStream(dictionary: PDFDictionary): PDFStream {
        assert(this.tokens[this.currentTokenIndex].type === TokenType.STREAM, `Failed assertion: Trying to parse stream from ${this.tokens[this.currentTokenIndex].type}`)
        const streamData = this.tokens[this.currentTokenIndex].value;
        this.currentTokenIndex++;
        
        return {
        dictionary,
        data: streamData
        };
    }

    /**
     * Parse a PDF dictionary
     */
    private parseDictionary(): PDFDictionary|PDFStream {
        assert(this.tokens[this.currentTokenIndex].type === TokenType.DICT_START, `Failed assertion: Trying to parse dictionary from ${this.tokens[this.currentTokenIndex].type}`)
        // Skip the dictionary start token
        this.currentTokenIndex++;
        
        const dictionary: PDFDictionary = new Map<string, PDFObject>();
        
        while (this.currentTokenIndex < this.tokens.length && this.tokens[this.currentTokenIndex].type !== TokenType.DICT_END) {
            // Dictionary keys must be name objects
            if (this.tokens[this.currentTokenIndex].type !== TokenType.NAME) {
                this.currentTokenIndex++;
                continue;
            }
            
            const key: string = this.tokens[this.currentTokenIndex].value;
            this.currentTokenIndex++;
            
            if (this.currentTokenIndex < this.tokens.length) {
                const value = this.parseNextObject();
                dictionary.set(key, value);
            }
        }
        
        // Skip the dictionary end token
        if (this.currentTokenIndex < this.tokens.length) {
            this.currentTokenIndex++;
        }
        
        // Check if this dictionary is followed by a stream
        if (this.currentTokenIndex < this.tokens.length && this.tokens[this.currentTokenIndex].type === TokenType.STREAM) {
            return this.parseStream(dictionary);
        }
        
        return dictionary;
    }

    /**
     * Parse an indirect object
     */
    private parseIndirectObject(): PDFIndirectObject {
        const objectNumber = parseInt(this.tokens[this.currentTokenIndex].value, 10);
        this.currentTokenIndex++;
        
        const generationNumber = parseInt(this.tokens[this.currentTokenIndex].value, 10);
        this.currentTokenIndex++;
        
        assert(this.tokens[this.currentTokenIndex].type === TokenType.OBJ_START, `Failed assertion: Trying to parse object from ${this.tokens[this.currentTokenIndex].type}`)
        // Skip the "obj" token
        this.currentTokenIndex++;
        
        const object = this.parseNextObject();
        
        // Skip the "endobj" token if present
        if (this.currentTokenIndex < this.tokens.length && this.tokens[this.currentTokenIndex].type === TokenType.OBJ_END) {
            this.currentTokenIndex++;
        }
        
        const indirectObject = {
            objectNumber,
            generationNumber,
            value: object
        };
        this.indirectObjectsMap.set(`${objectNumber} ${generationNumber}`, indirectObject);
        return indirectObject;
    }

    /**
     * Parse an indirect reference
     */
    private parseIndirectReference(): PDFIndirectReference {
        const objectNumber = parseInt(this.tokens[this.currentTokenIndex].value, 10);
        this.currentTokenIndex++;
        
        const generationNumber = parseInt(this.tokens[this.currentTokenIndex].value, 10);
        this.currentTokenIndex++;
        
        assert(this.tokens[this.currentTokenIndex].type === TokenType.INDIRECT_REFERENCE, `Failed assertion: Trying to parse indirect reference from ${this.tokens[this.currentTokenIndex].type}`)
        // Skip the "R" token
        this.currentTokenIndex++;
        
        return {
            objectNumber,
            generationNumber
        };
    }

    /**
     * Parse the cross-reference table and trailer
     */
    private parseXRefAndTrailer(): void {
        let token = this.nextToken();
        
        if (!token || token.type !== TokenType.KEYWORD || token.value !== 'xref') {
            throw new Error('Expected xref keyword');
        }
        
        this.parseXRefTable();
        this.parseTrailer();
    }

    /**
     * Parse the cross-reference table
     */
    private parseXRefTable(): void {
        let token: PDFToken | null;
        
        while ((token = this.nextToken()) !== null) {
            if (token.type !== TokenType.INTEGER) {
                // We've reached the trailer or something else
                this.backToken();
                break;
            }
            
            const startObjectId = token.value;
            
            token = this.nextToken();
            if (!token || token.type !== TokenType.INTEGER) {
                throw new Error('Expected count in xref subsection');
            }
            
            const count = token.value;
            
            for (let i = 0; i < count; i++) {
                const objectId = startObjectId + i;
                
                // Each xref entry is 3 numbers: offset, generation, in-use flag
                token = this.nextToken();
                if (!token || token.type !== TokenType.INTEGER) {
                    throw new Error('Expected offset in xref entry');
                }
                const offset = token.value;
                
                token = this.nextToken();
                if (!token || token.type !== TokenType.INTEGER) {
                    throw new Error('Expected generation number in xref entry');
                }
                const generationNumber = token.value;
                
                token = this.nextToken();
                if (!token || (token.type !== TokenType.KEYWORD)) {
                    throw new Error('Expected in-use flag in xref entry');
                }
                
                const inUse = token.value === 'n'; // 'n' for in-use, 'f' for free
                
                this.xrefTable[objectId] = {
                    offset,
                    generationNumber,
                    inUse
                };
            }
        }
    }

    /**
     * Parse the trailer dictionary
     */
    private parseTrailer(): void {
        let token = this.nextToken();
        
        if (!token || token.type !== TokenType.KEYWORD || token.value !== 'trailer') {
            throw new Error('Expected trailer keyword');
        }
        
        token = this.nextToken();
        if (!token || token.type !== TokenType.DICT_START) {
            throw new Error('Expected dictionary start after trailer keyword');
        }
        
        this.backToken(); // Put back the '<<' token for parseDictionary to consume
        let parsedDictionary = this.parseDictionary() as PDFDictionary;
        let size = parsedDictionary.get("Size") as number;
        let root = parsedDictionary.get("Root") as PDFIndirectReference;
        let info = parsedDictionary.get("Info") as PDFIndirectReference;
        let id = parsedDictionary.get("ID") as PDFArray;
        let encrypt =  parsedDictionary.get("Encrypt");
        let prev = parsedDictionary.get("Prev") as number;
        this.trailer = {
            Size: size,
            Root: root,
            Info: info? info : undefined,
            ID: id,
            Encrypt: encrypt,
            Prev: prev,
            parsedDictionary
        }as TrailerDictionary;
        
        // Look for startxref
        token = this.nextToken();
        if (!token || token.type !== TokenType.KEYWORD || token.value !== 'startxref') {
            throw new Error('Expected startxref keyword');
        }
        
        // Get the byte offset of the last xref section
        token = this.nextToken();
        if (!token || token.type !== TokenType.INTEGER) {
            throw new Error('Expected integer after startxref');
        }
        
        // We're not using this value right now, but we would if we were supporting
        // incremental updates or linearized PDFs
        const startxref = token.value;
    }

    /**
     * Get all parsed objects
     */
    public getObjects(): PDFObject[] {
        return this.objects;
    }


    /**
     * Get all indirect objects
     */
    public getIndirectObjects(): Map<string, PDFIndirectObject> {
        return this.indirectObjectsMap;
    }

    /**
     * Get the cross-reference table
     */
    public getXRefTable(): XRefTable {
        return this.xrefTable;
    }

    /**
     * Get the trailer dictionary
     */
    public getTrailer(): TrailerDictionary | null {
        return this.trailer;
    }

    /**
     * Get the PDF version
     */
    public getVersion(): string {
        return this.version;
    }
    
    /**
     * Get the root catalog object ID
     */
    public getRootObjectId(): PDFIndirectReference | null {
        return this.trailer?.Root || null;
    }
}