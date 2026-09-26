export const WcagFocusAppearance = {
  minimumThicknessPx: 2,
} as const;

export const WcagContrastMinimums = {
  text: 4.5,
  nonText: 3,
} as const;

export const WcagRelativeLuminance = {
  channelMaximum: 255,
  linearThreshold: 0.03928,
  linearDivisor: 12.92,
  gammaOffset: 0.055,
  gammaDivisor: 1.055,
  gammaExponent: 2.4,
  redWeight: 0.2126,
  greenWeight: 0.7152,
  blueWeight: 0.0722,
  flare: 0.05,
} as const;
