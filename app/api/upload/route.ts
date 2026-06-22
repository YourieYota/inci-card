import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, employeeId } = await req.json();

    if (!imageBase64 || !employeeId) {
      return NextResponse.json({ error: 'imageBase64 and employeeId are required' }, { status: 400 });
    }

    // Check if base64 has a data prefix and extract it
    const matches = imageBase64.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return NextResponse.json({ error: 'Invalid base64 format' }, { status: 400 });
    }

    const extension = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const imageBuffer = Buffer.from(matches[2], 'base64');
    
    // Generate a unique filename
    const filename = `photo_${employeeId}_${Date.now()}.${extension}`;
    const uploadDir = path.join(process.cwd(), 'public', 'image-carte');

    // Ensure directory exists
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const filePath = path.join(uploadDir, filename);
    fs.writeFileSync(filePath, imageBuffer);

    // Return the public URL
    const fileUrl = `/image-carte/${filename}`;

    return NextResponse.json({ success: true, url: fileUrl });
  } catch (error: any) {
    console.error('Upload Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
