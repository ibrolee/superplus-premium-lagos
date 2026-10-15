export async function compressImageForWeb(
  source: Blob,
  options: { maxDimension?: number; quality?: number } = {},
): Promise<Blob> {
  const { maxDimension = 1400, quality = 0.76 } = options;
  const objectUrl = URL.createObjectURL(source);

  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not decode this image."));
      image.src = objectUrl;
    });

    const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * ratio));
    const height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser image optimization is unavailable.");

    // JPEG has no alpha channel. Use white behind transparent PNG/WebP assets.
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Could not export optimized image."))),
        "image/jpeg",
        quality,
      );
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
