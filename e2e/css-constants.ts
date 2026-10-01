export const CssValues = {
  none: 'none',
  normal: 'normal',
  fixed: 'fixed',
  hidden: 'hidden',
  solid: 'solid',
  transparent: 'rgba(0, 0, 0, 0)',
  darkColorScheme: 'dark',
} as const;

export const ColorSchemeQueries = {
  light: '(prefers-color-scheme: light)',
} as const;
