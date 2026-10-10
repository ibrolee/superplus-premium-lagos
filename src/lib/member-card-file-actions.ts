/* PDFs need a second, direct user tap for iOS's native file share sheet.
 * Creating the file takes time and Safari may display a blob URL rather than
 * honouring a programmatic download from an expired user gesture. */
export function prefersMobileCardShare() {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
}

/**
 * Show a persistent action sheet AFTER asynchronous PDF preparation.
 * The native share API must be called directly inside the next tap, not after
 * awaiting image rendering. No PDF or member details leave the device unless
 * the administrator explicitly chooses a share destination.
 */
export function presentMemberCardPdf(blob: Blob, filename: string) {
  if (!prefersMobileCardShare()) { download(blob, filename); return; }

  document.getElementById('spf-card-pdf-actions')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'spf-card-pdf-actions';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', 'Your membership card PDF is ready');
  overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.77);display:flex;align-items:flex-end;justify-content:center;padding:16px;';
  const panel = document.createElement('div');
  panel.style.cssText = 'width:100%;max-width:480px;border:1px solid #f36840;border-radius:20px;background:#191a1c;color:#fff;padding:22px;font:500 15px/1.5 system-ui,-apple-system,sans-serif;box-shadow:0 16px 60px #0008;';
  const heading = document.createElement('h2');
  heading.textContent = 'Your PDF is ready';
  heading.style.cssText = 'font-size:22px;font-weight:800;margin:0 0 6px;';
  const description = document.createElement('p');
  description.textContent = 'Tap Save / Share / Print, then choose Save to Files or Print in the iPhone share sheet. The card is not saved until you choose an action.';
  description.style.cssText = 'margin:0 0 12px;color:#e4dadd;';
  const name = document.createElement('p');
  name.textContent = filename;
  name.style.cssText = 'margin:0 0 16px;overflow-wrap:anywhere;color:#ffab89;font-size:12px;';
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.style.cssText = 'margin:12px 0 0;color:#f7cfbf;font-size:13px;';
  function button(label: string, emphasis = false) {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    element.style.cssText = `width:100%;min-height:49px;margin-top:9px;border-radius:11px;border:1px solid ${emphasis ? '#ff683f' : '#777'};background:${emphasis ? '#ef4634' : '#303135'};color:#fff;font:700 15px system-ui,-apple-system,sans-serif;cursor:pointer;padding:10px;`;
    return element;
  }
  const share = button('Save / Share / Print', true);
  const direct = button('Download PDF instead');
  const preview = button('Open PDF preview');
  const close = button('Close');
  const file = new File([blob], filename, { type: 'application/pdf' });
  const payload = { files: [file], title: 'Super Plus Fitness membership card' };
  const supportsShare = typeof navigator.share === 'function' &&
    (typeof navigator.canShare !== 'function' || navigator.canShare({ files: [file] }));
  if (!supportsShare) {
    share.textContent = 'Save / Share unavailable in this browser';
    share.disabled = true;
    share.style.opacity = '.45';
    status.textContent = 'Use Download PDF instead, or open the preview and use Safari’s Share menu.';
  }
  share.addEventListener('click', () => {
    // Calling navigator.share synchronously here preserves iOS user activation.
    void navigator.share(payload).then(() => {
      status.textContent = 'Share sheet completed. If you selected Save to Files, check the Files app.';
    }).catch((error: unknown) => {
      if (error instanceof Error && error.name === 'AbortError') return;
      status.textContent = 'Sharing was unavailable. Try Download PDF instead.';
    });
  });
  direct.addEventListener('click', () => {
    download(blob, filename);
    status.textContent = 'If Safari opens a PDF instead of saving it, return here and use Save / Share / Print, or use Share in the PDF viewer.';
  });
  preview.addEventListener('click', () => {
    const url = URL.createObjectURL(blob);
    const opened = window.open(url, '_blank');
    if (!opened) status.textContent = 'Safari blocked the preview. Use Save / Share / Print instead.';
    window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
  });
  close.addEventListener('click', () => overlay.remove());
  panel.append(heading, description, name, share, direct, preview, close, status);
  overlay.append(panel);
  document.body.append(overlay);
  close.focus();
}
