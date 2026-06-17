// Fichier de constantes partagées côté client ET serveur
// Ne PAS marquer 'use server' ici

export const PERMISSION_KEYS = [
  { key: 'dashboard',        label: 'Tableau de bord',               category: 'Navigation' },
  { key: 'companies_view',   label: 'Voir les entreprises',           category: 'Entreprises' },
  { key: 'companies_manage', label: 'Créer / modifier entreprises',   category: 'Entreprises' },
  { key: 'employees',        label: 'Enrôlement des employés',        category: 'Employés' },
  { key: 'print',            label: 'Impression de badges',           category: 'Employés' },
  { key: 'studio',           label: 'Studio (création de modèles)',   category: 'Design' },
  { key: 'settings',         label: 'Modifier son profil',            category: 'Compte' },
  { key: 'accounts',         label: 'Gérer les comptes utilisateurs', category: 'Administration' },
  { key: 'roles',            label: 'Gérer les rôles & permissions',  category: 'Administration' },
  { key: 'system',           label: 'Accès complet au système',       category: 'Administration' },
];

export type PermissionKey = typeof PERMISSION_KEYS[number]['key'];
