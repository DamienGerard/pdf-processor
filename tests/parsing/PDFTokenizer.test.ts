import * as fs from "fs/promises";
import { PDFToken, PDFTokenizer, TokenType } from "../../src/parsing/PDFTokenizer";

// Enable or disable logging
// const logEnabled = true;

describe('PDFTokenizer Tests', () => {
  
  /**
   * Runs the tokenizer on the given buffer and logs the tokens.
   * @param buffer The buffer containing PDF data
   * @param testName The name of the test
   */
  async function testTokenizer(buffer: Buffer, testName: string, logEnabled: boolean = true) {
    console.log(`\n=== Running Test: ${testName} ===`);
    
    const tokenizer = new PDFTokenizer(buffer);
    const tokens: PDFToken[] = [];
    let token: PDFToken | null;

    try {
      // Tokenize the buffer and collect tokens until EOF or invalid token
      while ((token = tokenizer.nextToken()) !== null) {
        if (logEnabled) {
          console.log("Token:", token.toString());
        }
        tokens.push(token);
        // Break on EOF or invalid token
        if (token.type === TokenType.EOF || token.value === null) {
          break;
        }
      }

      // Basic assertion: ensure tokens are found
      expect(tokens.length).toBeGreaterThan(0);
    } catch (error) {
      console.error(`Error during tokenization in test "${testName}":`, error);
      throw error;  // Re-throw to fail the test
    }

    console.log(`\n=== Test "${testName}" Completed ===\n`);
  }

  /**
   * Test Case 1: Tokenizing a hardcoded sample PDF-like buffer
   */
  it('should tokenize a sample PDF buffer correctly', async () => {
    const samplePDF = Buffer.from(`
      %PDF-1.7
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
      %%EOF
    `);

    await testTokenizer(samplePDF, 'Sample Buffer Test');
  });

  /**
   * Test Case 2: Tokenizing an actual PDF file.
   * @param filePath The path of the PDF file to test.
   */
  it('should tokenize a PDF file correctly', async () => {
    const filePath = "C:\\Users\\p128bf6\\source\\repos\\pdf-processor\\tests\\resources\\sampleFile2.pdf"; // Update with your actual PDF file path
    try {
      const data = await fs.readFile(filePath);
      await testTokenizer(data, `File Path Test (${filePath})`, false);
    } catch (err) {
      console.error(`Error reading file "${filePath}":`, err);
      throw err; // Re-throw to fail the test
    }
  });

});
