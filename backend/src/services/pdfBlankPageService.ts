import { PDFDocument, PDFArray, PDFRef, PDFRawStream, decodePDFRawStream } from 'pdf-lib'

// LibreOffice's headless DOCX->PDF conversion sometimes mis-paginates templates that use
// absolute-positioned/floating text boxes (a technique some of our government form templates
// use for pixel-exact layout): it can inject extra pages that render nothing at all. This
// scans a converted PDF and drops pages that have no text, image, or shading operators in
// their content stream, i.e. pages that are visually empty filler rather than real content.
const VISIBLE_OPERATOR_PATTERN = /(?:^|[\s>])(Tj|TJ|Do|sh|BI)(?:[\s(<[]|$)/

function pageHasVisibleContent(pdfDoc: PDFDocument, page: ReturnType<PDFDocument['getPage']>): boolean {
  const contents = page.node.Contents()
  const streams = contents instanceof PDFArray
    ? contents.asArray()
    : contents
      ? [contents]
      : []

  for (const entry of streams) {
    const stream = entry instanceof PDFRef ? pdfDoc.context.lookup(entry) : entry
    if (!(stream instanceof PDFRawStream)) continue

    let decoded: Uint8Array
    try {
      decoded = decodePDFRawStream(stream).decode()
    } catch {
      // If we can't decode a content stream, don't risk dropping the page.
      return true
    }

    if (VISIBLE_OPERATOR_PATTERN.test(Buffer.from(decoded).toString('latin1'))) {
      return true
    }
  }

  return false
}

export async function stripBlankPdfPages(buffer: Buffer): Promise<Buffer> {
  try {
    const pdfDoc = await PDFDocument.load(buffer, { updateMetadata: false })
    const pages = pdfDoc.getPages()
    if (pages.length <= 1) return buffer

    const blankIndexes: number[] = []
    for (let i = 0; i < pages.length; i += 1) {
      if (!pageHasVisibleContent(pdfDoc, pages[i])) blankIndexes.push(i)
    }

    if (blankIndexes.length === 0 || blankIndexes.length === pages.length) return buffer

    for (let i = blankIndexes.length - 1; i >= 0; i -= 1) {
      pdfDoc.removePage(blankIndexes[i])
    }

    const saved = await pdfDoc.save()
    return Buffer.from(saved)
  } catch (error) {
    console.warn('[stripBlankPdfPages] failed, returning original PDF.', error)
    return buffer
  }
}
