import React from 'react';
import { type TemplateProps, getVisibleSections, dateRange } from './types';
import { displayProfileUrl, displayUrl, normalizeHref } from './resumeLinkUtils';

export const MODERN_MAIN_COLORS = ['#9B1B1B', '#3F51B5', '#0F766E', '#F59E0B', '#1C1917'] as const;

// ─── Scoped CSS ──────────────────────────────────────────────────────────────
// Prefix: .mn- (modern)
// Design: Contemporary single-column. Coral/amber (#c0392b → warm #e05a2b)
// accent on section titles and dates. Name in large bold Sora font. Skills
// rendered as pill tags. Subtle gray left-border on entries. Clean, approachable
// yet professional — great for product, design, ops, marketing.
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;0,900;1,400&display=swap');

  .mn-wrap {
    width: 794px;
    min-height: 1123px;
    background: #ffffff;
    padding: 36px 52px 36px 52px;
    box-sizing: border-box;
    font-family: 'Lato', 'Segoe UI', system-ui, Arial, sans-serif;
    font-size: 9px;
    color: #1e1e2e;
    line-height: 1.45;
  }

  /* ── Header ── */
  .mn-header {
    padding-bottom: 16px;
    border-bottom: 2px solid #f0f0f0;
    margin-bottom: 16px;
  }

  .mn-name {
    font-size: 26px;
    font-weight: 900;
    color: #1a1a2e;
    letter-spacing: 0px;
    margin: 0 0 2px 0;
    line-height: 1.1;
  }

  .mn-headline {
    font-size: 11px;
    font-weight: 400;
    color: #666666;
    letter-spacing: 0.2px;
    margin-bottom: 8px;
  }

  .mn-contact {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 24px;
    font-size: 8px;
    color: #444444;
    padding: 8px 0;
    border-bottom: 1px solid #e8e8e8;
    margin-bottom: 12px;
    justify-content: flex-start;
  }

  .mn-contact-item {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .mn-contact-item a {
    color: #444444;
    text-decoration: none;
  }

  .mn-contact-icon {
    font-size: 9px;
    color: var(--mn-main, #9B1B1B);
  }

  /* ── Section ── */
  .mn-section {
    margin-bottom: 16px;
  }

  .mn-section-header {
    display: flex;
    align-items: center;
    margin-bottom: 6px;
    border-bottom: 1px solid #cccccc;
    padding-bottom: 3px;
  }

  .mn-section-title {
    font-size: 13px;
    font-weight: 700;
    font-style: italic;
    text-transform: none;
    letter-spacing: 0;
    color: #1a1a1a;
  }

  /* ── Summary ── */
  .mn-summary {
    font-size: 9.5px;
    line-height: 1.7;
    color: #3a3a4a;
  }

  /* ── Entry ── */
  .mn-entry {
    margin-bottom: 10px;
    padding-left: 0;
    border-left: none;
    position: relative;
  }

  .mn-entry-row1 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .mn-entry-title {
    font-size: 10px;
    font-weight: 700;
    color: #1a1a2e;
    flex: 1;
    min-width: 0;
  }

  .mn-entry-date {
    font-size: 8.5px;
    color: var(--mn-main, #9B1B1B);
    font-weight: 400;
    font-style: italic;
    white-space: nowrap;
    flex-shrink: 0;
    background: none;
    border: none;
    padding: 0;
    border-radius: 0;
  }

  .mn-entry-row2 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin-top: 2px;
  }

  .mn-entry-company {
    font-size: 9px;
    font-style: italic;
    color: #555555;
    font-weight: 400;
    flex: 1;
    min-width: 0;
  }

  .mn-entry-location {
    font-size: 8.5px;
    color: #9999aa;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── Bullets ── */
  .mn-bullets {
    margin: 4px 0 0 0;
    padding: 0;
    list-style: none;
  }

  .mn-bullets li {
    font-size: 9.5px;
    line-height: 1.55;
    color: #2c2c3c;
    margin-bottom: 2px;
    padding-left: 12px;
    position: relative;
  }

  .mn-bullets li::before {
    content: '•';
    position: absolute;
    left: 0;
    color: #333333;
    font-size: 9px;
    line-height: 1.7;
  }

  /* ── Skills ── */
  .mn-skills-group {
    margin-bottom: 6px;
  }

  .mn-skills-cat {
    font-size: 8.5px;
    font-weight: 700;
    color: #1e1e2e;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 4px;
  }

  .mn-skills-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .mn-skill-tag {
    font-size: 8px;
    padding: 2px 9px;
    border-radius: 12px;
    border: 1px solid #e8e8ee;
    background: #f8f8fc;
    color: #3a3a5a;
    font-weight: 500;
    line-height: 1.6;
  }

  /* ── Certifications ── */
  .mn-cert-entry {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    padding-left: 12px;
    margin-bottom: 4px;
    gap: 8px;
  }

  .mn-cert-name {
    font-weight: 600;
    font-size: 9.5px;
    color: #1e1e2e;
    flex: 1;
  }

  .mn-cert-meta {
    font-size: 8.5px;
    color: #9999aa;
    white-space: nowrap;
    flex-shrink: 0;
    margin-left: 8px;
  }

  /* ── Languages ── */
  .mn-lang-entry {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-right: 12px;
    margin-bottom: 4px;
  }

  .mn-lang-name {
    font-weight: 600;
    font-size: 9.5px;
    color: #1e1e2e;
  }

  .mn-lang-level {
    font-size: 8px;
    color: #9999aa;
  }

  /* ── Awards ── */
  .mn-award-entry {
    padding-left: 0;
    border-left: none;
    margin-bottom: 6px;
    position: relative;
  }

  .mn-award-title {
    font-weight: 600;
    font-size: 9.5px;
    color: #1e1e2e;
    display: block;
  }

  .mn-award-meta {
    font-size: 8.5px;
    color: var(--mn-main, #9B1B1B);
    display: block;
    margin-top: 1px;
    line-height: 1.35;
    font-style: italic;
  }

  .mn-award-desc {
    font-size: 9px;
    color: #6b6b8a;
    margin-top: 1px;
    line-height: 1.45;
  }

  /* ── Pub / Ref ── */
  .mn-pub-entry {
    padding-left: 12px;
    font-size: 9.5px;
    line-height: 1.5;
    margin-bottom: 4px;
    color: #2c2c3c;
  }

  .mn-ref-entry {
    padding-left: 12px;
    font-size: 9.5px;
    line-height: 1.55;
    margin-bottom: 4px;
    color: #2c2c3c;
  }

  .mn-ref-name { font-weight: 700; color: #1e1e2e; }

  .mn-edu-note {
    font-size: 8.5px;
    color: #9999aa;
    margin-top: 2px;
  }

  .mn-proj-tech {
    font-size: 8.5px;
    color: #9999aa;
    margin-top: 1px;
  }
`;

function SectionHeader({ title }: { title: string }) {
  return (
    <div className="mn-section-header">
      <span className="mn-section-title">{title}</span>
    </div>
  );
}

function sectionTitleFromKey(key: string): string {
  const labels: Record<string, string> = {
    custom_sections: 'Additional Information',
    organisations: 'Organisations',
    courses: 'Courses & Training',
  };
  return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderSection(
  key: string,
  profile: NonNullable<TemplateProps['profile']>,
  mainColor: string = MODERN_MAIN_COLORS[0],
): React.ReactNode {
  const rec = profile as Record<string, unknown>;

  switch (key) {
    case 'summary':
      if (!profile.summary?.trim()) return null;
      return (
        <div className="mn-section" key="summary">
          <SectionHeader title="About Me" />
          <p className="mn-summary">{profile.summary}</p>
        </div>
      );

    case 'experience':
      if (!profile.experience?.length) return null;
      return (
        <div className="mn-section" key="experience">
          <SectionHeader title="Experience" />
          {profile.experience.map((exp, i) => (
            <div className="mn-entry" key={i}>
              <div className="mn-entry-row1">
                <span className="mn-entry-title">{exp.job_title || 'Job Title'}</span>
                <span className="mn-entry-date">{dateRange(exp.start_date, exp.end_date)}</span>
              </div>
              <div className="mn-entry-row2">
                <span className="mn-entry-company">
                  {exp.employer || ''}
                  {exp.employment_type ? ` · ${exp.employment_type}` : ''}
                  {exp.work_mode ? ` · ${exp.work_mode}` : ''}
                </span>
                <span className="mn-entry-location">{exp.location || ''}</span>
              </div>
              {exp.bullets?.length ? (
                <ul className="mn-bullets">
                  {exp.bullets.filter(Boolean).map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              ) : exp.description ? (
                <ul className="mn-bullets"><li>{exp.description}</li></ul>
              ) : null}
            </div>
          ))}
        </div>
      );

    case 'education':
      if (!profile.education?.length) return null;
      return (
        <div className="mn-section" key="education">
          <SectionHeader title="Education" />
          {profile.education.map((edu, i) => (
            <div className="mn-entry" key={i}>
              <div className="mn-entry-row1">
                <span className="mn-entry-title">{edu.institution || ''}</span>
                <span className="mn-entry-date">{dateRange(edu.start_date, edu.end_date)}</span>
              </div>
              <div className="mn-entry-row2">
                <span className="mn-entry-company">
                  {[edu.degree, edu.field_of_study].filter(Boolean).join(', ')}
                  {edu.gpa ? ` — ${edu.gpa}` : ''}
                </span>
                <span className="mn-entry-location">{edu.location || ''}</span>
              </div>
              {edu.achievements && <div className="mn-edu-note">{edu.achievements}</div>}
            </div>
          ))}
        </div>
      );

    case 'projects':
      if (!profile.projects?.length) return null;
      return (
        <div className="mn-section" key="projects">
          <SectionHeader title="Projects" />
          {profile.projects.map((proj, i) => (
            <div className="mn-entry" key={i}>
              <div className="mn-entry-row1">
                <span className="mn-entry-title">
                  {proj.name || 'Project'}
                  {proj.url ? (
                    <> · <a href={normalizeHref(proj.url)} style={{ fontWeight: 400, color: mainColor }}>{displayProfileUrl(proj.url)}</a></>
                  ) : proj.repo_url ? (
                    <> · <a href={normalizeHref(proj.repo_url)} style={{ fontWeight: 400, color: mainColor }}>{displayProfileUrl(proj.repo_url)}</a></>
                  ) : null}
                </span>
                {proj.project_type && <span className="mn-entry-date">{proj.project_type}</span>}
              </div>
              {proj.tech_stack && <div className="mn-proj-tech">{proj.tech_stack}</div>}
              {proj.bullets?.length ? (
                <ul className="mn-bullets">
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
        <div className="mn-section" key="skills">
          <SectionHeader title="Skills" />
          {profile.skills.flatMap((s) => s.items ?? []).map((item, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <div style={{ fontSize: '8.5px', fontWeight: 600, color: '#1e1e2e', marginBottom: '3px' }}>{item}</div>
              <div style={{ height: '3px', background: '#e8e8e8', borderRadius: '2px' }}>
                <div style={{ width: '70%', height: '100%', background: mainColor, borderRadius: '2px' }} />
              </div>
            </div>
          ))}
        </div>
      );

    case 'certifications':
      if (!profile.certifications?.length) return null;
      return (
        <div className="mn-section" key="certifications">
          <SectionHeader title="Certifications" />
          {profile.certifications.map((c, i) => (
            <div className="mn-cert-entry" key={i}>
              <span className="mn-cert-name">{c.name || ''}</span>
              <span className="mn-cert-meta">
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
        <div className="mn-section" key="languages">
          <SectionHeader title="Languages" />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 0' }}>
            {profile.languages.map((l, i) => (
              <div className="mn-lang-entry" key={i}>
                <span className="mn-lang-name">{l.language}</span>
                {l.proficiency && <span className="mn-lang-level">({l.proficiency})</span>}
              </div>
            ))}
          </div>
        </div>
      );

    case 'awards':
      if (!profile.awards?.length) return null;
      return (
        <div className="mn-section" key="awards">
          <SectionHeader title="Awards & Honours" />
          {profile.awards.map((a, i) => (
            <div className="mn-award-entry" key={i}>
              <span className="mn-award-title">{a.title || ''}</span>
              {[a.issuer, a.year].filter(Boolean).join(', ') ? (
                <span className="mn-award-meta">{[a.issuer, a.year].filter(Boolean).join(', ')}</span>
              ) : null}
              {a.description && <div className="mn-award-desc">{a.description}</div>}
            </div>
          ))}
        </div>
      );

    case 'publications':
      if (!profile.publications?.length) return null;
      return (
        <div className="mn-section" key="publications">
          <SectionHeader title="Publications" />
          {profile.publications.map((p, i) => (
            <div className="mn-pub-entry" key={i}>
              <strong>{p.title || ''}</strong>
              {p.journal_or_conference ? ` — ${p.journal_or_conference}` : ''}
              {p.year ? `, ${p.year}` : ''}
              {p.url ? <> · <a href={normalizeHref(p.url)} style={{ color: mainColor }}>{displayProfileUrl(p.url)}</a></> : null}
            </div>
          ))}
        </div>
      );

    case 'references':
      if (!profile.references?.length) return null;
      return (
        <div className="mn-section" key="references">
          <SectionHeader title="References" />
          {profile.references.map((r, i) => (
            <div className="mn-ref-entry" key={i}>
              <span className="mn-ref-name">{r.name || ''}</span>
              {(r.job_title || r.company) && <span> — {[r.job_title, r.company].filter(Boolean).join(', ')}</span>}
              {r.email && <span> · {r.email}</span>}
            </div>
          ))}
        </div>
      );

    case 'declaration':
      if (!profile.declaration?.trim()) return null;
      return (
        <div className="mn-section" key="declaration">
          <SectionHeader title="Declaration" />
          <p className="mn-summary">{profile.declaration}</p>
        </div>
      );

    case 'custom_sections':
      if (!profile.custom_sections?.length) return null;
      return (
        <div className="mn-section" key="custom_sections">
          {profile.custom_sections.map((section, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <SectionHeader title={section.section_title || section.title || `Section ${i + 1}`} />
              {section.description && <p className="mn-summary">{section.description}</p>}
              {(section.items ?? []).map((item, idx) => {
                if (typeof item === 'string') return <div className="mn-ref-entry" key={idx}>• {item}</div>;
                if (!item) return null;
                return (
                  <div className="mn-ref-entry" key={idx}>
                    {item.title ? <span className="mn-ref-name">{item.title}</span> : null}
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
          <div className="mn-section" key={key}>
            <SectionHeader title={sectionTitleFromKey(key)} />
            <p className="mn-summary">{val}</p>
          </div>
        );
      }
      if (Array.isArray(rec[key])) {
        const list = rec[key] as Array<unknown>;
        if (!list.length) return null;
        return (
          <div className="mn-section" key={key}>
            <SectionHeader title={sectionTitleFromKey(key)} />
            {list.map((entry, i) => {
              if (typeof entry === 'string') return <div className="mn-ref-entry" key={i}>• {entry}</div>;
              if (!entry || typeof entry !== 'object') return null;
              const obj = entry as Record<string, unknown>;
              const title = (obj.title ?? obj.name ?? obj.role ?? '') as string;
              const description = (obj.description ?? obj.details ?? '') as string;
              return (
                <div className="mn-ref-entry" key={i}>
                  {title ? <span className="mn-ref-name">{title}</span> : null}
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

export function ModernTemplate({
  profile,
  mainColor = MODERN_MAIN_COLORS[0],
}: TemplateProps & { mainColor?: string }) {
  const { personal } = profile;
  const visibleSections = getVisibleSections(profile);
  const showPersonal = visibleSections.includes('personal');

  const contactItems: { icon: string; node: React.ReactNode; key: string }[] = [];
  if (personal?.phone) contactItems.push({ key: 'phone', icon: '☎', node: <span>{personal.phone}</span> });
  if (personal?.email) contactItems.push({ key: 'email', icon: '✉', node: <a href={`mailto:${personal.email}`}>{personal.email}</a> });
  if (personal?.location) contactItems.push({ key: 'loc', icon: '◎', node: <span>{personal.location}</span> });
  if (personal?.linkedin_url) contactItems.push({ key: 'li', icon: 'in', node: <a href={normalizeHref(personal.linkedin_url)}>{displayProfileUrl(personal.linkedin_url)}</a> });
  if (personal?.github_url) contactItems.push({ key: 'gh', icon: '⎇', node: <a href={normalizeHref(personal.github_url)}>{displayProfileUrl(personal.github_url)}</a> });
  if (personal?.website_url) contactItems.push({ key: 'web', icon: '⊕', node: <a href={normalizeHref(personal.website_url)}>{displayProfileUrl(personal.website_url)}</a> });
  if (personal?.portfolio_url) contactItems.push({ key: 'portfolio', icon: '⊕', node: <a href={normalizeHref(personal.portfolio_url)}>{displayProfileUrl(personal.portfolio_url)}</a> });
  if (personal?.custom_links) {
    personal.custom_links.forEach((cl, i) => {
      if (cl.url) contactItems.push({ key: `cl${i}`, icon: '→', node: <a href={normalizeHref(cl.url)}>{displayUrl(cl.url, cl.label)}</a> });
    });
  }

  return (
    <>
      <style>{STYLES}</style>
      <div className="mn-wrap" style={{ '--mn-main': mainColor } as React.CSSProperties}>
        {showPersonal && (
          <>
            <div style={{ background: mainColor, padding: '20px 52px', display: 'flex', alignItems: 'center', gap: '18px', marginLeft: '-52px', marginRight: '-52px', marginTop: '-36px', marginBottom: '16px' }}>
              {personal?.photo_url && (
                <img src={personal.photo_url} style={{ width: '64px', height: '64px', borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.3)', flexShrink: 0 }} />
              )}
              <div>
                <div style={{ fontSize: '26px', fontWeight: 700, color: '#ffffff', letterSpacing: '0.5px', lineHeight: 1.1 }}>
                  {personal?.full_name || ''}
                </div>
                {personal?.headline && (
                  <div style={{ fontSize: '8px', color: 'rgba(255,255,255,0.75)', letterSpacing: '2px', textTransform: 'uppercase', marginTop: '4px' }}>
                    {personal.headline}
                  </div>
                )}
              </div>
            </div>
            {contactItems.length > 0 && (
              <div className="mn-contact">
                {contactItems.map(({ key, icon, node }) => (
                  <div className="mn-contact-item" key={key}>
                    <span className="mn-contact-icon">{icon}</span>
                    {node}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div style={{ display: 'flex', gap: '24px' }}>
          <div style={{ flex: '1 1 0', minWidth: 0 }}>
            {visibleSections.filter((k) => !['skills', 'languages', 'personal'].includes(k)).map((key) => renderSection(key, profile, mainColor))}
          </div>
          <div style={{ width: '160px', flexShrink: 0 }}>
            {visibleSections.includes('skills') && renderSection('skills', profile, mainColor)}
            {visibleSections.includes('languages') && renderSection('languages', profile, mainColor)}
          </div>
        </div>
      </div>
    </>
  );
}
