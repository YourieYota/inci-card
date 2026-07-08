const fs = require('fs');
const path = require('path');

const dir = path.join(process.cwd(), 'app', 'actions');
const files = fs.readdirSync(dir);

files.forEach(file => {
  if (!file.endsWith('.ts')) return;
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  if (!content.includes('revalidatePath')) {
    content = "import { revalidatePath } from 'next/cache';\n" + content;
  }
  
  // Replace `return await prisma...` with a block that revalidates
  const regex = /return await prisma\.[a-zA-Z]+\.(create|update|delete|deleteMany|updateMany)\([\s\S]*?\);/g;
  
  let modified = false;
  content = content.replace(regex, match => {
    modified = true;
    const replacement = match.replace('return await ', 'const result = await ');
    return `${replacement}\n    revalidatePath('/dashboard', 'layout');\n    return result;`;
  });
  
  if (modified) {
    fs.writeFileSync(filePath, content);
    console.log(`Updated ${file}`);
  }
});
