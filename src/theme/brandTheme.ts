import { applyTheme, type Theme } from '@cloudscape-design/components/theming';

/**
 * Crum & Forster brand theme for QA Platform.
 *
 * Approach (per design): keep Cloudscape's proven status colors + neutral gray
 * ramp, and override only the PRIMARY / accent to brand. Light theme only.
 *
 *   #005EB8  C&F blue   (primary)
 *   #003865  navy       (darker accent / active states)
 *   #FFD633  gold       (accent / highlight — used sparingly, not as text)
 */
export const BRAND = {
  blue: '#005EB8',
  blueHover: '#00478C',
  navy: '#003865',
  gold: '#FFD633',
} as const;

const theme: Theme = {
  tokens: {
    // Primary buttons -> C&F blue, hover/active darken toward navy
    colorBackgroundButtonPrimaryDefault: BRAND.blue,
    colorBackgroundButtonPrimaryHover: BRAND.blueHover,
    colorBackgroundButtonPrimaryActive: BRAND.navy,
    // Links + accents -> brand blue
    colorTextAccent: BRAND.blue,
    colorTextLinkDefault: BRAND.blue,
    colorTextLinkHover: BRAND.navy,
    // Focus/selection accents
    colorBorderItemFocused: BRAND.blue,
  },
};

export function applyBrandTheme(): void {
  applyTheme({ theme });
}
