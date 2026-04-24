import { JakeClassic } from './JakeClassic';
import { TwoColumnModern } from './TwoColumnModern';
import { TraditionalTemplate } from './TraditionalTemplate';
import { ProfessionalTemplate } from './ProfessionalTemplate';
import { PrecisionATS } from './PrecisionATS';
import { HeaderATS } from './HeaderATS';
import { ModernTemplate } from './ModernTemplate';
import type { TemplateProps } from './types';

export { JakeClassic } from './JakeClassic';
export { TwoColumnModern } from './TwoColumnModern';
export { TraditionalTemplate } from './TraditionalTemplate';
export { ProfessionalTemplate } from './ProfessionalTemplate';
export { PROFESSIONAL_MAIN_COLORS } from './ProfessionalTemplate';
export { PrecisionATS } from './PrecisionATS';
export { PRAGUE_COLORS } from './PrecisionATS';
export { HeaderATS } from './HeaderATS';
export { HEADER_ATS_COLORS } from './HeaderATS';
export { ModernTemplate } from './ModernTemplate';
export { MODERN_MAIN_COLORS } from './ModernTemplate';
export type { ProfileData, TemplateProps } from './types';
export { getVisibleSections, dateRange } from './types';

// ─── Template registry ───────────────────────────────────────────────────────
// Drop this map into ResumeBuilderPage and replace the hardcoded preview div
// with:
//
//   const ActiveTemplate = TEMPLATE_COMPONENTS[selectedTemplate];
//   return <ActiveTemplate profile={profileData} />;
//
// That's it. Template switching now works with zero conditional logic.
// ─────────────────────────────────────────────────────────────────────────────

export type TemplateId =
  | 'jake-classic'
  | 'two-column-modern'
  | 'traditional'
  | 'professional'
  | 'precision-ats'
  | 'header-ats'
  | 'modern';

export const TEMPLATE_COMPONENTS: Record<TemplateId, React.FC<TemplateProps>> = {
  'jake-classic': JakeClassic,
  'two-column-modern': TwoColumnModern,
  traditional: TraditionalTemplate,
  professional: ProfessionalTemplate,
  'precision-ats': PrecisionATS,
  'header-ats': HeaderATS,
  modern: ModernTemplate,
};

/** Single source of truth for valid ids (use when resolving saved `selected_template` strings). */
export const VALID_TEMPLATE_IDS = new Set<TemplateId>(Object.keys(TEMPLATE_COMPONENTS) as TemplateId[]);

export function isValidTemplateId(value: unknown): value is TemplateId {
  return typeof value === 'string' && VALID_TEMPLATE_IDS.has(value as TemplateId);
}

export const TEMPLATE_REGISTRY: Array<{
  id: TemplateId;
  displayName: string;
  description: string;
  tag: string;
  bestFor: string;
}> = [
  {
    id: 'jake-classic',
    displayName: "Jake's Classic",
    description: 'Single-column, black & white. The gold standard for tech roles.',
    tag: 'Best ATS score',
    bestFor: 'Software, Data, ML, CS graduates',
  },
  {
    id: 'two-column-modern',
    displayName: 'Modern Two-Column',
    description: 'Navy sidebar + white main. Skills always visible alongside experience.',
    tag: 'Popular for tech & product',
    bestFor: 'Product, Marketing, Design, Operations',
  },
  {
    id: 'traditional',
    displayName: 'Traditional',
    description: 'Classic serif resume with timeless styling and formal structure.',
    tag: 'Classic format',
    bestFor: 'Academia, Law, Consulting',
  },
  {
    id: 'professional',
    displayName: 'Professional',
    description: 'Polished corporate layout with strong visual hierarchy.',
    tag: 'Corporate-ready',
    bestFor: 'Business, Operations, Finance',
  },
  {
    id: 'precision-ats',
    displayName: 'Precision ATS',
    description: 'Minimal high-compatibility format optimized for ATS parsing.',
    tag: 'ATS-focused',
    bestFor: 'ATS-heavy hiring workflows',
  },
  {
    id: 'header-ats',
    displayName: 'Header ATS',
    description: 'ATS-safe format with a strong header and clean body structure.',
    tag: 'ATS + modern header',
    bestFor: 'General professional roles',
  },
  {
    id: 'modern',
    displayName: 'Modern',
    description: 'Contemporary single-column design with clean accent styling.',
    tag: 'Modern look',
    bestFor: 'Product, Design, Marketing',
  },
];

// ─── Suggested template per profession ──────────────────────────────────────
export const PROFESSION_DEFAULT_TEMPLATE: Record<string, TemplateId> = {
  software: 'precision-ats',
  data: 'precision-ats',
  product: 'modern',
  design: 'modern',
  marketing: 'modern',
  operations: 'professional',
  finance: 'professional',
  consulting: 'traditional',
  law: 'traditional',
  healthcare: 'professional',
  academia: 'traditional',
  other: 'jake-classic',
};
