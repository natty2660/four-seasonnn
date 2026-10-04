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

export function getVipTableUrl(tableNumber: string): string {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/vip?table=${encodeURIComponent(tableNumber)}`;
  }
  return `https://primecafe.et/vip?table=${encodeURIComponent(tableNumber)}`;
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
