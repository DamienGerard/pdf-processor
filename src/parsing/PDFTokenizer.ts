import { Buffer } from 'buffer';

/**
 * Types of tokens that can be found in a PDF document
 */
export enum TokenType {
  INTEGER = 'INTEGER',
  REAL = 'REAL',
  BOOLEAN = 'BOOLEAN',
  NAME = 'NAME',
  STRING = 'STRING',
  HEX_STRING = 'HEX_STRING',
  ARRAY_START = 'ARRAY_START',
  ARRAY_END = 'ARRAY_END',
  DICT_START = 'DICT_START',
  DICT_END = 'DICT_END',
  NULL = 'NULL',
  INDIRECT_REFERENCE = 'INDIRECT_REFERENCE',
  STREAM = 'STREAM',
  OBJ_START = 'OBJ_START',
  OBJ_END = 'OBJ_END',
  KEYWORD = 'KEYWORD',
  EOF = 'EOF',
  HEADER = 'HEADER'
}

/**
 * Represents a token in the PDF file
 */
export class PDFToken {
  constructor(public type: TokenType, public value: any) {}
  
  toString(): string {
    return `Token(${this.type}, ${this.value})`;
  }
}

/**
 * PDF Tokenizer - Converts a PDF file buffer into a stream of tokens
 */
export class PDFTokenizer {
  private buffer: Buffer;
  private position: number = 0;
  private bufferLength: number;
  
  /**
   * Create a new tokenizer for the provided buffer
   */
  constructor(buffer: Buffer) {
    this.buffer = buffer;
    this.bufferLength = buffer.length;
  }
  
  /**
   * Get the current byte position in the buffer
   */
  public getPosition(): number {
    return this.position;
  }
  
  /**
   * Set the current byte position in the buffer
   */
  public setPosition(position: number): void {
    if (position < 0 || position >= this.bufferLength) {
      throw new Error(`Invalid position: ${position}. Buffer length: ${this.bufferLength}`);
    }
    this.position = position;
  }
  
  /**
   * Check if we've reached the end of the buffer
   */
  public isEOF(): boolean {
    return this.position >= this.bufferLength;
  }
  
  /**
   * Read the next token from the buffer
   */
  public nextToken(): PDFToken {// Only skip whitespace and comments *after* checking for the header
    if (this.position === 0) {
      const header = this.readHeader();
      if (header) {
        return new PDFToken(TokenType.HEADER, header);
      }
    }
    this.skipWhitespaceAndComments();
    
    if (this.isEOF()) {
      return new PDFToken(TokenType.EOF, null);
    }
    
    const currentByte = this.buffer[this.position];
    const currentChar = String.fromCharCode(currentByte);
    
    // Handle numeric values (integer or real)
    if ((currentByte >= 48 && currentByte <= 57) || // 0-9
        currentByte === 43 || currentByte === 45) { // + or -
      return this.readNumber();
    }
    
    // Handle name objects
    if (currentByte === 47) { // '/'
      return this.readName();
    }
    
    // Handle literal strings
    if (currentByte === 40) { // '('
      return this.readLiteralString();
    }
    
    // Handle hex strings
    if (currentByte === 60) { // '<'
      if (this.position + 1 < this.bufferLength && this.buffer[this.position + 1] === 60) {
        // Dictionary start '<<'
        this.position += 2;
        return new PDFToken(TokenType.DICT_START, '<<');
      } else {
        return this.readHexString();
      }
    }
    
    // Handle dictionary end
    if (currentByte === 62) { // '>'
      if (this.position + 1 < this.bufferLength && this.buffer[this.position + 1] === 62) {
        // Dictionary end '>>'
        this.position += 2;
        return new PDFToken(TokenType.DICT_END, '>>');
      } else {
        throw new Error(`Invalid character '>' at position ${this.position}`);
      }
    }
    
    // Handle array start
    if (currentByte === 91) { // '['
      this.position++;
      return new PDFToken(TokenType.ARRAY_START, '[');
    }
    
    // Handle array end
    if (currentByte === 93) { // ']'
      this.position++;
      return new PDFToken(TokenType.ARRAY_END, ']');
    }
    
    // Handle keywords, booleans, null, and indirect references
    return this.readKeywordOrReference();
  }
  
  /**
   * Skip whitespace and comments in the PDF file
   */
  private skipWhitespaceAndComments(): void {
    while (!this.isEOF()) {
      const currentByte = this.buffer[this.position];
      
      // Handle PDF whitespace characters
      if (this.isWhitespace(currentByte)) {
        this.position++;
        continue;
      }
      
      // Handle comments (% until end of line)
      if (currentByte === 37) { // '%'
        while (!this.isEOF() && !this.isEOL(this.buffer[this.position])) {
          this.position++;
        }
        // Skip the EOL character(s)
        if (!this.isEOF()) {
          if (this.buffer[this.position] === 13 && 
              this.position + 1 < this.bufferLength && 
              this.buffer[this.position + 1] === 10) {
            // Skip CR+LF
            this.position += 2;
          } else {
            // Skip single EOL
            this.position++;
          }
        }
        continue;
      }
      
      // No more whitespace or comments
      break;
    }
  }

  /**
   * Read and tokenize the PDF header (e.g., "%PDF-1.7").
   */
  private readHeader(): PDFToken {
    const pdfHeader = "%PDF-";
    const startPos = this.buffer.indexOf(pdfHeader);

    if (startPos === -1) {
      throw new Error("PDF header '%PDF-' not found");
    }

    // Find the end of the header line (usually until newline or EOF)
    let endPos = startPos + pdfHeader.length;
    while (endPos < this.bufferLength && !this.isEOL(this.buffer[endPos])) {
      endPos++;
    }

    // Extract the header text from the buffer
    const header = this.buffer.slice(startPos, endPos).toString();

    // Update the position to just past the header
    this.position = endPos;

    // Return the header as a PDFToken
    return new PDFToken(TokenType.HEADER, header);
  }

  /**
   * Read a number token (integer or real)
   */
  private readNumber(): PDFToken {
    const startPos = this.position;
    let isReal = false;
    
    // Handle sign
    if (this.buffer[this.position] === 43 || this.buffer[this.position] === 45) { // + or -
      this.position++;
    }
    
    // Read digits before decimal point
    while (!this.isEOF() && this.isDigit(this.buffer[this.position])) {
      this.position++;
    }
    
    // Check for decimal point
    if (!this.isEOF() && this.buffer[this.position] === 46) { // '.'
      isReal = true;
      this.position++;
      
      // Read digits after decimal point
      while (!this.isEOF() && this.isDigit(this.buffer[this.position])) {
        this.position++;
      }
    }
    
    const numberStr = this.buffer.slice(startPos, this.position).toString();
    const value = isReal ? parseFloat(numberStr) : parseInt(numberStr, 10);
    
    return new PDFToken(isReal ? TokenType.REAL : TokenType.INTEGER, value);
  }
  
  /**
   * Read a name object token
   */
  private readName(): PDFToken {
    // Skip the leading '/'
    this.position++;
    const startPos = this.position;
    
    while (!this.isEOF() && !this.isDelimiter(this.buffer[this.position]) && !this.isWhitespace(this.buffer[this.position])) {
      // Handle hex encoding in name (#xx)
      if (this.buffer[this.position] === 35 && // '#'
          this.position + 2 < this.bufferLength &&
          this.isHexDigit(this.buffer[this.position + 1]) &&
          this.isHexDigit(this.buffer[this.position + 2])) {
        this.position += 3; // Skip the #xx sequence
      } else {
        this.position++;
      }
    }
    
    // Get the raw name with potential hex encodings
    const rawName = this.buffer.slice(startPos, this.position).toString();
    
    // Process hex encodings in the name
    let name = '';
    for (let i = 0; i < rawName.length; i++) {
      if (rawName[i] === '#' && i + 2 < rawName.length) {
        const hexValue = parseInt(rawName.substring(i + 1, i + 3), 16);
        name += String.fromCharCode(hexValue);
        i += 2; // Skip the two hex digits
      } else {
        name += rawName[i];
      }
    }
    
    return new PDFToken(TokenType.NAME, name);
  }
  
  /**
   * Read a literal string token (enclosed in parentheses)
   */
  private readLiteralString(): PDFToken {
    // Skip the opening '('
    this.position++;
    const startPos = this.position;
    let result = '';
    let depth = 1; // Parenthesis nesting level
    
    while (!this.isEOF() && depth > 0) {
      const currentByte = this.buffer[this.position++];
      
      // Handle nested parentheses
      if (currentByte === 40) { // '('
        depth++;
        result += '(';
      } else if (currentByte === 41) { // ')'
        depth--;
        if (depth > 0) {
          result += ')';
        }
      } else if (currentByte === 92) { // '\'
        // Handle escape sequences
        if (this.isEOF()) {
          break;
        }
        
        const nextByte = this.buffer[this.position++];
        switch (nextByte) {
          case 110: result += '\n'; break; // \n
          case 114: result += '\r'; break; // \r
          case 116: result += '\t'; break; // \t
          case 98: result += '\b'; break;  // \b
          case 102: result += '\f'; break; // \f
          case 40: result += '('; break;   // \(
          case 41: result += ')'; break;   // \)
          case 92: result += '\\'; break;  // \\
          case 13: // CR
            // Handle CR+LF as a line continuation
            if (!this.isEOF() && this.buffer[this.position] === 10) {
              this.position++;
            }
            break;
          case 10: // LF
            // Line continuation, ignore
            break;
          default:
            // Check for octal escape sequence (\ddd)
            if (nextByte >= 48 && nextByte <= 55) { // 0-7
              let octal = String.fromCharCode(nextByte);
              
              // Read up to 2 more octal digits
              if (!this.isEOF() && this.isOctalDigit(this.buffer[this.position])) {
                octal += String.fromCharCode(this.buffer[this.position++]);
                
                if (!this.isEOF() && this.isOctalDigit(this.buffer[this.position])) {
                  octal += String.fromCharCode(this.buffer[this.position++]);
                }
              }
              
              const charCode = parseInt(octal, 8);
              result += String.fromCharCode(charCode);
            } else {
              // Just add the character (PDF spec says to ignore the backslash)
              result += String.fromCharCode(nextByte);
            }
        }
      } else {
        result += String.fromCharCode(currentByte);
      }
    }
    
    return new PDFToken(TokenType.STRING, result);
  }
  
  /**
   * Read a hexadecimal string token
   */
  private readHexString(): PDFToken {
    // Skip the opening '<'
    this.position++;
    let hexString = '';
    
    while (!this.isEOF() && this.buffer[this.position] !== 62) { // '>'
      const currentByte = this.buffer[this.position++];
      
      // Skip whitespace in hex strings
      if (!this.isWhitespace(currentByte)) {
        hexString += String.fromCharCode(currentByte);
      }
    }
    
    // Skip the closing '>'
    if (!this.isEOF()) {
      this.position++;
    }
    
    // If odd number of hex digits, assume a trailing 0
    if (hexString.length % 2 === 1) {
      hexString += '0';
    }
    
    // Convert hex string to binary
    let result = '';
    for (let i = 0; i < hexString.length; i += 2) {
      const charCode = parseInt(hexString.substring(i, i + 2), 16);
      result += String.fromCharCode(charCode);
    }
    
    return new PDFToken(TokenType.HEX_STRING, result);
  }
  
  /**
   * Read a stream
   */
  private readStream(): PDFToken {
    // Skip the "stream" keyword
    
    // Consume any leading whitespace (PDF spec allows it)
    while (!this.isEOF() && this.isWhitespace(this.buffer[this.position])) {
      this.position++;
    }
  
    // Find "endstream" by searching ahead
    let streamStart = this.position;
    let endStreamPos = this.buffer.indexOf(Buffer.from("endstream"), streamStart, "utf-8");
  
    if (endStreamPos === -1) {
      throw new Error("Malformed PDF: Missing 'endstream' keyword");
    }
  
    // Extract the binary data
    const streamData = this.buffer.slice(streamStart, endStreamPos);
  
    // Move position past "endstream"
    this.position = endStreamPos + 9;
  
    // Return a special token
    return new PDFToken(TokenType.STREAM, streamData);
  }
  
  /**
   * Read a keyword, boolean, null, or indirect reference
   */
  private readKeywordOrReference(): PDFToken {
    const startPos = this.position;
    
    // Read until whitespace or delimiter
    while (!this.isEOF() && 
           !this.isWhitespace(this.buffer[this.position]) && 
           !this.isDelimiter(this.buffer[this.position])) {
      this.position++;
    }
    
    const keyword = this.buffer.slice(startPos, this.position).toString();
    
    // Check for boolean values
    if (keyword === 'true') {
      return new PDFToken(TokenType.BOOLEAN, true);
    } else if (keyword === 'false') {
      return new PDFToken(TokenType.BOOLEAN, false);
    } else if (keyword === 'null') {
      return new PDFToken(TokenType.NULL, null);
    } else if (keyword === 'stream') {
      return this.readStream();
    } else if (keyword === 'obj') {
      return new PDFToken(TokenType.OBJ_START, 'obj');
    } else if (keyword === 'endobj') {
      return new PDFToken(TokenType.OBJ_END, 'endobj');
    } else if (keyword === 'R') {
      return new PDFToken(TokenType.INDIRECT_REFERENCE, 'R');
    } else {
      return new PDFToken(TokenType.KEYWORD, keyword);
    }
  }
  
  /**
   * Check if a byte is a PDF whitespace character
   */
  private isWhitespace(byte: number): boolean {
    // ASCII codes for whitespace characters in PDF
    // NUL (0), HT (9), LF (10), FF (12), CR (13), and SP (32)
    return byte === 0 || byte === 9 || byte === 10 || byte === 12 || byte === 13 || byte === 32;
  }
  
  /**
   * Check if a byte is an EOL (End of Line) character
   */
  private isEOL(byte: number): boolean {
    // CR (13) or LF (10)
    return byte === 13 || byte === 10;
  }
  
  /**
   * Check if a byte is a delimiter character
   */
    private isDelimiter(byte: number): boolean {
        // ASCII codes for the delimiter characters: ( ) < > [ ] { } / %
        const delimiters = [40, 41, 60, 62, 91, 93, 123, 125, 47, 37];
        return delimiters.includes(byte);
    }

    /**
     * Check if a byte is an octal digit (0-7)
     */
    private isOctalDigit(byte: number): boolean {
        // ASCII codes for '0' to '7' are 48 to 55
        return byte >= 48 && byte <= 55;
    }

    /**
     * Check if a byte is a hex digit (0-9, A-F, a-f)
     */
    private isHexDigit(byte: number): boolean {
        // '0' - '9'
        if (byte >= 48 && byte <= 57) return true;
        // 'A' - 'F'
        if (byte >= 65 && byte <= 70) return true;
        // 'a' - 'f'
        if (byte >= 97 && byte <= 102) return true;
        return false;
    }

    /**
     * Check if a byte represents a digit (0-9)
     */
    private isDigit(byte: number): boolean {
        // ASCII codes for '0' to '9' are 48 to 57
        return byte >= 48 && byte <= 57;
    }
}