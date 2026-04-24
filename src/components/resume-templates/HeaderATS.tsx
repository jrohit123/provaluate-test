import React from 'react';
import { type TemplateProps, getVisibleSections, dateRange } from './types';
import { displayProfileUrl, displayUrl, normalizeHref } from './resumeLinkUtils';

export const HEADER_ATS_COLORS = ['#6b8f5e', '#8f9ab3', '#c9a0c2', '#6366d1'] as const;

function resolveHeaderPalette(mainColor: string): { headerBg: string; borderColor: string } {
  if (mainColor === '#8f9ab3') return { headerBg: '#d7dce8', borderColor: '#c4ccdb' };
  if (mainColor === '#c9a0c2') return { headerBg: '#e6d0e2', borderColor: '#d9bfd4' };
  if (mainColor === '#6366d1') return { headerBg: '#d7d8f1', borderColor: '#c4c7e8' };
  return { headerBg: '#cdd8c6', borderColor: '#c8d4c4' };
}

// ─── Scoped CSS ──────────────────────────────────────────────────────────────
// Prefix: .ha- (header-ats)
// Design: Bold teal (#0e6b72) full-width header containing name + headline.
// A lighter contact strip sits just below the header. Body is pure white with
// bold ALL-CAPS section labels and a teal bottom underline. Highly ATS-friendly.
// Font: Nunito Sans (legible, neutral) with system fallback
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;600;700;800&display=swap');

  .ha-wrap {
    width: 794px;
    min-height: 1123px;
    background: #ffffff;
    box-sizing: border-box;
    font-family: 'Nunito Sans', 'Segoe UI', system-ui, Arial, sans-serif;
    font-size: 10px;
    color: #1a1a1a;
    line-height: 1.4;
  }

  /* ── Header ── */
  .ha-header {
    background: var(--ha-header-bg, #cdd8c6);
    padding: 22px 36px 18px 36px;
    box-sizing: border-box;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 16px;
  }

  .ha-name {
    font-size: 26px;
    font-weight: 400;
    color: #1a1a1a;
    letter-spacing: 0px;
    margin: 0 0 4px 0;
    line-height: 1.1;
  }

  .ha-headline {
    font-size: 11px;
    font-weight: 400;
    color: #3a3a3a;
    letter-spacing: 0.2px;
  }

  /* ── Contact strip ── */
  .ha-contact-strip {
    background: transparent;
    padding: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 3px;
    flex-shrink: 0;
    max-width: 240px;
  }

  .ha-contact-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 8.5px;
    color: #333333;
  }

  .ha-contact-item a {
    color: #333333;
    text-decoration: none;
  }

  .ha-contact-icon {
    font-size: 9px;
    opacity: 0.7;
  }

  /* ── Body ── */
  .ha-body {
    padding: 22px 44px 36px 44px;
    box-sizing: border-box;
  }

  /* ── Section ── */
  .ha-section {
    margin-bottom: 14px;
  }

  .ha-section-title {
    font-size: 22px;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0px;
    color: var(--ha-main, #6b8f5e);
    padding-bottom: 4px;
    border-bottom: 1px solid var(--ha-border, #c8d4c4);
    margin-bottom: 10px;
  }

  /* ── Summary ── */
  .ha-summary {
    font-size: 9.5px;
    line-height: 1.65;
    color: #2c2c2c;
  }

  /* ── Entry ── */
  .ha-entry {
    margin-bottom: 10px;
  }

  .ha-entry-row1 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .ha-entry-title {
    font-size: 9.5px;
    font-weight: 400;
    font-style: italic;
    color: var(--ha-main, #6b8f5e);
    flex: 1;
    min-width: 0;
  }

  .ha-entry-date {
    font-size: 8.5px;
    color: #555555;
    font-weight: 400;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .ha-entry-row2 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin-top: 1.5px;
  }

  .ha-entry-company {
    font-size: 9px;
    color: #555555;
    font-weight: 400;
    flex: 1;
    min-width: 0;
  }

  .ha-entry-location {
    font-size: 8.5px;
    color: #718096;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── Bullets ── */
  .ha-bullets {
    margin: 4px 0 0 14px;
    padding: 0;
    list-style: none;
  }

  .ha-bullets li {
    font-size: 9.5px;
    line-height: 1.55;
    color: #2d3748;
    margin-bottom: 2px;
    padding-left: 10px;
    position: relative;
  }

  .ha-bullets li::before {
    content: '·';
    position: absolute;
    left: 0;
    color: #555555;
    font-weight: 400;
  }

  /* ── Skills ── */
  .ha-skills-row {
    font-size: 9.5px;
    line-height: 1.8;
    color: #2c2c2c;
  }

  .ha-skills-label {
    font-weight: 700;
    color: #0f2d30;
  }

  /* ── Cert ── */
  .ha-cert-entry {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 9.5px;
    margin-bottom: 3.5px;
    gap: 8px;
  }

  .ha-cert-name {
    font-weight: 700;
    color: #0f2d30;
    flex: 1;
  }

  .ha-cert-meta {
    font-size: 8.5px;
    color: #718096;
    white-space: nowrap;
    flex-shrink: 0;
    margin-left: 8px;
  }

  /* ── Lang ── */
  .ha-lang-row {
    font-size: 9.5px;
    line-height: 1.8;
    color: #2c2c2c;
  }

  /* ── Awards ── */
  .ha-award-entry { margin-bottom: 6px; }

  .ha-award-row1 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .ha-award-title {
    font-weight: 700;
    font-size: 9.5px;
    color: #0f2d30;
    flex: 1;
  }

  .ha-award-meta {
    font-size: 8.5px;
    color: #718096;
    white-space: nowrap;
  }

  .ha-award-desc {
    font-size: 9px;
    color: #4a5568;
    margin-top: 1px;
    line-height: 1.45;
  }

  /* ── Pub / Ref ── */
  .ha-pub-entry {
    font-size: 9.5px;
    line-height: 1.5;
    margin-bottom: 4px;
    color: #2d3748;
  }

  .ha-ref-entry {
    font-size: 9.5px;
    line-height: 1.55;
    margin-bottom: 4px;
    color: #2d3748;
  }

  .ha-ref-name {
    font-weight: 700;
    color: #0f2d30;
  }

  .ha-edu-note {
    font-size: 8.5px;
    color: #718096;
    margin-top: 2px;
    line-height: 1.4;
  }

  .ha-proj-tech {
    font-size: 8.5px;
    color: #718096;
    margin-top: 1px;
  }
`;

const CONTACT_ICONS: Record<string, string> = {
  phone: '☎',
  email: '✉',
  location: '◎',
  linkedin: 'in',
  github: '⎇',
  website: '⊕',
  portfolio: '⊕',
  link: '→',
};

function sectionTitleFromKey(key: string): string {
  const labels: Record<string, string> = {
    custom_sections: 'Additional Information',
    organisations: 'Organisations',
    courses: 'Courses & Training',
  };
  return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderSection(key: string, profile: NonNullable<TemplateProps['profile']>): React.ReactNode {
  const rec = profile as Record<string, unknown>;

  switch (key) {
    case 'summary':
      if (!profile.summary?.trim()) return null;
      return (
        <div className="ha-section" key="summary">
          <div className="ha-section-title">Profile</div>
          <p className="ha-summary">{profile.summary}</p>
        </div>
      );

    case 'experience':
      if (!profile.experience?.length) return null;
      return (
        <div className="ha-section" key="experience">
          <div className="ha-section-title">Work Experience</div>
          {profile.experience.map((exp, i) => (
            <div className="ha-entry" key={i}>
              <div className="ha-entry-row1">
                <span className="ha-entry-title">{exp.job_title || 'Job Title'}</span>
                <span className="ha-entry-date">{dateRange(exp.start_date, exp.end_date)}</span>
              </div>
              <div className="ha-entry-row2">
                <span className="ha-entry-company">
                  {exp.employer || ''}
                  {exp.employment_type ? ` · ${exp.employment_type}` : ''}
                  {exp.work_mode ? ` · ${exp.work_mode}` : ''}
                </span>
                <span className="ha-entry-location">{exp.location || ''}</span>
              </div>
              {exp.bullets?.length ? (
                <ul className="ha-bullets">
                  {exp.bullets.filter(Boolean).map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              ) : exp.description ? (
                <ul className="ha-bullets"><li>{exp.description}</li></ul>
              ) : null}
            </div>
          ))}
        </div>
      );

    case 'education':
      if (!profile.education?.length) return null;
      return (
        <div className="ha-section" key="education">
          <div className="ha-section-title">Education</div>
          {profile.education.map((edu, i) => (
            <div className="ha-entry" key={i}>
              <div className="ha-entry-row1">
                <span className="ha-entry-title">{edu.institution || ''}</span>
                <span className="ha-entry-date">{dateRange(edu.start_date, edu.end_date)}</span>
              </div>
              <div className="ha-entry-row2">
                <span className="ha-entry-company">
                  {[edu.degree, edu.field_of_study].filter(Boolean).join(', ')}
                  {edu.gpa ? ` — ${edu.gpa}` : ''}
                </span>
                <span className="ha-entry-location">{edu.location || ''}</span>
              </div>
              {edu.achievements && <div className="ha-edu-note">{edu.achievements}</div>}
            </div>
          ))}
        </div>
      );

    case 'projects':
      if (!profile.projects?.length) return null;
      return (
        <div className="ha-section" key="projects">
          <div className="ha-section-title">Projects</div>
          {profile.projects.map((proj, i) => (
            <div className="ha-entry" key={i}>
              <div className="ha-entry-row1">
                <span className="ha-entry-title">
                  {proj.name || 'Project'}
                  {proj.url ? (
                    <> · <a href={normalizeHref(proj.url)} style={{ fontWeight: 400, color: 'var(--ha-main, #6b8f5e)' }}>{displayProfileUrl(proj.url)}</a></>
                  ) : proj.repo_url ? (
                    <> · <a href={normalizeHref(proj.repo_url)} style={{ fontWeight: 400, color: 'var(--ha-main, #6b8f5e)' }}>{displayProfileUrl(proj.repo_url)}</a></>
                  ) : null}
                </span>
                {proj.project_type && <span className="ha-entry-date">{proj.project_type}</span>}
              </div>
              {proj.tech_stack && <div className="ha-proj-tech">{proj.tech_stack}</div>}
              {proj.bullets?.length ? (
                <ul className="ha-bullets">
                  {proj.bullets.filter(Boolean).map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      );

    case 'skills':
      if (!profile.skills?.length) return null;
      return (
        <div className="ha-section" key="skills">
          <div className="ha-section-title">Skills</div>
          {profile.skills.map((s, i) => (
            <div className="ha-skills-row" key={i}>
              {s.category && <span className="ha-skills-label">{s.category}: </span>}
              <span>{(s.items ?? []).join(', ')}</span>
            </div>
          ))}
        </div>
      );

    case 'certifications':
      if (!profile.certifications?.length) return null;
      return (
        <div className="ha-section" key="certifications">
          <div className="ha-section-title">Certifications</div>
          {profile.certifications.map((c, i) => (
            <div className="ha-cert-entry" key={i}>
              <span className="ha-cert-name">{c.name || ''}</span>
              <span className="ha-cert-meta">
                {[c.issuer, c.issue_date].filter(Boolean).join(' · ')}
                {c.expiry_date ? ` — Exp. ${c.expiry_date}` : ''}
              </span>
            </div>
          ))}
        </div>
      );

    case 'languages':
      if (!profile.languages?.length) return null;
      return (
        <div className="ha-section" key="languages">
          <div className="ha-section-title">Languages</div>
          <div className="ha-lang-row">
            {profile.languages.map((l, i) => (
              <span key={i}>
                <strong>{l.language}</strong>
                {l.proficiency ? ` (${l.proficiency})` : ''}
                {i < (profile.languages?.length ?? 0) - 1 ? '   ·   ' : ''}
              </span>
            ))}
          </div>
        </div>
      );

    case 'awards':
      if (!profile.awards?.length) return null;
      return (
        <div className="ha-section" key="awards">
          <div className="ha-section-title">Awards & Honours</div>
          {profile.awards.map((a, i) => (
            <div className="ha-award-entry" key={i}>
              <div className="ha-award-row1">
                <span className="ha-award-title">{a.title || ''}</span>
                <span className="ha-award-meta">{[a.issuer, a.year].filter(Boolean).join(', ')}</span>
              </div>
              {a.description && <div className="ha-award-desc">{a.description}</div>}
            </div>
          ))}
        </div>
      );

    case 'publications':
      if (!profile.publications?.length) return null;
      return (
        <div className="ha-section" key="publications">
          <div className="ha-section-title">Publications</div>
          {profile.publications.map((p, i) => (
            <div className="ha-pub-entry" key={i}>
              <strong>{p.title || ''}</strong>
              {p.journal_or_conference ? ` — ${p.journal_or_conference}` : ''}
              {p.year ? `, ${p.year}` : ''}
              {p.url ? <> · <a href={normalizeHref(p.url)} style={{ color: 'var(--ha-main, #6b8f5e)' }}>{displayProfileUrl(p.url)}</a></> : null}
            </div>
          ))}
        </div>
      );

    case 'references':
      if (!profile.references?.length) return null;
      return (
        <div className="ha-section" key="references">
          <div className="ha-section-title">References</div>
          {profile.references.map((r, i) => (
            <div className="ha-ref-entry" key={i}>
              <span className="ha-ref-name">{r.name || ''}</span>
              {(r.job_title || r.company) && <span> — {[r.job_title, r.company].filter(Boolean).join(', ')}</span>}
              {r.email && <span> · {r.email}</span>}
            </div>
          ))}
        </div>
      );

    case 'declaration':
      if (!profile.declaration?.trim()) return null;
      return (
        <div className="ha-section" key="declaration">
          <div className="ha-section-title">Declaration</div>
          <p className="ha-summary">{profile.declaration}</p>
        </div>
      );

    case 'custom_sections':
      if (!profile.custom_sections?.length) return null;
      return (
        <div className="ha-section" key="custom_sections">
          {profile.custom_sections.map((section, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <div className="ha-section-title">{section.section_title || section.title || `Section ${i + 1}`}</div>
              {section.description && <p className="ha-summary">{section.description}</p>}
              {(section.items ?? []).map((item, idx) => {
                if (typeof item === 'string') return <div className="ha-ref-entry" key={idx}>• {item}</div>;
                if (!item) return null;
                return (
                  <div className="ha-ref-entry" key={idx}>
                    {item.title ? <span className="ha-ref-name">{item.title}</span> : null}
                    {item.description ? <span>{item.title ? ` — ${item.description}` : item.description}</span> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );

    default: {
      if (!Object.prototype.hasOwnProperty.call(rec, key)) return null;
      if (['personal', 'profession', 'resume_config'].includes(key)) return null;
      if (typeof rec[key] === 'string') {
        const val = String(rec[key]).trim();
        if (!val) return null;
        return (
          <div className="ha-section" key={key}>
            <div className="ha-section-title">{sectionTitleFromKey(key)}</div>
            <div className="ha-summary">{val}</div>
          </div>
        );
      }
      if (Array.isArray(rec[key])) {
        const list = rec[key] as Array<unknown>;
        if (!list.length) return null;
        return (
          <div className="ha-section" key={key}>
            <div className="ha-section-title">{sectionTitleFromKey(key)}</div>
            {list.map((entry, i) => {
              if (typeof entry === 'string') return <div className="ha-ref-entry" key={i}>• {entry}</div>;
              if (!entry || typeof entry !== 'object') return null;
              const obj = entry as Record<string, unknown>;
              const title = (obj.title ?? obj.name ?? obj.role ?? '') as string;
              const description = (obj.description ?? obj.details ?? '') as string;
              return (
                <div className="ha-ref-entry" key={i}>
                  {title ? <span className="ha-ref-name">{title}</span> : null}
                  {description ? <span>{title ? ` — ${description}` : description}</span> : null}
                </div>
              );
            })}
          </div>
        );
      }
      return null;
    }
  }
}

export function HeaderATS({
  profile,
  mainColor = HEADER_ATS_COLORS[0],
}: TemplateProps & { mainColor?: string }) {
  const { personal } = profile;
  const visibleSections = getVisibleSections(profile);
  const showPersonal = visibleSections.includes('personal');
  const palette = resolveHeaderPalette(mainColor);

  const contactItems: { icon: string; node: React.ReactNode; key: string }[] = [];
  if (personal?.phone) contactItems.push({ key: 'phone', icon: CONTACT_ICONS.phone, node: <span>{personal.phone}</span> });
  if (personal?.email) contactItems.push({ key: 'email', icon: CONTACT_ICONS.email, node: <a href={`mailto:${personal.email}`}>{personal.email}</a> });
  if (personal?.location) contactItems.push({ key: 'loc', icon: CONTACT_ICONS.location, node: <span>{personal.location}</span> });
  if (personal?.linkedin_url) contactItems.push({ key: 'li', icon: CONTACT_ICONS.linkedin, node: <a href={normalizeHref(personal.linkedin_url)}>{displayProfileUrl(personal.linkedin_url)}</a> });
  if (personal?.github_url) contactItems.push({ key: 'gh', icon: CONTACT_ICONS.github, node: <a href={normalizeHref(personal.github_url)}>{displayProfileUrl(personal.github_url)}</a> });
  if (personal?.website_url) contactItems.push({ key: 'web', icon: CONTACT_ICONS.website, node: <a href={normalizeHref(personal.website_url)}>{displayProfileUrl(personal.website_url)}</a> });
  if (personal?.portfolio_url) contactItems.push({ key: 'portfolio', icon: CONTACT_ICONS.portfolio, node: <a href={normalizeHref(personal.portfolio_url)}>{displayProfileUrl(personal.portfolio_url)}</a> });
  if (personal?.custom_links) {
    personal.custom_links.forEach((cl, i) => {
      if (cl.url) contactItems.push({ key: `cl${i}`, icon: CONTACT_ICONS.link, node: <a href={normalizeHref(cl.url)}>{displayUrl(cl.url, cl.label)}</a> });
    });
  }

  return (
    <>
      <style>{STYLES}</style>
      <div
        className="ha-wrap"
        style={
          {
            '--ha-main': mainColor,
            '--ha-header-bg': palette.headerBg,
            '--ha-border': palette.borderColor,
          } as React.CSSProperties
        }
      >
        {showPersonal && (
          <div className="ha-header">
            <div>
              <div className="ha-name">
                {personal?.full_name || `${personal?.first_name ?? ''} ${personal?.last_name ?? ''}`.trim() || 'Your Name'}
              </div>
              {personal?.headline && <div className="ha-headline">{personal.headline}</div>}
            </div>
            {contactItems.length > 0 && (
              <div className="ha-contact-strip">
                {contactItems.map(({ key, icon, node }) => (
                  <div className="ha-contact-item" key={key}>
                    <span className="ha-contact-icon">{icon}</span>
                    {node}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="ha-body">
          {visibleSections.map((key) => renderSection(key, profile))}
        </div>
      </div>
    </>
  );
}
