import { randomBytes } from 'crypto';

export function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function toSlugWithSuffix(base: string): string {
  const suffix = randomBytes(2).toString('hex');
  return `${base}-${suffix}`;
}
