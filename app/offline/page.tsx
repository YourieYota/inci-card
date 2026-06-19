import type { Metadata } from 'next';
import OfflinePageContent from './OfflinePageContent';

export const metadata: Metadata = {
  title: 'Hors ligne — Imprimerie Nationale',
  description: 'Vous êtes actuellement sans connexion Internet.',
};

export default function OfflinePage() {
  return <OfflinePageContent />;
}
