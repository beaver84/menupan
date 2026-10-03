export const THEMES = [
  'cafe-dark',
  'bistro-light',
  'light-olive',
  'deep-green',
  'cream',
  'beige',
  'forest-dark',
  'forest-light',
];

export const DEFAULT_THEME = 'cafe-dark';

export function resolveTheme(name) {
  return THEMES.includes(name) ? name : DEFAULT_THEME;
}

export function assetUrl(theme, device, kind) {
  return `/assets/${theme}/${kind}-${device}.png`;
}
