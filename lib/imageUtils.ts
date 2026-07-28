/**
 * Resizes an image client-side using an HTML5 Canvas to a maximum dimension
 * while maintaining aspect ratio. This prevents sending heavy payloads (like 4MB photos)
 * over the network when only a smaller resolution is needed.
 *
 * @param src The source image (can be a relative path, absolute URL, or base64 data URI).
 * @param maxDimension The maximum width or height in pixels.
 * @returns A Promise that resolves to the resized base64 image string (data:image/jpeg;base64,...).
 */
export async function resizeImageClientSide(src: string, maxDimension: number = 800): Promise<string> {
  return new Promise((resolve, reject) => {
    // If we're not in a browser environment, just return the source
    if (typeof window === 'undefined') {
      return resolve(src);
    }

    const img = new Image();
    
    // Handle cross-origin if it's an absolute HTTP URL
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'Anonymous';
    }

    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Check if resizing is necessary
      if (width <= maxDimension && height <= maxDimension) {
        // Already small enough, but let's draw it on canvas anyway to convert it 
        // cleanly to a compressed base64 JPEG instead of a giant uncompressed PNG data URI
      } else {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve(src); // Fallback to original if canvas fails
      }

      const isPngOrWebp = src.startsWith('data:image/png') || 
                          src.startsWith('data:image/webp') || 
                          src.toLowerCase().includes('.png') || 
                          src.toLowerCase().includes('.webp');

      if (!isPngOrWebp) {
        // Draw white background for non-transparent formats so it converts cleanly to JPEG
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Export as PNG if transparent, or JPEG if not transparent
      const exportFormat = isPngOrWebp ? 'image/png' : 'image/jpeg';
      const dataUrl = canvas.toDataURL(exportFormat, isPngOrWebp ? undefined : 0.8);
      resolve(dataUrl);
    };

    img.onerror = (err) => {
      console.warn('[resizeImageClientSide] Failed to load image for resizing, falling back to original:', err);
      resolve(src); // Fallback to original if image fails to load (e.g. strict CORS)
    };

    img.src = src;
  });
}
