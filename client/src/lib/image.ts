/**
 * Read an image File, centre-crop it to a square, downscale, and return a PNG
 * data URL. Used for player photos and club crests so images are stored inline
 * (same-origin) — keeps canvas card downloads working with no external hosting.
 */
export function fileToSquareDataUrl(file: File, size = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Please choose an image file.'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load the image.'));
      img.onload = () => {
        // Centre-crop to a square
        const side = Math.min(img.width, img.height);
        const sx = (img.width - side) / 2;
        const sy = (img.height - side) / 2;
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported.')); return; }
        ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size);
        // JPEG keeps photos small; quality 0.85 is plenty for a card avatar
        let dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        if (dataUrl.length > 1_400_000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        }
        resolve(dataUrl);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
