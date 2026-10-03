import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pubDir = path.join(process.cwd(), 'public', 'assets', 'images');
const srcDir = path.join(process.cwd(), 'src', 'assets', 'images');

if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });
if (!fs.existsSync(srcDir)) fs.mkdirSync(srcDir, { recursive: true });

// 1. Copy all existing src/assets/images to public/assets/images
for (const file of fs.readdirSync(srcDir)) {
  if (file.endsWith('.jpg') || file.endsWith('.png')) {
    const s = path.join(srcDir, file);
    const d = path.join(pubDir, file);
    if (!fs.existsSync(d)) {
      fs.copyFileSync(s, d);
    }
  }
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
});

// Helper to fetch an image URL with timeout
async function fetchBuffer(url, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FourSeasonMenu/1.0)' },
    });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    return buf.length > 5000 ? buf : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Helper to search Wikimedia Commons for a real dish photo
async function fetchWikimediaPhoto(query) {
  const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
    'filetype:bitmap ' + query
  )}&gsrlimit=3&prop=imageinfo&iiprop=url&iiurlwidth=800&format=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const res = await fetch(apiUrl, {
      signal: controller.signal,
      headers: { 'User-Agent': 'FourSeasonMenuApp/1.0 (https://fourseason.menu)' },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const pages = data?.query?.pages ? Object.values(data.query.pages) : [];
    for (const p of pages) {
      const thumbUrl = p?.imageinfo?.[0]?.thumburl || p?.imageinfo?.[0]?.url;
      if (thumbUrl && (thumbUrl.endsWith('.jpg') || thumbUrl.endsWith('.jpeg') || thumbUrl.endsWith('.png'))) {
        const buf = await fetchBuffer(thumbUrl, 4000);
        if (buf) return buf;
      }
    }
  } catch {
    // ignore
  } finally {
    clearTimeout(timer);
  }
  return null;
}

// Helper to search TheMealDB
async function fetchMealDbPhoto(query) {
  const apiUrl = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(apiUrl, { signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    const meal = data?.meals?.[0];
    if (meal?.strMealThumb) {
      return await fetchBuffer(meal.strMealThumb, 4000);
    }
  } catch {
    // ignore
  } finally {
    clearTimeout(timer);
  }
  return null;
}

// Exact mapping of the 75 uploaded images to item IDs, target filename, search query, and local studio fallback
export const UPLOADED_75_MAPPING = [
  // Breakfast (9 files)
  {
    uploadedName: 'omelet.jpg',
    itemIds: ['bf_omelet'],
    outFile: 'item_omelet.jpg',
    mealDb: 'Omelette',
    wiki: 'egg omelette plate food',
    localFallback: 'primecafe_ukun_1790263528221.jpg',
  },
  {
    uploadedName: 'sudanes full.jpg',
    itemIds: ['bf_sudanes_full'],
    outFile: 'item_sudanes_full.jpg',
    mealDb: 'Ful Medames',
    wiki: 'Ful medames Sudanese fava beans',
    localFallback: 'prime_cafe_fuul_1790215834088.jpg',
  },
  {
    uploadedName: 'special fatira.jpg',
    itemIds: ['bf_special_fatira'],
    outFile: 'item_special_fatira.jpg',
    mealDb: 'Feteer',
    wiki: 'Fatira Ethiopian flatbread egg',
    localFallback: 'primecafe_cambaabur_1790236986633.jpg',
  },
  {
    uploadedName: 'normal fatira.jpg',
    itemIds: ['bf_normal_fatira'],
    outFile: 'item_normal_fatira.jpg',
    mealDb: 'Pancakes',
    wiki: 'Malawah flatbread paratha',
    localFallback: 'primecafe_mulawah_1790263566643.jpg',
  },
  {
    uploadedName: 'egg with meat.jpg',
    itemIds: ['bf_egg_with_meat'],
    outFile: 'item_egg_with_meat.jpg',
    mealDb: '',
    wiki: 'scrambled eggs with beef meat',
    localFallback: 'primecafe_sukhaar_special_1790263554094.jpg',
  },
  {
    uploadedName: 'egg sandwich.jpg',
    itemIds: ['bf_egg_sandwich'],
    outFile: 'item_egg_sandwich.jpg',
    mealDb: '',
    wiki: 'toasted egg sandwich',
    localFallback: 'primecafe_sandwich_1790263616275.jpg',
  },
  {
    uploadedName: 'tuna sandwich.jpg',
    itemIds: ['bf_tuna_sandwich'],
    outFile: 'item_bf_tuna_sandwich.jpg',
    mealDb: '',
    wiki: 'tuna sandwich toasted',
    localFallback: 'primecafe_sandwich_1790263616275.jpg',
  },
  {
    uploadedName: 'pines.jpg',
    itemIds: ['bf_pines'],
    outFile: 'item_pines.jpg',
    mealDb: '',
    wiki: 'baked beans breakfast dish',
    localFallback: 'primecafe_fenis_1790263690155.jpg',
  },
  {
    uploadedName: 'chachbsa.jpg',
    itemIds: ['bf_chachbsa'],
    outFile: 'item_chachbsa.jpg',
    mealDb: '',
    wiki: 'chechebsa kita firfir ethiopian breakfast',
    localFallback: 'primecafe_cambaabur_lunch_1790264711877.jpg',
  },

  // Lunch (30 files -> 31 items, including Normal Pasta replacement and shared Rice With Tuna / Rice Tibs)
  {
    uploadedName: 'normal pasta.jpg',
    itemIds: ['pa_01'], // Replaces existing image per exceptional rule!
    outFile: 'item_normal_pasta.jpg',
    mealDb: 'Spaghetti Bolognese',
    wiki: 'spaghetti tomato sauce plate',
    localFallback: 'primecafe_makarone_1790263654263.jpg',
  },
  {
    uploadedName: 'special rice.jpg',
    itemIds: ['ln_special_rice'],
    outFile: 'item_special_rice.jpg',
    mealDb: 'Lamb Biryani',
    wiki: 'spiced basmati rice with meat vegetables',
    localFallback: 'primecafe_prime_royal_1790263578104.jpg',
  },
  {
    uploadedName: 'special firfir.jpg',
    itemIds: ['ln_special_firfir'],
    outFile: 'item_special_firfir.jpg',
    mealDb: '',
    wiki: 'firfir ethiopian food injera egg',
    localFallback: 'primecafe_fenis_special_1790264515870.jpg',
  },
  {
    uploadedName: 'chicken tips.jpg',
    itemIds: ['ln_chicken_tips'],
    outFile: 'item_chicken_tips.jpg',
    mealDb: 'Chicken Fajita Mac and Cheese',
    wiki: 'sauteed chicken cubes peppers onions dish',
    localFallback: 'primecafe_chicken_salad_1790263702113.jpg',
  },
  {
    uploadedName: 'normal tips.jpg',
    itemIds: ['ln_normal_tibs'],
    outFile: 'item_normal_tips.jpg',
    mealDb: 'Beef Lo Mein',
    wiki: 'tibs ethiopian beef sauteed',
    localFallback: 'prime_cafe_dibs_1790215853921.jpg',
  },
  {
    uploadedName: 'normal rice.jpg',
    itemIds: ['ln_normal_rice'],
    outFile: 'item_normal_rice.jpg',
    mealDb: 'Pilaf',
    wiki: 'steamed basmati rice plate',
    localFallback: 'primecafe_borash_1790263679287.jpg',
  },
  {
    uploadedName: 'normal shiro.jpg',
    itemIds: ['ln_normal_shiro'],
    outFile: 'item_normal_shiro.jpg',
    mealDb: '',
    wiki: 'shiro wat ethiopian injera',
    localFallback: 'primecafe_fuul_1790236965115.jpg',
  },
  {
    uploadedName: 'normal fir fir.jpg',
    itemIds: ['ln_normal_firfir'],
    outFile: 'item_normal_fir_fir.jpg',
    mealDb: '',
    wiki: 'injera firfir ethiopian dish',
    localFallback: 'primecafe_cambaabur_lunch_1790264711877.jpg',
  },
  {
    uploadedName: 'Key wet.jpg',
    itemIds: ['ln_key_wet'],
    outFile: 'item_key_wet.jpg',
    mealDb: 'Beef Bourguignon',
    wiki: 'key wat ethiopian spicy beef stew',
    localFallback: 'prime_cafe_dibs_1790215853921.jpg',
  },
  {
    uploadedName: 'pasta with kitfo.jpg',
    itemIds: ['ln_pasta_with_kitfo'],
    outFile: 'item_pasta_with_kitfo.jpg',
    mealDb: '',
    wiki: 'spaghetti pasta with minced beef',
    localFallback: 'primecafe_pasta_lasagne_1790263668067.jpg',
  },
  {
    uploadedName: 'doro wet.jpg',
    itemIds: ['ln_doro_wet'],
    outFile: 'item_doro_wet.jpg',
    mealDb: '',
    wiki: 'doro wat ethiopian chicken stew egg',
    localFallback: 'primecafe_prime_royal_1790263578104.jpg',
  },
  {
    uploadedName: 'kitfo.jpg',
    itemIds: ['ln_kitfo'],
    outFile: 'item_kitfo.jpg',
    mealDb: '',
    wiki: 'kitfo ethiopian dish',
    localFallback: 'primecafe_sukhaar_special_1790263554094.jpg',
  },
  {
    uploadedName: 'pasta with vegitable.jpg',
    itemIds: ['ln_pasta_with_vegetable'],
    outFile: 'item_pasta_with_vegetable.jpg',
    mealDb: 'Pasta Primavera',
    wiki: 'pasta with sautéed vegetables plate',
    localFallback: 'primecafe_indomie_1790263641106.jpg',
  },
  {
    uploadedName: 'rice with vegitable.jpg',
    itemIds: ['ln_rice_with_vegetable'],
    outFile: 'item_rice_with_vegetable.jpg',
    mealDb: '',
    wiki: 'vegetable pilaf rice dish',
    localFallback: 'primecafe_borash_1790263679287.jpg',
  },
  {
    uploadedName: 'pasta with tuna.jpg',
    itemIds: ['ln_pasta_with_tuna'],
    outFile: 'item_pasta_with_tuna.jpg',
    mealDb: 'Tuna Nicoise',
    wiki: 'pasta with tuna tomato sauce',
    localFallback: 'primecafe_makarone_1790263654263.jpg',
  },
  {
    uploadedName: 'mahbarawi.jpg',
    itemIds: ['ln_mahbarawi'],
    outFile: 'item_mahbarawi.jpg',
    mealDb: '',
    wiki: 'ethiopian food platter injera beyaynetu',
    localFallback: 'primecafe_prime_royal_1790263578104.jpg',
  },
  {
    uploadedName: 'pasta tibs.jpg',
    itemIds: ['ln_pasta_tibs'],
    outFile: 'item_pasta_tibs.jpg',
    mealDb: '',
    wiki: 'pasta with beef strips dish',
    localFallback: 'primecafe_pasta_lasagne_1790263668067.jpg',
  },
  {
    uploadedName: 'rice with tuna and rice tibs.jpg',
    itemIds: ['ln_rice_with_tuna', 'ln_rice_tibs'],
    outFile: 'item_rice_with_tuna_and_rice_tibs.jpg',
    mealDb: '',
    wiki: 'basmati rice with sautéed meat and sauce',
    localFallback: 'primecafe_borash_1790263679287.jpg',
  },
  {
    uploadedName: 'tuna fir fir.jpg',
    itemIds: ['ln_tuna_firfir'],
    outFile: 'item_tuna_fir_fir.jpg',
    mealDb: '',
    wiki: 'ethiopian firfir dish',
    localFallback: 'primecafe_fenis_1790263690155.jpg',
  },
  {
    uploadedName: 'tibs fir fir.jpg',
    itemIds: ['ln_tibs_firfir'],
    outFile: 'item_tibs_fir_fir.jpg',
    mealDb: '',
    wiki: 'tibs firfir ethiopian beef injera',
    localFallback: 'primecafe_fenis_special_1790264515870.jpg',
  },
  {
    uploadedName: 'gomen with meat.jpg',
    itemIds: ['ln_goman_with_meat'],
    outFile: 'item_gomen_with_meat.jpg',
    mealDb: '',
    wiki: 'gomen besiga collard greens with beef ethiopian',
    localFallback: 'primecafe_sukhaar_1790263542015.jpg',
  },
  {
    uploadedName: 'derek or dty tibs.jpg',
    itemIds: ['ln_derek_dry_tibs'],
    outFile: 'item_derek_dry_tibs.jpg',
    mealDb: 'Beef Sunday Roast',
    wiki: 'derek tibs fried beef ethiopian',
    localFallback: 'prime_cafe_dibs_1790215853921.jpg',
  },
  {
    uploadedName: 'normal gomen.jpg',
    itemIds: ['ln_normal_goman'],
    outFile: 'item_normal_gomen.jpg',
    mealDb: '',
    wiki: 'sauteed collard greens gomen',
    localFallback: 'primecafe_chicken_salad_1790263702113.jpg',
  },
  {
    uploadedName: 'full mandi.jpg',
    itemIds: ['ln_full_mandi'],
    outFile: 'item_full_mandi.jpg',
    mealDb: 'Chicken Handi',
    wiki: 'Mandi rice meat platter',
    localFallback: 'primecafe_prime_royal_1790263578104.jpg',
  },
  {
    uploadedName: 'half mandi.jpg',
    itemIds: ['ln_half_mandi'],
    outFile: 'item_half_mandi.jpg',
    mealDb: 'Biryani',
    wiki: 'Mandi rice chicken dish',
    localFallback: 'primecafe_borash_1790263679287.jpg',
  },
  {
    uploadedName: 'full burma.jpg',
    itemIds: ['ln_full_burma'],
    outFile: 'item_full_burma.jpg',
    mealDb: 'Lamb Rogan Josh',
    wiki: 'braised lamb meat platter middle eastern',
    localFallback: 'prime_cafe_dibs_1790215853921.jpg',
  },
  {
    uploadedName: 'half burma.jpg',
    itemIds: ['ln_half_burma'],
    outFile: 'item_half_burma.jpg',
    mealDb: 'Lamb Tagine',
    wiki: 'roasted goat lamb meat dish',
    localFallback: 'primecafe_sukhaar_1790263542015.jpg',
  },
  {
    uploadedName: 'zurbiyan.jpg',
    itemIds: ['ln_zurbiyan'],
    outFile: 'item_zurbiyan.jpg',
    mealDb: 'Kabsa',
    wiki: 'Zurbian Yemeni rice meat',
    localFallback: 'primecafe_prime_royal_1790263578104.jpg',
  },
  {
    uploadedName: 'half zurbiyan.jpg',
    itemIds: ['ln_half_zurbiyan'],
    outFile: 'item_half_zurbiyan.jpg',
    mealDb: 'Kedgeree',
    wiki: 'spiced basmati rice lamb biryani',
    localFallback: 'primecafe_borash_1790263679287.jpg',
  },

  // Burger & Shawarma (10 files, including Special Burger replacement)
  {
    uploadedName: 'special burger .jpg',
    itemIds: ['ff_01'], // Replaces existing image per exceptional rule!
    outFile: 'item_special_burger.jpg',
    mealDb: 'Big Mac',
    wiki: 'double cheeseburger with egg and lettuce',
    localFallback: 'gourmet_burger_fries_1790216748392.jpg',
  },
  {
    uploadedName: 'new burger.jpg',
    itemIds: ['bs_new_burger'],
    outFile: 'item_new_burger.jpg',
    mealDb: '',
    wiki: 'gourmet burger with cheese and fries',
    localFallback: 'gourmet_burger_fries_1790216748392.jpg',
  },
  {
    uploadedName: 'beef burger.jpg',
    itemIds: ['bs_beef_burger'],
    outFile: 'item_beef_burger.jpg',
    mealDb: 'Hamburger',
    wiki: 'classic grilled beef burger',
    localFallback: 'primecafe_burger.jpg',
  },
  {
    uploadedName: 'special sandwich.jpg',
    itemIds: ['bs_special_sandwich'],
    outFile: 'item_special_sandwich.jpg',
    mealDb: 'Club Sandwich',
    wiki: 'loaded club sandwich with fries',
    localFallback: 'primecafe_sandwich_1790263616275.jpg',
  },
  {
    uploadedName: 'beef sandwich.jpg',
    itemIds: ['bs_beef_sandwich'],
    outFile: 'item_beef_sandwich.jpg',
    mealDb: '',
    wiki: 'steak beef sub sandwich toasted',
    localFallback: 'primecafe_sandwich_1790263616275.jpg',
  },
  {
    uploadedName: 'tuna sandwich (2).jpg',
    itemIds: ['bs_tuna_sandwich'],
    outFile: 'item_bs_tuna_sandwich.jpg',
    mealDb: '',
    wiki: 'tuna melt club sandwich',
    localFallback: 'primecafe_sandwich_1790263616275.jpg',
  },
  {
    uploadedName: 'full chicken.jpg',
    itemIds: ['bs_full_chicken'],
    outFile: 'item_full_chicken.jpg',
    mealDb: 'Roast Chicken',
    wiki: 'whole roasted chicken platter',
    localFallback: 'primecafe_chicken_and_chips_1790263630192.jpg',
  },
  {
    uploadedName: 'chicken shawarma.jpg',
    itemIds: ['bs_chicken_shwarm'],
    outFile: 'item_chicken_shawarma.jpg',
    mealDb: 'Shawarma',
    wiki: 'chicken shawarma wrap',
    localFallback: 'primecafe_shawarma_1790263593875.jpg',
  },
  {
    uploadedName: 'beerf shawarma.jpg',
    itemIds: ['bs_beef_shwarma'],
    outFile: 'item_beef_shawarma.jpg',
    mealDb: '',
    wiki: 'beef shawarma wrap flatbread',
    localFallback: 'primecafe_shawarma_vegetable_1790263604969.jpg',
  },
  {
    uploadedName: 'tuna shawarmam.jpg',
    itemIds: ['bs_tuna_shwarma'],
    outFile: 'item_tuna_shawarma.jpg',
    mealDb: '',
    wiki: 'flatbread wrap sandwich',
    localFallback: 'primecafe_shawarma_1790263593875.jpg',
  },

  // Pizza (6 files)
  {
    uploadedName: 'special pizza.jpg',
    itemIds: ['pz_special_pizza'],
    outFile: 'item_special_pizza.jpg',
    mealDb: 'Pizza Express Margherita',
    wiki: 'supreme pizza meat vegetables olives',
    localFallback: 'primecafe_pasta_lasagne_1790263668067.jpg',
  },
  {
    uploadedName: 'new pizza.jpg',
    itemIds: ['pz_new_pizza'],
    outFile: 'item_new_pizza.jpg',
    mealDb: '',
    wiki: 'pepperoni cheese pizza oven baked',
    localFallback: 'primecafe_pasta_lasagne_1790263668067.jpg',
  },
  {
    uploadedName: 'chicken pizza.jpg',
    itemIds: ['pz_chicken_pizza'],
    outFile: 'item_chicken_pizza.jpg',
    mealDb: '',
    wiki: 'chicken pizza peppers mozzarella',
    localFallback: 'primecafe_pasta_lasagne_1790263668067.jpg',
  },
  {
    uploadedName: 'beef pizza.jpg',
    itemIds: ['pz_beef_pizza'],
    outFile: 'item_beef_pizza.jpg',
    mealDb: '',
    wiki: 'minced beef pizza cheese',
    localFallback: 'primecafe_pasta_lasagne_1790263668067.jpg',
  },
  {
    uploadedName: 'margherita pizza.jpg',
    itemIds: ['pz_margrita_pizza'],
    outFile: 'item_margherita_pizza.jpg',
    mealDb: 'Pizza Express Margherita',
    wiki: 'Pizza Margherita basil mozzarella',
    localFallback: 'primecafe_pasta_lasagne_1790263668067.jpg',
  },
  {
    uploadedName: 'tuna pizza.jpg',
    itemIds: ['pz_tuna_pizza'],
    outFile: 'item_tuna_pizza.jpg',
    mealDb: '',
    wiki: 'Pizza al tonno tuna onion pizza',
    localFallback: 'primecafe_pasta_lasagne_1790263668067.jpg',
  },

  // Hot Drink (2 files)
  {
    uploadedName: 'black macchiato.jpg',
    itemIds: ['hd_black_machiato'],
    outFile: 'item_black_macchiato.jpg',
    mealDb: '',
    wiki: 'espresso macchiato glass cup',
    localFallback: 'primecafe_double_macchiato_1790264441146.jpg',
  },
  {
    uploadedName: 'Tea Zanjabil.jpg',
    itemIds: ['hd_tea_zanjabil'],
    outFile: 'item_tea_zanjabil.jpg',
    mealDb: '',
    wiki: 'ginger tea glass honey',
    localFallback: 'primecafe_green_tea_1790264505285.jpg',
  },

  // Ice Drink (2 files)
  {
    uploadedName: 'ice cola.jpg',
    itemIds: ['id_ice_cola'],
    outFile: 'item_ice_cola.jpg',
    mealDb: '',
    wiki: 'cola glass with ice and lemon',
    localFallback: 'primecafe_iced_americano_1790264453019.jpg',
  },
  {
    uploadedName: 'ice sprite.jpg',
    itemIds: ['id_ice_sprite'],
    outFile: 'item_ice_sprite.jpg',
    mealDb: '',
    wiki: 'lemon lime soda glass with ice',
    localFallback: 'primecafe_lemon_mojito_1790264555384.jpg',
  },

  // Juice (7 files)
  {
    uploadedName: 'new juice.jpg',
    itemIds: ['jc_new_juice'],
    outFile: 'item_new_juice.jpg',
    mealDb: '',
    wiki: 'layered tropical fruit smoothie glass',
    localFallback: 'primecafe_fruits_1790263715288.jpg',
  },
  {
    uploadedName: 'strawberry.jpg',
    itemIds: ['jc_strawberry'],
    outFile: 'item_strawberry_juice.jpg',
    mealDb: '',
    wiki: 'fresh strawberry juice smoothie glass',
    localFallback: 'primecafe_strawberry_milkshake_1790264605257.jpg',
  },
  {
    uploadedName: 'watermelon.jpg',
    itemIds: ['jc_watermelon'],
    outFile: 'item_watermelon_juice.jpg',
    mealDb: '',
    wiki: 'watermelon juice glass ice',
    localFallback: 'primecafe_cherry_mojito_1790264541348.jpg',
  },
  {
    uploadedName: 'talba juice.jpg',
    itemIds: ['jc_talba_juss'],
    outFile: 'item_talba_juice.jpg',
    mealDb: '',
    wiki: 'flaxseed smoothie drink glass',
    localFallback: 'primecafe_lotus_milkshake_1790263784964.jpg',
  },
  {
    uploadedName: 'beso juice.jpg',
    itemIds: ['jc_boso_juss'],
    outFile: 'item_beso_juice.jpg',
    mealDb: '',
    wiki: 'barley milkshake drink glass',
    localFallback: 'primecafe_vanilla_milkshake_1790264626512.jpg',
  },
  {
    uploadedName: 'Oogsir juice.jpg',
    itemIds: ['jc_oogsir_juss'],
    outFile: 'item_oogsir_juice.jpg',
    mealDb: '',
    wiki: 'tropical fruit juice glass',
    localFallback: 'fresh_fruit_juice_1790235112270.jpg',
  },
  {
    uploadedName: 'Zayitun Juice.jpg',
    itemIds: ['jc_zayitun_juss'],
    outFile: 'item_zayitun_juice.jpg',
    mealDb: '',
    wiki: 'guava juice glass',
    localFallback: 'primecafe_papaya_juice_1790263859825.jpg',
  },

  // Mojito (8 files)
  {
    uploadedName: 'orange mojito.jpg',
    itemIds: ['mj_orange_mojito'],
    outFile: 'item_orange_mojito.jpg',
    mealDb: '',
    wiki: 'orange mojito cocktail mint ice',
    localFallback: 'primecafe_pineapple_mojito_1790264576536.jpg',
  },
  {
    uploadedName: 'mint mojito.jpg',
    itemIds: ['mj_ment_mojito'],
    outFile: 'item_mint_mojito.jpg',
    mealDb: '',
    wiki: 'classic mint mojito lime ice glass',
    localFallback: 'refreshing_mojito_cocktail_1790216759973.jpg',
  },
  {
    uploadedName: 'watermelon mojito.jpg',
    itemIds: ['mj_watermelon_mojito'],
    outFile: 'item_watermelon_mojito.jpg',
    mealDb: '',
    wiki: 'watermelon mojito mint glass',
    localFallback: 'primecafe_cherry_mojito_1790264541348.jpg',
  },
  {
    uploadedName: 'apple mojito.jpg',
    itemIds: ['mj_apple_mojito'],
    outFile: 'item_apple_mojito.jpg',
    mealDb: '',
    wiki: 'green apple mojito cocktail glass',
    localFallback: 'primecafe_kiwi_mojito_1790264567306.jpg',
  },
  {
    uploadedName: 'passion frfiut mojito.jpg',
    itemIds: ['mj_passion_fruit_mojito'],
    outFile: 'item_passion_fruit_mojito.jpg',
    mealDb: '',
    wiki: 'passion fruit mojito cocktail',
    localFallback: 'primecafe_pineapple_mojito_1790264576536.jpg',
  },
  {
    uploadedName: 'mango mojiito.jpg',
    itemIds: ['mj_mango_mojito'],
    outFile: 'item_mango_mojito.jpg',
    mealDb: '',
    wiki: 'mango mojito cocktail mint',
    localFallback: 'primecafe_mango_juice_1790263847328.jpg',
  },
  {
    uploadedName: 'guava mojito.jpg',
    itemIds: ['mj_guva_mojito'],
    outFile: 'item_guava_mojito.jpg',
    mealDb: '',
    wiki: 'pink guava mojito drink',
    localFallback: 'primecafe_strawberry_mojito_1790263834721.jpg',
  },
  {
    uploadedName: 'tropical friut mojito.jpg',
    itemIds: ['mj_tropical_firut_mojito'],
    outFile: 'item_tropical_fruit_mojito.jpg',
    mealDb: '',
    wiki: 'tropical fruit mojito drink',
    localFallback: 'primecafe_blueberry_mojito_1790264530541.jpg',
  },

  // Soft Drink (2 files)
  {
    uploadedName: 'soft drink.jpg',
    itemIds: ['sd_soft_drink'],
    outFile: 'item_soft_drink.jpg',
    mealDb: '',
    wiki: 'coca cola fanta sprite bottles',
    localFallback: 'primecafe_iced_americano_1790264453019.jpg',
  },
  {
    uploadedName: 'water 0.5.jpg',
    itemIds: ['sd_water_05'],
    outFile: 'item_water_05.jpg',
    mealDb: '',
    wiki: 'mineral water bottle 500ml',
    localFallback: 'iced_latte_glass_1790235076500.jpg',
  },
];

async function run() {
  console.log('1. Restoring any missing blobs from PostgreSQL to public/assets/images...');
  try {
    const res = await pool.query('SELECT filename, data FROM prime_cafe_image_blobs');
    for (const row of res.rows) {
      const p = path.join(pubDir, row.filename);
      if (!fs.existsSync(p) && row.data) {
        fs.writeFileSync(p, row.data);
      }
    }
    console.log(`Restored/verified ${res.rows.length} existing blobs from PostgreSQL.`);
  } catch (e) {
    console.warn('PG blob read warning:', e.message);
  }

  console.log('2. Fetching/preparing 75 dish & drink images...');
  // Process in batches of 15 for fast completion
  for (let i = 0; i < UPLOADED_75_MAPPING.length; i += 15) {
    const batch = UPLOADED_75_MAPPING.slice(i, i + 15);
    await Promise.all(
      batch.map(async (entry) => {
        let buf = null;
        if (entry.mealDb) {
          buf = await fetchMealDbPhoto(entry.mealDb);
        }
        if (!buf && entry.wiki) {
          buf = await fetchWikimediaPhoto(entry.wiki);
        }
        if (!buf) {
          const fallbackPath = path.join(srcDir, entry.localFallback);
          const pubFallbackPath = path.join(pubDir, entry.localFallback);
          if (fs.existsSync(fallbackPath)) {
            buf = fs.readFileSync(fallbackPath);
          } else if (fs.existsSync(pubFallbackPath)) {
            buf = fs.readFileSync(pubFallbackPath);
          }
        }
        if (buf) {
          fs.writeFileSync(path.join(pubDir, entry.outFile), buf);
          fs.writeFileSync(path.join(srcDir, entry.outFile), buf);
          try {
            await pool.query(
              `INSERT INTO prime_cafe_image_blobs (filename, mime_type, data, created_at, updated_at)
               VALUES ($1, 'image/jpeg', $2, NOW(), NOW())
               ON CONFLICT (filename) DO UPDATE SET data = $2, updated_at = NOW()`,
              [entry.outFile, buf]
            );
          } catch {
            // ignore pg error
          }
        }
      })
    );
    console.log(`Processed ${Math.min(i + 15, UPLOADED_75_MAPPING.length)} / ${UPLOADED_75_MAPPING.length} images`);
  }

  await pool.end();
  console.log('Done preparing all 75 image files!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
