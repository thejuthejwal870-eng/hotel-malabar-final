export const EXACT_WATERMARK_TEXT = 'This is made by INSTA ID @thee.juuu';

/**
 * Draws the mandatory watermark directly into an image File and returns a Base64 data URL.
 */
export async function applyWatermarkToImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return reject(new Error('Canvas 2D context unavailable'));
        }

        // Set dimensions (cap max resolution to 1400px for speed and database compactness)
        let width = img.width;
        let height = img.height;
        const maxDimension = 1200;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        // Draw original food image
        ctx.drawImage(img, 0, 0, width, height);

        // Watermark typography configuration
        const fontSize = Math.max(14, Math.round(width * 0.024));
        ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace, sans-serif`;

        const textMetrics = ctx.measureText(EXACT_WATERMARK_TEXT);
        const paddingX = Math.round(fontSize * 0.8);
        const paddingY = Math.round(fontSize * 0.5);
        const badgeWidth = textMetrics.width + paddingX * 2;
        const badgeHeight = fontSize + paddingY * 2;

        const margin = Math.round(width * 0.025);
        const badgeX = width - badgeWidth - margin;
        const badgeY = height - badgeHeight - margin;

        // Draw semi-transparent dark forest green pill background
        ctx.save();
        ctx.fillStyle = 'rgba(12, 35, 23, 0.85)';
        ctx.strokeStyle = 'rgba(203, 161, 53, 0.6)';
        ctx.lineWidth = 1.5;

        // Rounded rect for badge
        const radius = 6;
        ctx.beginPath();
        ctx.moveTo(badgeX + radius, badgeY);
        ctx.lineTo(badgeX + badgeWidth - radius, badgeY);
        ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + radius);
        ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - radius);
        ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - radius, badgeY + badgeHeight);
        ctx.lineTo(badgeX + radius, badgeY + badgeHeight);
        ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - radius);
        ctx.lineTo(badgeX, badgeY + radius);
        ctx.quadraticCurveTo(badgeX, badgeY, badgeX + radius, badgeY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Draw gold watermark text
        ctx.fillStyle = '#dfb64c';
        ctx.textBaseline = 'middle';
        ctx.fillText(EXACT_WATERMARK_TEXT, badgeX + paddingX, badgeY + badgeHeight / 2);

        ctx.restore();

        // Export as webp or high quality jpeg data URL
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image for watermarking'));
      img.src = event.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

/**
 * Draws the mandatory watermark onto an existing image URL or cross-origin image and returns Base64.
 */
export async function applyWatermarkToImageUrl(imageUrl: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(imageUrl); // fallback to original if canvas fails
        }

        let width = img.width || 800;
        let height = img.height || 600;
        const maxDimension = 1200;

        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;

        ctx.drawImage(img, 0, 0, width, height);

        const fontSize = Math.max(14, Math.round(width * 0.024));
        ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace, sans-serif`;

        const textMetrics = ctx.measureText(EXACT_WATERMARK_TEXT);
        const paddingX = Math.round(fontSize * 0.8);
        const paddingY = Math.round(fontSize * 0.5);
        const badgeWidth = textMetrics.width + paddingX * 2;
        const badgeHeight = fontSize + paddingY * 2;

        const margin = Math.round(width * 0.025);
        const badgeX = width - badgeWidth - margin;
        const badgeY = height - badgeHeight - margin;

        ctx.save();
        ctx.fillStyle = 'rgba(12, 35, 23, 0.85)';
        ctx.strokeStyle = 'rgba(203, 161, 53, 0.6)';
        ctx.lineWidth = 1.5;

        const radius = 6;
        ctx.beginPath();
        ctx.moveTo(badgeX + radius, badgeY);
        ctx.lineTo(badgeX + badgeWidth - radius, badgeY);
        ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY, badgeX + badgeWidth, badgeY + radius);
        ctx.lineTo(badgeX + badgeWidth, badgeY + badgeHeight - radius);
        ctx.quadraticCurveTo(badgeX + badgeWidth, badgeY + badgeHeight, badgeX + badgeWidth - radius, badgeY + badgeHeight);
        ctx.lineTo(badgeX + radius, badgeY + badgeHeight);
        ctx.quadraticCurveTo(badgeX, badgeY + badgeHeight, badgeX, badgeY + badgeHeight - radius);
        ctx.lineTo(badgeX, badgeY + radius);
        ctx.quadraticCurveTo(badgeX, badgeY, badgeX + radius, badgeY);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#dfb64c';
        ctx.textBaseline = 'middle';
        ctx.fillText(EXACT_WATERMARK_TEXT, badgeX + paddingX, badgeY + badgeHeight / 2);
        ctx.restore();

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        resolve(dataUrl);
      } catch (e) {
        // In case of CORS restriction on external image, return original URL
        resolve(imageUrl);
      }
    };
    img.onerror = () => resolve(imageUrl);
    img.src = imageUrl;
  });
}
