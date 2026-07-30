import React from 'react';
import QrCodesClient from '@/components/qr-codes/QrCodesClient';
import { getCompanies } from '@/app/actions/templates';
import { getCardDocumentTypes } from '@/app/actions/cards';

export const dynamic = 'force-dynamic';

export default async function QrCodesPage() {
  let companies: any[] = [];
  let cardDocumentTypes: any[] = [];

  try {
    const [companiesData, docTypesData] = await Promise.all([
      getCompanies(),
      getCardDocumentTypes(),
    ]);
    companies = companiesData;
    cardDocumentTypes = docTypesData;
  } catch (error) {
    console.error('Error fetching QR codes page data:', error);
  }

  const serializedCompanies = companies.map(c => ({
    id: c.id,
    name: c.name,
  }));

  const serializedDocTypes = cardDocumentTypes.map(t => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    companyId: t.companyId ?? null,
  }));

  return (
    <div className="w-full max-w-[1920px] mx-auto px-2 md:px-4 py-2">
      <QrCodesClient
        initialCompanies={serializedCompanies}
        initialDocumentTypes={serializedDocTypes}
      />
    </div>
  );
}
