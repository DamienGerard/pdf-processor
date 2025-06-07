import { RenderOptions } from "../core/PDFPage";
import { Rectangle, Matrix } from "../types/ContentTypes";

export class GraphicsEngine{
  render(arg0: any[], arg1: any, cropBox: Rectangle, transform: Matrix, options: RenderOptions) {
    throw new Error('Method not implemented.');
  }
}