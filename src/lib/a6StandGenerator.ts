import QRCode from 'qrcode';

export interface StandCardOptions {
  tableNumber: string;
  tableName: string;
  theme: 'gold_luxury' | 'obsidian_dark';
  customBgDataUrl?: string | null;
  qrUrl: string;
  cafeName?: string;
  tagline?: string;
}

/**
 * Dimensions for A6 Horizontal / Landscape at 300 DPI:
 * 148 mm × 105 mm => (148 / 25.4 * 300) = 1748 px by (105 / 25.4 * 300) = 1240 px
 */
export const A6_WIDTH = 1748;
export const A6_HEIGHT = 1240;

/**
 * Draws rounded rectangle path on canvas
 */
export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

/**
 * Draws a metallic gold stroke border with subtle inner glow
 */
function drawGoldBorder(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  lineWidth = 3
) {
  ctx.save();
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, '#D4AF37');
  grad.addColorStop(0.3, '#FFF3B0');
  grad.addColorStop(0.6, '#AA771C');
  grad.addColorStop(1, '#E6C65A');

  roundRect(ctx, x, y, w, h, r);
  ctx.strokeStyle = grad;
  ctx.lineWidth = lineWidth;
  ctx.stroke();
  ctx.restore();
}

/**
 * Draws text curved along an arc
 */
function drawCurvedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  centerY: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  inward = false
) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const angleStep = (endAngle - startAngle) / Math.max(1, text.length - 1);
  for (let i = 0; i < text.length; i++) {
    const angle = startAngle + i * angleStep;
    ctx.save();
    ctx.translate(
      centerX + Math.cos(angle) * radius,
      centerY + Math.sin(angle) * radius
    );
    ctx.rotate(angle + (inward ? -Math.PI / 2 : Math.PI / 2));
    ctx.fillText(text[i], 0, 0);
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Draws the luxury circular Four Season seal emblem
 */
function drawSealLogo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number
) {
  ctx.save();

  // 1. Outer beaded ring
  const numBeads = 44;
  for (let i = 0; i < numBeads; i++) {
    const a = (i * 2 * Math.PI) / numBeads;
    const bx = cx + Math.cos(a) * (radius + 8);
    const by = cy + Math.sin(a) * (radius + 8);
    ctx.beginPath();
    ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = i % 2 === 0 ? '#E8C860' : '#AA771C';
    ctx.fill();
  }

  // 2. Outer golden ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  const ringGrad = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
  ringGrad.addColorStop(0, '#E8C860');
  ringGrad.addColorStop(0.3, '#FFF7CC');
  ringGrad.addColorStop(0.7, '#9C7720');
  ringGrad.addColorStop(1, '#D4AF37');
  ctx.strokeStyle = ringGrad;
  ctx.lineWidth = 6;
  ctx.stroke();

  // 3. Black central disc
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 4, 0, Math.PI * 2);
  ctx.fillStyle = '#080808';
  ctx.fill();

  // 4. Inner gold thin ring
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 16, 0, Math.PI * 2);
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // 5. Crown icon at top of inner circle
  ctx.fillStyle = '#E8C860';
  ctx.beginPath();
  ctx.moveTo(cx - 18, cy - radius + 32);
  ctx.lineTo(cx - 24, cy - radius + 20);
  ctx.lineTo(cx - 8, cy - radius + 25);
  ctx.lineTo(cx, cy - radius + 16);
  ctx.lineTo(cx + 8, cy - radius + 25);
  ctx.lineTo(cx + 24, cy - radius + 20);
  ctx.lineTo(cx + 18, cy - radius + 32);
  ctx.closePath();
  ctx.fill();

  // 6. Arched top text: "FOUR SEASON"
  ctx.font = 'bold 20px "Playfair Display", "Times New Roman", serif';
  ctx.fillStyle = '#F5E6A3';
  drawCurvedText(
    ctx,
    'FOUR SEASON',
    cx,
    cy,
    radius - 38,
    -Math.PI * 0.78,
    -Math.PI * 0.22,
    false
  );

  // 7. Middle: Ornate "FS" monogram and stars
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 60, 0, Math.PI * 2);
  ctx.strokeStyle = '#AA771C';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Stars
  ctx.font = '16px serif';
  ctx.fillStyle = '#D4AF37';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('★', cx - 44, cy + 2);
  ctx.fillText('★', cx + 44, cy + 2);

  // Monogram "FS"
  ctx.font = 'italic bold 52px "Cinzel", "Playfair Display", "Times New Roman", serif';
  const fsGrad = ctx.createLinearGradient(cx - 25, cy - 25, cx + 25, cy + 25);
  fsGrad.addColorStop(0, '#FFF5B8');
  fsGrad.addColorStop(0.5, '#E5C158');
  fsGrad.addColorStop(1, '#9C7720');
  ctx.fillStyle = fsGrad;
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 6;
  ctx.fillText('FS', cx, cy + 3);
  ctx.shadowBlur = 0;

  // 8. Bottom curved text: "Café & Restaurant"
  ctx.font = 'bold 15px "Playfair Display", "Times New Roman", serif';
  ctx.fillStyle = '#E8C860';
  drawCurvedText(
    ctx,
    'Café & Restaurant',
    cx,
    cy,
    radius - 28,
    Math.PI * 0.75,
    Math.PI * 0.25,
    true
  );

  ctx.restore();
}

/**
 * Draws royal crown icon with horizontal wing rules
 */
function drawHeaderCrown(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
  ctx.save();
  // Flanking horizontal lines
  const gradL = ctx.createLinearGradient(cx - 180, cy, cx - 35, cy);
  gradL.addColorStop(0, 'rgba(212, 175, 55, 0)');
  gradL.addColorStop(1, '#D4AF37');
  ctx.strokeStyle = gradL;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cx - 180, cy);
  ctx.lineTo(cx - 35, cy);
  ctx.stroke();

  const gradR = ctx.createLinearGradient(cx + 35, cy, cx + 180, cy);
  gradR.addColorStop(0, '#D4AF37');
  gradR.addColorStop(1, 'rgba(212, 175, 55, 0)');
  ctx.strokeStyle = gradR;
  ctx.beginPath();
  ctx.moveTo(cx + 35, cy);
  ctx.lineTo(cx + 180, cy);
  ctx.stroke();

  // Central Crown
  const cGrad = ctx.createLinearGradient(cx - 25, cy - 20, cx + 25, cy + 10);
  cGrad.addColorStop(0, '#FFF5B8');
  cGrad.addColorStop(0.5, '#E5C158');
  cGrad.addColorStop(1, '#9C7720');
  ctx.fillStyle = cGrad;
  ctx.shadowColor = 'rgba(212, 175, 55, 0.4)';
  ctx.shadowBlur = 10;

  ctx.beginPath();
  ctx.moveTo(cx - 22, cy + 12);
  ctx.lineTo(cx - 28, cy - 8);
  ctx.lineTo(cx - 10, cy - 2);
  ctx.lineTo(cx, cy - 14);
  ctx.lineTo(cx + 10, cy - 2);
  ctx.lineTo(cx + 28, cy - 8);
  ctx.lineTo(cx + 22, cy + 12);
  ctx.closePath();
  ctx.fill();

  // Crown jewels
  ctx.fillStyle = '#FFFDF0';
  ctx.beginPath();
  ctx.arc(cx - 28, cy - 9, 2.5, 0, Math.PI * 2);
  ctx.arc(cx, cy - 15, 3, 0, Math.PI * 2);
  ctx.arc(cx + 28, cy - 9, 2.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

/**
 * Draws Wi-Fi Icon
 */
function drawWifiIcon(ctx: CanvasRenderingContext2D, x: number, y: number, color = '#D4AF37') {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';

  // Wave 3 (Outer)
  ctx.beginPath();
  ctx.arc(x, y + 10, 24, -Math.PI * 0.75, -Math.PI * 0.25);
  ctx.stroke();

  // Wave 2 (Middle)
  ctx.beginPath();
  ctx.arc(x, y + 10, 16, -Math.PI * 0.75, -Math.PI * 0.25);
  ctx.stroke();

  // Wave 1 (Inner)
  ctx.beginPath();
  ctx.arc(x, y + 10, 8, -Math.PI * 0.75, -Math.PI * 0.25);
  ctx.stroke();

  // Dot
  ctx.beginPath();
  ctx.arc(x, y + 10, 2.8, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  ctx.restore();
}

/**
 * Draws step circle badge and icon
 */
function drawStepItem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  topY: number,
  stepNum: string,
  label: string,
  iconType: 'camera' | 'qr' | 'link',
  isDarkTheme: boolean
) {
  ctx.save();

  // Step Pill Badge "01" / "02" / "03"
  const badgeY = topY + 22;
  ctx.beginPath();
  ctx.arc(cx, badgeY, 20, 0, Math.PI * 2);
  const badgeGrad = ctx.createLinearGradient(cx - 20, badgeY - 20, cx + 20, badgeY + 20);
  badgeGrad.addColorStop(0, '#FFF5B8');
  badgeGrad.addColorStop(0.5, '#E5C158');
  badgeGrad.addColorStop(1, '#9C7720');
  ctx.fillStyle = badgeGrad;
  ctx.fill();
  ctx.strokeStyle = '#3A2A10';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.font = '900 16px "Montserrat", sans-serif';
  ctx.fillStyle = '#080808';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(stepNum, cx, badgeY + 1);

  // Large Dark Icon Container Circle
  const iconY = topY + 84;
  ctx.beginPath();
  ctx.arc(cx, iconY, 38, 0, Math.PI * 2);
  ctx.fillStyle = '#0A0A0A';
  ctx.fill();
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Inner icon drawing
  ctx.strokeStyle = '#E8C860';
  ctx.fillStyle = '#E8C860';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  if (iconType === 'camera') {
    // Camera body
    roundRect(ctx, cx - 18, iconY - 11, 36, 24, 4);
    ctx.stroke();
    // Lens
    ctx.beginPath();
    ctx.arc(cx, iconY + 1, 7.5, 0, Math.PI * 2);
    ctx.stroke();
    // Flash notch
    ctx.fillRect(cx - 10, iconY - 16, 7, 5);
  } else if (iconType === 'qr') {
    // QR scanner brackets
    const s = 14;
    // Top-left
    ctx.beginPath();
    ctx.moveTo(cx - s, iconY - s + 6);
    ctx.lineTo(cx - s, iconY - s);
    ctx.lineTo(cx - s + 6, iconY - s);
    ctx.stroke();
    // Top-right
    ctx.beginPath();
    ctx.moveTo(cx + s - 6, iconY - s);
    ctx.lineTo(cx + s, iconY - s);
    ctx.lineTo(cx + s, iconY - s + 6);
    ctx.stroke();
    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(cx - s, iconY + s - 6);
    ctx.lineTo(cx - s, iconY + s);
    ctx.lineTo(cx - s + 6, iconY + s);
    ctx.stroke();
    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(cx + s - 6, iconY + s);
    ctx.lineTo(cx + s, iconY + s);
    ctx.lineTo(cx + s, iconY + s - 6);
    ctx.stroke();
    // Center dot grid
    ctx.fillRect(cx - 6, iconY - 6, 4, 4);
    ctx.fillRect(cx + 2, iconY - 6, 4, 4);
    ctx.fillRect(cx - 6, iconY + 2, 4, 4);
    ctx.fillRect(cx + 2, iconY + 2, 4, 4);
  } else {
    // Chain Link Icon
    ctx.beginPath();
    ctx.arc(cx - 6, iconY + 5, 8, Math.PI * 0.25, Math.PI * 1.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx + 6, iconY - 5, 8, -Math.PI * 0.75, Math.PI * 0.25);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 5, iconY + 4);
    ctx.lineTo(cx + 5, iconY - 4);
    ctx.stroke();
  }

  // Label
  ctx.font = 'bold 20px "Cinzel", "Playfair Display", Georgia, serif';
  ctx.fillStyle = isDarkTheme ? '#FFFFFF' : '#1C150E';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, cx, topY + 148);

  ctx.restore();
}

/**
 * Draws Feature Item (Icon + Text)
 */
function drawFeatureItem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  type: 'fork' | 'hat' | 'cup',
  title: string
) {
  ctx.save();
  const iconX = cx - 60;

  // Icon Circle
  ctx.beginPath();
  ctx.arc(iconX, cy, 26, 0, Math.PI * 2);
  ctx.fillStyle = '#080808';
  ctx.fill();
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = '#E8C860';
  ctx.fillStyle = '#E8C860';
  ctx.lineWidth = 2;

  if (type === 'fork') {
    // Fork & Knife
    ctx.beginPath();
    ctx.moveTo(iconX - 6, cy - 10);
    ctx.lineTo(iconX - 6, cy + 10);
    ctx.moveTo(iconX - 9, cy - 10);
    ctx.lineTo(iconX - 3, cy - 10);
    ctx.moveTo(iconX + 6, cy - 10);
    ctx.lineTo(iconX + 6, cy + 10);
    ctx.stroke();
  } else if (type === 'hat') {
    // Chef hat
    ctx.beginPath();
    ctx.arc(iconX, cy - 5, 8, Math.PI, 0);
    ctx.rect(iconX - 8, cy + 1, 16, 6);
    ctx.stroke();
  } else {
    // Steaming cup
    ctx.beginPath();
    ctx.arc(iconX, cy + 2, 7, 0, Math.PI);
    ctx.lineTo(iconX - 7, cy + 2);
    ctx.stroke();
    // Handle
    ctx.beginPath();
    ctx.arc(iconX + 7, cy + 2, 3.5, -Math.PI / 2, Math.PI / 2);
    ctx.stroke();
    // Steam
    ctx.beginPath();
    ctx.moveTo(iconX - 3, cy - 6);
    ctx.lineTo(iconX - 3, cy - 10);
    ctx.moveTo(iconX + 3, cy - 6);
    ctx.lineTo(iconX + 3, cy - 10);
    ctx.stroke();
  }

  // Text
  ctx.font = 'bold 18px "Cinzel", "Playfair Display", Georgia, serif';
  ctx.fillStyle = '#F5E6A3';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const words = title.split(' ');
  if (words.length === 2) {
    ctx.fillText(words[0], iconX + 36, cy - 10);
    ctx.fillText(words[1], iconX + 36, cy + 12);
  } else {
    ctx.fillText(title, iconX + 36, cy);
  }

  ctx.restore();
}

/**
 * Draws Smartphone Scan CTA button
 */
function drawScanCta(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save();
  // Dark pill with gold border
  roundRect(ctx, x, y, w, h, h / 2);
  ctx.fillStyle = '#080808';
  ctx.fill();
  drawGoldBorder(ctx, x, y, w, h, h / 2, 2.5);

  const phoneX = x + 44;
  const phoneY = y + h / 2;

  // Phone body
  roundRect(ctx, phoneX - 12, phoneY - 18, 24, 36, 4);
  ctx.strokeStyle = '#E8C860';
  ctx.lineWidth = 2.5;
  ctx.stroke();

  // Screen
  roundRect(ctx, phoneX - 8, phoneY - 12, 16, 22, 2);
  ctx.fillStyle = 'rgba(232, 200, 96, 0.2)';
  ctx.fill();

  // Radiating rays on left and right
  ctx.strokeStyle = '#E8C860';
  ctx.lineWidth = 2;
  // Left rays
  ctx.beginPath();
  ctx.moveTo(phoneX - 22, phoneY - 8);
  ctx.lineTo(phoneX - 29, phoneY - 12);
  ctx.moveTo(phoneX - 24, phoneY);
  ctx.lineTo(phoneX - 32, phoneY);
  ctx.moveTo(phoneX - 22, phoneY + 8);
  ctx.lineTo(phoneX - 29, phoneY + 12);
  // Right rays
  ctx.moveTo(phoneX + 22, phoneY - 8);
  ctx.lineTo(phoneX + 29, phoneY - 12);
  ctx.moveTo(phoneX + 24, phoneY);
  ctx.lineTo(phoneX + 32, phoneY);
  ctx.moveTo(phoneX + 22, phoneY + 8);
  ctx.lineTo(phoneX + 29, phoneY + 12);
  ctx.stroke();

  // Text
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 19px "Cinzel", "Playfair Display", Georgia, serif';
  ctx.fillText('SCAN TO VIEW', phoneX + 46, phoneY - 11);
  ctx.fillStyle = '#E8C860';
  ctx.font = '900 20px "Cinzel", "Playfair Display", Georgia, serif';
  ctx.fillText('OUR DIGITAL MENU', phoneX + 46, phoneY + 12);

  ctx.restore();
}

/**
 * Draws Footer Bar
 */
function drawFooterBar(ctx: CanvasRenderingContext2D, isDarkTheme: boolean) {
  ctx.save();
  const y = 1170;
  const pillW = 740;
  const pillH = 46;
  const pillX = (A6_WIDTH - pillW) / 2;

  // Left & Right flanking lines
  const gradL = ctx.createLinearGradient(80, y, pillX, y);
  gradL.addColorStop(0, 'rgba(212, 175, 55, 0)');
  gradL.addColorStop(1, '#D4AF37');
  ctx.strokeStyle = gradL;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(80, y);
  ctx.lineTo(pillX, y);
  ctx.stroke();

  const gradR = ctx.createLinearGradient(pillX + pillW, y, A6_WIDTH - 80, y);
  gradR.addColorStop(0, '#D4AF37');
  gradR.addColorStop(1, 'rgba(212, 175, 55, 0)');
  ctx.strokeStyle = gradR;
  ctx.beginPath();
  ctx.moveTo(pillX + pillW, y);
  ctx.lineTo(A6_WIDTH - 80, y);
  ctx.stroke();

  // Centered Pill
  roundRect(ctx, pillX, y - pillH / 2, pillW, pillH, pillH / 2);
  ctx.fillStyle = isDarkTheme ? 'rgba(10, 10, 10, 0.85)' : 'rgba(255, 248, 225, 0.88)';
  ctx.fill();
  drawGoldBorder(ctx, pillX, y - pillH / 2, pillW, pillH, pillH / 2, 1.8);

  // Agency "Z" Icon
  const zX = pillX + 36;
  const zY = y;
  ctx.fillStyle = '#D4AF37';
  ctx.beginPath();
  ctx.moveTo(zX - 10, zY - 9);
  ctx.lineTo(zX + 10, zY - 9);
  ctx.lineTo(zX - 2, zY + 3);
  ctx.lineTo(zX + 10, zY + 3);
  ctx.lineTo(zX + 10, zY + 9);
  ctx.lineTo(zX - 10, zY + 9);
  ctx.lineTo(zX + 2, zY - 3);
  ctx.lineTo(zX - 10, zY - 3);
  ctx.closePath();
  ctx.fill();

  // Powered by Zaza Digital Agency
  ctx.font = 'bold 15px "Montserrat", sans-serif';
  ctx.fillStyle = isDarkTheme ? '#EDEDED' : '#2A2016';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Powered by Zaza Digital Agency', zX + 20, y);

  // Divider
  ctx.fillStyle = '#D4AF37';
  ctx.fillText('|', pillX + 360, y);

  // Phone Icon
  const pX = pillX + 386;
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(pX, y, 7, 0, Math.PI * 2);
  ctx.stroke();
  ctx.font = '12px serif';
  ctx.textAlign = 'center';
  ctx.fillText('📞', pX, y);

  // Phone text
  ctx.font = 'bold 15px "Montserrat", sans-serif';
  ctx.fillStyle = isDarkTheme ? '#EDEDED' : '#2A2016';
  ctx.textAlign = 'left';
  ctx.fillText('Tell no: +251942850404', pX + 16, y);

  ctx.restore();
}

/**
 * Draws procedural luxury background (Dark Obsidian or Champagne Gold Cream Marble)
 */
function drawProceduralBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  isDarkTheme: boolean
) {
  ctx.save();

  if (isDarkTheme) {
    // 1. Deep charcoal/black marble base
    const bgGrad = ctx.createRadialGradient(
      width * 0.75,
      height * 0.25,
      100,
      width / 2,
      height / 2,
      width * 0.8
    );
    bgGrad.addColorStop(0, '#1E1A16');
    bgGrad.addColorStop(0.3, '#141210');
    bgGrad.addColorStop(0.7, '#0C0A09');
    bgGrad.addColorStop(1, '#050505');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Warm bokeh lights in top-right
    const bokehColors = ['rgba(235, 195, 90, 0.12)', 'rgba(255, 220, 130, 0.08)', 'rgba(212, 175, 55, 0.06)'];
    const bokehs = [
      { x: width - 260, y: 140, r: 160 },
      { x: width - 140, y: 280, r: 120 },
      { x: width - 380, y: 200, r: 90 },
      { x: width - 100, y: 80, r: 110 },
    ];
    for (let i = 0; i < bokehs.length; i++) {
      const b = bokehs[i];
      const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
      g.addColorStop(0, bokehColors[i % bokehColors.length]);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Fine golden marble veins
    ctx.strokeStyle = 'rgba(212, 175, 55, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.35);
    ctx.bezierCurveTo(width * 0.25, height * 0.45, width * 0.45, height * 0.15, width * 0.7, height * 0.28);
    ctx.bezierCurveTo(width * 0.85, height * 0.35, width * 0.95, height * 0.1, width, height * 0.18);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 230, 140, 0.08)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(width * 0.15, height);
    ctx.bezierCurveTo(width * 0.3, height * 0.7, width * 0.6, height * 0.85, width, height * 0.65);
    ctx.stroke();

    // 4. Top-left luxury curved gold corner swoosh
    ctx.strokeStyle = '#D4AF37';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, 220);
    ctx.bezierCurveTo(120, 180, 260, 90, 320, 0);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 240, 160, 0.6)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 235);
    ctx.bezierCurveTo(130, 195, 275, 105, 335, 0);
    ctx.stroke();
  } else {
    // 1. Warm cream / ivory champagne marble base
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#FFFDF5');
    bgGrad.addColorStop(0.3, '#FAF4E4');
    bgGrad.addColorStop(0.7, '#F3E8CE');
    bgGrad.addColorStop(1, '#EFE3C3');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. Soft golden marble veins
    ctx.strokeStyle = 'rgba(180, 140, 50, 0.18)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.28);
    ctx.bezierCurveTo(width * 0.25, height * 0.42, width * 0.4, height * 0.18, width * 0.68, height * 0.32);
    ctx.bezierCurveTo(width * 0.82, height * 0.4, width * 0.92, height * 0.2, width, height * 0.25);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(212, 175, 55, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(width * 0.1, height);
    ctx.bezierCurveTo(width * 0.3, height * 0.75, width * 0.55, height * 0.9, width, height * 0.72);
    ctx.stroke();

    // 3. Top-left luxury curved gold corner swoosh
    ctx.strokeStyle = '#C99D2A';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(0, 220);
    ctx.bezierCurveTo(120, 180, 260, 90, 320, 0);
    ctx.stroke();

    ctx.strokeStyle = '#E8C860';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(0, 235);
    ctx.bezierCurveTo(130, 195, 275, 105, 335, 0);
    ctx.stroke();
  }

  // Outer framing gold border
  ctx.strokeStyle = isDarkTheme ? '#D4AF37' : '#B8861B';
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, width - 36, height - 36);

  ctx.strokeStyle = isDarkTheme ? 'rgba(212, 175, 55, 0.35)' : 'rgba(184, 134, 27, 0.35)';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(26, 26, width - 52, height - 52);

  ctx.restore();
}

/**
 * Loads an image into an HTMLImageElement
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * Generates the full A6 Horizontal (148mm × 105mm) Stand Card Canvas at 300 DPI (1748px × 1240px)
 */
export async function generateA6StandCardCanvas(
  options: StandCardOptions
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas');
  canvas.width = A6_WIDTH;
  canvas.height = A6_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  const isDark = options.theme === 'obsidian_dark';

  // 1. Render Background
  if (options.customBgDataUrl) {
    try {
      const bgImg = await loadImage(options.customBgDataUrl);
      ctx.drawImage(bgImg, 0, 0, A6_WIDTH, A6_HEIGHT);
    } catch {
      drawProceduralBackground(ctx, A6_WIDTH, A6_HEIGHT, isDark);
    }
  } else {
    drawProceduralBackground(ctx, A6_WIDTH, A6_HEIGHT, isDark);
  }

  // 2. Generate Gold QR Code with Solid Black Background
  const qrDataUrl = await QRCode.toDataURL(options.qrUrl, {
    width: 600,
    margin: 1,
    errorCorrectionLevel: 'H',
    color: {
      dark: '#E5C158', // Metallic Gold Modules
      light: '#0A0A0A', // Deep Black Background
    },
  });
  const qrImg = await loadImage(qrDataUrl);

  // 3. Top Header: Seal Logo Badge (Left)
  drawSealLogo(ctx, 230, 160, 100);

  // 4. Center / Header Section
  const headerCenterX = 980;

  // Crown Icon with Horizontal Wing Rules
  drawHeaderCrown(ctx, headerCenterX, 78);

  // Main Title: "FOUR SEASON" (3D Metallic Gold Gradient)
  ctx.save();
  ctx.font = '900 82px "Cinzel", "Playfair Display", "Times New Roman", serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 4;

  const titleGrad = ctx.createLinearGradient(
    headerCenterX - 300,
    135,
    headerCenterX + 300,
    145
  );
  titleGrad.addColorStop(0, '#FFECA8');
  titleGrad.addColorStop(0.35, '#FFF8D6');
  titleGrad.addColorStop(0.65, '#E5C158');
  titleGrad.addColorStop(1, '#9C7720');
  ctx.fillStyle = titleGrad;
  ctx.fillText('FOUR SEASON', headerCenterX, 138);

  // Subtitle: "— Café & Restaurant —"
  ctx.shadowBlur = 0;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 0;
  ctx.font = '700 32px "Playfair Display", "Times New Roman", serif';
  ctx.fillStyle = isDark ? '#FFF0B3' : '#3D2F1B';
  ctx.fillText('— Café & Restaurant —', headerCenterX, 196);

  // Tagline: "Good Food • Great Mood" (Cursive / Script)
  ctx.font = 'italic 500 34px "Great Vibes", "Brush Script MT", "Playfair Display", cursive, serif';
  ctx.fillStyle = '#E8C860';
  ctx.fillText('Good Food   •   Great Mood', headerCenterX, 246);

  // Dynamic VIP Table Badge
  const tableBadge = `${options.tableNumber} • ${options.tableName}`;
  ctx.font = 'bold 20px "Cinzel", "Playfair Display", Georgia, serif';
  const badgeWidth = Math.max(340, ctx.measureText(tableBadge).width + 64);
  const badgeX = headerCenterX - badgeWidth / 2;
  const badgeY = 276;
  const badgeH = 38;

  roundRect(ctx, badgeX, badgeY, badgeWidth, badgeH, badgeH / 2);
  ctx.fillStyle = isDark ? '#141414' : '#2A1F13';
  ctx.fill();
  drawGoldBorder(ctx, badgeX, badgeY, badgeWidth, badgeH, badgeH / 2, 2);

  ctx.fillStyle = '#FCF6BA';
  ctx.fillText(`👑 ${tableBadge}`, headerCenterX, badgeY + badgeH / 2 + 1);

  ctx.restore();

  // -------------------------------------------------------------
  // LEFT COLUMN: INSTRUCTIONS & HIGHLIGHTS
  // -------------------------------------------------------------
  const leftX = 110;
  const colW = 890;

  // 1. Wi-Fi Pill Box
  const wifiY = 340;
  const wifiH = 76;
  roundRect(ctx, leftX, wifiY, colW, wifiH, wifiH / 2);
  ctx.fillStyle = isDark ? 'rgba(10, 10, 10, 0.9)' : 'rgba(255, 252, 240, 0.92)';
  ctx.fill();
  drawGoldBorder(ctx, leftX, wifiY, colW, wifiH, wifiH / 2, 2.5);

  // Wi-Fi Icon
  drawWifiIcon(ctx, leftX + 54, wifiY + 28, '#E8C860');

  // Divider
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(leftX + 104, wifiY + 16);
  ctx.lineTo(leftX + 104, wifiY + wifiH - 16);
  ctx.stroke();

  // Text
  ctx.font = 'bold 24px "Montserrat", sans-serif';
  ctx.fillStyle = isDark ? '#FFFFFF' : '#1C150E';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    'Please make sure your phone is connected to the internet.',
    leftX + 128,
    wifiY + wifiH / 2
  );

  // 2. "HOW TO VIEW OUR MENU" Heading
  const stepsHeaderY = 470;
  ctx.save();
  // Flanking lines
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(leftX + 20, stepsHeaderY);
  ctx.lineTo(leftX + 220, stepsHeaderY);
  ctx.moveTo(leftX + colW - 220, stepsHeaderY);
  ctx.lineTo(leftX + colW - 20, stepsHeaderY);
  ctx.stroke();

  ctx.font = '900 24px "Cinzel", "Playfair Display", Georgia, serif';
  ctx.fillStyle = isDark ? '#FCF6BA' : '#1C150E';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('HOW TO VIEW OUR MENU', leftX + colW / 2, stepsHeaderY);
  ctx.restore();

  // 3-Step Horizontal Grid (01, 02, 03)
  const stepsTopY = 520;
  const colStepW = colW / 3;

  drawStepItem(
    ctx,
    leftX + colStepW * 0.5,
    stepsTopY,
    '01',
    'Open your camera',
    'camera',
    isDark
  );

  // Vertical Divider 1
  ctx.strokeStyle = 'rgba(212, 175, 55, 0.4)';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(leftX + colStepW, stepsTopY + 30);
  ctx.lineTo(leftX + colStepW, stepsTopY + 140);
  ctx.stroke();

  drawStepItem(
    ctx,
    leftX + colStepW * 1.5,
    stepsTopY,
    '02',
    'Scan the QR code',
    'qr',
    isDark
  );

  // Vertical Divider 2
  ctx.beginPath();
  ctx.moveTo(leftX + colStepW * 2, stepsTopY + 30);
  ctx.lineTo(leftX + colStepW * 2, stepsTopY + 140);
  ctx.stroke();

  drawStepItem(
    ctx,
    leftX + colStepW * 2.5,
    stepsTopY,
    '03',
    'Tap the link',
    'link',
    isDark
  );

  // 3. 3-Feature Pill Bar (Fresh Ingredients, Quality Food, Great Service)
  const featY = 780;
  const featH = 86;
  roundRect(ctx, leftX, featY, colW, featH, featH / 2);
  ctx.fillStyle = '#080808';
  ctx.fill();
  drawGoldBorder(ctx, leftX, featY, colW, featH, featH / 2, 2.5);

  drawFeatureItem(ctx, leftX + colStepW * 0.5, featY + featH / 2, 'fork', 'Fresh Ingredients');

  // Divider 1
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(leftX + colStepW, featY + 18);
  ctx.lineTo(leftX + colStepW, featY + featH - 18);
  ctx.stroke();

  drawFeatureItem(ctx, leftX + colStepW * 1.5, featY + featH / 2, 'hat', 'Quality Food');

  // Divider 2
  ctx.beginPath();
  ctx.moveTo(leftX + colStepW * 2, featY + 18);
  ctx.lineTo(leftX + colStepW * 2, featY + featH - 18);
  ctx.stroke();

  drawFeatureItem(ctx, leftX + colStepW * 2.5, featY + featH / 2, 'cup', 'Great Service');

  // -------------------------------------------------------------
  // RIGHT COLUMN: DYNAMIC QR CODE & SCAN CTA
  // -------------------------------------------------------------
  const qrBoxX = 1060;
  const qrBoxY = 330;
  const qrBoxW = 578;
  const qrBoxH = 578;
  const qrBoxR = 36;

  // Solid Black Container Box
  roundRect(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, qrBoxR);
  ctx.fillStyle = '#0A0A0A';
  ctx.fill();

  // Double glowing gold border
  drawGoldBorder(ctx, qrBoxX, qrBoxY, qrBoxW, qrBoxH, qrBoxR, 4);
  drawGoldBorder(ctx, qrBoxX + 6, qrBoxY + 6, qrBoxW - 12, qrBoxH - 12, qrBoxR - 4, 1.5);

  // Draw QR Image Inside
  const qrPad = 28;
  ctx.drawImage(
    qrImg,
    qrBoxX + qrPad,
    qrBoxY + qrPad,
    qrBoxW - qrPad * 2,
    qrBoxH - qrPad * 2
  );

  // Bottom Scan CTA Pill directly below QR
  const ctaY = 936;
  const ctaH = 76;
  drawScanCta(ctx, qrBoxX, ctaY, qrBoxW, ctaH);

  // -------------------------------------------------------------
  // BOTTOM FOOTER BAR (FULL WIDTH)
  // -------------------------------------------------------------
  drawFooterBar(ctx, isDark);

  return canvas;
}

/**
 * Downloads the A6 Horizontal Stand Card as a 300 DPI PNG file
 */
export async function downloadA6StandCardPNG(options: StandCardOptions): Promise<void> {
  const canvas = await generateA6StandCardCanvas(options);
  const dataUrl = canvas.toDataURL('image/png', 1.0);

  const cleanTable = options.tableNumber.replace(/[^a-zA-Z0-9_-]/g, '');
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `FourSeason-${cleanTable}-Stand-Card-A6.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
