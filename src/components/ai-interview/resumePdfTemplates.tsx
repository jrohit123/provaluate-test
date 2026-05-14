import React from 'react';
import {
  Document,
  Font,
  Image,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from '@react-pdf/renderer';
import { HEADER_ATS_COLORS, MODERN_MAIN_COLORS, PROFESSIONAL_MAIN_COLORS, isValidTemplateId, type TemplateId as BuilderTemplateId } from '@/components/resume-templates';

// PDF fonts
// Keep Helvetica for body, and register local Georgia files for Precision ATS serif headings.
Font.register({
  family: 'Georgia',
  fonts: [
    { src: `${import.meta.env.BASE_URL}fonts/Georgia.ttf`, fontWeight: 400 },
    { src: `${import.meta.env.BASE_URL}fonts/Georgia-Bold.ttf`, fontWeight: 700 },
    { src: `${import.meta.env.BASE_URL}fonts/Georgia-Italic.ttf`, fontStyle: 'italic' },
    { src: `${import.meta.env.BASE_URL}fonts/Georgia-BoldItalic.ttf`, fontWeight: 700, fontStyle: 'italic' },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

export type TemplateId = BuilderTemplateId;

type ProfileData = {
  personal?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin_url?: string;
    website_url?: string;
    portfolio_url?: string;
    github_url?: string;
    headline?: string;
    photo_url?: string;
    custom_links?: Array<{ label?: string; url?: string }>;
  } | string;
  summary?: string;
  experience?: Array<{
    job_title?: string;
    employer?: string;
    employment_type?: string;
    work_mode?: string;
    start_date?: string;
    end_date?: string;
    location?: string;
    bullets?: string[];
  }>;
  education?: Array<{
    institution?: string;
    degree?: string;
    field_of_study?: string;
    start_date?: string;
    end_date?: string;
    location?: string;
    gpa?: string;
    achievements?: string;
  }>;
  projects?: Array<{
    name?: string;
    project_type?: string;
    tech_stack?: string;
    url?: string;
    repo_url?: string;
    bullets?: string[];
  }>;
  skills?: Array<{ category?: string; items?: string[] }>;
  certifications?: Array<{ name?: string; issuer?: string; issue_date?: string; expiry_date?: string; credential_id?: string; url?: string }>;
  languages?: Array<{ language?: string; proficiency?: string }>;
  awards?: Array<{ title?: string; issuer?: string; year?: string; description?: string }>;
  publications?: Array<{ title?: string; year?: string; journal_or_conference?: string; url?: string }>;
  references?: Array<{ name?: string; job_title?: string; company?: string; email?: string }>;
  organisations?: Array<{ title?: string; role?: string; start_date?: string; end_date?: string; description?: string }>;
  courses?: Array<{ title?: string; provider?: string; completion_date?: string; description?: string }>;
  interests?: Array<string | { title?: string; description?: string }>;
  declaration?: string;
  custom_sections?: Array<{
    section_title?: string;
    title?: string;
    description?: string;
    items?: Array<string | { title?: string; description?: string }>;
  }>;
  resume_config?: {
    section_order?: string[];
    hidden_sections?: string[];
    precision_accent_color?: string;
    professional_main_color?: string;
    header_main_color?: string;
    modern_main_color?: string;
  };
};

const styles = StyleSheet.create({
  page: { padding: 28, fontFamily: 'Helvetica', fontSize: 10, color: '#0f172a' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
});

function DiamondBullet({ color = '#111111' }: { color?: string }) {
  return (
    <View
      style={{
        width: 5.5,
        height: 5.5,
        backgroundColor: color,
        transform: 'rotate(45deg)',
        marginRight: 5,
        marginTop: 1.5,
        flexShrink: 0,
      }}
    />
  );
}

/** Visual tokens for section blocks — each template gets its own theme so PDFs match preview. */
type PdfSectionTheme = {
  mode?: 'default' | 'precision' | 'traditional' | 'professional' | 'modern';
  section: Record<string, unknown>;
  sectionTitle: Record<string, unknown>;
  /** null = no horizontal rule under section title (e.g. Professional uses left bar only) */
  titleDivider: { borderBottomWidth: number; borderBottomColor: string; marginBottom: number } | null;
  bodyText: Record<string, unknown>;
  itemTitle: Record<string, unknown>;
  itemMetaItalic: Record<string, unknown>;
  dateText: Record<string, unknown>;
  locationText: Record<string, unknown>;
  bulletText: Record<string, unknown>;
  linkSmall: Record<string, unknown>;
  genericLine: Record<string, unknown>;
};

const JAKE_SECTION_THEME: PdfSectionTheme = {
  section: { marginBottom: 10 },
  sectionTitle: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.9, marginBottom: 2, color: '#0f172a' },
  titleDivider: { borderBottomWidth: 1, borderBottomColor: '#000000', marginBottom: 4 },
  bodyText: { fontSize: 9.5, lineHeight: 1.55, color: '#1a1a1a' },
  itemTitle: { fontSize: 10, fontWeight: 700, color: '#0f172a' },
  itemMetaItalic: { fontSize: 9.5, fontStyle: 'italic', color: '#222222' },
  dateText: { fontSize: 9, color: '#333333' },
  locationText: { fontSize: 9, color: '#444444' },
  bulletText: { fontSize: 9.5, marginLeft: 16, marginTop: 2, color: '#1a1a1a' },
  linkSmall: { fontSize: 8.5, color: '#475569', fontStyle: 'italic' },
  genericLine: { fontSize: 9.5, marginTop: 2, color: '#1a1a1a' },
};

const TRADITIONAL_SECTION_THEME: PdfSectionTheme = {
  mode: 'traditional',
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 10.5,
    fontWeight: 700,
    fontFamily: 'Georgia',
    textTransform: 'uppercase',
    letterSpacing: 2.5,
    color: '#000000',
    textAlign: 'center',
    marginTop: 4,
    marginBottom: 4,
    paddingTop: 3,
    paddingBottom: 3,
    paddingHorizontal: 4,
    backgroundColor: '#ececec',
    borderTopWidth: 1,
    borderTopColor: '#444444',
    borderBottomWidth: 1,
    borderBottomColor: '#444444',
  },
  titleDivider: null,
  bodyText: { fontSize: 10, lineHeight: 1.65, color: '#222222', textAlign: 'justify', fontFamily: 'Georgia' },
  itemTitle: { fontSize: 10.5, fontWeight: 700, color: '#111111', fontFamily: 'Georgia' },
  itemMetaItalic: { fontSize: 10, fontStyle: 'italic', color: '#333333', fontFamily: 'Georgia' },
  dateText: { fontSize: 9.5, color: '#444444' },
  locationText: { fontSize: 9.5, color: '#555555' },
  bulletText: { fontSize: 10, marginLeft: 0, marginTop: 2, color: '#222222', fontFamily: 'Georgia', fontStyle: 'italic' },
  linkSmall: { fontSize: 9, color: '#555555', fontStyle: 'italic' },
  genericLine: { fontSize: 10, marginTop: 2, color: '#222222' },
};

const PROFESSIONAL_SECTION_THEME: PdfSectionTheme = {
  mode: 'professional',
  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 700,
    fontFamily: 'Georgia',
    color: '#1a2535',
    marginBottom: 3,
    paddingBottom: 3,
    borderBottomWidth: 1,
    borderBottomColor: '#cccccc',
  },
  titleDivider: null,
  bodyText: { fontSize: 9.5, lineHeight: 1.65, color: '#444444' },
  itemTitle: { fontSize: 10.5, fontWeight: 700, color: '#1a2535' },
  itemMetaItalic: { fontSize: 9, fontStyle: 'italic', color: '#666666' },
  dateText: { fontSize: 7.5, color: '#1a7a72', textTransform: 'uppercase' as const },
  locationText: { fontSize: 8.5, color: '#888888' },
  bulletText: { fontSize: 9.5, marginLeft: 14, marginTop: 2, color: '#444444' },
  linkSmall: { fontSize: 8.5, color: '#666666', fontStyle: 'italic' },
  genericLine: { fontSize: 9.5, marginTop: 2, color: '#444444' },
};

function professionalTheme(mainColor: string): PdfSectionTheme {
  return {
    ...PROFESSIONAL_SECTION_THEME,
    sectionTitle: {
      ...PROFESSIONAL_SECTION_THEME.sectionTitle,
      color: mainColor,
    },
    itemTitle: {
      ...PROFESSIONAL_SECTION_THEME.itemTitle,
      color: mainColor,
    },
  };
}

const PRECISION_SECTION_THEME: PdfSectionTheme = {
  mode: 'precision',
  section: { marginTop: 16, marginBottom: 4 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 400,
    fontFamily: 'Georgia',
    color: '#C25C24',
    marginBottom: 6,
    paddingBottom: 2,
    borderBottomWidth: 0.5,
    borderBottomColor: '#dddddd',
  },
  titleDivider: null,
  bodyText: { fontSize: 10, lineHeight: 1.55, color: '#111111' },
  itemTitle: { fontSize: 12, fontWeight: 400, fontFamily: 'Georgia', color: '#000000' },
  itemMetaItalic: { fontSize: 10, color: '#C25C24' },
  dateText: { fontSize: 10, color: '#555555' },
  locationText: { fontSize: 10, color: '#555555' },
  bulletText: { fontSize: 10, marginLeft: 14, marginTop: 2, marginBottom: 1.5, lineHeight: 1.55, color: '#111111' },
  linkSmall: { fontSize: 9, color: '#555555' },
  genericLine: { fontSize: 10, marginTop: 2, color: '#111111' },
};

function resolveHeaderAtsPalette(mainColor: string): { headerBg: string; borderColor: string } {
  if (mainColor === '#8f9ab3') return { headerBg: '#d7dce8', borderColor: '#c4ccdb' };
  if (mainColor === '#c9a0c2') return { headerBg: '#e6d0e2', borderColor: '#d9bfd4' };
  if (mainColor === '#6366d1') return { headerBg: '#d7d8f1', borderColor: '#c4c7e8' };
  return { headerBg: '#cdd8c6', borderColor: '#c8d4c4' };
}

function headerAtsTheme(mainColor: string, borderColor: string): PdfSectionTheme {
  return {
    section: { marginBottom: 16 },
    sectionTitle: {
      fontSize: 18,
      fontWeight: 400,
      letterSpacing: 0,
      color: mainColor,
      marginBottom: 4,
      paddingBottom: 4,
      borderBottomWidth: 0.75,
      borderBottomColor: borderColor,
    },
    titleDivider: null,
    bodyText: { fontSize: 10, lineHeight: 1.55, color: '#1a1a1a' },
    itemTitle: { fontSize: 10, fontWeight: 400, fontStyle: 'italic', color: mainColor },
    itemMetaItalic: { fontSize: 9.5, fontStyle: 'italic', color: '#555555' },
    dateText: { fontSize: 9, color: '#555555' },
    locationText: { fontSize: 9, color: '#718096' },
    bulletText: { fontSize: 9.5, marginLeft: 14, marginTop: 2, color: '#2d3748' },
    linkSmall: { fontSize: 8.5, color: '#718096', fontStyle: 'italic' },
    genericLine: { fontSize: 10, marginTop: 2, color: '#1a1a1a' },
  };
}

const MODERN_SECTION_THEME: PdfSectionTheme = {
  mode: 'modern',
  section: { marginBottom: 16 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    fontStyle: 'italic',
    textTransform: 'none',
    letterSpacing: 0,
    color: '#1a1a1a',
    marginBottom: 3,
    paddingBottom: 3,
    borderBottomWidth: 0.75,
    borderBottomColor: '#cccccc',
  },
  titleDivider: null,
  bodyText: { fontSize: 9.5, lineHeight: 1.7, color: '#333333' },
  itemTitle: { fontSize: 10, fontWeight: 700, color: '#1a1a2e' },
  itemMetaItalic: { fontSize: 9, fontStyle: 'italic', color: '#555555' },
  dateText: { fontSize: 8, color: '#9B1B1B', fontStyle: 'italic' },
  locationText: { fontSize: 8.5, color: '#888888' },
  bulletText: { fontSize: 9.5, marginLeft: 12, marginTop: 2, color: '#333333' },
  linkSmall: { fontSize: 8.5, color: '#1a7a72' },
  genericLine: { fontSize: 9.5, marginTop: 2, color: '#333333' },
};

const TWO_COLUMN_MAIN_SECTION_THEME: PdfSectionTheme = {
  section: { marginBottom: 12, marginTop: 4 },
  sectionTitle: {
    fontSize: 10,
    fontWeight: 700,
    color: '#1e3a5f',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 2,
    paddingBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#1e3a5f',
  },
  titleDivider: null,
  bodyText: { fontSize: 9.5, lineHeight: 1.55, color: '#1e293b' },
  itemTitle: { fontSize: 10.5, fontWeight: 700, color: '#0f172a' },
  itemMetaItalic: { fontSize: 9.5, fontStyle: 'italic', color: '#334155' },
  dateText: { fontSize: 9, color: '#1e3a5f', fontWeight: 700 },
  locationText: { fontSize: 9, color: '#64748b' },
  bulletText: { fontSize: 9.5, marginLeft: 14, marginTop: 2, color: '#1e293b' },
  linkSmall: { fontSize: 8.5, color: '#64748b', fontStyle: 'italic' },
  genericLine: { fontSize: 9.5, marginTop: 2, color: '#1e293b' },
};

const TWO_COLUMN_VARIANT = {
  sidebarBg: '#1e3a5f',
  sidebarAccent: '#7dd3fc',
  sidebarText: '#bfdbfe',
  mainAccent: '#1e3a5f',
} as const;

function getVisibleSections(profileData: ProfileData): string[] {
  const defaultOrder = ['personal', 'summary', 'experience', 'projects', 'education', 'skills', 'certifications', 'languages', 'awards', 'publications', 'references', 'organisations', 'courses', 'interests', 'declaration', 'custom_sections'];
  const hasContent = (value: unknown): boolean => {
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
    return false;
  };
  const dynamicKeys = Object.keys(profileData as Record<string, unknown>).filter(
    (key) => !['profession', 'resume_config'].includes(key) && hasContent((profileData as Record<string, unknown>)[key]),
  );
  const order = profileData.resume_config?.section_order?.length ? profileData.resume_config.section_order : defaultOrder;
  const mergedOrder = [...order];
  dynamicKeys.forEach((key) => {
    if (!mergedOrder.includes(key)) mergedOrder.push(key);
  });
  const hidden = new Set(profileData.resume_config?.hidden_sections ?? []);
  return mergedOrder.filter((section) => !hidden.has(section) && (section === 'personal' || hasContent((profileData as Record<string, unknown>)[section])));
}

function normalizePersonal(personal: ProfileData['personal']): NonNullable<Exclude<ProfileData['personal'], string>> {
  if (typeof personal === 'string') return { headline: personal };
  return personal ?? {};
}

function buildPrecisionContactLines(personal: ReturnType<typeof normalizePersonal>): Array<{ text: string; href?: string }> {
  const compactLink = (value?: string) => (value ?? '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const toHref = (value: string) => (value.startsWith('http') || value.startsWith('mailto:') ? value : `https://${value}`);
  const lines: Array<{ text: string; href?: string }> = [];
  if (personal.email) lines.push({ text: personal.email, href: `mailto:${personal.email}` });
  if (personal.phone) lines.push({ text: personal.phone });
  if (personal.location) lines.push({ text: personal.location });
  if (personal.linkedin_url) lines.push({ text: compactLink(personal.linkedin_url), href: toHref(personal.linkedin_url) });
  if (personal.github_url) lines.push({ text: compactLink(personal.github_url), href: toHref(personal.github_url) });
  if (personal.website_url) lines.push({ text: compactLink(personal.website_url), href: toHref(personal.website_url) });
  if (personal.portfolio_url && personal.portfolio_url !== personal.website_url) {
    lines.push({ text: compactLink(personal.portfolio_url), href: toHref(personal.portfolio_url) });
  }
  (personal.custom_links ?? []).forEach((link) => {
    if (link?.url) {
      const compact = compactLink(link.url);
      lines.push({ text: link.label ? `${link.label}: ${compact}` : compact, href: toHref(link.url) });
    }
  });
  return lines;
}

function sectionLabel(key: string): string {
  const labels: Record<string, string> = {
    custom_sections: 'Custom Sections',
    organisations: 'Organisations',
    courses: 'Courses & Training',
  };
  return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function renderGenericArrayThemed(list: Array<unknown>, bulletStyle: Record<string, unknown>, lineStyle: Record<string, unknown>) {
  return list.map((entry, i) => {
    if (typeof entry === 'string') return <Text key={i} style={bulletStyle}>• {entry}</Text>;
    if (!entry || typeof entry !== 'object') return null;
    const obj = entry as Record<string, unknown>;
    const title = (obj.title ?? obj.name ?? obj.role ?? '') as string;
    const description = (obj.description ?? obj.details ?? '') as string;
    return (
      <Text key={i} style={lineStyle}>
        {title ? `${title}${description ? ` — ${description}` : ''}` : description}
      </Text>
    );
  });
}

function SectionTitleDivider({ theme }: { theme: PdfSectionTheme }) {
  if (!theme.titleDivider) return null;
  return <View style={theme.titleDivider} />;
}

function renderThemedSection(sectionKey: string, profileData: ProfileData, theme: PdfSectionTheme) {
  const profileRecord = profileData as Record<string, unknown>;
  const t = theme;
  switch (sectionKey) {
    case 'summary':
      return profileData.summary ? (
        <View style={t.section} key={sectionKey}>
          <Text style={t.sectionTitle}>{t.mode === 'traditional' || t.mode === 'professional' ? 'Profile' : 'Summary'}</Text>
          <SectionTitleDivider theme={t} />
          <Text style={{ ...t.bodyText, ...(t.mode === 'traditional' ? { fontStyle: 'italic' } : {}) }}>{profileData.summary}</Text>
        </View>
      ) : null;
    case 'experience':
      return profileData.experience?.length ? (
        <View style={t.section} key={sectionKey}>
          <Text style={t.sectionTitle}>{t.mode === 'traditional' ? 'Experience' : t.mode === 'professional' ? 'Employment History' : 'Professional Experience'}</Text>
          <SectionTitleDivider theme={t} />
          {profileData.experience.map((exp, i) => (
            <View key={i} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                {t.mode === 'traditional' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <DiamondBullet />
                    <Text style={t.itemTitle}>
                      {`${exp.job_title ?? ''}${exp.employer ? ` - ${exp.employer}` : ''}${exp.employment_type ? ` · ${exp.employment_type}` : ''}`}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ ...t.itemTitle, flex: 1 }}>{exp.job_title}</Text>
                )}
                {t.mode === 'traditional' ? (
                  <View
                    style={{
                      flex: 1,
                      borderBottomWidth: 0.75,
                      borderBottomColor: '#999999',
                      borderBottomStyle: 'dashed',
                      marginBottom: 2.5,
                      marginHorizontal: 4,
                    }}
                  />
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                <Text style={{ ...t.dateText, textAlign: 'right', flexShrink: 0 }}>
                  {[exp.start_date, exp.end_date].filter(Boolean).join(' – ')}
                </Text>
              </View>
              {t.mode === 'traditional' ? (
                <>
                  {exp.location ? (
                    <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                      <Text style={{ ...t.locationText, textAlign: 'right' }}>{exp.location}</Text>
                    </View>
                  ) : null}
                  {exp.work_mode ? <Text style={{ ...t.itemMetaItalic }}>{exp.work_mode}</Text> : null}
                </>
              ) : (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ ...t.itemMetaItalic, flex: 1 }}>
                    {exp.employer}
                    {exp.employment_type ? ` · ${exp.employment_type}` : ''}
                    {exp.work_mode ? ` · ${exp.work_mode}` : ''}
                  </Text>
                  <Text style={{ ...t.locationText, textAlign: 'right', flexShrink: 0 }}>{exp.location}</Text>
                </View>
              )}
              {(exp.bullets ?? []).filter(Boolean).map((b, j) => (
                <Text key={j} style={t.bulletText}>
                  • {b}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null;
    case 'education':
      return profileData.education?.length ? (
        <View style={t.section} key={sectionKey} wrap={t.mode === 'traditional' ? false : undefined}>
          <Text style={t.sectionTitle}>Education</Text>
          <SectionTitleDivider theme={t} />
          {profileData.education.map((edu, i) => (
            <View key={i} style={{ marginBottom: 6 }} wrap={t.mode === 'traditional' ? false : undefined}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                {t.mode === 'traditional' ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <DiamondBullet />
                    <Text style={t.itemTitle}>
                      {[edu.degree, edu.field_of_study].filter(Boolean).join(', ') || edu.institution || ''}
                    </Text>
                  </View>
                ) : (
                  <Text style={{ ...t.itemTitle, flex: 1 }}>{edu.institution}</Text>
                )}
                {t.mode === 'traditional' ? (
                  <View
                    style={{
                      flex: 1,
                      borderBottomWidth: 0.75,
                      borderBottomColor: '#999999',
                      borderBottomStyle: 'dashed',
                      marginBottom: 2.5,
                      marginHorizontal: 4,
                    }}
                  />
                ) : (
                  <View style={{ flex: 1 }} />
                )}
                <Text style={{ ...t.dateText, textAlign: 'right', flexShrink: 0 }}>
                  {[edu.start_date, edu.end_date].filter(Boolean).join(' – ')}
                </Text>
              </View>
              {t.mode !== 'traditional' ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ ...t.itemMetaItalic, flex: 1 }}>
                    {[edu.degree, edu.field_of_study].filter(Boolean).join(', ')}
                    {edu.gpa ? ` — ${edu.gpa}` : ''}
                  </Text>
                  <Text style={{ ...t.locationText, textAlign: 'right', flexShrink: 0 }}>{edu.location}</Text>
                </View>
              ) : null}
              {t.mode === 'traditional' ? (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                  <Text style={{ ...t.itemMetaItalic, flex: 1 }}>
                    {edu.institution || ''}
                    {edu.gpa ? ` — GPA: ${edu.gpa}` : ''}
                  </Text>
                  <Text style={{ ...t.locationText, textAlign: 'right', flexShrink: 0 }}>
                    {edu.location || ''}
                  </Text>
                </View>
              ) : null}
              {edu.achievements ? <Text style={{ ...t.locationText, marginTop: 1 }}>{edu.achievements}</Text> : null}
            </View>
          ))}
        </View>
      ) : null;
    case 'projects':
      return profileData.projects?.length ? (
        <View style={t.section} key={sectionKey}>
          <Text style={t.sectionTitle}>Projects</Text>
          <SectionTitleDivider theme={t} />
          {profileData.projects.map((proj, i) => (
            <View key={i} style={{ marginBottom: 8, paddingTop: 6 }} wrap={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}>
                <Text style={{ ...t.itemTitle, flex: 1 }}>{proj.name}</Text>
                {proj.project_type ? <Text style={{ ...t.locationText, textAlign: 'right', flexShrink: 0 }}>{proj.project_type}</Text> : null}
              </View>
              {proj.url || proj.repo_url ? <Text style={t.linkSmall}>{proj.url || proj.repo_url}</Text> : null}
              {proj.tech_stack ? <Text style={{ ...t.itemMetaItalic, marginTop: 1 }}>{proj.tech_stack}</Text> : null}
              {(proj.bullets ?? []).filter(Boolean).map((b, j) => (
                <Text key={j} style={t.bulletText}>
                  • {b}
                </Text>
              ))}
            </View>
          ))}
        </View>
      ) : null;
    case 'skills':
      if (t.mode === 'modern' && profileData.skills?.length) {
        const modernBarColor =
          typeof (t.dateText as { color?: unknown }).color === 'string'
            ? ((t.dateText as { color?: string }).color as string)
            : '#9B1B1B';
        return (
          <View style={t.section} key={sectionKey}>
            <Text style={t.sectionTitle}>Skills</Text>
            {profileData.skills.flatMap((s) => s.items ?? []).map((item, i) => (
              <View key={i} style={{ marginBottom: 7 }}>
                <Text style={{ fontSize: 8, fontWeight: 700, color: '#1e1e2e', marginBottom: 2 }}>{item}</Text>
                <View style={{ height: 3, backgroundColor: '#e8e8e8', borderRadius: 2 }}>
                  <View style={{ width: '70%', height: 3, backgroundColor: modernBarColor, borderRadius: 2 }} />
                </View>
              </View>
            ))}
          </View>
        );
      }
      return profileData.skills?.length ? (
        <View style={t.section} key={sectionKey}>
          <Text style={t.sectionTitle}>Skills</Text>
          <SectionTitleDivider theme={t} />
          {profileData.skills.map((s, i) => (
            <Text key={i} style={{ ...t.bodyText, lineHeight: 1.75 }}>
              <Text style={{ fontWeight: 700 }}>{s.category}: </Text>
              {(s.items ?? []).join(', ')}
            </Text>
          ))}
        </View>
      ) : null;
    case 'certifications':
      return profileData.certifications?.length ? (
        <View style={t.section} key={sectionKey}>
          <Text style={t.sectionTitle}>Certifications</Text>
          <SectionTitleDivider theme={t} />
          {profileData.certifications.map((c, i) => {
            const metaParts = [
              [c.issuer, c.issue_date].filter(Boolean).join(' · '),
              c.expiry_date ? `Exp. ${c.expiry_date}` : '',
              c.credential_id ? `ID: ${c.credential_id}` : '',
            ].filter(Boolean).join(' — ');
            return (
              <View key={i} style={{ marginBottom: 5 }}>
                <Text style={t.itemTitle}>{c.name}</Text>
                {metaParts ? (
                  <Text style={{ ...t.itemMetaItalic, marginTop: 1 }}>{metaParts}</Text>
                ) : null}
              </View>
            );
          })}
        </View>
      ) : null;
    case 'languages':
      return profileData.languages?.length ? (
        <View style={t.section} key={sectionKey}>
          <Text style={t.sectionTitle}>Languages</Text>
          <SectionTitleDivider theme={t} />
          <Text style={t.bodyText}>
            {profileData.languages
              .map((l) => `${l.language ?? ''}${l.proficiency ? ` (${l.proficiency})` : ''}`)
              .filter(Boolean)
              .join('  ·  ')}
          </Text>
        </View>
      ) : null;
    case 'awards':
      return profileData.awards?.length ? (
        <View style={t.section} key={sectionKey}>
          <Text style={t.sectionTitle}>Awards & Honours</Text>
          <SectionTitleDivider theme={t} />
          {profileData.awards.map((a, i) => (
            <View key={i} style={{ marginBottom: 5 }}>
              <Text style={t.itemTitle}>{a.title}</Text>
              {[a.issuer, a.year].filter(Boolean).join(', ') ? (
                <Text style={{ ...t.dateText, marginTop: 1 }}>{[a.issuer, a.year].filter(Boolean).join(', ')}</Text>
              ) : null}
              {a.description ? <Text style={{ ...t.itemMetaItalic, marginTop: 1 }}>{a.description}</Text> : null}
            </View>
          ))}
        </View>
      ) : null;
    case 'publications':
      return profileData.publications?.length ? (
        <View style={t.section} key={sectionKey}>
          <Text style={t.sectionTitle}>Publications</Text>
          <SectionTitleDivider theme={t} />
          {profileData.publications.map((p, i) => (
            <Text key={i} style={{ ...t.genericLine, marginBottom: 2 }}>
              <Text style={{ fontWeight: 700 }}>{p.title}</Text>
              {p.journal_or_conference ? ` — ${p.journal_or_conference}` : ''}
              {p.year ? `, ${p.year}` : ''}
            </Text>
          ))}
        </View>
      ) : null;
    case 'references':
      return profileData.references?.length ? (
        <View style={t.section} key={sectionKey}>
          <Text style={t.sectionTitle}>References</Text>
          <SectionTitleDivider theme={t} />
          {profileData.references.map((r, i) => (
            <Text key={i} style={{ ...t.genericLine, marginBottom: 2 }}>
              <Text style={{ fontWeight: 700 }}>{r.name}</Text>
              {r.job_title || r.company ? ` — ${[r.job_title, r.company].filter(Boolean).join(', ')}` : ''}
              {r.email ? ` · ${r.email}` : ''}
            </Text>
          ))}
        </View>
      ) : null;
    case 'declaration':
      return profileData.declaration?.trim() ? (
        <View style={t.section} key={sectionKey}>
          <Text style={t.sectionTitle}>Declaration</Text>
          <SectionTitleDivider theme={t} />
          <Text style={t.bodyText}>{profileData.declaration}</Text>
        </View>
      ) : null;
    case 'custom_sections':
      return profileData.custom_sections?.length ? (
        <View style={t.section} key={sectionKey}>
          {profileData.custom_sections.map((section, i) => (
            <View key={i} style={{ marginBottom: 6 }}>
              <Text style={t.sectionTitle}>{section.section_title || section.title || `Custom Section ${i + 1}`}</Text>
              <SectionTitleDivider theme={t} />
              {section.description ? <Text style={{ ...t.bodyText, lineHeight: 1.5 }}>{section.description}</Text> : null}
              {renderGenericArrayThemed(section.items ?? [], t.bulletText, t.genericLine)}
            </View>
          ))}
        </View>
      ) : null;
    default: {
      if (!Object.prototype.hasOwnProperty.call(profileRecord, sectionKey)) return null;
      if (['personal', 'resume_config'].includes(sectionKey)) return null;
      const value = profileRecord[sectionKey];
      if (typeof value === 'string' && value.trim()) {
        return (
          <View style={t.section} key={sectionKey}>
            <Text style={t.sectionTitle}>{sectionLabel(sectionKey)}</Text>
            <SectionTitleDivider theme={t} />
            <Text style={{ ...t.bodyText, lineHeight: 1.5 }}>{value}</Text>
          </View>
        );
      }
      if (Array.isArray(value) && value.length) {
        return (
          <View style={t.section} key={sectionKey}>
            <Text style={t.sectionTitle}>{sectionLabel(sectionKey)}</Text>
            <SectionTitleDivider theme={t} />
            {renderGenericArrayThemed(value, t.bulletText, t.genericLine)}
          </View>
        );
      }
      return null;
    }
  }
}

/** Jake's Classic — centered header, Helvetica, black rules */
function JakeClassicPdf({ profileData }: { profileData: ProfileData }) {
  const visibleSections = getVisibleSections(profileData);
  const personal = normalizePersonal(profileData.personal);
  const showPersonal = visibleSections.includes('personal');
  const contactItems = [personal.phone, personal.email, personal.linkedin_url, personal.github_url, personal.website_url].filter(Boolean).join(' | ');

  return (
    <Page size="A4" style={[styles.page, { padding: 28 }]}>
      {showPersonal ? (
        <>
          <Text style={{ fontSize: 22, fontWeight: 700, textAlign: 'center', letterSpacing: 1.8, marginBottom: 4 }}>{personal.full_name || 'Candidate Name'}</Text>
          {personal.headline ? (
            <Text style={{ fontSize: 9, color: '#444444', textAlign: 'center', fontStyle: 'italic', marginBottom: 3 }}>{personal.headline}</Text>
          ) : null}
          <Text style={{ fontSize: 9, color: '#333333', textAlign: 'center', marginBottom: 6 }}>{contactItems}</Text>
          <View style={{ borderBottomWidth: 1, borderBottomColor: '#000000', marginBottom: 8 }} />
        </>
      ) : null}
      {visibleSections.map((sectionKey) => renderThemedSection(sectionKey, profileData, JAKE_SECTION_THEME))}
    </Page>
  );
}

/** Traditional — Times-Roman feel, centered uppercase name, double rule */
function TraditionalPdf({ profileData }: { profileData: ProfileData }) {
  const visibleSections = getVisibleSections(profileData);
  const personal = normalizePersonal(profileData.personal);
  const showPersonal = visibleSections.includes('personal');
  const compactLink = (value?: string) => (value ?? '').replace(/^https?:\/\//i, '').replace(/\/$/, '');
  const customLinkTexts = (personal.custom_links ?? [])
    .map((cl) => compactLink(cl.url))
    .filter(Boolean);
  const contactItems = [personal.phone, personal.email, personal.linkedin_url, personal.github_url, personal.website_url, ...customLinkTexts]
    .map((item) => compactLink(item))
    .filter(Boolean) as string[];

  return (
    <Page
      size="A4"
      style={{
        paddingTop: 56,
        paddingHorizontal: 72,
        paddingBottom: 56,
        fontFamily: 'Georgia',
        fontSize: 10.5,
        color: '#111111',
      }}
    >
      {showPersonal ? (
        <>
          <Text style={{ fontSize: 27, fontWeight: 700, textAlign: 'center', letterSpacing: 0.5, marginBottom: 3 }}>
            {personal.full_name || `${personal.first_name ?? ''} ${personal.last_name ?? ''}`.trim() || 'Candidate Name'}
          </Text>
          {personal.headline ? (
            <Text style={{ textAlign: 'center', fontSize: 11, color: '#333333', marginBottom: 4 }}>{personal.headline}</Text>
          ) : null}
          {personal.location ? (
            <Text style={{ textAlign: 'center', fontSize: 9, color: '#555555', marginBottom: 5 }}>{personal.location}</Text>
          ) : null}
          <View style={{
            borderTopWidth: 1,
            borderTopColor: '#555555',
            borderBottomWidth: 1,
            borderBottomColor: '#555555',
            paddingTop: 5,
            paddingBottom: 5,
            paddingHorizontal: 2,
            marginTop: 3,
            marginBottom: 3,
          }}>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
              {contactItems.map((item, idx) => (
                <Text key={idx} style={{ fontSize: 8.9, color: '#444444', lineHeight: 1.25, marginRight: idx === contactItems.length - 1 ? 0 : 6, marginBottom: 1 }}>
                  {item}
                  {idx < contactItems.length - 1 ? ' ·' : ''}
                </Text>
              ))}
            </View>
          </View>
        </>
      ) : null}
      {visibleSections.map((sectionKey) => renderThemedSection(sectionKey, profileData, TRADITIONAL_SECTION_THEME))}
    </Page>
  );
}

function ProfessionalPdf({ profileData }: { profileData: ProfileData }) {
  const visibleSections = getVisibleSections(profileData);
  const personal = normalizePersonal(profileData.personal);
  const showPersonal = visibleSections.includes('personal');
  const mainColor = profileData.resume_config?.professional_main_color ?? PROFESSIONAL_MAIN_COLORS[4];
  const dynamicTheme = professionalTheme(mainColor);

  const sidebarExclude = new Set(['personal', 'skills', 'languages', 'resume_config']);
  const mainSections = visibleSections.filter((s) => !sidebarExclude.has(s));
  const skillItems = (profileData.skills ?? []).flatMap((s) => s.items ?? []).filter(Boolean);

  const sidebarLabel = {
    fontSize: 9,
    fontWeight: 700,
    color: '#ffffff',
    marginBottom: 6,
    letterSpacing: 0.2,
  } as const;

  const sidebarText = {
    fontSize: 8,
    color: '#b0c8de',
    lineHeight: 1.5,
    marginBottom: 4,
  } as const;

  return (
    <Page size="A4" style={{ padding: 0, fontFamily: 'Helvetica', flexDirection: 'row' }}>
      <View style={{ width: 165, backgroundColor: mainColor, padding: 24, paddingTop: 30, alignItems: 'center' }}>
        <View
          style={{
            width: 64,
            height: 64,
            borderRadius: 0,
            backgroundColor: '#2d3f55',
            marginBottom: 12,
            overflow: 'hidden',
          }}
        >
          {personal.photo_url ? (
            <Image
              src={personal.photo_url}
              style={{
                width: 64,
                height: 64,
                borderRadius: 0,
                objectFit: 'cover',
              }}
            />
          ) : null}
        </View>

        {showPersonal ? (
          <>
            <Text style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', textAlign: 'center', marginBottom: 4, lineHeight: 1.3 }}>
              {personal.full_name || `${personal.first_name ?? ''} ${personal.last_name ?? ''}`.trim() || 'Your Name'}
            </Text>
            {personal.headline ? (
              <Text style={{ fontSize: 7, color: '#8fa3b8', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 12, lineHeight: 1.5 }}>
                {personal.headline}
              </Text>
            ) : null}
            <View style={{ width: '100%', marginBottom: 14 }}>
              <Text style={sidebarLabel}>Details</Text>
              {personal.location ? <Text style={sidebarText}>{personal.location}</Text> : null}
              {personal.phone ? <Text style={sidebarText}>{personal.phone}</Text> : null}
              {personal.email ? <Text style={sidebarText}>{personal.email}</Text> : null}
              {personal.linkedin_url ? (
                <Text style={sidebarText}>{personal.linkedin_url.replace(/^https?:\/\//i, '').replace(/\/$/, '')}</Text>
              ) : null}
              {personal.github_url ? (
                <Text style={sidebarText}>{personal.github_url.replace(/^https?:\/\//i, '').replace(/\/$/, '')}</Text>
              ) : null}
              {personal.website_url ? (
                <Text style={sidebarText}>{personal.website_url.replace(/^https?:\/\//i, '').replace(/\/$/, '')}</Text>
              ) : null}
            </View>
          </>
        ) : null}

        {skillItems.length > 0 && visibleSections.includes('skills') ? (
          <View style={{ width: '100%', marginBottom: 14 }}>
            <Text style={sidebarLabel}>Skills</Text>
            {skillItems.map((item, i) => (
              <View
                key={i}
                style={{
                  backgroundColor: 'rgba(126,184,212,0.15)',
                  paddingHorizontal: 7,
                  paddingVertical: 2.5,
                  borderRadius: 2,
                  marginBottom: 4,
                }}
              >
                <Text style={{ fontSize: 8, color: '#cce4f4', lineHeight: 1.5 }}>{item}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {(profileData.languages ?? []).length > 0 && visibleSections.includes('languages') ? (
          <View style={{ width: '100%' }}>
            <Text style={sidebarLabel}>Languages</Text>
            {(profileData.languages ?? []).map((l, i) => (
              <Text key={i} style={sidebarText}>
                <Text style={{ fontWeight: 700, color: '#ffffff' }}>{l.language ?? ''}</Text>
                {l.proficiency ? ` — ${l.proficiency}` : ''}
              </Text>
            ))}
          </View>
        ) : null}
      </View>

      <View style={{ flex: 1, padding: 24, paddingTop: 28 }}>
        {mainSections.map((sectionKey) =>
          renderThemedSection(sectionKey, profileData, dynamicTheme),
        )}
      </View>
    </Page>
  );
}

/** Precision ATS — two-column header with dynamic accent color */
function PrecisionAtsPdf({ profileData, accentColor = '#C25C24' }: { profileData: ProfileData; accentColor?: string }) {
  const visibleSections = getVisibleSections(profileData);
  const personal = normalizePersonal(profileData.personal);
  const showPersonal = visibleSections.includes('personal');
  const contactLines = buildPrecisionContactLines(personal);
  const precisionTheme: PdfSectionTheme = {
    ...PRECISION_SECTION_THEME,
    sectionTitle: {
      ...PRECISION_SECTION_THEME.sectionTitle,
      color: accentColor,
    },
    itemMetaItalic: {
      ...PRECISION_SECTION_THEME.itemMetaItalic,
      color: accentColor,
    },
  };

  return (
    <Page
      size="LETTER"
      style={{
        paddingTop: 0.3 * 72,
        paddingBottom: 0.3 * 72,
        paddingHorizontal: 0.5 * 72,
        fontFamily: 'Helvetica',
        fontSize: 10,
        color: '#000000',
      }}
    >
      {showPersonal ? (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16, gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 24, fontWeight: 400, fontFamily: 'Georgia', color: accentColor, marginBottom: 3 }}>
              {personal.full_name || `${personal.first_name ?? ''} ${personal.last_name ?? ''}`.trim() || 'Your Name'}
            </Text>
            {personal.headline ? (
              <Text style={{ fontSize: 12, fontFamily: 'Georgia', color: accentColor }}>{personal.headline}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', justifyContent: 'flex-start', maxWidth: 220 }}>
            {contactLines.map((line, i) => (
              line.href ? (
                <Link
                  key={i}
                  src={line.href}
                  style={{ fontSize: 10, color: '#333333', marginBottom: 2, textAlign: 'right' }}
                >
                  {line.text}
                </Link>
              ) : (
                <Text key={i} style={{ fontSize: 10, color: '#333333', marginBottom: 2, textAlign: 'right' }}>
                  {line.text}
                </Text>
              )
            ))}
          </View>
        </View>
      ) : null}
      {visibleSections.map((sectionKey) => renderThemedSection(sectionKey, profileData, precisionTheme))}
    </Page>
  );
}

/** Header ATS — teal header, darker contact strip, teal section accents */
function HeaderAtsPdf({ profileData, mainColor = HEADER_ATS_COLORS[0] }: { profileData: ProfileData; mainColor?: string }) {
  const visibleSections = getVisibleSections(profileData);
  const personal = normalizePersonal(profileData.personal);
  const showPersonal = visibleSections.includes('personal');
  const palette = resolveHeaderAtsPalette(mainColor);
  const theme = headerAtsTheme(mainColor, palette.borderColor);
  const contactLines = [
    personal.email,
    personal.phone,
    personal.location,
    personal.linkedin_url ? personal.linkedin_url.replace(/^https?:\/\//i, '').replace(/\/$/, '') : null,
    personal.github_url ? personal.github_url.replace(/^https?:\/\//i, '').replace(/\/$/, '') : null,
    personal.website_url ? personal.website_url.replace(/^https?:\/\//i, '').replace(/\/$/, '') : null,
  ].filter(Boolean) as string[];

  return (
    <Page size="A4" style={{ padding: 0, fontFamily: 'Helvetica' }}>
      {showPersonal ? (
        <View style={{ backgroundColor: palette.headerBg, paddingVertical: 20, paddingHorizontal: 36, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 26, fontWeight: 400, color: '#1a1a1a', letterSpacing: 0, marginBottom: 4 }}>
              {personal.full_name || 'Candidate Name'}
            </Text>
            {personal.headline ? (
              <Text style={{ fontSize: 11, fontWeight: 400, color: '#3a3a3a' }}>{personal.headline}</Text>
            ) : null}
          </View>
          <View style={{ alignItems: 'flex-end', justifyContent: 'flex-start', flexShrink: 0, maxWidth: 220 }}>
            {contactLines.map((line, i) => (
              <Text key={i} style={{ fontSize: 8.5, color: '#333333', marginBottom: 2.5, textAlign: 'right' }}>
                {line}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
      <View style={{ paddingHorizontal: 36, paddingTop: 22, paddingBottom: 36 }}>
        {visibleSections.map((sectionKey) => renderThemedSection(sectionKey, profileData, theme))}
      </View>
    </Page>
  );
}

/** Modern — single column, coral accent dates, soft entry border (matches HTML preview layout family) */
function ModernPdf({ profileData }: { profileData: ProfileData }) {
  const visibleSections = getVisibleSections(profileData);
  const personal = normalizePersonal(profileData.personal);
  const showPersonal = visibleSections.includes('personal');
  const mainColor = profileData.resume_config?.modern_main_color ?? MODERN_MAIN_COLORS[0];
  const contactBits = [personal.email, personal.phone, personal.location].filter(Boolean);
  const leftSections = visibleSections.filter((k) => !['skills', 'languages', 'personal'].includes(k));
  const showSkills = visibleSections.includes('skills');
  const showLanguages = visibleSections.includes('languages');
  const modernTheme: PdfSectionTheme = {
    ...MODERN_SECTION_THEME,
    dateText: { ...MODERN_SECTION_THEME.dateText, color: mainColor },
    linkSmall: { ...MODERN_SECTION_THEME.linkSmall, color: mainColor },
  };

  return (
    <Page size="A4" style={{ paddingTop: 48, paddingHorizontal: 72, paddingBottom: 48, fontFamily: 'Helvetica', fontSize: 9.5, color: '#1a1a2e' }}>
      {showPersonal ? (
        <>
          <View style={{ backgroundColor: mainColor, paddingVertical: 18, paddingHorizontal: 52, flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14, marginHorizontal: -72, marginTop: -48 }}>
            {personal.photo_url ? (
              <Image src={personal.photo_url} style={{ width: 56, height: 56, borderRadius: 28 }} />
            ) : null}
            <View>
              <Text style={{ fontSize: 22, fontWeight: 700, color: '#ffffff', letterSpacing: 0.5 }}>
                {personal.full_name || ''}
              </Text>
              {personal.headline ? (
                <Text style={{ fontSize: 7, color: 'rgba(255,255,255,0.75)', letterSpacing: 2, textTransform: 'uppercase', marginTop: 3 }}>
                  {personal.headline}
                </Text>
              ) : null}
            </View>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 12, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: '#e0e0e0' }}>
            {contactBits.map((c, i) => (
              <Text key={i} style={{ fontSize: 7.5, color: '#444444' }}>{c}</Text>
            ))}
          </View>
        </>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 20 }}>
        <View style={{ flex: 1 }}>
          {leftSections.map((sectionKey) => renderThemedSection(sectionKey, profileData, modernTheme))}
        </View>
        <View style={{ width: 130 }}>
          {showSkills ? renderThemedSection('skills', profileData, modernTheme) : null}
          {showLanguages ? renderThemedSection('languages', profileData, modernTheme) : null}
        </View>
      </View>
    </Page>
  );
}

/** Modern Two-Column — navy sidebar + main (only template using this layout) */
function TwoColumnModernPdf({ profileData }: { profileData: ProfileData }) {
  const visibleSections = getVisibleSections(profileData);
  const personal = normalizePersonal(profileData.personal);
  const showPersonal = visibleSections.includes('personal');
  const variantStyle = TWO_COLUMN_VARIANT;
  const sidebarStyle = {
    width: 180,
    backgroundColor: variantStyle.sidebarBg,
    padding: 20,
  };

  const sidebarHeading = {
    fontSize: 8,
    fontWeight: 700,
    color: variantStyle.sidebarAccent,
    textTransform: 'uppercase' as const,
    letterSpacing: 1,
    marginTop: 14,
    marginBottom: 6,
    paddingBottom: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: variantStyle.sidebarAccent,
  };

  const sidebarText = {
    fontSize: 8.5,
    color: variantStyle.sidebarText,
    lineHeight: 1.5,
    marginBottom: 3,
  };

  return (
    <Page size="A4" style={[styles.page, { padding: 0, flexDirection: 'row' }]}>
      <View style={sidebarStyle}>
        {showPersonal ? (
          <>
            <Text style={{ fontSize: 15, fontWeight: 700, color: '#ffffff', marginBottom: 3 }}>{personal.full_name || 'Candidate Name'}</Text>
            {personal.headline ? (
              <Text style={{ fontSize: 9, color: variantStyle.sidebarAccent, marginBottom: 12 }}>{personal.headline}</Text>
            ) : null}
            <Text style={sidebarHeading}>Contact</Text>
            {personal.email ? <Text style={sidebarText}>{personal.email}</Text> : null}
            {personal.phone ? <Text style={sidebarText}>{personal.phone}</Text> : null}
            {personal.location ? <Text style={sidebarText}>{personal.location}</Text> : null}
            {personal.linkedin_url ? <Text style={sidebarText}>{personal.linkedin_url}</Text> : null}
            {personal.github_url ? <Text style={sidebarText}>{personal.github_url}</Text> : null}
            {personal.website_url ? <Text style={sidebarText}>{personal.website_url}</Text> : null}
          </>
        ) : null}
      </View>
      <View style={{ flex: 1, padding: 28 }}>
        {visibleSections.map((sectionKey) => renderThemedSection(sectionKey, profileData, TWO_COLUMN_MAIN_SECTION_THEME))}
      </View>
    </Page>
  );
}

function resolvePdfTemplateId(templateId: unknown): TemplateId {
  return isValidTemplateId(templateId) ? templateId : 'jake-classic';
}

/**
 * Exactly one page tree per document — `modern` must use {@link ModernPdf} (single column),
 * never the two-column layout used by {@link TwoColumnModernPdf}.
 */
export function ResumePdfDocument({
  templateId,
  profileData,
}: {
  templateId: TemplateId;
  profileData: ProfileData;
}) {
  const id = resolvePdfTemplateId(templateId);
  let body: React.ReactElement;
  switch (id) {
    case 'jake-classic':
      body = <JakeClassicPdf profileData={profileData} />;
      break;
    case 'two-column-modern':
      body = <TwoColumnModernPdf profileData={profileData} />;
      break;
    case 'traditional':
      body = <TraditionalPdf profileData={profileData} />;
      break;
    case 'professional':
      body = <ProfessionalPdf profileData={profileData} />;
      break;
    case 'precision-ats':
      body = <PrecisionAtsPdf profileData={profileData} accentColor={profileData.resume_config?.precision_accent_color ?? '#C25C24'} />;
      break;
    case 'header-ats':
      body = <HeaderAtsPdf profileData={profileData} mainColor={profileData.resume_config?.header_main_color ?? HEADER_ATS_COLORS[0]} />;
      break;
    case 'modern':
      body = <ModernPdf profileData={profileData} />;
      break;
    default:
      body = <JakeClassicPdf profileData={profileData} />;
      break;
  }
  return <Document>{body}</Document>;
}

