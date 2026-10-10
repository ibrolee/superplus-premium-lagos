/* Batch export: alternating front/back CR80 pages, same size as the single-card PDF.
 * A 25-member ceiling keeps memory and mobile PDF sizes manageable. */
import { presentMemberCardPdf } from './member-card-file-actions';

const PAGE_W = 85.6 * 72 / 25.4;
const PAGE_H = 54 * 72 / 25.4;
const encoder = new TextEncoder();

async function renderCard(svgElement: SVGSVGElement): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const svg = svgElement.cloneNode(true) as SVGSVGElement;
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  for (const image of Array.from(svg.querySelectorAll('image'))) {
    const url = image.getAttribute('href') || image.getAttribute('xlink:href');
    if (!url || url.startsWith('data:')) continue;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Unable to load the card logo for the print file.');
    image.setAttribute('href', `data:image/svg+xml;charset=utf-8,${encodeURIComponent(await response.text())}`);
  }
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const loaded = new Image();
    await new Promise<void>((resolve, reject) => {
      loaded.onload = () => resolve();
      loaded.onerror = () => reject(new Error('Could not render a selected membership card.'));
      loaded.src = url;
    });
    const width = 1712;
    const height = 1080;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot generate batch print files.');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(loaded, 0, 0, width, height);
    const payload = canvas.toDataURL('image/jpeg', 0.95).split(',')[1];
    if (!payload) throw new Error('Unable to encode a selected membership card image.');
    const decoded = atob(payload);
    const bytes = new Uint8Array(decoded.length);
    for (let i = 0; i < decoded.length; i++) bytes[i] = decoded.charCodeAt(i);
    return { bytes, width, height };
  } finally { URL.revokeObjectURL(url); }
}

export async function generateMemberCardBatchPdf(pairs: Array<{ front: SVGSVGElement; back: SVGSVGElement }>): Promise<Blob> {
  if (pairs.length < 1 || pairs.length > 25) throw new Error('Choose between 1 and 25 cards per PDF batch.');
  const images: Array<{ bytes: Uint8Array; width: number; height: number }> = [];
  // Sequential rasterisation avoids running 50 large canvases simultaneously on mobile.
  for (const pair of pairs) { images.push(await renderCard(pair.front)); images.push(await renderCard(pair.back)); }
  const count = images.length;
  const lastId = 2 + 3 * count;
  const offsets: number[] = Array(lastId + 1).fill(0);
  const parts: Uint8Array[] = [];
  let length = 0;
  function write(value: string | Uint8Array) {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    parts.push(bytes); length += bytes.length;
  }
  function object(id: number, content: string) {
    offsets[id] = length; write(`${id} 0 obj\n${content}\nendobj\n`);
  }
  const pageId = (index: number) => 3 + index;
  const imageId = (index: number) => 3 + count + index;
  const streamId = (index: number) => 3 + 2 * count + index;
  write('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${images.map((_image, index) => `${pageId(index)} 0 R`).join(' ')}] /Count ${count} >>`);
  images.forEach((_image, index) => object(pageId(index), `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(4)} ${PAGE_H.toFixed(4)}] /Resources << /XObject << /Card ${imageId(index)} 0 R >> >> /Contents ${streamId(index)} 0 R >>`));
  images.forEach((image, index) => {
    const id = imageId(index); offsets[id] = length;
    write(`${id} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);
    write(image.bytes); write('\nendstream\nendobj\n');
  });
  images.forEach((_image, index) => {
    const stream = `q\n${PAGE_W.toFixed(4)} 0 0 ${PAGE_H.toFixed(4)} 0 0 cm\n/Card Do\nQ\n`;
    object(streamId(index), `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`);
  });
  const xref = length;
  write(`xref\n0 ${lastId + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= lastId; id++) write(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  write(`trailer\n<< /Size ${lastId + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}

export function saveBatchPdf(pdf: Blob, filename: string) {
  presentMemberCardPdf(pdf, filename);
}
