import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/authOptions';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/sync/pull
 * 
 * Retourne les enregistrements modifiés depuis la date 'since' (delta pull).
 * Utilisé par les installations locales pour récupérer les changements du serveur central.
 * 
 * Query params:
 *   - since     : ISO date string (ex: 2024-01-01T00:00:00Z) — si absent, retourne tout
 *   - companyId : filtre par entreprise (optionnel)
 */
export async function GET(req: NextRequest) {
  try {
    // Authentification obligatoire
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sinceParam = searchParams.get('since');
    const companyId = searchParams.get('companyId');

    const since = sinceParam ? new Date(sinceParam) : undefined;

    // Filtre temporel
    const timeFilter = since ? { updatedAt: { gt: since } } : {};

    // Filtre entreprise
    const companyFilter = companyId ? { companyId } : {};

    // Récupérer les employés modifiés
    const employees = await prisma.employee.findMany({
      where: {
        ...timeFilter,
        ...companyFilter,
      },
      select: {
        id: true,
        companyId: true,
        uniqueIdentifier: true,
        dynamicData: true,
        photoUrl: true,
        photoHash: true,
        photoConflict: true,
        enrollmentNumber: true,
        cardNumber: true,
        status: true,
        isLocked: true,
        isBlocked: true,
        appModified: true,
        printCount: true,
        version: true,
        printedAt: true,
        enrolledBy: true,
        printedBy: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: 1000, // Limite par appel pour éviter les timeouts
    });

    // Récupérer les entreprises modifiées
    const companies = await prisma.company.findMany({
      where: {
        ...(since ? { createdAt: { gt: since } } : {}),
        ...(companyId ? { id: companyId } : {}),
      },
      select: {
        id: true,
        name: true,
        identifierPrefix: true,
        isLocked: true,
        isLaserEnabled: true,
        protectAppModified: true,
        version: true,
        createdAt: true,
      },
      take: 200,
    });

    return NextResponse.json({
      employees,
      companies,
      pulledAt: new Date().toISOString(),
      hasMore: employees.length === 1000, // Signal si plus de données à récupérer
    });

  } catch (error: any) {
    console.error('[API /sync/pull] Error:', error);
    return NextResponse.json(
      { error: 'Erreur serveur lors de la synchronisation' },
      { status: 500 }
    );
  }
}
