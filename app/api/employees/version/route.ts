import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getEmployeesVersion } from '@/lib/employeesVersion';

export const dynamic = 'force-dynamic';

// Interrogé toutes les quelques secondes par la page Employés de chaque poste :
// requête légère qui indique seulement si la liste a changé depuis le dernier chargement.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
  }

  const companyId = req.nextUrl.searchParams.get('companyId');
  if (!companyId) {
    return NextResponse.json({ error: 'companyId requis' }, { status: 400 });
  }

  try {
    return NextResponse.json({ version: await getEmployeesVersion(companyId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Version indisponible.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
