import React from 'react';
import { prisma } from '@/lib/prisma';
import PrintClient from './PrintClient';
import Link from 'next/link';
import { AlertCircle, ArrowLeft } from 'lucide-react';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    ids?: string;
  }>;
}

export default async function PrintPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const idsString = resolvedSearchParams.ids || '';
  const ids = idsString.split(',').filter(Boolean);

  if (ids.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-center shadow-sm">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
        <h2 className="text-lg font-bold text-neutral-800 dark:text-white">Aucun employé sélectionné</h2>
        <p className="text-sm text-neutral-400 mt-1 max-w-sm">Veuillez sélectionner au moins un employé pour générer une planche d&apos;impression.</p>
        <Link href="/dashboard/employees" className="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à l&apos;enrôlement</span>
        </Link>
      </div>
    );
  }

  // Fetch employees
  const employees = await prisma.employee.findMany({
    where: {
      id: { in: ids },
    },
    include: {
      company: true,
    },
  });

  if (employees.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] p-6 bg-white dark:bg-neutral-800 rounded-2xl border border-neutral-200 dark:border-neutral-800 text-center shadow-sm">
        <AlertCircle className="w-10 h-10 text-rose-500 mb-3" />
        <h2 className="text-lg font-bold text-neutral-800 dark:text-white">Employés introuvables</h2>
        <p className="text-sm text-neutral-400 mt-1 max-w-sm">Les employés sélectionnés n&apos;existent pas ou ont été supprimés.</p>
        <Link href="/dashboard/employees" className="mt-5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" />
          <span>Retour</span>
        </Link>
      </div>
    );
  }

  // Fetch templates for the company of the first employee
  const companyId = employees[0].companyId;
  const templates = await prisma.cardTemplate.findMany({
    where: {
      companyId,
    },
  });

  return (
    <PrintClient
      employees={employees}
      templates={templates}
      companyName={employees[0].company.name}
    />
  );
}
