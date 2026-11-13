import { BadRequestException } from '@nestjs/common';

/** Accepts 9876543210, +91 98765 43210, 091-9876543210 → "9876543210" (Indian mobiles only). */
export function normalizeIndianMobile(input: string): string {
  const digits = String(input || '').replace(/\D/g, '');
  const local =
    digits.length > 10 ? digits.replace(/^(0091|091|91|0)/, '') : digits;
  if (!/^[6-9]\d{9}$/.test(local)) {
    throw new BadRequestException(
      'Enter a valid 10-digit Indian mobile number',
    );
  }
  return local;
}

/** Same rules, but returns null instead of throwing (for bulk imports). */
export function tryNormalizeIndianMobile(input: string): string | null {
  try {
    return normalizeIndianMobile(input);
  } catch {
    return null;
  }
}

export function maskMobile(mobile: string): string {
  return mobile.length >= 4 ? `******${mobile.slice(-4)}` : mobile;
}
