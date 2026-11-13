export const PLATFORM_CAPABILITIES = [
  'publish',
  'analytics',
  'comments',
  'reviews',
  'leads',
  'ads',
] as const;
export type PlatformCapability = (typeof PLATFORM_CAPABILITIES)[number];

/** Seeded once; admins can edit afterwards (seeder never overwrites). */
export const DEFAULT_PLATFORMS: Array<{
  name: string;
  slug: string;
  capabilities: PlatformCapability[];
  isActive: boolean;
  sortOrder: number;
}> = [
  {
    name: 'Facebook Page',
    slug: 'facebook',
    capabilities: ['publish', 'analytics', 'comments', 'leads'],
    isActive: true,
    sortOrder: 1,
  },
  {
    name: 'Instagram',
    slug: 'instagram',
    capabilities: ['publish', 'analytics', 'comments', 'leads'],
    isActive: true,
    sortOrder: 2,
  },
  {
    name: 'Google Business Profile',
    slug: 'google_business',
    capabilities: ['publish', 'analytics', 'reviews'],
    isActive: true,
    sortOrder: 3,
  },
  {
    name: 'YouTube',
    slug: 'youtube',
    capabilities: ['publish', 'analytics', 'comments'],
    isActive: false,
    sortOrder: 4,
  },
  {
    name: 'Meta Ads (Facebook & Instagram)',
    slug: 'meta_ads',
    capabilities: ['ads', 'leads', 'analytics'],
    isActive: true,
    sortOrder: 5,
  },
  {
    name: 'LinkedIn',
    slug: 'linkedin',
    capabilities: ['publish', 'analytics', 'comments'],
    isActive: false,
    sortOrder: 6,
  },
  {
    name: 'X (Twitter)',
    slug: 'x',
    capabilities: ['publish', 'analytics', 'comments'],
    isActive: false,
    sortOrder: 7,
  },
  {
    name: 'TikTok',
    slug: 'tiktok',
    capabilities: ['publish', 'analytics'],
    isActive: false,
    sortOrder: 8,
  },
];

export const SOCIAL_PROVIDERS = ['zernio', 'ayrshare'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];

export const ZERNIO_DEFAULT_API_BASE = 'https://zernio.com/api/v1';

/** Our platform slug → Zernio platform value. Meta Ads uses the ads connect flow. */
export const ZERNIO_PLATFORM_BY_SLUG: Record<string, string> = {
  facebook: 'facebook',
  instagram: 'instagram',
  google_business: 'googlebusiness',
  youtube: 'youtube',
  linkedin: 'linkedin',
  x: 'twitter',
  tiktok: 'tiktok',
  meta_ads: 'metaads',
};

export const SLUG_BY_ZERNIO_PLATFORM: Record<string, string> =
  Object.fromEntries(
    Object.entries(ZERNIO_PLATFORM_BY_SLUG).map(([slug, z]) => [z, slug]),
  );

/** Platforms that reject text-only posts (test post needs mediaUrl). */
export const MEDIA_REQUIRED_PLATFORMS: Record<
  string,
  'image_or_video' | 'video'
> = {
  instagram: 'image_or_video',
  youtube: 'video',
  tiktok: 'video',
};
