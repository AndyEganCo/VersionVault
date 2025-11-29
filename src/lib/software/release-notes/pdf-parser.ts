import * as pdfjsLib from 'pdfjs-dist';

// Use unpkg CDN which is more reliable and supports ES modules
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

/**
 * Parse a PDF file and extract all text content
 */
export async function parsePDFFile(file: File): Promise<string> {
  try {
    console.log('Starting PDF parse for file:', file.name, 'Size:', file.size);

    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    console.log('ArrayBuffer loaded, size:', arrayBuffer.byteLength);

    // Load PDF document with additional options
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true
    });

    const pdf = await loadingTask.promise;
    console.log('PDF loaded, pages:', pdf.numPages);

    let fullText = '';

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`Processing page ${pageNum}/${pdf.numPages}`);
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      // Combine text items with spaces
      const pageText = textContent.items
        .map((item: any) => item.str)
        .join(' ');

      fullText += pageText + '\n\n';
    }

    console.log('PDF parsing complete, text length:', fullText.length);
    return fullText;
  } catch (error) {
    console.error('Error parsing PDF:', error);
    if (error instanceof Error) {
      throw new Error(`Failed to parse PDF: ${error.message}`);
    }
    throw new Error('Failed to parse PDF file');
  }
}
