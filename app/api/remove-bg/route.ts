import { NextRequest, NextResponse } from 'next/server';
import { removeBackground } from '@imgly/background-removal-node';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, imageData } = await request.json();
    const sourceImage = imageUrl || imageData;

    if (!sourceImage) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    console.log(`[remove-bg] Processing image: ${sourceImage.slice(0, 60)}...`);

    // Helper: Convert any image source (data URL, relative URL, localhost URL, remote URL) to Buffer
    let imageBuffer: Buffer;
    let mimeType = 'image/png';

    if (sourceImage.startsWith('data:')) {
      const parts = sourceImage.split(',');
      mimeType = parts[0].match(/:(.*?);/)?.[1] || 'image/png';
      imageBuffer = Buffer.from(parts[1], 'base64');
    } else {
      let fetchUrl = sourceImage;
      if (sourceImage.startsWith('/')) {
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

    // 1. OPTION 1: Native In-App JS/Node AI Background Removal (100% serverless / containerless)
    let lastError = '';
    try {
      console.log('[remove-bg] Performing native JS background removal inside Next.js Node.js server...');
      const inputBlob = new Blob([new Uint8Array(imageBuffer)], { type: mimeType });
      const blob = await removeBackground(inputBlob);
      const outputBuffer = Buffer.from(await blob.arrayBuffer());
      const resultDataUrl = `data:image/png;base64,${outputBuffer.toString('base64')}`;
      console.log(`[remove-bg] Success! Native JS background removal returned ${outputBuffer.length} bytes transparent PNG`);
      return NextResponse.json({ result: resultDataUrl });
    } catch (nativeErr: any) {
      lastError = nativeErr?.message || String(nativeErr);
      console.error('[remove-bg] Native JS background removal error details:', nativeErr);
    }

    // 2. OPTION 2: Remove.bg Cloud API (if REMOVE_BG_API_KEY is set)
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
      }
    }

    return NextResponse.json(
      { error: `Échec du détourage d'image natif: ${lastError}` },
      { status: 500 }
    );
  } catch (error: any) {
    console.error('[remove-bg] Error in POST handler:', error);
    return NextResponse.json(
      { error: error?.message || 'Erreur interne du serveur lors du détourage' },
      { status: 500 }
    );
  }
}
