import React from 'react';
import { prisma } from '@/lib/prisma';
import ReceiptClient from './ReceiptClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{
    id?: string;
  }>;
}

export default async function ReceiptPage({ searchParams }: PageProps) {
  const resolvedSearchParams = await searchParams;
  const id = resolvedSearchParams.id || '';

  if (!id) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6 text-center">
        <div className="max-w-sm bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-sm font-semibold text-rose-500">Erreur : Identifiant manquant</p>
          <p className="text-xs text-neutral-500 mt-2">Le reçu d&apos;enrôlement ne peut pas être généré sans identifiant valide.</p>
        </div>
      </div>
    );
  }

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: { company: true },
  });

  if (!employee) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6 text-center">
        <div className="max-w-sm bg-white p-8 rounded-3xl border border-neutral-200 shadow-sm">
          <p className="text-sm font-semibold text-rose-500">Erreur : Employé introuvable</p>
          <p className="text-xs text-neutral-500 mt-2">L&apos;employé associé à cet identifiant n&apos;existe pas ou a été supprimé.</p>
        </div>
      </div>
    );
  }

  // Retrieve the custom RECEIPT template from database if it exists
  const template = await prisma.cardTemplate.findFirst({
    where: {
      companyId: employee.companyId,
      type: 'RECU',
    },
  });

  const defaultTemplate = template ? {
    width: template.width,
    height: template.height,
    backgroundUrl: template.backgroundUrl || '',
    layoutConfig: template.layoutConfig,
  } : {
    width: 378,
    height: 530,
    backgroundUrl: '',
    layoutConfig: {
      recto: {
        elements: [
          {
            id: `logo_1`,
            type: 'logo',
            logoUrl: '/logo-imprimerie.png',
            x: 159,
            y: 15,
            width: 60,
            height: 60,
            opacity: 1,
          },
          {
            id: `text_title`,
            type: 'text',
            content: 'Imprimerie Nationale',
            x: 20,
            y: 80,
            width: 338,
            height: 25,
            fontSize: 14,
            fontWeight: 'bold',
            alignment: 'center',
            color: '#111827',
            opacity: 1,
          },
          {
            id: `text_subtitle`,
            type: 'text',
            content: 'Enrôlement Biométrique',
            x: 20,
            y: 105,
            width: 338,
            height: 20,
            fontSize: 10,
            alignment: 'center',
            color: '#4b5563',
            opacity: 1,
          },
          {
            id: `text_recu_num`,
            type: 'text',
            field: 'Reçu N°',
            x: 25,
            y: 122,
            width: 150,
            height: 15,
            fontSize: 9,
            color: '#6b7280',
            alignment: 'left',
            opacity: 1,
          },
          {
            id: `text_date_enr`,
            type: 'text',
            field: 'Date d\'enrôlement',
            x: 180,
            y: 122,
            width: 173,
            height: 15,
            fontSize: 9,
            color: '#6b7280',
            alignment: 'right',
            opacity: 1,
          },
          {
            id: `image_photo`,
            type: 'image',
            x: 25,
            y: 140,
            width: 90,
            height: 110,
            opacity: 1,
          },
          {
            id: `text_ent`,
            type: 'text',
            field: 'Entreprise',
            x: 130,
            y: 140,
            width: 220,
            height: 20,
            fontSize: 11,
            fontWeight: 'bold',
            alignment: 'left',
            color: '#111827',
            opacity: 1,
          },
          {
            id: `text_nom`,
            type: 'text',
            field: 'Nom',
            x: 130,
            y: 165,
            width: 220,
            height: 20,
            fontSize: 11,
            fontWeight: 'bold',
            alignment: 'left',
            color: '#111827',
            opacity: 1,
          },
          {
            id: `text_prenom`,
            type: 'text',
            field: 'Prenom',
            x: 130,
            y: 190,
            width: 220,
            height: 20,
            fontSize: 11,
            fontWeight: 'bold',
            alignment: 'left',
            color: '#111827',
            opacity: 1,
          },
          {
            id: `text_role`,
            type: 'text',
            field: 'Role',
            x: 130,
            y: 215,
            width: 220,
            height: 20,
            fontSize: 11,
            alignment: 'left',
            color: '#4b5563',
            opacity: 1,
          },
          {
            id: `text_mat`,
            type: 'text',
            field: 'Matricule',
            x: 130,
            y: 240,
            width: 220,
            height: 20,
            fontSize: 11,
            alignment: 'left',
            color: '#4b5563',
            opacity: 1,
          },
          {
            id: `qr_qr`,
            type: 'qr',
            field: 'Matricule',
            x: 144,
            y: 280,
            width: 90,
            height: 90,
            opacity: 1,
          },
          {
            id: `text_ctrl`,
            type: 'text',
            content: 'Code de contrôle enrôlement',
            x: 20,
            y: 380,
            width: 338,
            height: 15,
            fontSize: 8,
            alignment: 'center',
            color: '#6b7280',
            opacity: 1,
          },
          {
            id: `text_op`,
            type: 'text',
            content: "Signature de l'Opérateur",
            x: 25,
            y: 415,
            width: 140,
            height: 15,
            fontSize: 9,
            fontWeight: 'bold',
            alignment: 'center',
            color: '#6b7280',
            opacity: 1,
          },
          {
            id: `text_emp`,
            type: 'text',
            content: "Signature de l'Employé",
            x: 210,
            y: 415,
            width: 140,
            height: 15,
            fontSize: 9,
            fontWeight: 'bold',
            alignment: 'center',
            color: '#6b7280',
            opacity: 1,
          },
          {
            id: `text_line1`,
            type: 'text',
            content: '---------------------------------',
            x: 25,
            y: 470,
            width: 140,
            height: 15,
            fontSize: 9,
            alignment: 'center',
            color: '#9ca3af',
            opacity: 1,
          },
          {
            id: `text_line2`,
            type: 'text',
            content: '---------------------------------',
            x: 210,
            y: 470,
            width: 140,
            height: 15,
            fontSize: 9,
            alignment: 'center',
            color: '#9ca3af',
            opacity: 1,
          },
          {
            id: `text_footer`,
            type: 'text',
            content: "Ce document atteste de la conformité de l'enrôlement.",
            x: 20,
            y: 500,
            width: 338,
            height: 15,
            fontSize: 8,
            alignment: 'center',
            color: '#9ca3af',
            opacity: 1,
          },
        ],
        backgroundUrl: '',
        backgroundOpacity: 1,
      },
      borderRadius: 8,
    },
  };

  const serializedEmployee = {
    id: employee.id,
    uniqueIdentifier: employee.uniqueIdentifier,
    enrollmentNumber: employee.enrollmentNumber,
    photoUrl: employee.photoUrl,
    status: employee.status,
    createdAt: employee.createdAt.toISOString(),
    printedAt: employee.printedAt ? employee.printedAt.toISOString() : null,
    company: {
      id: employee.company.id,
      name: employee.company.name,
      createdAt: employee.company.createdAt.toISOString(),
    },
    dynamicData: employee.dynamicData,
  };

  return <ReceiptClient employee={serializedEmployee} template={defaultTemplate} />;
}
