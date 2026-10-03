import { MenuItem } from '../types/index.ts';

export interface EnhancementOptions {
  cropMode: '4:3-studio' | '4:3-alt-angle' | 'original';
  applyLightingAndClarity: boolean;
  applyWarmthAndVibrancy: boolean;
  applyVignette: boolean;
}

// Exact mapping of the user's 75 carefully named image files to menu item IDs
export const EXACT_FILENAME_TO_ITEM_IDS: Record<string, string[]> = {
  // Breakfast (9 files)
  'omelet': ['bf_omelet'],
  'sudanes full': ['bf_sudanes_full'],
  'sudanese full': ['bf_sudanes_full'],
  'sudanese fuul': ['bf_sudanes_full'],
  'special fatira': ['bf_special_fatira'],
  'normal fatira': ['bf_normal_fatira'],
  'egg with meat': ['bf_egg_with_meat'],
  'egg sandwich': ['bf_egg_sandwich'],
  'tuna sandwich': ['bf_tuna_sandwich'],
  'pines': ['bf_pines'],
  'chachbsa': ['bf_chachbsa'],
  'chechebsa': ['bf_chachbsa'],

  // Lunch (30 files -> 31 items)
  'normal pasta': ['pa_01'],
  'special rice': ['ln_special_rice'],
  'special firfir': ['ln_special_firfir'],
  'special fir fir': ['ln_special_firfir'],
  'chicken tips': ['ln_chicken_tips'],
  'chicken tibs': ['ln_chicken_tips'],
  'normal tips': ['ln_normal_tibs'],
  'normal tibs': ['ln_normal_tibs'],
  'normal rice': ['ln_normal_rice'],
  'normal shiro': ['ln_normal_shiro'],
  'normal fir fir': ['ln_normal_firfir'],
  'normal firfir': ['ln_normal_firfir'],
  'key wet': ['ln_key_wet'],
  'pasta with kitfo': ['ln_pasta_with_kitfo'],
  'doro wet': ['ln_doro_wet'],
  'kitfo': ['ln_kitfo'],
  'pasta with vegitable': ['ln_pasta_with_vegetable'],
  'pasta with vegetable': ['ln_pasta_with_vegetable'],
  'rice with vegitable': ['ln_rice_with_vegetable'],
  'rice with vegetable': ['ln_rice_with_vegetable'],
  'pasta with tuna': ['ln_pasta_with_tuna'],
  'mahbarawi': ['ln_mahbarawi'],
  'pasta tibs': ['ln_pasta_tibs'],
  'pasta tips': ['ln_pasta_tibs'],
  'rice with tuna and rice tibs': ['ln_rice_with_tuna', 'ln_rice_tibs'],
  'rice with tuna': ['ln_rice_with_tuna'],
  'rice tibs': ['ln_rice_tibs'],
  'rice tips': ['ln_rice_tibs'],
  'tuna fir fir': ['ln_tuna_firfir'],
  'tuna firfir': ['ln_tuna_firfir'],
  'tibs fir fir': ['ln_tibs_firfir'],
  'tibs firfir': ['ln_tibs_firfir'],
  'tips fir fir': ['ln_tibs_firfir'],
  'gomen with meat': ['ln_goman_with_meat'],
  'goman with meat': ['ln_goman_with_meat'],
  'derek or dty tibs': ['ln_derek_dry_tibs'],
  'derek or dry tibs': ['ln_derek_dry_tibs'],
  'derek dry tibs': ['ln_derek_dry_tibs'],
  'derek tibs': ['ln_derek_dry_tibs'],
  'normal gomen': ['ln_normal_goman'],
  'normal goman': ['ln_normal_goman'],
  'full mandi': ['ln_full_mandi'],
  'half mandi': ['ln_half_mandi'],
  'full burma': ['ln_full_burma'],
  'half burma': ['ln_half_burma'],
  'zurbiyan': ['ln_zurbiyan'],
  'half zurbiyan': ['ln_half_zurbiyan'],

  // Burger & Shawarma (10 files)
  'special burger': ['ff_01'],
  'new burger': ['bs_new_burger'],
  'beef burger': ['bs_beef_burger'],
  'cheese burger': ['bs_chiss_burger'],
  'special sandwich': ['bs_special_sandwich'],
  'beef sandwich': ['bs_beef_sandwich'],
  'tuna sandwich 2': ['bs_tuna_sandwich'],
  'tuna sandwich (2)': ['bs_tuna_sandwich'],
  'full chicken': ['bs_full_chicken'],
  'chicken shawarma': ['bs_chicken_shwarm'],
  'beerf shawarma': ['bs_beef_shwarma'],
  'beef shawarma': ['bs_beef_shwarma'],
  'tuna shawarmam': ['bs_tuna_shwarma'],
  'tuna shawarma': ['bs_tuna_shwarma'],

  // Pizza (6 files)
  'special pizza': ['pz_special_pizza'],
  'new pizza': ['pz_new_pizza'],
  'chicken pizza': ['pz_chicken_pizza'],
  'beef pizza': ['pz_beef_pizza'],
  'margherita pizza': ['pz_margrita_pizza'],
  'margrita pizza': ['pz_margrita_pizza'],
  'tuna pizza': ['pz_tuna_pizza'],

  // Hot Drink (2 files)
  'black macchiato': ['hd_black_machiato'],
  'black machiato': ['hd_black_machiato'],
  'tea zanjabil': ['hd_tea_zanjabil'],

  // Ice Drink (2 files)
  'ice cola': ['id_ice_cola'],
  'ice sprite': ['id_ice_sprite'],

  // Juice (7 files)
  'new juice': ['jc_new_juice'],
  'strawberry': ['jc_strawberry'],
  'strawberry juice': ['jc_strawberry'],
  'watermelon': ['jc_watermelon'],
  'watermelon juice': ['jc_watermelon'],
  'talba juice': ['jc_talba_juss'],
  'talba juss': ['jc_talba_juss'],
  'beso juice': ['jc_boso_juss'],
  'boso juice': ['jc_boso_juss'],
  'oogsir juice': ['jc_oogsir_juss'],
  'zayitun juice': ['jc_zayitun_juss'],

  // Mojito (8 files)
  'orange mojito': ['mj_orange_mojito'],
  'mint mojito': ['mj_ment_mojito'],
  'ment mojito': ['mj_ment_mojito'],
  'watermelon mojito': ['mj_watermelon_mojito'],
  'apple mojito': ['mj_apple_mojito'],
  'passion frfiut mojito': ['mj_passion_fruit_mojito'],
  'passion fruit mojito': ['mj_passion_fruit_mojito'],
  'mango mojiito': ['mj_mango_mojito'],
  'mango mojito': ['mj_mango_mojito'],
  'guava mojito': ['mj_guva_mojito'],
  'guva mojito': ['mj_guva_mojito'],
  'tropical friut mojito': ['mj_tropical_firut_mojito'],
  'tropical fruit mojito': ['mj_tropical_firut_mojito'],
  'tropical blue mojito': ['mj_tropical_blue_mojito'],

  // Soft Drink (2 files)
  'soft drink': ['sd_soft_drink'],
  'water 0 5': ['sd_water_05'],
  'water 0.5': ['sd_water_05'],
  'water': ['sd_water_05'],
};

export function normalizeFileKey(filename: string): string {
  const withoutExt = filename.replace(/\.[^/.]+$/, '').trim().toLowerCase();
  return withoutExt
    .replace(/[()]/g, ' ')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchFilenameToMenuItems(filename: string, items: MenuItem[]): MenuItem[] {
  const rawBase = filename.replace(/\.[^/.]+$/, '').trim().toLowerCase();
  const normKey = normalizeFileKey(filename);
  const dotSpaces = normKey.replace(/\./g, ' ').replace(/\s+/g, ' ').trim();

  const mappedIds =
    EXACT_FILENAME_TO_ITEM_IDS[rawBase] ||
    EXACT_FILENAME_TO_ITEM_IDS[normKey] ||
    EXACT_FILENAME_TO_ITEM_IDS[dotSpaces];

  if (mappedIds && mappedIds.length > 0) {
    const matched = mappedIds
      .map((id) => items.find((i) => i.id === id))
      .filter((i): i is MenuItem => Boolean(i));
    if (matched.length > 0) return matched;
  }

  // Fallback: match by normalized item name
  const cleanAlnum = normKey.replace(/[^a-z0-9]/g, '');
  const direct = items.find(
    (i) => i.name.toLowerCase().replace(/[^a-z0-9]/g, '') === cleanAlnum
  );
  if (direct) return [direct];

  const partial = items.find((i) => {
    const itemNorm = i.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    return itemNorm.includes(cleanAlnum) || cleanAlnum.includes(itemNorm);
  });
  return partial ? [partial] : [];
}

/**
 * Enhances an original food photo on an HTML5 Canvas WITHOUT altering ingredients or food structure.
 * Applies:
 * - High-definition 1200x900 (4:3) smart studio crop (or distinct framing crop for 2nd shared item so no duplicate image exists)
 * - Studio contrast, lighting warmth, and color vibrancy
 * - Subtle studio vignette & edge clarity enhancement
 */
export async function enhanceOriginalDishPhoto(
  file: File,
  options: EnhancementOptions = {
    cropMode: '4:3-studio',
    applyLightingAndClarity: true,
    applyWarmthAndVibrancy: true,
    applyVignette: true,
  }
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Failed to decode image'));
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(reader.result as string);
          return;
        }

        let targetW = 1200;
        let targetH = 900;
        let sx = 0;
        let sy = 0;
        let sw = img.width;
        let sh = img.height;

        if (options.cropMode === 'original') {
          const maxDim = 1400;
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          targetW = Math.round(img.width * scale);
          targetH = Math.round(img.height * scale);
        } else {
          // 4:3 target aspect ratio
          const targetRatio = 4 / 3;
          const srcRatio = img.width / img.height;

          if (srcRatio > targetRatio) {
            sh = img.height;
            sw = Math.round(img.height * targetRatio);
            sx = Math.round((img.width - sw) / 2);
            sy = 0;
          } else {
            sw = img.width;
            sh = Math.round(img.width / targetRatio);
            sx = 0;
            sy = Math.round((img.height - sh) / 2);
          }

          // Slight 4% inward trim to remove messy table edges and frame the plate cleanly
          const zoomFactor = options.cropMode === '4:3-alt-angle' ? 0.88 : 0.96;
          const trimW = Math.round(sw * zoomFactor);
          const trimH = Math.round(sh * zoomFactor);
          const offsetX =
            options.cropMode === '4:3-alt-angle'
              ? Math.round((sw - trimW) * 0.65)
              : Math.round((sw - trimW) * 0.5);
          const offsetY =
            options.cropMode === '4:3-alt-angle'
              ? Math.round((sh - trimH) * 0.35)
              : Math.round((sh - trimH) * 0.5);

          sx += offsetX;
          sy += offsetY;
          sw = trimW;
          sh = trimH;
        }

        canvas.width = targetW;
        canvas.height = targetH;

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Build non-destructive photographic filter string (zero ingredient changes!)
        const filters: string[] = [];
        if (options.applyLightingAndClarity) {
          filters.push('contrast(1.08)', 'brightness(1.03)');
        }
        if (options.applyWarmthAndVibrancy) {
          filters.push('saturate(1.15)');
        }
        ctx.filter = filters.length > 0 ? filters.join(' ') : 'none';

        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH);
        ctx.filter = 'none';

        // Subtle warm golden-hour studio highlight overlay (3% opacity)
        if (options.applyWarmthAndVibrancy) {
          ctx.fillStyle = 'rgba(255, 215, 140, 0.03)';
          ctx.fillRect(0, 0, targetW, targetH);
        }

        // Subtle studio edge vignette to draw focus to the dish in the center
        if (options.applyVignette) {
          const grad = ctx.createRadialGradient(
            targetW / 2,
            targetH / 2,
            Math.min(targetW, targetH) * 0.36,
            targetW / 2,
            targetH / 2,
            Math.max(targetW, targetH) * 0.72
          );
          grad.addColorStop(0, 'rgba(0,0,0,0)');
          grad.addColorStop(1, 'rgba(0,0,0,0.18)');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, targetW, targetH);
        }

        resolve(canvas.toDataURL('image/jpeg', 0.92));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}
