const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'app', 'actions');
const files = ['cards.ts', 'employees.ts', 'templates.ts'];

files.forEach(file => {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // The script previously added `import { revalidatePath } from 'next/cache';\n` at the top.
  // We need to make sure `'use server';` is the very first line.
  
  if (content.startsWith("import { revalidatePath } from 'next/cache';\n'use server';")) {
    content = content.replace(
      "import { revalidatePath } from 'next/cache';\n'use server';",
      "'use server';\nimport { revalidatePath } from 'next/cache';"
    );
    fs.writeFileSync(filePath, content);
    console.log(`Fixed ${file}`);
  }
});
