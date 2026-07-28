export function extractCategoryFromDynamicData(dynamicData: any): string | undefined {
  if (!dynamicData || typeof dynamicData !== 'object') return undefined;
  const keys = Object.keys(dynamicData);
  for (const k of keys) {
    const norm = k.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (norm === 'categorie_id' || norm === 'category_id' || norm === 'categorie' || norm === 'category' || norm === 'cat' || norm === 'caté') {
      const val = dynamicData[k];
      if (val && typeof val === 'string' && val.trim()) return val.trim();
    }
  }
  return undefined;
}
