import { useLayoutEffect, useRef } from 'react';

/** The QR artwork begins at x=583; keep member names inside x=76..541 with breathing room. */
const MAX_NAME_WIDTH = 465;
const ORIGINAL_FONT_SIZE = 47;
const MIN_FONT_SIZE = 22;

export function FittedMemberName({ name }: { name: string }) {
  const reference = useRef<SVGTextElement>(null);
  useLayoutEffect(() => {
    let cancelled = false;
    const fit = () => {
      const text = reference.current;
      if (!text || cancelled) return;
      // Reset first so subsequent member changes and font loading never compound shrinking.
      text.setAttribute('font-size', String(ORIGINAL_FONT_SIZE));
      text.removeAttribute('textLength');
      text.removeAttribute('lengthAdjust');
      const measured = text.getComputedTextLength();
      if (!Number.isFinite(measured) || measured <= MAX_NAME_WIDTH) return;
      const nextSize = Math.max(MIN_FONT_SIZE, Math.floor(ORIGINAL_FONT_SIZE * MAX_NAME_WIDTH / measured));
      text.setAttribute('font-size', String(nextSize));
      // Save an explicit upper bound for PDF SVG rasterization, whose font fallback
      // can be wider than the on-page font. Never stretch already-fitting names.
      text.setAttribute('textLength', String(Math.min(MAX_NAME_WIDTH, text.getComputedTextLength())));
      text.setAttribute('lengthAdjust', 'spacingAndGlyphs');
    };
    fit();
    void document.fonts?.ready.then(fit);
    return () => { cancelled = true; };
  }, [name]);
  return <text ref={reference} x="76" y="321" fill="#fff" fontWeight="850" fontSize={ORIGINAL_FONT_SIZE}>
    {name.toUpperCase()}
  </text>;
}
