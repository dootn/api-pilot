export type Size = 'sm' | 'md' | 'lg';

export function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}
