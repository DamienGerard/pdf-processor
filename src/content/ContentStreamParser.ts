import { PDFObjectResolver } from "../parsing/PDFObjectResolver";
import { PDFSecurityHandler } from "../security/PDFSecurityHandler";
import { PDFIndirectReference, PDFResources } from "../types/PDFTypes";

export class ContentStreamParser{
  extractText(arg0: any[]): string | PromiseLike<string> {
    throw new Error('Method not implemented.');
  }
  parse(contents: PDFIndirectReference | PDFIndirectReference[], resources: PDFResources): any[] | PromiseLike<any[]> {
    throw new Error('Method not implemented.');
  }
  constructor(resolver: PDFObjectResolver, securityHandler?: PDFSecurityHandler){}
}