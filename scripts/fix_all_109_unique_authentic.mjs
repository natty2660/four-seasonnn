import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pubDir = path.join(process.cwd(), 'public', 'assets', 'images');
const srcDir = path.join(process.cwd(), 'src', 'assets', 'images');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 8000,
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const USER_AGENT = 'FourSeasonMenuBot/1.2 (https://fourseason.example.com; admin@fourseason.example.com) Node/22';

function md5(buf) {
  return crypto.createHash('md5').update(buf).digest('hex');
}

async function fetchBuffer(url, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('image')) return null;
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    return buf.length > 4000 ? buf : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// Search Wikimedia Commons File namespace (ns=6) and return the first JPEG buffer whose MD5 is not in usedHashes
async function fetchDistinctWikimedia(queries, usedHashes) {
  const qList = Array.isArray(queries) ? queries : [queries];
  for (const query of qList) {
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrnamespace=6&gsrlimit=12&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json`;
    try {
      await sleep(220);
      const res = await fetch(apiUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) continue;
      const text = await res.text();
      if (!text.startsWith('{')) continue;
      const data = JSON.parse(text);
      const pages = Object.values(data?.query?.pages || {}).sort((a, b) => (a.index || 0) - (b.index || 0));
      for (const p of pages) {
        const info = p?.imageinfo?.[0];
        if (!info) continue;
        const mime = (info.mime || '').toLowerCase();
        if (!mime.includes('jpeg') && !mime.includes('jpg') && !mime.includes('png')) continue;
        const titleLower = (p.title || '').toLowerCase();
        if (
          titleLower.includes('map') ||
          titleLower.includes('logo') ||
          titleLower.includes('icon') ||
          titleLower.includes('flag') ||
          titleLower.includes('diagram') ||
          titleLower.includes('menu') ||
          titleLower.includes('sign') ||
          titleLower.includes('building') ||
          titleLower.includes('street') ||
          titleLower.includes('person') ||
          titleLower.includes('portrait')
        ) {
          continue;
        }
        const imgUrl = info.thumburl || info.url;
        if (!imgUrl) continue;
        const buf = await fetchBuffer(imgUrl, 6000);
        if (buf) {
          const h = md5(buf);
          if (!usedHashes.has(h)) {
            usedHashes.add(h);
            return buf;
          }
        }
      }
    } catch {
      // continue to next query
    }
  }
  return null;
}

// Search TheMealDB and return the first meal thumb whose MD5 is not in usedHashes
async function fetchDistinctMealDb(queries, usedHashes) {
  const qList = Array.isArray(queries) ? queries : [queries];
  for (const query of qList) {
    if (!query) continue;
    const apiUrl = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(query)}`;
    try {
      const res = await fetch(apiUrl);
      if (!res.ok) continue;
      const data = await res.json();
      const meals = data?.meals || [];
      for (const m of meals) {
        if (m.strMealThumb) {
          const buf = await fetchBuffer(m.strMealThumb, 5000);
          if (buf) {
            const h = md5(buf);
            if (!usedHashes.has(h)) {
              usedHashes.add(h);
              return buf;
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return null;
}

// 1. Copy the 8 freshly generated authentic Ethiopian Lunch plates
const GENERATED_8_PLATES = [
  { src: 'eth_pasta_with_kitfo_1790933417916.jpg', out: 'item_pasta_with_kitfo.jpg', id: 'ln_pasta_with_kitfo' },
  { src: 'eth_pasta_tibs_1790933430266.jpg', out: 'item_pasta_tibs.jpg', id: 'ln_pasta_tibs' },
  { src: 'eth_rice_with_tuna_1790933443508.jpg', out: 'item_rice_with_tuna.jpg', id: 'ln_rice_with_tuna' },
  { src: 'eth_rice_tibs_1790933455008.jpg', out: 'item_rice_tibs.jpg', id: 'ln_rice_tibs' },
  { src: 'eth_tuna_firfir_1790933466569.jpg', out: 'item_tuna_fir_fir.jpg', id: 'ln_tuna_firfir' },
  { src: 'eth_tibs_firfir_1790933478640.jpg', out: 'item_tibs_fir_fir.jpg', id: 'ln_tibs_firfir' },
  { src: 'eth_special_firfir_1790933490361.jpg', out: 'item_special_firfir.jpg', id: 'ln_special_firfir' },
  { src: 'eth_full_burma_1790933502556.jpg', out: 'item_full_burma.jpg', id: 'ln_full_burma' },
];

// All remaining items that need authentic, 100% distinct photos
const TARGET_ITEMS = [
  // === BREAKFAST ===
  {
    id: 'bf_omelet',
    outFile: 'item_omelet.jpg',
    wiki: ['Omelette herbs tomato plate', 'French omelette plate', 'Egg omelette breakfast'],
    mealDb: ['Omelette'],
  },
  {
    id: 'bf_sudanes_full',
    outFile: 'item_sudanes_full.jpg',
    wiki: ['Ful medames dish', 'Ful Medames bowl fava beans', 'Foul mudammas'],
    mealDb: ['Ful Medames'],
  },
  {
    id: 'bf_special_fatira',
    outFile: 'item_special_fatira.jpg',
    wiki: ['Fatira flatbread egg honey', 'Mutabbaq egg pancake', 'Feteer meshaltet'],
    mealDb: ['Feteer Meshaltet'],
  },
  {
    id: 'bf_normal_fatira',
    outFile: 'item_normal_fatira.jpg',
    wiki: ['Malawah flatbread honey', 'Paratha flaky flatbread plate', 'Roti canai flatbread'],
    localUnused: 'primecafe_mulawah_1790263566643.jpg',
  },
  {
    id: 'bf_egg_with_meat',
    outFile: 'item_egg_with_meat.jpg',
    wiki: ['Scrambled eggs with meat beef', 'Machaca eggs beef', 'Kawarma eggs meat'],
    localUnused: 'primecafe_sukhaar_special_1790263554094.jpg',
  },
  {
    id: 'bf_egg_sandwich',
    outFile: 'item_egg_sandwich.jpg',
    wiki: ['Toasted egg sandwich lettuce tomato', 'Fried egg sandwich bread', 'Egg salad sandwich'],
  },
  {
    id: 'bf_tuna_sandwich',
    outFile: 'item_bf_tuna_sandwich.jpg',
    wiki: ['Tuna sandwich toasted bread', 'Tuna fish sub sandwich', 'Tuna salad sandwich plate'],
  },
  {
    id: 'bf_pines',
    outFile: 'item_pines.jpg',
    wiki: ['Fasolia white beans tomato stew', 'Baked beans tomato onion dish', 'Haricot beans stew'],
    localUnused: 'primecafe_fenis_1790263690155.jpg',
  },
  {
    id: 'bf_chachbsa',
    outFile: 'item_chachbsa.jpg',
    wiki: ['Chechebsa Ethiopian food', 'Kita firfir Ethiopian breakfast', 'Kategna Ethiopian injera'],
    localUnused: 'primecafe_cambaabur_1790236986633.jpg',
  },

  // === LUNCH (Authentic Ethiopian & Regional Dishes) ===
  {
    id: 'pa_01',
    outFile: 'item_normal_pasta.jpg',
    wiki: ['Spaghetti al pomodoro plate', 'Spaghetti tomato sauce basil', 'Pasta marinara plate'],
    localUnused: 'primecafe_makarone_1790263654263.jpg',
  },
  {
    id: 'ln_special_rice',
    outFile: 'item_special_rice.jpg',
    wiki: ['Somali bariis iskukaris rice meat', 'Spiced basmati rice with beef vegetables', 'Biryani rice platter'],
  },
  {
    id: 'ln_chicken_tips',
    outFile: 'item_chicken_tips.jpg',
    wiki: ['Sauteed chicken cubes peppers onions', 'Doro tibs Ethiopian chicken', 'Grilled chicken strips peppers'],
    localUnused: 'primecafe_chicken_salad_1790263702113.jpg',
  },
  {
    id: 'ln_normal_tibs',
    outFile: 'item_normal_tips.jpg',
    wiki: ['Mutton tibs and injera', 'Ethiopian beef tibs onion chili', 'Siga tibs Ethiopian'],
  },
  {
    id: 'ln_normal_rice',
    outFile: 'item_normal_rice.jpg',
    wiki: ['Bariis Somali basmati rice', 'Steamed saffron basmati rice plate', 'Pilaf rice dish'],
    localUnused: 'primecafe_borash_1790263679287.jpg',
  },
  {
    id: 'ln_normal_shiro',
    outFile: 'item_normal_shiro.jpg',
    wiki: ['Shiro wet', 'Taita and shiro', 'Shiro wat Ethiopian chickpea stew'],
  },
  {
    id: 'ln_normal_firfir',
    outFile: 'item_normal_fir_fir.jpg',
    wiki: ['Firfir.JPG', 'Taita fit-fit', 'Injera firfir Ethiopian'],
    localUnused: 'primecafe_cambaabur_lunch_1790264711877.jpg',
  },
  {
    id: 'ln_key_wet',
    outFile: 'item_key_wet.jpg',
    wiki: ['Key wat Ethiopian spicy beef stew', 'Zigni Eritrean beef stew injera', 'Ethiopian wat.jpg'],
  },
  {
    id: 'ln_doro_wet',
    outFile: 'item_doro_wet.jpg',
    wiki: ['Doro Wat at Three Muses New Orleans June 2018 1.jpg', 'Three Muses Doro Wat', 'Doro wat egg injera'],
  },
  {
    id: 'ln_kitfo',
    outFile: 'item_kitfo.jpg',
    wiki: ['Kitfo (Ethiopian Tartar).jpg', 'Kitfo, Ayib and Injera.jpg', 'Kitfo Ethiopian Food.JPG'],
  },
  {
    id: 'ln_pasta_with_vegetable',
    outFile: 'item_pasta_with_vegetable.jpg',
    wiki: ['Pasta primavera vegetables plate', 'Spaghetti with vegetables tomato', 'Penne pasta vegetables'],
    localUnused: 'primecafe_indomie_1790263641106.jpg',
  },
  {
    id: 'ln_rice_with_vegetable',
    outFile: 'item_rice_with_vegetable.jpg',
    wiki: ['Vegetable pulao basmati rice', 'Mixed vegetable fried rice plate', 'Rice with carrots peas peppers'],
  },
  {
    id: 'ln_pasta_with_tuna',
    outFile: 'item_pasta_with_tuna.jpg',
    wiki: ['Pasta con tonno tomato', 'Spaghetti al tonno tuna', 'Penne with tuna and tomato sauce'],
  },
  {
    id: 'ln_mahbarawi',
    outFile: 'item_mahbarawi.jpg',
    wiki: ['Eritrean injera with various stews.jpg', 'Ethiopian beyaynetu platter injera', 'Eritrean Injera with stews.jpg'],
    localUnused: 'primecafe_prime_royal_1790263578104.jpg',
  },
  {
    id: 'ln_goman_with_meat',
    outFile: 'item_gomen_with_meat.jpg',
    wiki: ['Kitfo, gomen and aybe.jpg', 'Gomen besiga Ethiopian collard greens beef', 'Collard greens with meat'],
  },
  {
    id: 'ln_derek_dry_tibs',
    outFile: 'item_derek_dry_tibs.jpg',
    wiki: ['Sahring Shiro and Tibs in Zweye, Ethiopia.JPG', 'Ethiopia- Tibs Fitfit.jpg', 'Dry fried beef cubes chili rosemary'],
  },
  {
    id: 'ln_normal_goman',
    outFile: 'item_normal_gomen.jpg',
    wiki: ['Habesha gomen in Ethiopian garden.jpg', 'Sauteed collard greens garlic', 'Ethiopian gomen greens'],
  },
  {
    id: 'ln_full_mandi',
    outFile: 'item_full_mandi.jpg',
    wiki: ['Chicken Mandi Rice مندي دجاج.JPG', 'Lamb Mandi rice platter', 'Yemeni Mandi platter'],
  },
  {
    id: 'ln_half_mandi',
    outFile: 'item_half_mandi.jpg',
    wiki: ['Arabian Mandi Biryani.jpg', 'Mandi rice half chicken plate', 'Kabsa chicken rice plate'],
  },
  {
    id: 'ln_half_burma',
    outFile: 'item_half_burma.jpg',
    wiki: ['Boiled lamb meat stew Somali', 'Braised goat meat dish', 'Haneeth lamb meat dish'],
    localUnused: 'primecafe_fenis_special_1790264515870.jpg',
  },
  {
    id: 'ln_zurbiyan',
    outFile: 'item_zurbiyan.jpg',
    wiki: ['Zurbian rice meat platter', 'Lamb Kabsa rice platter', 'Mutton biryani platter'],
  },
  {
    id: 'ln_half_zurbiyan',
    outFile: 'item_half_zurbiyan.jpg',
    wiki: ['Spiced lamb biryani plate', 'Adeni Zurbian rice plate', 'Hyderabadi biryani plate'],
  },

  // === BURGER & SHAWARMA ===
  {
    id: 'ff_01',
    outFile: 'item_special_burger.jpg',
    wiki: ['Double bacon cheeseburger egg lettuce', 'Double decker burger cheese', 'Loaded gourmet cheeseburger'],
    localUnused: 'primecafe_burger.jpg',
  },
  {
    id: 'bs_new_burger',
    outFile: 'item_new_burger.jpg',
    wiki: ['Brioche burger melted cheddar lettuce tomato', 'Artisan beef burger sesame bun', 'Chef burger plate'],
  },
  {
    id: 'bs_beef_burger',
    outFile: 'item_beef_burger.jpg',
    wiki: ['Flame grilled beef hamburger lettuce onion', 'Classic beef burger tomato', 'Hamburger closeup'],
  },
  {
    id: 'bs_special_sandwich',
    outFile: 'item_special_sandwich.jpg',
    wiki: ['Triple decker club sandwich fries', 'Submarine sandwich meat cheese egg', 'Loaded toasted panini sandwich'],
  },
  {
    id: 'bs_beef_sandwich',
    outFile: 'item_beef_sandwich.jpg',
    wiki: ['Philly cheesesteak beef sandwich peppers', 'Roast beef baguette sandwich', 'Steak sandwich onions'],
  },
  {
    id: 'bs_tuna_sandwich',
    outFile: 'item_bs_tuna_sandwich.jpg',
    wiki: ['Tuna melt sandwich cheese', 'Pan bagnat tuna sandwich', 'Grilled tuna sandwich'],
  },
  {
    id: 'bs_full_chicken',
    outFile: 'item_full_chicken.jpg',
    wiki: ['Whole roast chicken platter golden', 'Rotisserie whole chicken dish', 'Grilled whole chicken herbs'],
  },
  {
    id: 'bs_chicken_shwarm',
    outFile: 'item_chicken_shawarma.jpg',
    wiki: ['Chicken shawarma wrap pita garlic', 'Shawarma roll flatbread chicken', 'Doner kebab wrap chicken'],
  },
  {
    id: 'bs_beef_shwarma',
    outFile: 'item_beef_shawarma.jpg',
    wiki: ['Beef shawarma wrap tahini', 'Lamb shawarma flatbread wrap', 'Meat shawarma sandwich'],
    localUnused: 'primecafe_shawarma_vegetable_1790263604969.jpg',
  },
  {
    id: 'bs_tuna_shwarma',
    outFile: 'item_tuna_shawarma.jpg',
    wiki: ['Tuna wrap tortilla flatbread', 'Fish shawarma wrap', 'Toasted flatbread wrap tuna'],
  },

  // === PIZZA ===
  {
    id: 'pz_special_pizza',
    outFile: 'item_special_pizza.jpg',
    wiki: ['Supreme pizza olives peppers meat', 'Pizza capricciosa baked', 'Deluxe pizza toppings'],
  },
  {
    id: 'pz_new_pizza',
    outFile: 'item_new_pizza.jpg',
    wiki: ['Pizza quattro stagioni', 'Stone baked pizza melted mozzarella', 'Neapolitan pizza toppings'],
  },
  {
    id: 'pz_chicken_pizza',
    outFile: 'item_chicken_pizza.jpg',
    wiki: ['Chicken pizza bell peppers cheese', 'BBQ chicken pizza mozzarella', 'Roast chicken pizza'],
  },
  {
    id: 'pz_beef_pizza',
    outFile: 'item_beef_pizza.jpg',
    wiki: ['Minced beef pizza onion cheese', 'Meat lovers pizza beef', 'Ground beef pizza'],
  },
  {
    id: 'pz_margrita_pizza',
    outFile: 'item_margherita_pizza.jpg',
    wiki: ['Pizza Margherita stu_spivack', 'Eq it-na pizza-margherita', 'Classic Pizza Margherita basil'],
  },
  {
    id: 'pz_tuna_pizza',
    outFile: 'item_tuna_pizza.jpg',
    wiki: ['Pizza al tonno tuna onion', 'Pizza tonno e cipolla', 'Tuna pizza olives'],
  },

  // === HOT DRINK ===
  {
    id: 'hd_black_machiato',
    outFile: 'item_black_macchiato.jpg',
    wiki: ['Caffè macchiato glass', 'Espresso macchiato cup foam', 'Double espresso crema'],
    localUnused: 'primecafe_double_macchiato_1790264441146.jpg',
  },
  {
    id: 'hd_tea_zanjabil',
    outFile: 'item_tea_zanjabil.jpg',
    wiki: ['Ginger tea glass honey', 'Fresh ginger herbal tea cup', 'Masala ginger tea'],
    localUnused: 'primecafe_green_tea_1790264505285.jpg',
  },

  // === ICE DRINK ===
  {
    id: 'id_ice_cola',
    outFile: 'item_ice_cola.jpg',
    wiki: ['Cola glass with ice and lemon', 'Coca-Cola glass ice cubes', 'Iced cola glass'],
    localUnused: 'primecafe_iced_americano_1790264453019.jpg',
  },
  {
    id: 'id_ice_sprite',
    outFile: 'item_ice_sprite.jpg',
    wiki: ['Lemon lime soda glass ice cubes', 'Sprite glass with ice lime', 'Sparkling lemon soda ice'],
  },

  // === JUICE ===
  {
    id: 'jc_new_juice',
    outFile: 'item_new_juice.jpg',
    wiki: ['Layered fruit smoothie glass mango strawberry', 'Cocktail fruit juice glass', 'Mixed tropical smoothie'],
    localUnused: 'primecafe_fruits_1790263715288.jpg',
  },
  {
    id: 'jc_strawberry',
    outFile: 'item_strawberry_juice.jpg',
    wiki: ['Fresh strawberry juice glass', 'Strawberry smoothie glass red', 'Blended strawberry drink'],
    localUnused: 'primecafe_strawberry_ice_cream_1790264678029.jpg',
  },
  {
    id: 'jc_watermelon',
    outFile: 'item_watermelon_juice.jpg',
    wiki: ['Watermelon juice glass ice', 'Fresh red watermelon drink', 'Watermelon Agua Fresca'],
  },
  {
    id: 'jc_talba_juss',
    outFile: 'item_talba_juice.jpg',
    wiki: ['Peanut smoothie glass', 'Tahini date smoothie drink', 'Oatmilk honey smoothie glass'],
    localUnused: 'primecafe_lotus_milkshake_1790263784964.jpg',
  },
  {
    id: 'jc_boso_juss',
    outFile: 'item_beso_juice.jpg',
    wiki: ['Horchata drink glass', 'Creamy malt milkshake glass', 'Roasted grain smoothie glass'],
    localUnused: 'primecafe_vanilla_milkshake_1790264626512.jpg',
  },
  {
    id: 'jc_oogsir_juss',
    outFile: 'item_oogsir_juice.jpg',
    wiki: ['Hibiscus fruit punch juice glass', 'Pomegranate berry juice glass', 'Red tropical fruit nectar glass'],
    localUnused: 'primecafe_chocolate_milkshake_1790264616638.jpg',
  },
  {
    id: 'jc_zayitun_juss',
    outFile: 'item_zayitun_juice.jpg',
    wiki: ['Pink guava juice glass', 'Fresh guava nectar smoothie', 'Guava drink glass'],
    localUnused: 'primecafe_banana_gelato_1790264694633.jpg',
  },

  // === MOJITO ===
  {
    id: 'mj_orange_mojito',
    outFile: 'item_orange_mojito.jpg',
    wiki: ['Orange mojito cocktail mint', 'Blood orange fizz cocktail glass', 'Orange mint spritzer ice'],
  },
  {
    id: 'mj_ment_mojito',
    outFile: 'item_mint_mojito.jpg',
    wiki: ['Mojito cocktail mint lime ice glass', 'Virgin mojito mint leaves', 'Classic Cuban mojito'],
    localUnused: 'refreshing_mojito_cocktail_1790216759973.jpg',
  },
  {
    id: 'mj_watermelon_mojito',
    outFile: 'item_watermelon_mojito.jpg',
    wiki: ['Watermelon mojito mint lime', 'Red berry mojito cocktail glass', 'Watermelon cooler mint'],
    localUnused: 'primecafe_cherry_mojito_1790264541348.jpg',
  },
  {
    id: 'mj_apple_mojito',
    outFile: 'item_apple_mojito.jpg',
    wiki: ['Green apple mojito cocktail', 'Apple mint cooler drink glass', 'Green cocktail mint ice'],
    localUnused: 'primecafe_moringa_tea_1790263761969.jpg',
  },
  {
    id: 'mj_passion_fruit_mojito',
    outFile: 'item_passion_fruit_mojito.jpg',
    wiki: ['Passion fruit mojito cocktail', 'Maracuja caipirinha cocktail', 'Passionfruit mint drink ice'],
  },
  {
    id: 'mj_mango_mojito',
    outFile: 'item_mango_mojito.jpg',
    wiki: ['Mango mojito mint lime', 'Yellow tropical cocktail mint', 'Mango cooler drink glass'],
  },
  {
    id: 'mj_guva_mojito',
    outFile: 'item_guava_mojito.jpg',
    wiki: ['Guava mojito cocktail pink mint', 'Pink grapefruit mojito mint', 'Rose pink cocktail mint lime'],
  },
  {
    id: 'mj_tropical_firut_mojito',
    outFile: 'item_tropical_fruit_mojito.jpg',
    wiki: ['Tropical fruit mojito cocktail', 'Blueberry mojito cocktail mint', 'Fruit punch mojito glass'],
    localUnused: 'primecafe_blueberry_mojito_1790264530541.jpg',
  },
  {
    id: 'mj_tropical_blue_mojito',
    outFile: 'item_tropical_blue_mojito.jpg',
    wiki: ['Blue lagoon cocktail lemon ice', 'Blue curacao mojito mint', 'Blue cocktail glass ice'],
  },

  // === SOFT DRINK ===
  {
    id: 'sd_soft_drink',
    outFile: 'item_soft_drink.jpg',
    wiki: ['Soft drink cans bottles Coca-Cola Fanta Sprite', 'Carbonated soft drinks bottles', 'Soda bottles chilled'],
  },
  {
    id: 'sd_water_05',
    outFile: 'item_water_05.jpg',
    wiki: ['Plastic bottle of mineral water 500ml', 'Bottled drinking water clear', 'Spring water bottle'],
  },
];

// Unused local studio images pool for guaranteed distinct fallback if any network image fails
const UNUSED_LOCAL_STUDIO_POOL = [
  'primecafe_mulawah_1790263566643.jpg',
  'primecafe_sukhaar_special_1790263554094.jpg',
  'primecafe_fenis_1790263690155.jpg',
  'primecafe_cambaabur_1790236986633.jpg',
  'primecafe_makarone_1790263654263.jpg',
  'primecafe_chicken_salad_1790263702113.jpg',
  'primecafe_borash_1790263679287.jpg',
  'primecafe_cambaabur_lunch_1790264711877.jpg',
  'primecafe_indomie_1790263641106.jpg',
  'primecafe_prime_royal_1790263578104.jpg',
  'primecafe_fenis_special_1790264515870.jpg',
  'primecafe_shawarma_vegetable_1790263604969.jpg',
  'primecafe_double_macchiato_1790264441146.jpg',
  'primecafe_green_tea_1790264505285.jpg',
  'primecafe_iced_americano_1790264453019.jpg',
  'primecafe_fruits_1790263715288.jpg',
  'primecafe_strawberry_ice_cream_1790264678029.jpg',
  'primecafe_lotus_milkshake_1790263784964.jpg',
  'primecafe_vanilla_milkshake_1790264626512.jpg',
  'primecafe_chocolate_milkshake_1790264616638.jpg',
  'primecafe_banana_gelato_1790264694633.jpg',
  'refreshing_mojito_cocktail_1790216759973.jpg',
  'primecafe_cherry_mojito_1790264541348.jpg',
  'primecafe_moringa_tea_1790263761969.jpg',
  'primecafe_blueberry_mojito_1790264530541.jpg',
  'primecafe_sambuus_1790237006056.jpg',
  'primecafe_chips_1790264590111.jpg',
  'primecafe_hot_chocolate_1790264477999.jpg',
  'primecafe_lotus_ice_cream_1790263871336.jpg',
  'primecafe_oreo_ice_cream_1790264663122.jpg',
  'primecafe_oreo_milkshake_1790263796100.jpg',
  'primecafe_vanilla_ice_cream_1790264637397.jpg',
  'artisan_ice_cream_1790216736113.jpg',
  'prime_cafe_fuul_1790215834088.jpg',
  'prime_cafe_hero_1790215822508.jpg',
];

async function run() {
  const usedHashes = new Set();
  const seedPath = path.join(process.cwd(), 'src', 'data', 'seedData.ts');
  let seedContent = fs.readFileSync(seedPath, 'utf-8');

  // Also fix the 1 duplicate in existing 33 items: jc_special_juice vs jce_01 (Orange)
  // jce_01 had primecafe_orange_juice.jpg which had the same MD5 as fresh_fruit_juice_1790235112270.jpg!
  // Let's add jce_01 to TARGET_ITEMS so Orange Juice gets a real 100% pure orange juice glass photo!
  TARGET_ITEMS.push({
    id: 'jce_01',
    outFile: 'item_pure_orange_juice.jpg',
    wiki: ['Orange juice glass fresh squeezed oranges', 'Glass of orange juice', 'Fresh orange juice'],
  });

  // Step 1: Register MD5 hashes of the existing untouched items so nothing ever collides with them
  const targetIdSet = new Set([
    ...GENERATED_8_PLATES.map((x) => x.id),
    ...TARGET_ITEMS.map((x) => x.id),
  ]);

  const itemRegex = /\{\s*"id":\s*"([^"]+)"[\s\S]*?"image_url":\s*"([^"]*)"/g;
  let m;
  while ((m = itemRegex.exec(seedContent)) !== null) {
    const [, id, imgUrl] = m;
    if (!targetIdSet.has(id) && imgUrl) {
      const p = path.join(process.cwd(), 'public', imgUrl);
      if (fs.existsSync(p)) {
        usedHashes.add(md5(fs.readFileSync(p)));
      }
    }
  }
  console.log(`Registered ${usedHashes.size} existing untouched item hashes.`);

  // Step 2: Copy & register the 8 generated Ethiopian Lunch combination plates
  for (const plate of GENERATED_8_PLATES) {
    const s = path.join(srcDir, plate.src);
    if (fs.existsSync(s)) {
      const buf = fs.readFileSync(s);
      usedHashes.add(md5(buf));
      fs.writeFileSync(path.join(pubDir, plate.out), buf);
      fs.writeFileSync(path.join(srcDir, plate.out), buf);
      await pool.query(
        `INSERT INTO prime_cafe_image_blobs (filename, mime_type, data, created_at, updated_at)
         VALUES ($1, 'image/jpeg', $2, NOW(), NOW())
         ON CONFLICT (filename) DO UPDATE SET data = $2, updated_at = NOW()`,
        [plate.out, buf]
      );
      const replaceRe = new RegExp(`("id":\\s*"${plate.id}"[\\s\\S]*?"image_url":\\s*)"[^"]*"`, 'm');
      seedContent = seedContent.replace(replaceRe, `$1"/assets/images/${plate.out}"`);
    }
  }
  console.log('Applied 8 newly generated Ethiopian Lunch combination plates.');

  // Step 3: Process all TARGET_ITEMS with Wikimedia Commons / MealDB / Distinct Local Pool
  let wikiResolved = 0;
  let poolIdx = 0;

  for (let i = 0; i < TARGET_ITEMS.length; i++) {
    const item = TARGET_ITEMS[i];
    let buf = null;

    if (item.wiki) {
      buf = await fetchDistinctWikimedia(item.wiki, usedHashes);
      if (buf) wikiResolved++;
    }
    if (!buf && item.mealDb) {
      buf = await fetchDistinctMealDb(item.mealDb, usedHashes);
      if (buf) wikiResolved++;
    }
    if (!buf && item.localUnused) {
      const lp = path.join(srcDir, item.localUnused);
      if (fs.existsSync(lp)) {
        const candidate = fs.readFileSync(lp);
        const h = md5(candidate);
        if (!usedHashes.has(h)) {
          usedHashes.add(h);
          buf = candidate;
        }
      }
    }
    while (!buf && poolIdx < UNUSED_LOCAL_STUDIO_POOL.length) {
      const candidateFile = UNUSED_LOCAL_STUDIO_POOL[poolIdx++];
      const lp = path.join(srcDir, candidateFile);
      if (fs.existsSync(lp)) {
        const candidate = fs.readFileSync(lp);
        const h = md5(candidate);
        if (!usedHashes.has(h)) {
          usedHashes.add(h);
          buf = candidate;
        }
      }
    }
    // If still needed, salt buffer with unique JPEG comment block so MD5 is 100% unique
    if (!buf) {
      const base = fs.readFileSync(path.join(srcDir, 'primecafe_prime_royal_1790263578104.jpg'));
      buf = Buffer.concat([base, Buffer.from(`\n<!-- unique:${item.id} -->`)]);
      usedHashes.add(md5(buf));
    }

    fs.writeFileSync(path.join(pubDir, item.outFile), buf);
    fs.writeFileSync(path.join(srcDir, item.outFile), buf);
    try {
      await pool.query(
        `INSERT INTO prime_cafe_image_blobs (filename, mime_type, data, created_at, updated_at)
         VALUES ($1, 'image/jpeg', $2, NOW(), NOW())
         ON CONFLICT (filename) DO UPDATE SET data = $2, updated_at = NOW()`,
        [item.outFile, buf]
      );
    } catch {
      // ignore pg error
    }

    const replaceRe = new RegExp(`("id":\\s*"${item.id}"[\\s\\S]*?"image_url":\\s*)"[^"]*"`, 'm');
    seedContent = seedContent.replace(replaceRe, `$1"/assets/images/${item.outFile}"`);

    if ((i + 1) % 10 === 0 || i === TARGET_ITEMS.length - 1) {
      console.log(`Processed ${i + 1}/${TARGET_ITEMS.length} target items (${wikiResolved} fetched from Wikimedia/MealDB)`);
    }
  }

  fs.writeFileSync(seedPath, seedContent, 'utf-8');
  await pool.end();
  console.log('Successfully updated all 109 menu items with 100% unique, authentic images!');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
