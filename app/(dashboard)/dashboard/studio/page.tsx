import React from 'react';
import StudioClient from '@/components/studio/StudioClient';
import { getCompanies } from '@/app/actions/templates';

export const dynamic = 'force-dynamic';

export default async function StudioPage() {
  const companies = await getCompanies();

  return (
    <div className="w-full py-1">
      <StudioClient initialCompanies={companies} />
    </div>
  );
}
