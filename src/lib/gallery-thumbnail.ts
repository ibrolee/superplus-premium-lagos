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
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    await new Promise<void>((resolve, reject) => {
      const ready = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error("Could not decode this video for optimization."));
      };
      const cleanup = () => {
        video.removeEventListener("loadeddata", ready);
        video.removeEventListener("error", failed);
      };
      video.addEventListener("loadeddata", ready, { once: true });
      video.addEventListener("error", failed, { once: true });
      video.load();
    });

    // iOS Safari can fail when seeking some MP4 encodings. Try a tiny seek for a
    // better poster frame, but fall back to the already-decoded first frame.
    const duration = Number.isFinite(video.duration) ? video.duration : 0;
    if (duration > 0.2) {
      await new Promise<void>((resolve) => {
        let finished = false;
        const done = () => {
          if (finished) return;
          finished = true;
          video.removeEventListener("seeked", done);
          window.clearTimeout(timeout);
          resolve();
        };
        const timeout = window.setTimeout(done, 1200);
        video.addEventListener("seeked", done, { once: true });
        try {
          video.currentTime = Math.min(0.15, duration / 4);
        } catch {
          done();
        }
      });
    }

    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    const size = fitSize(width, height);
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
