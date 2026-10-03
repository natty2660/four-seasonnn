import fs from 'fs';
import path from 'path';

const svgPath = path.join(process.cwd(), 'public', 'assets', 'images', 'four_season_logo_exact.svg');
let svg = fs.readFileSync(svgPath, 'utf-8');

// 1. Add gold backdrop gradients in <defs>
const newDefs = `
      <radialGradient id="luxuryGoldBackdrop" cx="50%" cy="50%" r="75%">
        <stop offset="0%" stop-color="#FFF9DB"/>
        <stop offset="25%" stop-color="#F5E3A9"/>
        <stop offset="50%" stop-color="#E2C368"/>
        <stop offset="75%" stop-color="#C79F38"/>
        <stop offset="100%" stop-color="#9C7620"/>
      </radialGradient>
      <radialGradient id="goldOuterDiscGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="#FFFDF2"/>
        <stop offset="35%" stop-color="#FCEAB3"/>
        <stop offset="70%" stop-color="#E2C368"/>
        <stop offset="90%" stop-color="#BD9737"/>
        <stop offset="100%" stop-color="#997522"/>
      </radialGradient>
      <linearGradient id="goldSlatPanel" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#E2C46E"/>
        <stop offset="50%" stop-color="#FFF7C8"/>
        <stop offset="100%" stop-color="#CBA440"/>
      </linearGradient>
    </defs>`;

svg = svg.replace('</defs>', newDefs);

// 2. Replace black base rect
svg = svg.replace('<rect width="1080" height="1080" fill="#060708"/>', '<rect width="1080" height="1080" fill="url(#luxuryGoldBackdrop)"/>');

// 3. Replace slat colors to luxurious golden paneling
svg = svg.replaceAll('fill="#17191B"', 'fill="url(#goldSlatPanel)"');
svg = svg.replaceAll('fill="#030405"', 'fill="#A37C24"');
svg = svg.replaceAll('fill="#3E4246"', 'fill="#FFFAD6"');
svg = svg.replaceAll('fill="#2A2D30"', 'fill="#C9A139"');

// 4. Replace black circle backdrop with glowing golden disc
svg = svg.replace(
  '<circle cx="540.0" cy="540.0" r="486.0" fill="#040303" opacity="0.72"/>',
  '<circle cx="540.0" cy="540.0" r="486.0" fill="url(#goldOuterDiscGlow)" stroke="#9C7720" stroke-width="4"/>'
);

fs.writeFileSync(svgPath, svg, 'utf-8');
console.log('✓ four_season_logo_exact.svg updated with radiant golden background');
