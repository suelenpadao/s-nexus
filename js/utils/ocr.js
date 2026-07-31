// utils/ocr.js
// Camada de OCR — transforma o arquivo (PDF ou imagem) em texto puro.
// PDF com camada de texto: usa pdf.js (rápido, grátis, sem servidor).
// PDF escaneado (sem texto) ou imagem: usa Tesseract.js (OCR gratuito, roda no navegador).
// pdf.js e Tesseract.js são carregados como <script> clássico no index.html e ficam em window.

const MIN_TEXT_LENGTH_OK = 80; // abaixo disso, consideramos que não tem camada de texto útil (provavelmente escaneado)

export async function getTextFromFile(file) {
  const t0 = performance.now();
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (isPdf) {
    const pdfText = await extractPdfText(file).catch(() => '');
    if (pdfText && pdfText.trim().length >= MIN_TEXT_LENGTH_OK) {
      return { text: pdfText, method: 'pdf-text', timeMs: Math.round(performance.now() - t0) };
    }
    // PDF sem texto útil (escaneado) — renderiza páginas e roda OCR nelas
    const ocrText = await ocrPdfPages(file).catch(() => '');
    return { text: ocrText, method: 'ocr-pdf', timeMs: Math.round(performance.now() - t0) };
  }

  // Imagem direta — OCR
  const imgText = await ocrImageFile(file).catch(() => '');
  return { text: imgText, method: 'ocr-image', timeMs: Math.round(performance.now() - t0) };
}

async function extractPdfText(file) {
  if (!window.pdfjsLib) return '';
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  const maxPages = Math.min(pdf.numPages, 15); // trava de segurança pra contratos muito longos
  for (let p = 1; p <= maxPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    text += content.items.map(it => it.str).join(' ') + '\n';
  }
  return text;
}

async function ocrPdfPages(file) {
  if (!window.pdfjsLib || !window.Tesseract) return '';
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let text = '';
  const maxPages = Math.min(pdf.numPages, 5); // OCR é mais caro — limita páginas processadas
  for (let p = 1; p <= maxPages; p++) {
    const page = await pdf.getPage(p);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const { data } = await window.Tesseract.recognize(canvas, 'por');
    text += (data.text || '') + '\n';
  }
  return text;
}

async function ocrImageFile(file) {
  if (!window.Tesseract) return '';
  const { data } = await window.Tesseract.recognize(file, 'por');
  return data.text || '';
}
