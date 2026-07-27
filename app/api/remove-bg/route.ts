import { NextRequest, NextResponse } from 'next/server';
import { removeBackground } from '@imgly/background-removal-node';

export async function POST(request: NextRequest) {
  try {
    const { imageUrl, imageData } = await request.json();
    const sourceImage = imageUrl || imageData;

    if (!sourceImage) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 });
    }

    console.log(`[remove-bg] Processing image: ${sourceImage.slice(0, 60)}...`);

    // Helper: Convert any image source (data URL, relative URL, localhost URL, remote URL) to Buffer + data URL
    let imageBuffer: Buffer;
    let mimeType = 'image/png';
    let inputDataUrl = sourceImage;

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
      inputDataUrl = `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    }

    console.log(`[remove-bg] Image loaded successfully (${imageBuffer.length} bytes, type ${mimeType})`);

    // 1. OPTION 1: Native In-App JS/Node AI Background Removal (100% serverless / containerless)
    try {
      console.log('[remove-bg] Performing native JS background removal inside Next.js Node.js server...');
      const blob = await removeBackground(inputDataUrl);
      const outputBuffer = Buffer.from(await blob.arrayBuffer());
      const resultDataUrl = `data:image/png;base64,${outputBuffer.toString('base64')}`;
      console.log(`[remove-bg] Success! Native JS background removal returned ${outputBuffer.length} bytes transparent PNG`);
      return NextResponse.json({ result: resultDataUrl });
    } catch (nativeErr: any) {
      console.warn('[remove-bg] Native JS background removal error:', nativeErr?.message || nativeErr);
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

    // 3. OPTION 3: Replicate API (if REPLICATE_API_TOKEN is set)
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
        let resultUrl = prediction.output;
        
        let attempts = 0;
        while (!resultUrl && attempts < 30) {
          await new Promise(r => setTimeout(r, 1000));
          const checkRes = await fetch(prediction.urls.get, {
            headers: { 'Authorization': `Token ${replicateToken}` },
          });
          const checkData = await checkRes.json();
          resultUrl = checkData.output;
          attempts++;
        }

        if (resultUrl) {
          const finalImgRes = await fetch(resultUrl);
          const finalBuffer = await finalImgRes.arrayBuffer();
          const base64 = Buffer.from(finalBuffer).toString('base64');
          return NextResponse.json({ result: `data:image/png;base64,${base64}` });
        }
      }
    }

    return NextResponse.json(
      { error: 'Échec du détourage d\'image natif.' },
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
