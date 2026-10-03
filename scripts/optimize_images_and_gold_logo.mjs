import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const IMAGES_DIR = path.join(process.cwd(), 'public', 'assets', 'images');

console.log('--- Step 1: Create Golden Background for Four Season Logo ---');

const goldBgPath = '/tmp/gold_radial_bg.jpg';
const maskPath = '/tmp/logo_mask.png';
const goldLogoResult = '/tmp/gold_logo_final.jpg';

// 1. Generate rich luxury golden gradient background (512x512)
execSync(
  `convert -size 512x512 radial-gradient:'#FFF8D6'-'#C89B2B' ${goldBgPath}`
);

// 2. Generate mask from four_season_confidential_logo_1790854372202.jpg separating logo from black background
const confidentialLogoPath = path.join(IMAGES_DIR, 'four_season_confidential_logo_1790854372202.jpg');

execSync(
  `convert "${confidentialLogoPath}" -colorspace gray -threshold 28% ${maskPath}`
);

// 3. Composite logo onto the golden gradient background
execSync(
  `convert ${goldBgPath} "${confidentialLogoPath}" ${maskPath} -composite -quality 80 ${goldLogoResult}`
);

// 4. Overwrite confidential logo, four_season_logo.jpg, four_season_logo_1790686712803.jpg
fs.copyFileSync(goldLogoResult, confidentialLogoPath);
fs.copyFileSync(goldLogoResult, path.join(IMAGES_DIR, 'four_season_logo.jpg'));
fs.copyFileSync(goldLogoResult, path.join(IMAGES_DIR, 'four_season_logo_1790686712803.jpg'));
console.log('✓ Successfully updated Four Season logo files with golden background');

console.log('\n--- Step 2: Batch Optimize & Compress All Images for Blazing Fast Loading ---');

const files = fs.readdirSync(IMAGES_DIR);
let totalOriginalSize = 0;
let totalNewSize = 0;
let count = 0;

for (const file of files) {
  if (!file.endsWith('.jpg') && !file.endsWith('.jpeg')) continue;

  const fullPath = path.join(IMAGES_DIR, file);
  const origSize = fs.statSync(fullPath).size;
  totalOriginalSize += origSize;

  const isBanner = file.includes('banner') || file.includes('wall');
  const isLogo = file.includes('logo');

  try {
    if (isBanner) {
      // Banners: Max 800px width, quality 68
      execSync(
        `convert "${fullPath}" -resize 800x450\\> -strip -quality 68 -interlace Plane -sampling-factor 4:2:0 /tmp/opt_tmp.jpg && mv /tmp/opt_tmp.jpg "${fullPath}"`
      );
    } else if (isLogo) {
      // Logos: 400x400, quality 75
      execSync(
        `convert "${fullPath}" -resize 400x400\\> -strip -quality 75 -interlace Plane /tmp/opt_tmp.jpg && mv /tmp/opt_tmp.jpg "${fullPath}"`
      );
    } else {
      // Dish & drink photos: Max 440x440, quality 62, progressive JPEG
      execSync(
        `convert "${fullPath}" -resize 440x440\\> -strip -quality 62 -interlace Plane -sampling-factor 4:2:0 /tmp/opt_tmp.jpg && mv /tmp/opt_tmp.jpg "${fullPath}"`
      );
    }

    const newSize = fs.statSync(fullPath).size;
    totalNewSize += newSize;
    count++;
  } catch (err) {
    console.warn(`Error optimizing ${file}:`, err.message);
  }
}

const origMb = (totalOriginalSize / (1024 * 1024)).toFixed(1);
const newMb = (totalNewSize / (1024 * 1024)).toFixed(1);
const savedPct = (((totalOriginalSize - totalNewSize) / totalOriginalSize) * 100).toFixed(1);

console.log(`\n✓ Optimized ${count} images!`);
console.log(`Initial total size: ${origMb} MB`);
console.log(`Optimized total size: ${newMb} MB`);
console.log(`Bandwidth savings: ${savedPct}% reduction!`);
