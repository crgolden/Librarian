const layoutProperties = [
  'display',
  'grid[-a-z]*',
  'flex[-a-z]*',
  'gap',
  'row-gap',
  'column-gap',
  'place-[a-z]+',
  'align-[a-z]+',
  'justify-[a-z]+',
  'order',
  'margin[-a-z]*',
  'padding[-a-z]*',
  'width',
  'min-width',
  'max-width',
  'height',
  'min-height',
  'max-height',
  'inset[-a-z]*',
  'top',
  'right',
  'bottom',
  'left',
  'position',
  'overflow[-a-z]*',
  'z-index',
  'aspect-ratio',
  'object-fit',
  'object-position',
  'visibility',
  'content',
  'list-style[-a-z]*',
  'border-collapse',
  'border-spacing',
  'table-layout',
  'white-space',
  'text-align',
  'vertical-align',
  'box-sizing',
];

const motionAndInteractionProperties = [
  'transition[-a-z]*',
  'transform[-a-z]*',
  'animation[-a-z]*',
  'opacity',
  'cursor',
  'user-select',
  'pointer-events',
  'will-change',
  'text-decoration[-a-z]*',
  'word-break',
  'overflow-wrap',
  'text-overflow',
  'resize',
  'scroll-[a-z-]+',
  'appearance',
];

const themeableProperties = [
  'color',
  'background',
  'background-color',
  'border',
  'border-[a-z-]+',
  'box-shadow',
  'outline',
  'outline-[a-z-]+',
  'font',
  'font-[a-z-]+',
  'line-height',
  'letter-spacing',
  'text-transform',
  'fill',
  'stroke',
  'accent-color',
  'caret-color',
];

const allowedProperties = [...layoutProperties, ...motionAndInteractionProperties, ...themeableProperties];

const propertyOutsideTheAllowedSet = `/^(?!--)(?!(?:${allowedProperties.join('|')})$).+$/`;

const literalColour = ['/#[0-9a-fA-F]{3,8}\\b/', '/\\brgba?\\(/', '/\\bhsla?\\(/', '/\\bcolor-mix\\(/'];

const colourValuedProperties = [
  'color',
  'background',
  'background-color',
  'border',
  'border-color',
  'border-top',
  'border-right',
  'border-bottom',
  'border-left',
  'border-top-color',
  'border-right-color',
  'border-bottom-color',
  'border-left-color',
  'outline',
  'outline-color',
  'fill',
  'stroke',
  'accent-color',
  'caret-color',
  'box-shadow',
  'text-shadow',
];

const literalColourBans = Object.fromEntries(colourValuedProperties.map((property) => [property, literalColour]));

const tokenOnlyTypography = {
  'font-size': ['/^var\\(--font-size-/', 'inherit'],
  'font-weight': ['/^var\\(--font-weight-/', 'inherit'],
  'letter-spacing': ['/^var\\(--letter-spacing-/', 'normal', 'inherit'],
  'font-family': ['/^var\\(--font-/', 'inherit'],
};

export default {
  rules: {},
  overrides: [
    {
      files: ['src/**/*.component.css'],
      rules: {
        'property-disallowed-list': [
          [propertyOutsideTheAllowedSet],
          {
            message: (property) =>
              `"${property}" is not a layout, motion or themeable property. Component stylesheets hold a page's own arrangement; appearance that repeats belongs in styles.css as a named primitive with a DESIGN.md Components entry.`,
          },
        ],
        'declaration-property-value-disallowed-list': [
          literalColourBans,
          {
            message: (property) =>
              `"${property}" uses a literal colour. Use a var(--color-*) / var(--shadow-*) token so both Reading Room and After Hours stay in step.`,
          },
        ],
        'declaration-property-value-allowed-list': [
          { 'box-shadow': ['/var\\(--shadow-/', 'none'], ...tokenOnlyTypography },
          {
            message: (property) =>
              property === 'box-shadow'
                ? 'box-shadow must use a var(--shadow-*) token — the three-step scale is the whole elevation vocabulary.'
                : `"${property}" must use a design token, not a literal. The type scale is named by role in styles.css and tabulated in DESIGN.md; a literal here drifts from that table silently.`,
          },
        ],
      },
    },
  ],
};
