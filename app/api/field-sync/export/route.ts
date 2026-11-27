import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyAdminAndPassword } from '@/app/actions/backup';
import { buildFieldSyncPackage } from '@/lib/fieldSync';

export const dynamic = 'force-dynamic';

// PC terrain : exporte toutes les fiches créées ou modifiées depuis l'installation du kit.
// Route plutôt qu'action serveur : le .zip (photos comprises) part en binaire, sans passer
// par une chaîne base64 sérialisée, qui faisait dépasser la mémoire de Node.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const user = await verifyAdminAndPassword(typeof body?.password === 'string' ? body.password : '');
    const { zipBuffer, filename, counts } = await buildFieldSyncPackage(user.name || user.email);
    revalidatePath('/', 'layout');

    return new NextResponse(new Uint8Array(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': String(zipBuffer.length),
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Field-Sync-Counts': JSON.stringify(counts),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Error exporting field data:', error);
    return NextResponse.json(
      { success: false, error: error.message || "Impossible d'exporter les données terrain" },
      { status: 400 }
    );
  }
}
