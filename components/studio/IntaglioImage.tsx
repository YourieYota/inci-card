'use client';

import React, { useRef, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

interface IntaglioImageProps {
  src: string;
  spacing?: number;
  lineWidth?: number;
  waveAmp?: number;
  targetWidth?: number;
  className?: string;
  style?: React.CSSProperties;
  crossOrigin?: 'anonymous' | 'use-credentials' | '';
}

export default function IntaglioImage({
  src,
  spacing = 10,
  lineWidth = 0.85,
  waveAmp = 7,
  targetWidth = 300, // Reduced resolution for fast execution inside the card editor/print layout
  className,
  style,
  crossOrigin = 'anonymous',
}: IntaglioImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!src) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsProcessing(true);
    setError(null);

    const img = new Image();
    if (crossOrigin) img.crossOrigin = crossOrigin;

    img.onload = () => {
      if (!active) return;

      try {
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) throw new Error("Impossible de récupérer le contexte 2D");

        // Calculer les dimensions d'affichage redimensionnées
        const ratio = targetWidth / img.width;
        const width = targetWidth;
        const height = Math.floor(img.height * ratio);

        canvas.width = width;
        canvas.height = height;

        // 1. Dessiner l'image originale
        ctx.drawImage(img, 0, 0, width, height);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // 2. Conversion Niveaux de gris et Extraction Luma
        const luma = new Float32Array(width * height);
        for (let i = 0; i < data.length; i += 4) {
          luma[i / 4] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        }

        // 3. Unsharp Masking
        const blurredHeavy = boxBlur(luma, width, height, 4);
        const enhancedLuma = new Float32Array(width * height);
        for (let i = 0; i < luma.length; i++) {
          let val = luma[i] + (luma[i] - blurredHeavy[i]) * 1.5;
          enhancedLuma[i] = Math.max(0, Math.min(255, val));
        }

        // 4. Léger Flou
        const blur = boxBlur(enhancedLuma, width, height, 1);

        // 5. Calcul de l'encre "Darkness"
        const darkness = new Float32Array(width * height);
        for (let i = 0; i < blur.length; i++) {
          let d = 1.0 - blur[i] / 255.0;
          d = Math.max(0, Math.min(1, (d - 0.04) / 0.96));
          darkness[i] = Math.pow(d, 0.72);
        }

        // 6. Détection de contours (Sobel)
        const edges = sobelEdgeDetection(enhancedLuma, width, height);

        // 7. Dessiner le fond Guilloché rouge
        const bgCanvas = document.createElement('canvas');
        bgCanvas.width = width;
        bgCanvas.height = height;
        const bgCtx = bgCanvas.getContext('2d');
        if (!bgCtx) throw new Error("Impossible de créer le canvas temporaire");

        bgCtx.fillStyle = 'rgb(248, 248, 248)';
        bgCtx.fillRect(0, 0, width, height);

        bgCtx.strokeStyle = 'rgba(220, 30, 55, 0.42)';
        bgCtx.lineWidth = 1;
        const spacingBg = 23, ampBg = 18, freqBg = 0.027;

        for (let baseY = -height; baseY < height * 2; baseY += spacingBg) {
          bgCtx.beginPath();
          for (let x = 0; x < width; x += 3) {
            let y = baseY + ampBg * Math.sin(x * freqBg) + ampBg * 0.45 * Math.sin(x * freqBg * 0.33 + 1.7);
            if (x === 0) bgCtx.moveTo(x, y);
            else bgCtx.lineTo(x, y);
          }
          bgCtx.stroke();
        }

        // Lignes secondaires
        bgCtx.strokeStyle = 'rgba(220, 30, 55, 0.29)';
        for (let baseY = -height; baseY < height * 2; baseY += spacingBg * 1.6) {
          bgCtx.beginPath();
          for (let x = 0; x < width; x += 3) {
            let y = baseY + ampBg * 0.75 * Math.sin(x * freqBg * 0.8 + 2.4);
            if (x === 0) bgCtx.moveTo(x, y);
            else bgCtx.lineTo(x, y);
          }
          bgCtx.stroke();
        }

        const bgImgData = bgCtx.getImageData(0, 0, width, height).data;

        // 8. Rendu Final avec Hachures (Pixel par Pixel)
        const resultData = new Uint8ClampedArray(width * height * 4);

        const t1 = 24 * Math.PI / 180;
        const t2 = -28 * Math.PI / 180;
        const t3 = 68 * Math.PI / 180;

        const cosT1 = Math.cos(t1), sinT1 = Math.sin(t1);
        const cosT2 = Math.cos(t2), sinT2 = Math.sin(t2);
        const cosT3 = Math.cos(t3), sinT3 = Math.sin(t3);

        const s1 = spacing;
        const s2 = spacing * 1.2;
        const s3 = spacing * 1.5;

        const lw1 = lineWidth;
        const lw2 = lineWidth * 0.9;
        const lw3 = lineWidth * 0.8;

        const wa1 = waveAmp;
        const wa2 = waveAmp * 0.7;
        const wa3 = waveAmp * 0.6;

        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = y * width + x;
            const pIdx = idx * 4;

            // Hatch 1
            let u = x * cosT1 + y * sinT1;
            let v = -x * sinT1 + y * cosT1;
            let wave = wa1 * Math.sin(v * 0.030 + 0.1) + 0.45 * wa1 * Math.sin((x + y) * 0.030 * 0.37 + 0.1);
            let dist = Math.abs(((u + wave) % s1) - s1 / 2);
            let h1 = Math.max(0, Math.min(1, (lw1 + 1.2 - dist) / 1.2));

            // Hatch 2
            u = x * cosT2 + y * sinT2;
            v = -x * sinT2 + y * cosT2;
            wave = wa2 * Math.sin(v * 0.026 + 1.4) + 0.45 * wa2 * Math.sin((x + y) * 0.026 * 0.37 + 1.4);
            dist = Math.abs(((u + wave) % s2) - s2 / 2);
            let h2 = Math.max(0, Math.min(1, (lw2 + 1.2 - dist) / 1.2));

            // Hatch 3
            u = x * cosT3 + y * sinT3;
            v = -x * sinT3 + y * cosT3;
            wave = wa3 * Math.sin(v * 0.021 + 2.2) + 0.45 * wa3 * Math.sin((x + y) * 0.021 * 0.37 + 2.2);
            dist = Math.abs(((u + wave) % s3) - s3 / 2);
            let h3 = Math.max(0, Math.min(1, (lw3 + 1.2 - dist) / 1.2));

            let hatch = h1 * 0.65 + h2 * 0.55 + h3 * 0.35;
            hatch = Math.max(0, Math.min(1, hatch));

            const dark = darkness[idx];
            const edgeAlpha = edges[idx];

            let portraitAlpha = hatch * (0.10 + 0.95 * dark);
            portraitAlpha = Math.max(0, Math.min(1, portraitAlpha + edgeAlpha * 0.45));

            let r = bgImgData[pIdx];
            let g = bgImgData[pIdx + 1];
            let b = bgImgData[pIdx + 2];

            const blueAlpha = portraitAlpha * 0.92;
            r = r * (1 - blueAlpha) + 0 * blueAlpha;
            g = g * (1 - blueAlpha) + 72 * blueAlpha;
            b = b * (1 - blueAlpha) + 122 * blueAlpha;

            const darkEdgeAlpha = Math.max(0, Math.min(1, edgeAlpha * 0.35));
            r = r * (1 - darkEdgeAlpha) + 0 * darkEdgeAlpha;
            g = g * (1 - darkEdgeAlpha) + 42 * darkEdgeAlpha;
            b = b * (1 - darkEdgeAlpha) + 82 * darkEdgeAlpha;

            resultData[pIdx] = r;
            resultData[pIdx + 1] = g;
            resultData[pIdx + 2] = b;
            resultData[pIdx + 3] = 255;
          }
        }

        ctx.putImageData(new ImageData(resultData, width, height), 0, 0);
        setIsProcessing(false);
      } catch (err: any) {
        console.error("Intaglio processing error:", err);
        setError("Erreur de traitement CORS ou Canvas");
        setIsProcessing(false);
      }
    };

    img.onerror = () => {
      if (!active) return;
      setError("Erreur lors du chargement de la photo source");
      setIsProcessing(false);
    };

    img.src = src;

    return () => {
      active = false;
    };
  }, [src, spacing, lineWidth, waveAmp, targetWidth, crossOrigin]);

  // Image processing helpers
  const boxBlur = (data: Float32Array, w: number, h: number, radius = 1) => {
    const result = new Float32Array(data.length);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0;
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            let nx = x + dx, ny = y + dy;
            if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
              sum += data[ny * w + nx];
              count++;
            }
          }
        }
        result[y * w + x] = sum / count;
      }
    }
    return result;
  };

  const sobelEdgeDetection = (data: Float32Array, w: number, h: number) => {
    const result = new Float32Array(data.length);
    const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
    const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let sumX = 0, sumY = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            let val = data[(y + dy) * w + (x + dx)];
            let kIdx = (dy + 1) * 3 + (dx + 1);
            sumX += val * gx[kIdx];
            sumY += val * gy[kIdx];
          }
        }
        let mag = Math.sqrt(sumX * sumX + sumY * sumY) / 255.0;
        let edgeVal = mag > 0.12 ? mag * 2.5 : 0;
        result[y * w + x] = Math.max(0, Math.min(1, edgeVal));
      }
    }
    return result;
  };

  return (
    <div className={`relative w-full h-full flex items-center justify-center bg-neutral-100 ${className || ''}`} style={style}>
      <canvas ref={canvasRef} className="w-full h-full object-cover" style={{ display: error ? 'none' : 'block' }} />
      {isProcessing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-xs">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
        </div>
      )}
      {error && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={src} className="w-full h-full object-cover" alt="Original fallback" />
      )}
    </div>
  );
}
