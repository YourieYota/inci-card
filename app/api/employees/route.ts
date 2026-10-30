import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { getEmployees, getCompanyDashboardStats } from '@/app/actions/employees';

export const dynamic = 'force-dynamic';

// Lecture de la liste d'employés via un Route Handler plutôt qu'une Server Action :
// le routeur Next exécute les Server Actions une par une et abandonne celle en cours
// (sa promesse ne se résout jamais) dès qu'une navigation survient, ce qui laissait
// la page bloquée sur « Chargement de la liste d'employés… ».
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
    const [employees, stats] = await Promise.all([
      getEmployees(companyId),
      getCompanyDashboardStats(companyId),
    ]);
    return NextResponse.json({ employees, stats });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Impossible de charger les employés.' }, { status: 500 });
  }
}
