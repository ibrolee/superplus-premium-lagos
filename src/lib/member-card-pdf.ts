/* A two-page, actual-size (85.6 x 54 mm) CR80 PDF, generated without a new dependency.
 * Both sides are rasterised at 3x SVG resolution (~760 DPI at finished size).
 * The existing site logo is embedded before rasterisation so it appears offline.
 */
import { presentMemberCardPdf } from './member-card-file-actions';

const CARD_WIDTH_PT = 85.6 * 72 / 25.4;
const CARD_HEIGHT_PT = 54 * 72 / 25.4;
const encoder = new TextEncoder();

async function cardJpeg(svgElement: SVGSVGElement): Promise<{ bytes: Uint8Array; width: number; height: number }> {
  const svg = svgElement.cloneNode(true) as SVGSVGElement;
  svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  for (const image of Array.from(svg.querySelectorAll('image'))) {
    const url = image.getAttribute('href') || image.getAttribute('xlink:href');
    if (!url || url.startsWith('data:')) continue;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Unable to load the brand logo for printing.');
    const logoSvg = await response.text();
    image.setAttribute('href', `data:image/svg+xml;charset=utf-8,${encodeURIComponent(logoSvg)}`);
  }
  const markup = new XMLSerializer().serializeToString(svg);
  const objectUrl = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
  try {
    const rendered = new Image();
    await new Promise<void>((resolve, reject) => {
      rendered.onload = () => resolve();
      rendered.onerror = () => reject(new Error('Unable to render the membership card.'));
      rendered.src = objectUrl;
    });
    const width = 2568;
    const height = 1620;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser cannot prepare the card PDF.');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);
    context.drawImage(rendered, 0, 0, width, height);
    const jpeg = canvas.toDataURL('image/jpeg', 0.98).split(',')[1];
    if (!jpeg) throw new Error('Unable to encode the membership card image.');
    const decoded = atob(jpeg);
    const bytes = new Uint8Array(decoded.length);
    for (let index = 0; index < decoded.length; index++) bytes[index] = decoded.charCodeAt(index);
    return { bytes, width, height };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/** Returns a Blob for a PDF with one full-size front page and one full-size back page. */
export async function generateMemberCardPdf(front: SVGSVGElement, back: SVGSVGElement): Promise<Blob> {
  const images = await Promise.all([cardJpeg(front), cardJpeg(back)]);
  const parts: Uint8Array[] = [];
  const offsets: number[] = [0];
  let length = 0;
  const write = (value: string | Uint8Array) => {
    const bytes = typeof value === 'string' ? encoder.encode(value) : value;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string) => {
    offsets[id] = length;
    write(`${id} 0 obj\n${body}\nendobj\n`);
  };
  write('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>');
  [3, 4].forEach((id, index) => object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${CARD_WIDTH_PT.toFixed(4)} ${CARD_HEIGHT_PT.toFixed(4)}] /Resources << /XObject << /Card ${5 + index} 0 R >> >> /Contents ${7 + index} 0 R >>`));
  images.forEach((image, index) => {
    const id = index + 5;
    offsets[id] = length;
    write(`${id} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`);
    write(image.bytes); write('\nendstream\nendobj\n');
  });
  [7, 8].forEach((id) => {
    const stream = `q\n${CARD_WIDTH_PT.toFixed(4)} 0 0 ${CARD_HEIGHT_PT.toFixed(4)} 0 0 cm\n/Card Do\nQ\n`;
    object(id, `<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream`);
  });
  const xref = length;
  write('xref\n0 9\n0000000000 65535 f \n');
  for (let id = 1; id <= 8; id++) write(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  write(`trailer\n<< /Size 9 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts as BlobPart[], { type: 'application/pdf' });
}

export function saveMemberCardPdf(blob: Blob, filename: string) {
  presentMemberCardPdf(blob, filename);
}
