import 'dotenv/config';
import { createCardCategory, getCardFormats } from '../app/actions/cards';

async function main() {
  console.log('--- TESTING CATEGORY CREATION ---');
  const formats = await getCardFormats(null);
  console.log('Available formats:', formats.map(f => ({ id: f.id, name: f.name })));
  
  if (formats.length === 0) {
    console.log('No formats available');
    return;
  }

  const formatId = formats[0].id;
  console.log(`Using formatId: ${formatId}`);

  try {
    const result = await createCardCategory({
      name: 'TEST CATEGORY',
      color: '#6366f1',
      description: 'Test description',
      formatId: formatId,
      companyId: null
    });
    console.log('Success! Created Category:', result);
  } catch (err: any) {
    console.log('FAILED! Error stack:');
    console.error(err);
  }
}

main()
  .catch(console.error);
