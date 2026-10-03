import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const srcDir = path.join(process.cwd(), 'src', 'assets', 'images');
const pubDir = path.join(process.cwd(), 'public', 'assets', 'images');

const FIX_MAPPINGS = [
  { src: 'fix_normal_gomen_1790935534399.jpg', out: 'item_normal_gomen.jpg' },
  { src: 'fix_chechebsa_1790935554215.jpg', out: 'item_chachbsa.jpg' },
  { src: 'fix_chicken_tibs_1790935568471.jpg', out: 'item_chicken_tips.jpg' },
  { src: 'fix_special_burger_1790935582070.jpg', out: 'item_special_burger.jpg' },
  { src: 'fix_half_zurbiyan_1790935610236.jpg', out: 'item_half_zurbiyan.jpg' },
  { src: 'fix_tuna_shawarma_1790935625710.jpg', out: 'item_tuna_shawarma.jpg' },
  { src: 'fix_ice_sprite_1790935638399.jpg', out: 'item_ice_sprite.jpg' },
  { src: 'fix_talba_juice_1790935656735.jpg', out: 'item_talba_juice.jpg' },
  { src: 'fix_oogsir_juice_1790935692640.jpg', out: 'item_oogsir_juice.jpg' },
  { src: 'fix_orange_mojito_1790935704315.jpg', out: 'item_orange_mojito.jpg' },
  { src: 'fix_passion_fruit_mojito_1790935716457.jpg', out: 'item_passion_fruit_mojito.jpg' },
  { src: 'fix_guava_mojito_1790935728385.jpg', out: 'item_guava_mojito.jpg' },
  { src: 'fix_watermelon_mojito_1790935741081.jpg', out: 'item_watermelon_mojito.jpg' },
  { src: 'fix_water_05_1790935752694.jpg', out: 'item_water_05.jpg' },
  { src: 'fix_normal_shiro_1790935789367.jpg', out: 'item_normal_shiro.jpg' },
  { src: 'fix_normal_firfir_1790935804938.jpg', out: 'item_normal_fir_fir.jpg' },
  { src: 'fix_key_wet_1790935820620.jpg', out: 'item_key_wet.jpg' },
  { src: 'fix_doro_wet_1790935834679.jpg', out: 'item_doro_wet.jpg' },
  { src: 'fix_kitfo_1790935857250.jpg', out: 'item_kitfo.jpg' },
  { src: 'fix_gomen_with_meat_1790935873715.jpg', out: 'item_gomen_with_meat.jpg' },
  { src: 'fix_derek_dry_tibs_1790935884472.jpg', out: 'item_derek_dry_tibs.jpg' },
  { src: 'fix_normal_tibs_1790935896543.jpg', out: 'item_normal_tips.jpg' },
  { src: 'fix_mahbarawi_1790935919487.jpg', out: 'item_mahbarawi.jpg' },
  { src: 'fix_half_burma_1790935932162.jpg', out: 'item_half_burma.jpg' },
  { src: 'fix_special_fatira_1790936002639.jpg', out: 'item_special_fatira.jpg' },
  { src: 'fix_normal_fatira_1790936015470.jpg', out: 'item_normal_fatira.jpg' },
];

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });

  let applied = 0;
  for (const m of FIX_MAPPINGS) {
    const s = path.join(srcDir, m.src);
    if (fs.existsSync(s)) {
      const buf = fs.readFileSync(s);
      fs.writeFileSync(path.join(pubDir, m.out), buf);
      fs.writeFileSync(path.join(srcDir, m.out), buf);
      try {
        await pool.query(
          `INSERT INTO prime_cafe_image_blobs (filename, mime_type, data, created_at, updated_at)
           VALUES ($1, 'image/jpeg', $2, NOW(), NOW())
           ON CONFLICT (filename) DO UPDATE SET data = $2, updated_at = NOW()`,
          [m.out, buf]
        );
      } catch {
        // ignore pg error
      }
      applied++;
    }
  }

  await pool.end();
  console.log(`Applied ${applied}/${FIX_MAPPINGS.length} authentic Ethiopian & East African dish and drink fixes.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
