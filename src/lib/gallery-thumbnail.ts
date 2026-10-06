// Generate lightweight gallery card images without paid Supabase transformations.
// This runs only in the authenticated manager's browser on upload or backfill.
async function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.66): Promise<Blob> {
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Could not export optimized media preview."))),
      "image/jpeg",
      quality,
    );
  });
}

function fitSize(width: number, height: number, maxDimension = 640) {
  const ratio = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

export async function makeGalleryThumbnail(source: Blob): Promise<Blob> {
  const objectUrl = URL.createObjectURL(source);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("Could not decode this photo for optimization."));
      image.src = objectUrl;
    });

    const size = fitSize(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas image optimization is unavailable.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return await canvasToJpeg(canvas);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function makeGalleryVideoThumbnail(source: Blob): Promise<Blob> {
  const objectUrl = URL.createObjectURL(source);
  try {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new Error("Could not decode this video for optimization."));
    });

    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    video.currentTime = Math.min(0.15, Math.max(0, duration / 4));
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error("Could not capture a video preview."));
    });

    const size = fitSize(video.videoWidth || 1280, video.videoHeight || 720);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas video optimization is unavailable.");
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await canvasToJpeg(canvas, 0.62);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
