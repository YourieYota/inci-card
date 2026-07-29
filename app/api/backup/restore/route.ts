import { NextRequest, NextResponse } from 'next/server';
import { restoreDatabaseFromSql, restoreDatabaseBackup, verifyAdminAndPassword } from '@/app/actions/backup';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const passwordConfirm = req.headers.get('x-password-confirm') || '';
    const filename = req.headers.get('x-file-name') || 'backup.json';

    // Verify admin and password
    await verifyAdminAndPassword(passwordConfirm);

    const textContent = await req.text();
    if (!textContent || !textContent.trim()) {
      return NextResponse.json({ success: false, error: 'Fichier de sauvegarde vide' }, { status: 400 });
    }

    let result;
    if (filename.endsWith('.sql')) {
      result = await restoreDatabaseFromSql(textContent, passwordConfirm);
    } else {
      let parsedJson;
      try {
        parsedJson = JSON.parse(textContent);
      } catch (e: any) {
        return NextResponse.json({ success: false, error: `Fichier JSON corrompu ou incomplet : ${e.message}` }, { status: 400 });
      }
      result = await restoreDatabaseBackup(parsedJson, passwordConfirm);
    }

    if (result.success) {
      return NextResponse.json(result);
    } else {
      return NextResponse.json({ success: false, error: result.error || 'Échec de la restauration' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Error in /api/backup/restore:', error);
    return NextResponse.json({ success: false, error: error.message || 'Erreur lors de la restauration' }, { status: 500 });
  }
}
