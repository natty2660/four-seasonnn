import fs from 'fs';
import path from 'path';
import { UPLOADED_75_MAPPING } from './populate_75_images.mjs';

const seedPath = path.join(process.cwd(), 'src', 'data', 'seedData.ts');
let content = fs.readFileSync(seedPath, 'utf-8');

for (const entry of UPLOADED_75_MAPPING) {
  const newUrl = `/assets/images/${entry.outFile}`;
  for (const id of entry.itemIds) {
    // Replace "image_url": "..." inside the object with "id": "<id>"
    const regex = new RegExp(`("id":\\s*"${id}"[\\s\\S]*?"image_url":\\s*)"[^"]*"`, 'm');
    if (regex.test(content)) {
      content = content.replace(regex, `$1"${newUrl}"`);
    } else {
      console.warn(`Could not find item id ${id} in seedData.ts`);
    }
  }
}

fs.writeFileSync(seedPath, content, 'utf-8');
console.log('Updated src/data/seedData.ts with all 75 images (76 items)!');
