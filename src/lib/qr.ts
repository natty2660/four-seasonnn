import QRCode from 'qrcode';

export interface QROptions {
  url: string;
  size?: number;
  darkColor?: string;
  lightColor?: string;
}

export function getMenuUrl(slug = 'prime-cafe'): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/menu/${slug}`;
  }
  return `https://primecafe.et/menu/${slug}`;
}

/**
 * Generates a deterministic hidden pass/token for physical QR code stands.
 * This embedded pass allows the system to distinguish between a physical camera QR scan
 * and a browser refresh/reload without ever prompting the customer to enter passwords manually.
 */
export function generateTableScanPass(tableNumber: string, secretCode?: string | null): string {
  const clean = (tableNumber || '').toUpperCase().trim();
  const code = (secretCode || 'FOUR_SEASON_AUTH').trim();
  let hash = 0x811c9dc5;
  const str = `${clean}::${code}::VIP_PHYSICAL_STAND`;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, '0');
  return `fs_pass_${hex}`;
}

export function getVipTableUrl(
  tableNumber: string,
  secretCode?: string | null,
  grantAccess = true
): string {
  const origin =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'https://fourseason.et';
  const params = new URLSearchParams();
  params.set('table', tableNumber);
  params.set('entry', 'qr');
  params.set('scan', 'camera');
  // Embed hidden pass token for automatic 4-hour physical scan validation
  const scanPass = generateTableScanPass(tableNumber, secretCode);
  params.set('pass', scanPass);
  if (grantAccess) {
    params.set('access', 'granted');
  }
  return `${origin}/vip?${params.toString()}`;
}

/**
 * Generates a high-resolution QR code data URL (min 1024x1024px)
 * Encodes strictly the public menu URL, never menu data.
 */
export async function generateQRCodeDataUrl(options: QROptions): Promise<string> {
  const {
    url,
    size = 1024,
    darkColor = '#0A0A0A', // Deep Obsidian Black
    lightColor = '#FBF5B7', // Soft Gold Cream background
  } = options;

  return QRCode.toDataURL(url, {
    width: size,
    margin: 3,
    errorCorrectionLevel: 'M',
    color: {
      dark: darkColor,
      light: lightColor,
    },
  });
}

/**
 * Downloads the high-resolution QR code as a PNG file.
 */
export async function downloadQRPNG(
  slug = 'prime-cafe',
  _cafeName = 'Four Season Cafe and Restaurant',
  darkColor = '#0A0A0A',
  lightColor = '#FBF5B7'
): Promise<void> {
  const url = getMenuUrl(slug);
  const dataUrl = await generateQRCodeDataUrl({
    url,
    size: 1200,
    darkColor,
    lightColor,
  });

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${slug}-qr-menu-1200px.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Downloads a high-resolution VIP Table QR Code with automatic access token embedded.
 */
export async function downloadVipQRPNG(
  tableNumber: string,
  pin?: string | null,
  darkColor = '#0A0A0A',
  lightColor = '#FBF5B7'
): Promise<void> {
  const url = getVipTableUrl(tableNumber, pin, true);
  const dataUrl = await generateQRCodeDataUrl({
    url,
    size: 1200,
    darkColor,
    lightColor,
  });

  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `FourSeason-${tableNumber}-VIP-Access-QR.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
