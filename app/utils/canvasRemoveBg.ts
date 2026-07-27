/**
 * Smart Client-Side Canvas Background Removal for Photo Badges with Border Flood-Fill.
 * 1. Performs a Breadth-First Search (BFS) flood-fill starting ONLY from outer image borders (top, left, right edges).
 * 2. Flood-fill traverses connected background pixels matching the background color.
 * 3. STOPS at subject contours (head, hair, skin, shoulders, collar).
 * 4. Ensures white/light clothing inside the subject contour remains 100% OPAQUE and UNTOUCHED!
 */
export function removeBackgroundCanvas(
  imageSource: string | HTMLImageElement,
  threshold: number = 36,
  feathering: number = 16
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;

        if (!width || !height) {
          return resolve(typeof imageSource === 'string' ? imageSource : imageSource.src);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(typeof imageSource === 'string' ? imageSource : imageSource.src);

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        // 1. Average reference background color from top-left, top-right, and top-center border
        const sampleCoords = [
          [0, 0],
          [width - 1, 0],
          [Math.floor(width / 2), 0],
          [0, 5],
          [width - 1, 5],
        ];

        let totalR = 0, totalG = 0, totalB = 0;
        for (const [x, y] of sampleCoords) {
          const idx = (y * width + x) * 4;
          totalR += data[idx];
          totalG += data[idx + 1];
          totalB += data[idx + 2];
        }
        const bgR = totalR / sampleCoords.length;
        const bgG = totalG / sampleCoords.length;
        const bgB = totalB / sampleCoords.length;

        // Distance function to reference background color
        const getBgDistance = (x: number, y: number) => {
          const idx = (y * width + x) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          return Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
        };

        // 2. BFS Flood-fill queue starting from outer border pixels
        const visited = new Uint8Array(width * height); // 0 = unvisited (subject/clothes), 1 = background, 2 = edge
        const queue: number[] = [];

        // Push top row, left edge, and right edge into BFS queue
        for (let x = 0; x < width; x++) {
          if (getBgDistance(x, 0) < threshold + feathering) {
            const idx = 0 * width + x;
            visited[idx] = 1;
            queue.push(x, 0);
          }
        }
        for (let y = 1; y < Math.floor(height * 0.75); y++) {
          // Left border
          if (getBgDistance(0, y) < threshold + feathering) {
            const idx = y * width + 0;
            if (!visited[idx]) {
              visited[idx] = 1;
              queue.push(0, y);
            }
          }
          // Right border
          if (getBgDistance(width - 1, y) < threshold + feathering) {
            const idx = y * width + (width - 1);
            if (!visited[idx]) {
              visited[idx] = 1;
              queue.push(width - 1, y);
            }
          }
        }

        // 4-directional BFS propagation
        let head = 0;
        const dx = [1, -1, 0, 0];
        const dy = [0, 0, 1, -1];

        while (head < queue.length) {
          const cx = queue[head++];
          const cy = queue[head++];

          for (let d = 0; d < 4; d++) {
            const nx = cx + dx[d];
            const ny = cy + dy[d];

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nidx = ny * width + nx;
              if (visited[nidx] === 0) {
                const dist = getBgDistance(nx, ny);
                if (dist < threshold) {
                  visited[nidx] = 1; // Pure connected background
                  queue.push(nx, ny);
                } else if (dist < threshold + feathering) {
                  visited[nidx] = 2; // Edge boundary
                }
              }
            }
          }
        }

        // 3. Apply alpha mask ONLY to flood-filled connected background pixels
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            const v = visited[y * width + x];

            if (v === 1) {
              // Connected background -> Transparent
              data[idx + 3] = 0;
            } else if (v === 2) {
              // Border edge -> Feathered alpha
              const dist = getBgDistance(x, y);
              const alphaFactor = Math.max(0, Math.min(1, (dist - threshold) / feathering));
              data[idx + 3] = Math.round(data[idx + 3] * alphaFactor);
            }
            // v === 0 (Subject & Clothes inside contour) -> Untouched 100% Opaque!
          }
        }

        ctx.putImageData(imgData, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (err) {
        console.warn("[canvasRemoveBg] Error processing canvas background:", err);
        resolve(typeof imageSource === "string" ? imageSource : imageSource.src);
      }
    };
    img.onerror = (err) => {
      console.warn("[canvasRemoveBg] Failed to load image for canvas removal:", err);
      resolve(typeof imageSource === "string" ? imageSource : imageSource.src);
    };
    img.src = typeof imageSource === "string" ? imageSource : imageSource.src;
  });
}
