import React, { useState, useEffect } from 'react';

interface BlendedImageProps {
  src: string;
  blendMode?: string;
  className?: string;
  style?: React.CSSProperties;
  alt?: string;
}

export default function BlendedImage({ src, blendMode, className, style, alt }: BlendedImageProps) {
  const [processedSrc, setProcessedSrc] = useState<string>(src);

  useEffect(() => {
    if (!src) {
      setProcessedSrc('');
      return;
    }

    if (!blendMode || blendMode === 'normal') {
      setProcessedSrc(src);
      return;
    }

    // Process image to turn white background transparent for multiply/darken blendModes
    if (blendMode === 'multiply' || blendMode === 'darken') {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setProcessedSrc(src);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imgData.data;

          // Convert light/white pixels to transparent alpha
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Near white threshold (> 210)
            if (r > 210 && g > 210 && b > 210) {
              const brightness = (r + g + b) / 3;
              const alphaFactor = (255 - brightness) / 45; // 255 -> 0, 210 -> 1
              data[i + 3] = Math.max(0, Math.min(255, Math.round(data[i + 3] * alphaFactor)));
            }
          }

          ctx.putImageData(imgData, 0, 0);
          setProcessedSrc(canvas.toDataURL('image/png'));
        } catch (err) {
          // Fallback to original src if CORS restricts canvas read
          setProcessedSrc(src);
        }
      };
      img.onerror = () => setProcessedSrc(src);
      img.src = src;
    } else {
      setProcessedSrc(src);
    }
  }, [src, blendMode]);

  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={processedSrc || src}
      className={className}
      style={{
        ...style,
        mixBlendMode: blendMode && blendMode !== 'normal' ? (blendMode as any) : 'normal',
      }}
      alt={alt || ''}
    />
  );
}
