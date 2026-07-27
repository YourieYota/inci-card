import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, imageData } = await request.json();
    const sourceImage = imageUrl || imageData;

    if (!sourceImage) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    console.log(`[remove-bg] Processing image: ${sourceImage.slice(0, 60)}...`);

    // Helper: Convert any image source (data URL, relative URL, localhost URL, remote URL) to Buffer + mime
    let imageBuffer: Buffer;
    let mimeType = 'image/png';

    if (sourceImage.startsWith('data:')) {
      const parts = sourceImage.split(',');
      mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
      imageBuffer = Buffer.from(parts[1], 'base64');
    } else {
      let fetchUrl = sourceImage;
      if (sourceImage.startsWith('/')) {
        // Resolve relative URL against current request origin
        const origin = request.nextUrl.origin;
        fetchUrl = `${origin}${sourceImage}`;
      }
      
      console.log(`[remove-bg] Fetching image from: ${fetchUrl}`);
      const imgRes = await fetch(fetchUrl);
      if (!imgRes.ok) {
        return NextResponse.json(
          { error: `Impossible de charger l'image source (HTTP ${imgRes.status})` },
          { status: 400 }
        );
      }
      const arrayBuffer = await imgRes.arrayBuffer();
      imageBuffer = Buffer.from(arrayBuffer);
      mimeType = imgRes.headers.get('content-type') || 'image/png';
    }

    console.log(`[remove-bg] Image loaded successfully (${imageBuffer.length} bytes, type ${mimeType})`);

    // 1. OPTION 1: Self-hosted rembg microservice (tries primary URL, falls back to live cloud service if offline)
    const primaryUrl = process.env.REMBG_SERVICE_URL || (process.env.NODE_ENV === 'production'
      ? 'https://rembg-service-h15k.onrender.com/remove-bg'
      : 'http://localhost:5000/remove-bg');
    const fallbackUrl = 'https://rembg-service-h15k.onrender.com/remove-bg';
    const urlsToTry = primaryUrl === fallbackUrl ? [primaryUrl] : [primaryUrl, fallbackUrl];

    const base64Input = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;

    for (const serviceUrl of urlsToTry) {
      try {
        console.log(`[remove-bg] Trying rembg service at ${serviceUrl}...`);
        const modelToUse = serviceUrl.includes('localhost') ? 'u2net' : 'u2netp';
        let res: Response | null = null;
        let attempts = 0;
        const maxAttempts = serviceUrl.includes('localhost') ? 1 : 3;

        while (attempts < maxAttempts) {
          attempts++;
          try {
            res = await fetch(serviceUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ image: base64Input, model: modelToUse }),
              signal: AbortSignal.timeout(30000),
            });

            if (res.ok) break;

            const errText = await res.text();
            console.warn(`[remove-bg] rembg service at ${serviceUrl} returned HTTP ${res.status} on attempt ${attempts}: ${errText.slice(0, 100)}`);
          } catch (err: any) {
            console.warn(`[remove-bg] rembg service connection error for ${serviceUrl} on attempt ${attempts}:`, err?.message || err);
          }

          if (attempts < maxAttempts) {
            console.log(`[remove-bg] Container waking up... waiting 2s before retry ${attempts + 1}/${maxAttempts}`);
            await new Promise((r) => setTimeout(r, 2000));
          }
        }

        if (res && res.ok) {
          const data = await res.json();
          return NextResponse.json({ result: data.result || data.image });
        }
      } catch (err: any) {
        console.warn(`[remove-bg] Exception when trying ${serviceUrl}:`, err?.message || err);
      }
    }

    console.error(`[remove-bg] All rembg services failed (${urlsToTry.join(', ')}).`);
    return NextResponse.json(
      { error: `Impossible de contacter les services de détourage (${urlsToTry.join(', ')}).` },
      { status: 500 }
    );

    // 2. OPTION 2A: Remove.bg Cloud API (if REMOVE_BG_API_KEY is set)
    const removeBgApiKey = process.env.REMOVE_BG_API_KEY;
    if (removeBgApiKey) {
      console.log('[remove-bg] Uploading file bytes to Remove.bg Cloud API...');
      
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
      formData.append('image_file', blob, 'image.png');
      formData.append('size', 'auto');

      const res = await fetch('https://api.remove.bg/v1.0/removebg', {
        method: 'POST',
        headers: {
          'X-Api-Key': removeBgApiKey,
        },
        body: formData,
      });

      if (res.ok) {
        const arrayBuffer = await res.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString('base64');
        const resultDataUrl = `data:image/png;base64,${base64}`;
        console.log(`[remove-bg] Success! Returned transparent PNG (${arrayBuffer.byteLength} bytes)`);
        return NextResponse.json({ result: resultDataUrl });
      } else {
        const errorText = await res.text();
        console.error('[remove-bg] Remove.bg API error:', errorText);
        let errorJson: any = {};
        try { errorJson = JSON.parse(errorText); } catch(e) {}
        const errorMsg = errorJson?.errors?.[0]?.title || 'Échec du détourage Remove.bg';
        return NextResponse.json(
          { error: errorMsg, details: errorText },
          { status: res.status }
        );
      }
    }

    // 3. OPTION 2B: Replicate API (if REPLICATE_API_TOKEN is set)
    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (replicateToken) {
      console.log('[remove-bg] Calling Replicate API...');
      const base64Input = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
      const res = await fetch('https://api.replicate.com/v1/predictions', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${replicateToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          version: 'fb8808906663f739660c9b0e271424177d6368d4f40d8778f564757c91cf967a',
          input: { image: base64Input },
        }),
      });

      if (res.ok) {
        const prediction = await res.json();
        let getPrediction = prediction;

        while (getPrediction.status !== 'succeeded' && getPrediction.status !== 'failed') {
          await new Promise((r) => setTimeout(r, 800));
          const pollRes = await fetch(getPrediction.urls.get, {
            headers: { 'Authorization': `Token ${replicateToken}` },
          });
          getPrediction = await pollRes.json();
        }

        if (getPrediction.status === 'succeeded' && getPrediction.output) {
          const imgRes = await fetch(getPrediction.output);
          const imgBuffer = await imgRes.arrayBuffer();
          const base64 = Buffer.from(imgBuffer).toString('base64');
          return NextResponse.json({ result: `data:image/png;base64,${base64}` });
        }
      }
    }

    return NextResponse.json(
      {
        error: 'Aucune clé d\'API de détourage configurée.',
        message: 'Veuillez définir REMOVE_BG_API_KEY dans votre fichier .env',
      },
      { status: 501 }
    );
  } catch (error: any) {
    console.error('[remove-bg] Server error:', error);
    return NextResponse.json(
      { error: 'Erreur lors du traitement de l\'image', details: error?.message },
      { status: 500 }
    );
  }
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
