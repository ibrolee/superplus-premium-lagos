type SvgZipEntry = { filename: string; card: SVGSVGElement };

function serializeMemberCardSvg(card: SVGSVGElement): string {
  const copy = card.cloneNode(true) as SVGSVGElement;
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  copy.setAttribute('width', '85.6mm');
  copy.setAttribute('height', '54mm');
  copy.setAttribute('viewBox', '0 0 856 540');
  copy.removeAttribute('class');
  copy.removeAttribute('role');
  copy.removeAttribute('aria-label');
  copy.removeAttribute('data-card-side');
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(copy)}`;
}

function downloadBlob(blob: Blob, filename: string, revokeAfter = 60000): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), revokeAfter);
}

export function downloadMemberCardSvg(card: SVGSVGElement, filename: string): void {
  const blob = new Blob([serializeMemberCardSvg(card)], { type: 'image/svg+xml;charset=utf-8' });
  downloadBlob(blob, filename);
}

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < CRC_TABLE.length; index++) {
  let crc = index;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  CRC_TABLE[index] = crc >>> 0;
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]!;
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date = new Date()): { date: number; time: number } {
  return {
    date: ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
  };
}

function header(size: number, writer: (view: DataView) => void): Uint8Array {
  const bytes = new Uint8Array(size);
  writer(new DataView(bytes.buffer));
  return bytes;
}

function createZip(entries: { filename: string; content: string }[]): Blob {
  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: BlobPart[] = [];
  const stamp = dosDateTime();
  let offset = 0;
  let centralSize = 0;

  for (const entry of entries) {
    const filename = encoder.encode(entry.filename);
    const data = encoder.encode(entry.content);
    const crc = crc32(data);
    const localOffset = offset;
    const localHeader = header(30 + filename.length, (view) => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 0x0800, true);
      view.setUint16(8, 0, true);
      view.setUint16(10, stamp.time, true);
      view.setUint16(12, stamp.date, true);
      view.setUint32(14, crc, true);
      view.setUint32(18, data.length, true);
      view.setUint32(22, data.length, true);
      view.setUint16(26, filename.length, true);
      view.setUint16(28, 0, true);
      localHeaderName(filename, view, 30);
    });
    parts.push(localHeader, data);
    offset += localHeader.byteLength + data.byteLength;

    const centralHeader = header(46 + filename.length, (view) => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, 0x0800, true);
      view.setUint16(10, 0, true);
      view.setUint16(12, stamp.time, true);
      view.setUint16(14, stamp.date, true);
      view.setUint32(16, crc, true);
      view.setUint32(20, data.length, true);
      view.setUint32(24, data.length, true);
      view.setUint16(28, filename.length, true);
      view.setUint16(30, 0, true);
      view.setUint16(32, 0, true);
      view.setUint16(34, 0, true);
      view.setUint16(36, 0, true);
      view.setUint32(38, 0, true);
      view.setUint32(42, localOffset, true);
      localHeaderName(filename, view, 46);
    });
    central.push(centralHeader);
    centralSize += centralHeader.byteLength;
  }

  const end = header(22, (view) => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(4, 0, true);
    view.setUint16(6, 0, true);
    view.setUint16(8, entries.length, true);
    view.setUint16(10, entries.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, offset, true);
    view.setUint16(20, 0, true);
  });

  return new Blob([...parts, ...central, end], { type: 'application/zip' });
}

function localHeaderName(filename: Uint8Array, view: DataView, start: number): void {
  new Uint8Array(view.buffer, start, filename.length).set(filename);
}

export function downloadMemberCardSvgZip(entries: SvgZipEntry[], filename: string): void {
  if (!entries.length) throw new Error('No membership card SVG files were selected.');
  const zip = createZip(entries.map((entry) => ({ filename: entry.filename, content: serializeMemberCardSvg(entry.card) })));
  downloadBlob(zip, filename, 120000);
}
