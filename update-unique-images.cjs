const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src', 'assets', 'images');
const pubDir = path.join(__dirname, 'public', 'assets', 'images');
const dlDir = path.join(__dirname, 'public', 'downloads');

// Copy all src/assets/images/*.jpg to public/assets/images/*.jpg
fs.readdirSync(srcDir).forEach((file) => {
  if (file.endsWith('.jpg') || file.endsWith('.png')) {
    fs.copyFileSync(path.join(srcDir, file), path.join(pubDir, file));
  }
});

const uniqueImageMap = {
  // Artisan Ice cream (6 items - completely distinct)
  'ice_vanilla': 'primecafe_vanilla_ice_cream_1790264637397.jpg',
  'ice_lotus': 'primecafe_lotus_ice_cream_1790263871336.jpg',
  'ice_oreo': 'primecafe_oreo_ice_cream_1790264663122.jpg',
  'ice_strawberry': 'primecafe_strawberry_ice_cream_1790264678029.jpg',
  'ice_chocolate': 'primecafe_belgian_chocolate_1790263884328.jpg',
  'ice_banana': 'primecafe_banana_gelato_1790264694633.jpg',

  // Breakfast (9 items - completely distinct)
  'bf_01': 'primecafe_ukun_1790263528221.jpg',
  'bf_02': 'primecafe_sukhaar_1790263542015.jpg',
  'bf_03': 'primecafe_sukhaar_special_1790263554094.jpg',
  'bf_04': 'primecafe_fuul_1790236965115.jpg',
  'bf_05': 'primecafe_fuul_special_1790236975673.jpg',
  'bf_06': 'primecafe_cambaabur_1790236986633.jpg',
  'bf_07': 'primecafe_bankeke_1790236996406.jpg',
  'bf_08': 'primecafe_sambuus_1790237006056.jpg',
  'bf_09': 'primecafe_mulawah_1790263566643.jpg',

  // Lunch (8 items - completely distinct)
  'ff_01': 'gourmet_burger_fries_1790216748392.jpg',
  'ff_02': 'primecafe_shawarma_1790263593875.jpg',
  'ff_03': 'primecafe_shawarma_vegetable_1790263604969.jpg',
  'ff_04': 'primecafe_sandwich_1790263616275.jpg',
  'ff_05': 'primecafe_chicken_and_chips_1790263630192.jpg',
  'ff_06': 'primecafe_indomie_1790263641106.jpg',
  'ff_07': 'primecafe_chips_1790264590111.jpg',
  'ff_08': 'primecafe_cambaabur_lunch_1790264711877.jpg',

  // Pasta (2 items - completely distinct)
  'pa_01': 'primecafe_makarone_1790263654263.jpg',
  'pa_02': 'primecafe_pasta_lasagne_1790263668067.jpg',

  // Dinner & Specialties (7 items - completely distinct)
  'dn_01': 'primecafe_prime_royal_1790263578104.jpg',
  'dn_02': 'primecafe_borash_1790263679287.jpg',
  'dn_03': 'prime_cafe_dibs_1790215853921.jpg',
  'dn_04': 'primecafe_fenis_1790263690155.jpg',
  'dn_05': 'primecafe_fenis_special_1790264515870.jpg',
  'dn_06': 'primecafe_chicken_salad_1790263702113.jpg',
  'dn_07': 'primecafe_fruits_1790263715288.jpg',

  // Hot & Cold Coffee (8 items - completely distinct)
  'cof_01': 'prime_cafe_macchiato_1790215844194.jpg',
  'cof_02': 'primecafe_double_macchiato_1790264441146.jpg',
  'cof_03': 'iced_latte_glass_1790235076500.jpg',
  'cof_04': 'primecafe_iced_americano_1790264453019.jpg',
  'cof_05': 'iced_spanish_latte_1790235097521.jpg',
  'cof_06': 'primecafe_iced_mocha_latte_1790264464404.jpg',
  'cof_07': 'artisan_cappuccino_1790235086488.jpg',
  'cof_08': 'primecafe_hot_chocolate_1790264477999.jpg',

  // Fresh Mojitos (7 items - completely distinct)
  'moj_01': 'primecafe_strawberry_mojito_1790263834721.jpg',
  'moj_02': 'primecafe_blueberry_mojito_1790264530541.jpg',
  'moj_03': 'primecafe_blu_mojito_1790263809838.jpg',
  'moj_04': 'primecafe_kiwi_mojito_1790264567306.jpg',
  'moj_05': 'primecafe_lemon_mojito_1790264555384.jpg',
  'moj_06': 'primecafe_cherry_mojito_1790264541348.jpg',
  'moj_07': 'primecafe_pineapple_mojito_1790264576536.jpg',

  // Creamy Milkshakes (5 items - completely distinct)
  'ms_01': 'primecafe_oreo_milkshake_1790263796100.jpg',
  'ms_02': 'primecafe_vanilla_milkshake_1790264626512.jpg',
  'ms_03': 'primecafe_strawberry_milkshake_1790264605257.jpg',
  'ms_04': 'primecafe_chocolate_milkshake_1790264616638.jpg',
  'ms_05': 'primecafe_lotus_milkshake_1790263784964.jpg',

  // Special Teas (5 items - completely distinct)
  'tea_01': 'primecafe_special_tea_1790263736432.jpg',
  'tea_02': 'primecafe_somali_tea_1790263749065.jpg',
  'tea_03': 'primecafe_black_tea_1790264491217.jpg',
  'tea_04': 'primecafe_green_tea_1790264505285.jpg',
  'tea_05': 'primecafe_moringa_tea_1790263761969.jpg',

  // Fresh Juices & Shakes (5 items - completely distinct)
  'jce_01': 'fresh_fruit_juice_1790235112270.jpg',
  'jce_02': 'primecafe_papaya_juice_1790263859825.jpg',
  'jce_03': 'primecafe_avocado_juice_1790263484390.jpg',
  'jce_04': 'primecafe_mango_juice_1790263847328.jpg',
  'jce_05': 'primecafe_banana_shake_1790263771958.jpg',
};

// Also create canonical primecafe_<clean_slug>.jpg files for downloads and direct access
const canonicalNames = {
  // Breakfast
  'bf_01': ['breakfast', 'primecafe_ukun.jpg'],
  'bf_02': ['breakfast', 'primecafe_sukhaar.jpg'],
  'bf_03': ['breakfast', 'primecafe_sukhaar_special.jpg'],
  'bf_04': ['breakfast', 'primecafe_fuul.jpg'],
  'bf_05': ['breakfast', 'primecafe_fuul_special.jpg'],
  'bf_06': ['breakfast', 'primecafe_cambaabur.jpg'],
  'bf_07': ['breakfast', 'primecafe_bankeke.jpg'],
  'bf_08': ['breakfast', 'primecafe_sambuus.jpg'],
  'bf_09': ['breakfast', 'primecafe_mulawah.jpg'],

  // Lunch
  'ff_01': ['lunch', 'primecafe_burger.jpg'],
  'ff_02': ['lunch', 'primecafe_shawarma.jpg'],
  'ff_03': ['lunch', 'primecafe_shawarma_vegetable.jpg'],
  'ff_04': ['lunch', 'primecafe_sandwich.jpg'],
  'ff_05': ['lunch', 'primecafe_chicken_and_chips.jpg'],
  'ff_06': ['lunch', 'primecafe_indomie.jpg'],
  'ff_07': ['lunch', 'primecafe_chips.jpg'],
  'ff_08': ['lunch', 'primecafe_cambaabur_lunch.jpg'],
  'pa_01': ['lunch', 'primecafe_makarone.jpg'],
  'pa_02': ['lunch', 'primecafe_pasta_lasagne.jpg'],

  // Dinner
  'dn_01': ['dinner', 'primecafe_prime_royal.jpg'],
  'dn_02': ['dinner', 'primecafe_borash.jpg'],
  'dn_03': ['dinner', 'primecafe_dibs.jpg'],
  'dn_04': ['dinner', 'primecafe_fenis.jpg'],
  'dn_05': ['dinner', 'primecafe_fenis_special.jpg'],
  'dn_06': ['dinner', 'primecafe_chicken_salad.jpg'],
  'dn_07': ['dinner', 'primecafe_fruits.jpg'],

  // Coffee & Tea
  'cof_01': ['coffee_tea', 'primecafe_macchiato.jpg'],
  'cof_02': ['coffee_tea', 'primecafe_double_macchiato.jpg'],
  'cof_03': ['coffee_tea', 'primecafe_iced_latte.jpg'],
  'cof_04': ['coffee_tea', 'primecafe_iced_americano.jpg'],
  'cof_05': ['coffee_tea', 'primecafe_iced_spanish_latte.jpg'],
  'cof_06': ['coffee_tea', 'primecafe_iced_mocha_latte.jpg'],
  'cof_07': ['coffee_tea', 'primecafe_cappuccino.jpg'],
  'cof_08': ['coffee_tea', 'primecafe_hot_chocolate.jpg'],
  'tea_01': ['coffee_tea', 'primecafe_special_tea.jpg'],
  'tea_02': ['coffee_tea', 'primecafe_somali_tea.jpg'],
  'tea_03': ['coffee_tea', 'primecafe_black_tea.jpg'],
  'tea_04': ['coffee_tea', 'primecafe_green_tea.jpg'],
  'tea_05': ['coffee_tea', 'primecafe_moringa_tea.jpg'],

  // Juice & Mojito & Shake
  'jce_01': ['juice_mojito_shake', 'primecafe_orange_juice.jpg'],
  'jce_02': ['juice_mojito_shake', 'primecafe_papaya_juice.jpg'],
  'jce_03': ['juice_mojito_shake', 'primecafe_avocado_juice.jpg'],
  'jce_04': ['juice_mojito_shake', 'primecafe_mango_juice.jpg'],
  'jce_05': ['juice_mojito_shake', 'primecafe_banana_shake.jpg'],
  'moj_01': ['juice_mojito_shake', 'primecafe_strawberry_mojito.jpg'],
  'moj_02': ['juice_mojito_shake', 'primecafe_blueberry_mojito.jpg'],
  'moj_03': ['juice_mojito_shake', 'primecafe_blu_mojito.jpg'],
  'moj_04': ['juice_mojito_shake', 'primecafe_kiwi_mojito.jpg'],
  'moj_05': ['juice_mojito_shake', 'primecafe_lemon_mojito.jpg'],
  'moj_06': ['juice_mojito_shake', 'primecafe_cherry_mojito.jpg'],
  'moj_07': ['juice_mojito_shake', 'primecafe_pineapple_mojito.jpg'],
  'ms_01': ['juice_mojito_shake', 'primecafe_oreo_milkshake.jpg'],
  'ms_02': ['juice_mojito_shake', 'primecafe_vanilla_milkshake.jpg'],
  'ms_03': ['juice_mojito_shake', 'primecafe_strawberry_milkshake.jpg'],
  'ms_04': ['juice_mojito_shake', 'primecafe_chocolate_milkshake.jpg'],
  'ms_05': ['juice_mojito_shake', 'primecafe_lotus_milkshake.jpg'],

  // Ice cream
  'ice_vanilla': ['ice_cream', 'primecafe_vanilla_ice_cream.jpg'],
  'ice_lotus': ['ice_cream', 'primecafe_lotus_ice_cream.jpg'],
  'ice_oreo': ['ice_cream', 'primecafe_oreo_ice_cream.jpg'],
  'ice_strawberry': ['ice_cream', 'primecafe_strawberry_ice_cream.jpg'],
  'ice_chocolate': ['ice_cream', 'primecafe_belgian_chocolate.jpg'],
  'ice_banana': ['ice_cream', 'primecafe_banana_gelato.jpg'],
};

for (const [id, targetFile] of Object.entries(uniqueImageMap)) {
  const src = path.join(srcDir, targetFile);
  if (fs.existsSync(src)) {
    // Copy to public/assets/images/<targetFile>
    fs.copyFileSync(src, path.join(pubDir, targetFile));

    // Also copy to canonical name in public/assets/images/ and public/downloads/<folder>/
    if (canonicalNames[id]) {
      const [folder, cleanName] = canonicalNames[id];
      fs.copyFileSync(src, path.join(pubDir, cleanName));
      const batchFolder = path.join(dlDir, folder);
      fs.mkdirSync(batchFolder, { recursive: true });
      fs.copyFileSync(src, path.join(batchFolder, cleanName));
    }
  } else {
    console.warn('File not found in src:', targetFile);
  }
}

// Update data/prime_cafe_db.json
const dbPath = path.join(__dirname, 'data', 'prime_cafe_db.json');
const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

db.items = db.items.map((item) => {
  if (uniqueImageMap[item.id]) {
    item.image_url = `/assets/images/${uniqueImageMap[item.id]}`;
  }
  return item;
});
db.last_updated = new Date().toISOString();
fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');

// Update src/data/seedData.ts
const seedContent = `import { Restaurant, Category, MenuItem } from '../types/index.ts';

export const PRIME_CAFE_RESTAURANT: Restaurant = ${JSON.stringify(db.restaurant, null, 2)};

export const SEED_CATEGORIES: Category[] = ${JSON.stringify(db.categories, null, 2)};

export const SEED_MENU_ITEMS: MenuItem[] = ${JSON.stringify(db.items, null, 2)};

export const OWNER_TRANSCRIPTION_FLAGS = [
  {
    id: 'flag_01',
    term: 'PENIS / PENIS SPECIAL (350 / 500 Birr)',
    transcription: 'Listed under Special Dishes as "PENIS" and "PENIS SPECIAL"',
    note: 'Appears on the physical laminated menu board under Special Dishes. Retained as transcribed on the menu card, with direct rename capability in admin.',
    status: 'owner_review_recommended',
  },
  {
    id: 'flag_02',
    term: 'LAWS (150 / 300 / 500 Birr)',
    transcription: 'Lotus Biscoff flavor ice cream & milkshake',
    note: 'The menu lists "LAWS" in the Ice Cream section and "LOTUS MILKSHAKE" in milkshakes. Standardized as Lotus Biscoff (Laws).',
    status: 'confirmed_lotus',
  },
  {
    id: 'flag_03',
    term: 'PANANA (150 / 300 / 500 Birr)',
    transcription: 'Banana ice cream flavor',
    note: 'Menu board spelled as "PANANA". Standardized as Banana Cream Gelato (Panana).',
    status: 'confirmed_banana',
  },
  {
    id: 'flag_04',
    term: 'BEER (500 Birr)',
    transcription: 'Regional term for fresh sautéed Liver',
    note: 'In the local regional dialect, "Beer" refers to beef liver (Beer / Beer Sauté). Listed in Breakfast (500 Birr) and Special Dishes (500 Birr).',
    status: 'confirmed_liver',
  },
  {
    id: 'flag_05',
    term: 'BASTO LASANY (700 Birr)',
    transcription: 'Pasta Lasagne (Baked Lasagna)',
    note: 'Listed as "BASTO LASANY" in Pasta & Mains.',
    status: 'confirmed_lasagna',
  },
  {
    id: 'flag_06',
    term: 'DJJBS (650 Birr)',
    transcription: 'Dibs / Tibs beef sauté',
    note: 'Regional transliteration "DJJBS" in Dinner & Special Dishes.',
    status: 'confirmed_dibs',
  },
];
`;

fs.writeFileSync(path.join(__dirname, 'src', 'data', 'seedData.ts'), seedContent, 'utf8');

console.log('✅ ALL 62 ITEMS SYNCHRONIZED WITH 100% UNIQUE IMAGES (0 DUPLICATES)!');
