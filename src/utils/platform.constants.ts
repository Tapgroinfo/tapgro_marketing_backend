export const PLATFORM_CAPABILITIES = [
  'publish',
  'analytics',
  'comments',
  'reviews',
  'leads',
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
    name: 'LinkedIn',
    slug: 'linkedin',
    capabilities: ['publish', 'analytics', 'comments'],
    isActive: false,
    sortOrder: 5,
  },
  {
    name: 'X (Twitter)',
    slug: 'x',
    capabilities: ['publish', 'analytics', 'comments'],
    isActive: false,
    sortOrder: 6,
  },
  {
    name: 'TikTok',
    slug: 'tiktok',
    capabilities: ['publish', 'analytics'],
    isActive: false,
    sortOrder: 7,
  },
];

export const SOCIAL_PROVIDERS = ['zernio', 'ayrshare'] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];
