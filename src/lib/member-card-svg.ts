export function downloadMemberCardSvg(card: SVGSVGElement, filename: string): void {
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
  const blob = new Blob(['<?xml version="1.0" encoding="UTF-8"?>\n', new XMLSerializer().serializeToString(copy)], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
}
