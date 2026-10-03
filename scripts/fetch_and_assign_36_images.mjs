import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const pubDir = path.join(process.cwd(), 'public', 'assets', 'images');
const distDir = path.join(process.cwd(), 'dist', 'assets', 'images');

if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });
if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

const USER_AGENT = 'FourSeasonRestaurantApp/1.0 (contact@fourseason.example.com; ImageImporter)';

function md5(buf) {
  return crypto.createHash('md5').update(buf).digest('hex');
}

async function fetchBuffer(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': USER_AGENT },
    });
    if (!res.ok) return null;
    const ct = (res.headers.get('content-type') || '').toLowerCase();
    if (!ct.includes('image')) return null;
    const ab = await res.arrayBuffer();
    const buf = Buffer.from(ab);
    return buf.length > 3000 ? buf : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function searchWikimedia(queries, usedHashes) {
  const qList = Array.isArray(queries) ? queries : [queries];
  for (const query of qList) {
    const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(
      query
    )}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|mime&iiurlwidth=800&format=json`;
    try {
      await new Promise((r) => setTimeout(r, 150));
      const res = await fetch(apiUrl, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) continue;
      const data = await res.json();
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
          titleLower.includes('building') ||
          titleLower.includes('street') ||
          titleLower.includes('person') ||
          titleLower.includes('portrait')
        ) {
          continue;
        }
        const imgUrl = info.thumburl || info.url;
        if (!imgUrl) continue;
        const buf = await fetchBuffer(imgUrl, 8000);
        if (buf) {
          const h = md5(buf);
          if (!usedHashes.has(h)) {
            usedHashes.add(h);
            return buf;
          }
        }
      }
    } catch {
      // try next query
    }
  }
  return null;
}

// Search Wikipedia page image
async function searchWikipedia(titles, usedHashes) {
  const tList = Array.isArray(titles) ? titles : [titles];
  for (const title of tList) {
    try {
      const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`;
      const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
      if (!res.ok) continue;
      const data = await res.json();
      const imgUrl = data.thumbnail?.source || data.originalimage?.source;
      if (imgUrl) {
        const buf = await fetchBuffer(imgUrl, 8000);
        if (buf) {
          const h = md5(buf);
          if (!usedHashes.has(h)) {
            usedHashes.add(h);
            return buf;
          }
        }
      }
    } catch {
      // try next
    }
  }
  return null;
}

// Search TheMealDB
async function searchMealDb(terms, usedHashes) {
  const list = Array.isArray(terms) ? terms : [terms];
  for (const t of list) {
    try {
      const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(t)}`;
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      const meals = data?.meals || [];
      for (const m of meals) {
        if (m.strMealThumb) {
          const buf = await fetchBuffer(m.strMealThumb, 8000);
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
      // try next
    }
  }
  return null;
}

const ITEMS_CONFIG = [
  {
    name: 'Sudanese Fuul',
    file: 'sudanes full.jpg',
    wiki: ['Ful medames plate', 'Sudanese ful mudammas', 'Ful Medames dish'],
    wp: ['Ful_medames'],
    meal: ['Ful Medames']
  },
  {
    name: 'Egg with meat',
    file: 'egg with meat.jpg',
    wiki: ['Scrambled eggs with minced meat beef', 'Machaca eggs plate', 'Minced beef scrambled eggs'],
    wp: ['Machaca', 'Huevos_con_machaca']
  },
  {
    name: 'Pines',
    file: 'pines.jpg',
    wiki: ['Fasolia white beans tomato stew plate', 'Baked beans tomato sauce dish', 'White bean stew tomato'],
    wp: ['Fasolia', 'Baked_beans']
  },
  {
    name: 'Chechebsa',
    file: 'chachbsa.jpg',
    wiki: ['Chechebsa Ethiopian food plate', 'Kita firfir Ethiopian breakfast', 'Fit-fit dish'],
    wp: ['Chechebsa', 'Fit-fit']
  },
  {
    name: 'Special Pasta',
    file: 'special pasta.jpg',
    wiki: ['Spaghetti bolognese meat sauce plate', 'Pasta bolognese sauce parmesan', 'Spaghetti alla bolognese plate'],
    wp: ['Bolognese_sauce', 'Spaghetti_alla_bolognese'],
    meal: ['Bolognese', 'Spaghetti']
  },
  {
    name: 'Special Fir Fir',
    file: 'special firfir.jpg',
    wiki: ['Injera fit-fit Ethiopian meat', 'Tibs firfir dish plate', 'Firfir Ethiopian food'],
    wp: ['Fit-fit']
  },
  {
    name: 'Chicken Tibs',
    file: 'chicken tibs.jpg',
    wiki: ['Doro tibs Ethiopian chicken plate', 'Sauteed chicken peppers onions dish', 'Chicken fajita platter'],
    wp: ['Tibs_(food)']
  },
  {
    name: 'Rice with Vegetable',
    file: 'rice with vegitable.jpg',
    wiki: ['Vegetable fried rice plate', 'Vegetable pulao basmati dish', 'Rice with mixed vegetables carrots peas'],
    wp: ['Fried_rice', 'Pilaf']
  },
  {
    name: 'Pasta with Tuna',
    file: 'pasta with tuna.jpg',
    wiki: ['Pasta con tonno tomato plate', 'Spaghetti al tonno tuna plate', 'Pasta with tuna and tomato sauce'],
    wp: ['Pasta_con_i_peperoni_cruschi']
  },
  {
    name: 'Half Mandi',
    file: 'half mandi.jpg',
    wiki: ['Chicken Mandi rice plate', 'Arabian Mandi chicken platter', 'Yemeni Mandi chicken rice'],
    wp: ['Mandi_(food)']
  },
  {
    name: 'Zurbiyan',
    file: 'zurbiyan.jpg',
    wiki: ['Adeni Zurbian rice meat platter', 'Lamb Zurbian rice platter', 'Mutton biryani rice platter'],
    wp: ['Zurbian', 'Biryani'],
    meal: ['Biryani']
  },
  {
    name: 'Half Zurbiyan',
    file: 'half zurbiyan.jpg',
    wiki: ['Spiced chicken biryani plate', 'Chicken biryani rice dish plate', 'Hyderabadi biryani plate'],
    wp: ['Biryani']
  },
  {
    name: 'New Burger',
    file: 'new burger.jpg',
    wiki: ['Gourmet brioche bacon cheeseburger plate', 'Artisan beef burger cheddar lettuce tomato', 'Cheeseburger sesame bun'],
    wp: ['Cheeseburger', 'Hamburger'],
    meal: ['Burger']
  },
  {
    name: 'Special Sandwich',
    file: 'special sandwich.jpg',
    wiki: ['Triple decker club sandwich fries plate', 'Submarine sandwich cold cuts cheese', 'Club sandwich plate toasted'],
    wp: ['Club_sandwich', 'Submarine_sandwich']
  },
  {
    name: 'Beef Sandwich',
    file: 'beef sandwich.jpg',
    wiki: ['Philly cheesesteak sandwich peppers onions', 'Roast beef baguette sub sandwich', 'Steak sandwich caramelized onions'],
    wp: ['Cheesesteak', 'Roast_beef_sandwich']
  },
  {
    name: 'Full Chicken',
    file: 'full chicken.jpg',
    wiki: ['Whole roasted chicken herbs platter', 'Rotisserie whole chicken golden brown plate', 'Roast whole chicken platter'],
    wp: ['Roast_chicken'],
    meal: ['Roast Chicken', 'Chicken']
  },
  {
    name: 'Chicken Shawarma',
    file: 'chicken shawarma.jpg',
    wiki: ['Chicken shawarma wrap sliced plate', 'Chicken shawarma pita sandwich plate', 'Shawarma wrap chicken'],
    wp: ['Shawarma']
  },
  {
    name: 'Beef Shawarma',
    file: 'beerf shawarma.jpg',
    wiki: ['Beef shawarma wrap plate', 'Doner kebab beef pita sandwich plate', 'Beef shawarma pita wrap'],
    wp: ['Shawarma', 'Doner_kebab']
  },
  {
    name: 'Special Pizza',
    file: 'special pizza.jpg',
    wiki: ['Supreme deluxe pizza peppers mushrooms pepperoni', 'Loaded pizza olives bell peppers pepperoni', 'Pizza supreme whole'],
    wp: ['Pizza']
  },
  {
    name: 'New Pizza',
    file: 'new pizza.jpg',
    wiki: ['Pizza quattro formaggi cheese', 'Four cheese pizza mozzarella gorgonzola', 'Artisan gourmet pizza arugula prosciutto'],
    wp: ['Pizza_quattro_formaggi']
  },
  {
    name: 'Chicken Pizza',
    file: 'chicken pizza.jpg',
    wiki: ['BBQ chicken pizza red onions cilantro', 'Chicken pizza bell peppers mozzarella', 'Grilled chicken pizza'],
    wp: ['Pizza']
  },
  {
    name: 'Beef Pizza',
    file: 'beef pizza.jpg',
    wiki: ['Meat lovers pizza beef pepperoni sausage', 'Beef pepperoni pizza slice', 'Minced meat pizza cheese'],
    wp: ['Pizza']
  },
  {
    name: 'Margherita Pizza',
    file: 'margherita pizza.jpg',
    wiki: ['Pizza Margherita fresh basil mozzarella tomato', 'Classic Neapolitan pizza Margherita', 'Pizza Margherita whole'],
    wp: ['Pizza_Margherita']
  },
  {
    name: 'Tuna Pizza',
    file: 'tuna pizza.jpg',
    wiki: ['Pizza al tonno e cipolla tuna red onion', 'Tuna pizza red onion mozzarella', 'Pizza al tonno'],
    wp: ['Pizza']
  },
  {
    name: 'Tea Zanjabil',
    file: 'Tea Zanjabil.jpg',
    wiki: ['Hot ginger tea cup lemon honey', 'Spiced ginger tea glass', 'Adrak chai ginger tea cup'],
    wp: ['Ginger_tea']
  },
  {
    name: 'Strawberry',
    file: 'strawberry.jpg',
    wiki: ['Fresh strawberry smoothie glass berries', 'Strawberry juice glass fresh strawberries', 'Strawberry drink glass'],
    wp: ['Strawberry_juice', 'Smoothie']
  },
  {
    name: 'Orange',
    file: 'orange.jpg',
    wiki: ['Freshly squeezed orange juice glass sliced orange', 'Orange juice glass pitcher', 'Fresh orange juice glass'],
    wp: ['Orange_juice']
  },
  {
    name: 'Beso Juice',
    file: 'beso juice.jpg',
    wiki: ['Horchata glass cinnamon ice', 'Barley roasted drink smoothie glass', 'Grain smoothie shake glass'],
    wp: ['Horchata', 'Barley_water']
  },
  {
    name: 'Zayitun Juice',
    file: 'Zayitun Juice.jpg',
    wiki: ['Pink guava juice glass fresh', 'Guava drink glass ice', 'Guava nectar juice glass'],
    wp: ['Guava_juice']
  },
  {
    name: 'Mint Mojito',
    file: 'mint mojito.jpg',
    wiki: ['Mint mojito cocktail glass lime mint ice', 'Virgin mojito fresh mint leaves glass', 'Classic mint mojito glass lime'],
    wp: ['Mojito']
  },
  {
    name: 'Apple Mojito',
    file: 'apple mojito.jpg',
    wiki: ['Apple mojito cocktail glass mint lime apple slice', 'Green apple cocktail glass ice mint', 'Apple mint drink cocktail glass'],
    wp: ['Apple_cider']
  },
  {
    name: 'Mango Mojito',
    file: 'mango mojiito.jpg',
    wiki: ['Mango mojito cocktail glass mint lime', 'Mango cocktail glass fresh mint ice', 'Mango virgin mojito glass'],
    wp: ['Mango_smoothie']
  },
  {
    name: 'Tropical Blue Mojito',
    file: 'tropical blue mojito.jpg',
    wiki: ['Blue curacao cocktail glass lime mint ice', 'Blue lagoon cocktail glass mint', 'Blue tropical drink glass lime'],
    wp: ['Blue_Hawaii_(cocktail)', 'Blue_Lagoon_(cocktail)']
  },
  {
    name: 'Tropical Fruit Mojito',
    file: 'tropical friut mojito.jpg',
    wiki: ['Passion fruit mojito cocktail glass mint', 'Tropical fruit cocktail glass mint lime ice', 'Exotic fruit cocktail glass mint'],
    wp: ['Cocktail']
  },
  {
    name: 'Soft Drink',
    file: 'soft drink.jpg',
    wiki: ['Cold cola soda glass ice cubes lemon', 'Glass of soda with ice cubes bubbles', 'Cola soft drink glass ice'],
    wp: ['Cola', 'Soft_drink']
  },
  {
    name: 'Water 0.5',
    file: 'water 0.5.jpg',
    wiki: ['Bottle of mineral water glass table', 'Plastic mineral water bottle 500ml', 'Bottled pure spring water'],
    wp: ['Bottled_water', 'Mineral_water']
  }
];

async function main() {
  const usedHashes = new Set();

  // Read hashes of existing images so we don't repeat
  for (const f of fs.readdirSync(pubDir)) {
    try {
      const b = fs.readFileSync(path.join(pubDir, f));
      usedHashes.add(md5(b));
    } catch {}
  }

  console.log(`Starting fetch for ${ITEMS_CONFIG.length} items...`);

  for (let idx = 0; idx < ITEMS_CONFIG.length; idx++) {
    const item = ITEMS_CONFIG[idx];
    console.log(`[${idx + 1}/${ITEMS_CONFIG.length}] Fetching image for "${item.name}" -> "${item.file}"...`);
    
    let buf = null;

    // 1. Try Wikimedia Commons
    if (item.wiki) {
      buf = await searchWikimedia(item.wiki, usedHashes);
    }

    // 2. Try Wikipedia Summary
    if (!buf && item.wp) {
      buf = await searchWikipedia(item.wp, usedHashes);
    }

    // 3. Try MealDB
    if (!buf && item.meal) {
      buf = await searchMealDb(item.meal, usedHashes);
    }

    if (!buf) {
      // General fallback queries
      console.warn(`Fallback query for ${item.name}...`);
      buf = await searchWikimedia([`${item.name} food`, `${item.name} dish`, `${item.name} drink`], usedHashes);
    }

    if (buf) {
      const pubPath = path.join(pubDir, item.file);
      const distPath = path.join(distDir, item.file);
      fs.writeFileSync(pubPath, buf);
      fs.writeFileSync(distPath, buf);
      console.log(`Saved "${item.file}" (${Math.round(buf.length / 1024)} KB)`);
    } else {
      console.error(`FAILED to find image for "${item.name}"`);
    }
  }

  console.log('Finished fetching images.');
}

main().catch(console.error);
