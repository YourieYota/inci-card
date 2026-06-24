'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { PERMISSION_KEYS } from '@/lib/permissions';

// --- System roles default permissions -----------------------------------------
const SYSTEM_ROLES = [
  {
    name: 'Administrateur',
    slug: 'ADMIN',
    description: 'Contrôle total sur toutes les fonctionnalités du système.',
    color: '#f43f5e',
    isSystem: true,
    permissions: {
      dashboard: true, companies_view: true, companies_manage: true,
      employees: true, print: true, studio: true, settings: true,
      accounts: true, roles: true, system: true,
    },
  },
  {
    name: 'Designer',
    slug: 'DESIGNER',
    description: 'Accès au studio de création de modèles de badges.',
    color: '#6366f1',
    isSystem: true,
    permissions: {
      dashboard: true, companies_view: true, companies_manage: true,
      employees: false, print: false, studio: true, settings: true,
      accounts: false, roles: false, system: false,
    },
  },
  {
    name: 'Opérateur',
    slug: 'OPERATEUR',
    description: "Accès à l'enrôlement et à l'impression des badges.",
    color: '#64748b',
    isSystem: true,
    permissions: {
      dashboard: true, companies_view: true, companies_manage: false,
      employees: true, print: true, studio: false, settings: true,
      accounts: false, roles: false, system: false,
    },
  },
];

// --- Ensure system roles exist in DB -----------------------------------------
async function ensureSystemRoles() {
  for (const role of SYSTEM_ROLES) {
    await prisma.customRole.upsert({
      where: { slug: role.slug },
      update: { name: role.name, description: role.description, color: role.color },
      create: role,
    });
  }
}

// --- Get all roles ------------------------------------------------------------
export async function getRoles() {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      throw new Error('Non autorisé');
    }
    await ensureSystemRoles();
    const roles = await prisma.customRole.findMany({
      orderBy: [{ isSystem: 'desc' }, { createdAt: 'asc' }],
    });
    const userCounts = await prisma.user.groupBy({
      by: ['role'],
      _count: { role: true },
    });
    const countMap: Record<string, number> = {};
    userCounts.forEach(u => { countMap[u.role] = u._count.role; });

    return roles.map(r => ({
      ...r,
      permissions: r.permissions as Record<string, boolean>,
      userCount: countMap[r.slug] || 0,
    }));
  } catch (e: any) {
    throw new Error(e.message || 'Impossible de charger les rôles');
  }
}

// --- Create a role ------------------------------------------------------------
export async function createRole(data: {
  name: string;
  slug: string;
  description?: string;
  color: string;
  permissions: Record<string, boolean>;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      throw new Error('Non autorisé');
    }
    const slug = data.slug.toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    const existing = await prisma.customRole.findFirst({
      where: { OR: [{ slug }, { name: data.name }] },
    });
    if (existing) {
      throw new Error('Un rôle avec ce nom ou cet identifiant existe déjà');
    }
    const role = await prisma.customRole.create({
      data: {
        name: data.name,
        slug,
        description: data.description || null,
        color: data.color,
        isSystem: false,
        permissions: data.permissions,
      },
    });
    return { success: true, role: { ...role, permissions: role.permissions as Record<string, boolean>, userCount: 0 } };
  } catch (e: any) {
    throw new Error(e.message || 'Impossible de créer le rôle');
  }
}

// --- Update a role ------------------------------------------------------------
export async function updateRole(id: string, data: {
  name: string;
  description?: string;
  color: string;
  permissions: Record<string, boolean>;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      throw new Error('Non autorisé');
    }
    const role = await prisma.customRole.findUnique({ where: { id } });
    if (!role) throw new Error('Rôle introuvable');
    const updateData: any = {
      description: data.description || null,
      color: data.color,
      permissions: data.permissions,
    };
    if (!role.isSystem) {
      updateData.name = data.name;
    }
    const updated = await prisma.customRole.update({ where: { id }, data: updateData });
    return { success: true, role: { ...updated, permissions: updated.permissions as Record<string, boolean> } };
  } catch (e: any) {
    throw new Error(e.message || 'Impossible de modifier le rôle');
  }
}

// --- Delete a role ------------------------------------------------------------
export async function deleteRole(id: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || session.user?.role !== 'ADMIN') {
      throw new Error('Non autorisé');
    }
    const role = await prisma.customRole.findUnique({ where: { id } });
    if (!role) throw new Error('Rôle introuvable');
    if (role.isSystem) throw new Error('Les rôles système ne peuvent pas être supprimés');
    await prisma.user.updateMany({
      where: { role: role.slug },
      data: { role: 'OPERATEUR' },
    });
    await prisma.customRole.delete({ where: { id } });
    return { success: true };
  } catch (e: any) {
    throw new Error(e.message || 'Impossible de supprimer le rôle');
  }
}
