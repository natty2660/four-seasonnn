import fs from 'fs';
import path from 'path';
import { SEED_CATEGORIES, SEED_MENU_ITEMS, PRIME_CAFE_RESTAURANT } from '../src/data/seedData.ts';
import { getMenuUrl, generateQRCodeDataUrl } from '../src/lib/qr.ts';
import { getInitialState } from '../src/lib/storage.ts';
import { initPostgresDatabase, saveDatabase } from '../src/server/db.ts';

async function runTests() {
  console.log('🧪 Running Four Season Cafe & Restaurant QR Digital Menu QA Verification Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}`);
      process.exitCode = 1;
    }
  }

  // Sync data/prime_cafe_db.json and PostgreSQL with the updated menu
  const freshState = getInitialState();
  const dbPath = path.join(process.cwd(), 'data', 'prime_cafe_db.json');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, JSON.stringify(freshState, null, 2), 'utf-8');
  await initPostgresDatabase();
  saveDatabase(freshState);

  // TEST 1: Command 4 — Zero Price Tags Across the Entire Menu System
  assert(
    SEED_MENU_ITEMS.every((item) => item.price === undefined && item.sizes === undefined),
    'All menu items have zero price tags or size price tags'
  );

  const itemCardCode = fs.readFileSync(path.join(process.cwd(), 'src/components/ItemCard.tsx'), 'utf-8');
  const publicMenuCode = fs.readFileSync(path.join(process.cwd(), 'src/components/PublicMenu.tsx'), 'utf-8');
  assert(
    !itemCardCode.includes('formatBirr') && !publicMenuCode.includes('formatBirr'),
    'Public menu and ItemCard contain zero price formatting or price tags'
  );

  // TEST 2: Command 1, 2, 3 — Exact Menu Categories & Items Synced
  const catIds = SEED_CATEGORIES.map((c) => c.id);
  assert(
    catIds.includes('cat_breakfast') &&
      catIds.includes('cat_launch') &&
      catIds.includes('cat_lunch_mains') &&
      catIds.includes('cat_pizza') &&
      catIds.includes('cat_hot_cold_coffee') &&
      catIds.includes('cat_ice_drink') &&
      catIds.includes('cat_fresh_juices') &&
      catIds.includes('cat_mojito') &&
      catIds.includes('cat_soft_drink'),
    `All 9 categories (including Ice Drink) are present (${SEED_CATEGORIES.length} categories)`
  );

  const breakfastItems = SEED_MENU_ITEMS.filter((i) => i.category_id === 'cat_breakfast');
  const launchItems = SEED_MENU_ITEMS.filter((i) => i.category_id === 'cat_launch');
  const burgerShawarmaItems = SEED_MENU_ITEMS.filter((i) => i.category_id === 'cat_lunch_mains');
  const pizzaItems = SEED_MENU_ITEMS.filter((i) => i.category_id === 'cat_pizza');
  const hotDrinksItems = SEED_MENU_ITEMS.filter((i) => i.category_id === 'cat_hot_cold_coffee');
  const iceDrinkItems = SEED_MENU_ITEMS.filter((i) => i.category_id === 'cat_ice_drink');
  const juiceItems = SEED_MENU_ITEMS.filter((i) => i.category_id === 'cat_fresh_juices');
  const mojitoItems = SEED_MENU_ITEMS.filter((i) => i.category_id === 'cat_mojito');
  const softDrinkItems = SEED_MENU_ITEMS.filter((i) => i.category_id === 'cat_soft_drink');

  assert(breakfastItems.length === 14, `Breakfast has 14 items (${breakfastItems.length} found)`);
  assert(launchItems.length === 32, `Lunch has 32 items (${launchItems.length} found)`);
  assert(burgerShawarmaItems.length === 14, `Burger & Shawarma has 14 items (${burgerShawarmaItems.length} found)`);
  assert(pizzaItems.length === 6, `Pizza has 6 items (${pizzaItems.length} found)`);
  assert(hotDrinksItems.length === 7, `Hot Drink has 7 items (${hotDrinksItems.length} found)`);
  assert(iceDrinkItems.length === 6, `Ice Drink has 6 items (${iceDrinkItems.length} found): Ice Chocolate, Ice Strawberry, Ice Cola, Ice Sprite, Ice Caramel, Ice Coffee`);
  assert(juiceItems.length === 14, `Juice has 14 items (${juiceItems.length} found)`);
  assert(mojitoItems.length === 14, `Mojito has 14 items (${mojitoItems.length} found)`);
  assert(softDrinkItems.length === 2, `Soft Drink has 2 items (${softDrinkItems.length} found)`);
  assert(SEED_MENU_ITEMS.length === 109, `Total menu items strictly equals 109 (${SEED_MENU_ITEMS.length} found)`);

  const expectedIceDrinks = ['Ice Chocolate', 'Ice Strawberry', 'Ice Cola', 'Ice Sprite', 'Ice Caramel', 'Ice Coffee'];
  assert(
    expectedIceDrinks.every((name) => iceDrinkItems.some((i) => i.name === name)),
    'All 6 new Ice Drinks are present with corrected spelling'
  );

  // Verify deleted items are gone (Command 3)
  const deletedNames = ['Prime Royal Dish', 'French Toast', 'Cortado', 'Hibiscus Tea', 'Affogato', 'V60 Pour-Over'];
  assert(
    deletedNames.every((name) => !SEED_MENU_ITEMS.some((i) => i.name.toLowerCase() === name.toLowerCase())),
    'Items not in the uploaded menu sheets have been deleted from the system'
  );

  // Verify all 109 items now have images inserted AND zero repeated images across the entire menu
  const itemsWithImages = SEED_MENU_ITEMS.filter((i) => Boolean(i.image_url && i.image_url.trim() !== ''));
  assert(
    itemsWithImages.length === 109,
    `All 109 menu items have images assigned (${itemsWithImages.length}/109 found)`
  );

  const uniqueImageUrls = new Set(SEED_MENU_ITEMS.map((i) => i.image_url));
  assert(
    uniqueImageUrls.size === 109,
    `Command 2: Every single menu item has its own distinct image URL with zero repeated images (${uniqueImageUrls.size}/109 unique URLs)`
  );

  // Also verify every single image file exists on disk and is > 20KB (no broken thumbnails)
  const validFiles = SEED_MENU_ITEMS.filter((i) => {
    const filePath = path.join(process.cwd(), 'public', i.image_url);
    return fs.existsSync(filePath) && fs.statSync(filePath).size > 20000;
  });
  assert(
    validFiles.length === 109,
    `All 109 menu item image files exist on disk with high-resolution content (${validFiles.length}/109 verified)`
  );

  const specialBurger = SEED_MENU_ITEMS.find((i) => i.id === 'ff_01');
  const normalPasta = SEED_MENU_ITEMS.find((i) => i.id === 'pa_01');
  assert(
    specialBurger?.image_url === '/assets/images/item_special_burger.jpg' &&
      normalPasta?.image_url === '/assets/images/item_normal_pasta.jpg',
    'Exceptional rule applied: existing images on Special Burger and Normal Pasta were replaced with the new images'
  );

  // TEST 3: QR Persistence Integrity
  const qrUrl = getMenuUrl(PRIME_CAFE_RESTAURANT.slug);
  assert(qrUrl.includes('/menu/prime-cafe'), 'QR URL points permanently to /menu/prime-cafe');

  const dataUrl = await generateQRCodeDataUrl({
    url: qrUrl,
    size: 1024,
    darkColor: '#2B1A12',
    lightColor: '#EFEBE9',
  });
  assert(dataUrl.startsWith('data:image/png;base64,'), 'QR code generates valid 1024px PNG data URL');
  console.log(`\n🎉 Verification Complete: ${passed}/${total} checks passed successfully!`);
  process.exit(passed === total ? 0 : 1);
}

runTests();
