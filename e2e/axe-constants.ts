import type { RunOptions } from 'axe-core';

export const AxeTags = {
  wcag2a: 'wcag2a',
  wcag2aa: 'wcag2aa',
  wcag21a: 'wcag21a',
  wcag21aa: 'wcag21aa',
} as const;

export const AXE_WCAG_AA_RUN: RunOptions = {
  runOnly: { type: 'tag', values: [AxeTags.wcag2a, AxeTags.wcag2aa, AxeTags.wcag21a, AxeTags.wcag21aa] },
};
