/**
 * Process Image: Add watermark using Canvas
 */
async function processImage(file: File, logoUrl: string): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const logoImg = new Image();

    img.onload = () => {
      logoImg.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('No canvas context'));
          return;
        }

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Calculate watermark position (bottom right corner with 20px padding)
        const logoWidth = Math.min(150, img.width * 0.25);
        const logoHeight = (logoWidth / logoImg.width) * logoImg.height;
        const x = canvas.width - logoWidth - 20;
        const y = canvas.height - logoHeight - 20;

        // Apply slight transparency to the watermark
        ctx.globalAlpha = 0.85;
        ctx.drawImage(logoImg, x, y, logoWidth, logoHeight);
        ctx.globalAlpha = 1.0;

        // Export as Blob
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(new File([blob], file.name, { type: file.type }));
            } else {
              reject(new Error('canvas.toBlob failed'));
            }
          },
          file.type,
          0.9,
        );
      };
      logoImg.onerror = reject;
      logoImg.src = logoUrl;
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Main function to handle the file
 * Currently only processes images for watermarking.
 * Videos are returned as-is.
 */
export async function processMediaFile(file: File, logoUrl = '/logo.svg'): Promise<File> {
  if (file.type.startsWith('image/')) {
    console.log('[mediaProcessor] Processing image via Canvas...');
    return processImage(file, logoUrl);
  }

  // If it's a video or other file type, return as-is
  return file;
}