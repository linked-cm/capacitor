import { Capacitor } from '@capacitor/core';

/**
 * On Android dev builds, image URLs still point at localhost. Rewrite them to
 * SITE_ROOT so the device can load them. Other platforms keep the original URL.
 */
export function replaceLocalhostWithSiteRoot(croppedImage: string): string {
  let imageSrc = croppedImage;
  if (
    imageSrc &&
    process.env.NODE_ENV !== 'production' &&
    Capacitor.getPlatform() === 'android'
  ) {
    const siteRoot = process.env.SITE_ROOT;
    if (siteRoot && imageSrc.includes('localhost')) {
      imageSrc = imageSrc.replace(/http:\/\/localhost:\d+/, siteRoot);
    }
  }

  return imageSrc;
}

/**
 * Normalize telephone strings for WhatsApp OTP sign-in identity lookup.
 *
 * Examples:
 * - `"+1 813-381-1122"` -> `"+18133811122"`
 * - `"(+62) 813 3811 1222"` -> `"+6281338111222"`
 * - `"001234567890"` -> `"+1234567890"`
 */
export function normalizeTelephone(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';

  // Keep leading '+' when present; drop other non-digit characters (spaces, dashes, parentheses).
  let cleaned = raw.replace(/[^\d+]/g, '');

  // Some sources use 00 prefix for international dialing.
  if (cleaned.startsWith('00')) {
    cleaned = `+${cleaned.slice(2)}`;
  }

  // If still no '+', leave as-is (some legacy records may be stored without it).
  return cleaned;
}
