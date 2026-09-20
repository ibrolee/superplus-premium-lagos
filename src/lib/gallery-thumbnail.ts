// Generate lightweight gallery card images without paid Supabase transformations.
// This runs only in the authenticated manager's browser on upload or backfill.
export async function makeGalleryThumbnail(source: Blob): Promise<Blob> {
  const objectUrl = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Could not decode this photo for optimization.'));
      image.src = objectUrl;
    });
    const maxDimension = 720;
    const ratio = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas image optimization is unavailable.');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not export optimized photo.')), 'image/webp', 0.68);
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
