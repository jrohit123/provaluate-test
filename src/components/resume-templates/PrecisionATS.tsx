import React from 'react';
import { type TemplateProps, getVisibleSections, dateRange } from './types';
import { displayProfileUrl, displayUrl, normalizeHref } from './resumeLinkUtils';

// ─── Scoped CSS ──────────────────────────────────────────────────────────────
// Prefix: .px- (precision / ats)
// Design: Zero decoration. Pure Arial on white. Bold section headers, single
// horizontal rule, pipe-separated contact. Every parsing engine reads this
// flawlessly. Generous line-height for human readability.
// ─────────────────────────────────────────────────────────────────────────────
export const PRAGUE_COLORS = ['#C25C24', '#6F84C3', '#82848C', '#6F9C81'] as const;

const STYLES = `
  .px-wrap {
    width: 794px;
    min-height: 1123px;
    background: #ffffff;
    padding: 0.5in;
    box-sizing: border-box;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10pt;
    color: #000000;
    line-height: 1.4;
  }

  /* ── Header ── */
  .px-name {
    font-size: 24pt;
    font-weight: 400;
    color: var(--accent, #C25C24);
    text-transform: none;
    font-family: Georgia, serif;
    margin: 0 0 4pt 0;
  }

  .px-headline {
    font-size: 12pt;
    font-weight: 400;
    color: var(--accent, #C25C24);
    font-family: Georgia, serif;
    margin-bottom: 0;
  }

  .px-contact-right {
    font-size: 10pt;
    color: #333333;
    text-align: right;
    line-height: 1.6;
    max-width: 270px;
    word-break: break-word;
  }

  .px-contact-right a {
    color: #333333;
    text-decoration: none;
  }

  /* ── Section ── */
  .px-section {
    margin-top: 16pt;
  }

  .px-section-title {
    font-size: 16pt;
    font-weight: 400;
    color: var(--accent, #C25C24);
    text-transform: none;
    border-bottom: 1px solid #dddddd;
    padding-bottom: 2pt;
    margin-bottom: 6pt;
    margin-top: 0;
  }

  /* ── Summary ── */
  .px-summary {
    font-size: 10px;
    line-height: 1.6;
    color: #111111;
  }

  /* ── Entry ── */
  .px-entry {
    margin-bottom: 6pt;
  }

  .px-entry-row1 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .px-entry-title {
    font-size: 12pt;
    font-weight: 400;
    font-family: Georgia, serif;
    color: #000000;
    flex: 1;
    min-width: 0;
  }

  .px-entry-date {
    font-size: 10pt;
    color: #555555;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .px-entry-row2 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin-top: 1px;
  }

  .px-entry-company {
    font-size: 10px;
    color: #222222;
    flex: 1;
    min-width: 0;
  }

  .px-entry-location {
    font-size: 9.5px;
    color: #444444;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── Bullets ── */
  .px-bullets {
    margin: 3px 0 0 16px;
    padding: 0;
    list-style: disc;
  }

  .px-bullets li {
    font-size: 10px;
    line-height: 1.55;
    color: #111111;
    margin-bottom: 1.5px;
    padding-left: 2px;
  }

  /* ── Skills ── */
  .px-skills-row {
    font-size: 10px;
    line-height: 1.8;
    color: #111111;
  }

  .px-skills-label {
    font-weight: 700;
  }

  /* ── Cert row ── */
  .px-cert-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 10px;
    margin-bottom: 3px;
    gap: 8px;
  }

  .px-cert-name {
    font-weight: 700;
    flex: 1;
    min-width: 0;
  }

  .px-cert-meta {
    font-size: 9.5px;
    color: #444444;
    white-space: normal;
    text-align: right;
    max-width: 50%;
    margin-left: 8px;
  }

  /* ── Lang / generic text ── */
  .px-text-row {
    font-size: 10px;
    line-height: 1.8;
    color: #111111;
  }

  /* ── Awards ── */
  .px-award-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 2px;
    gap: 8px;
  }

  .px-award-title {
    font-weight: 700;
    font-size: 10px;
    flex: 1;
  }

  .px-award-meta {
    font-size: 9.5px;
    color: #444444;
    white-space: normal;
    text-align: right;
    max-width: 45%;
  }

  .px-award-desc {
    font-size: 9.5px;
    color: #333333;
    margin-bottom: 5px;
    line-height: 1.45;
  }

  /* ── Pub / Ref ── */
  .px-pub-entry {
    font-size: 10px;
    line-height: 1.5;
    margin-bottom: 4px;
    color: #111111;
  }

  .px-ref-entry {
    font-size: 10px;
    line-height: 1.55;
    margin-bottom: 4px;
    color: #111111;
  }

  .px-ref-name { font-weight: 700; }

  .px-edu-note {
    font-size: 9.5px;
    color: #444444;
    margin-top: 2px;
  }

  .px-proj-tech {
    font-size: 9.5px;
    color: #444444;
    margin-top: 1px;
  }
`;

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
        <div className="px-section" key="summary">
          <div className="px-section-title">Summary</div>
          <p className="px-summary">{profile.summary}</p>
        </div>
      );

    case 'experience':
      if (!profile.experience?.length) return null;
      return (
        <div className="px-section" key="experience">
          <div className="px-section-title">Experience</div>
          {profile.experience.map((exp, i) => (
            <div className="px-entry" key={i}>
              <div className="px-entry-row1">
                <span className="px-entry-title">{exp.job_title || 'Job Title'}</span>
                <span className="px-entry-date">{dateRange(exp.start_date, exp.end_date)}</span>
              </div>
              <div className="px-entry-row2">
                <span className="px-entry-company">
                  {exp.employer || ''}
                  {exp.employment_type ? ` | ${exp.employment_type}` : ''}
                  {exp.work_mode ? ` | ${exp.work_mode}` : ''}
                </span>
                <span className="px-entry-location">{exp.location || ''}</span>
              </div>
              {exp.bullets?.length ? (
                <ul className="px-bullets">
                  {exp.bullets.filter(Boolean).map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              ) : exp.description ? (
                <ul className="px-bullets"><li>{exp.description}</li></ul>
              ) : null}
            </div>
          ))}
        </div>
      );

    case 'education':
      if (!profile.education?.length) return null;
      return (
        <div className="px-section" key="education">
          <div className="px-section-title">Education</div>
          {profile.education.map((edu, i) => (
            <div className="px-entry" key={i}>
              <div className="px-entry-row1">
                <span className="px-entry-title">{edu.institution || ''}</span>
                <span className="px-entry-date">{edu.location || ''}</span>
              </div>
              <div className="px-entry-row2">
                <span className="px-entry-company">
                  {[edu.degree, edu.field_of_study].filter(Boolean).join(', ')}
                  {edu.gpa ? ` | GPA: ${edu.gpa}` : ''}
                </span>
                <span className="px-entry-date">{dateRange(edu.start_date, edu.end_date)}</span>
              </div>
              {edu.achievements && <div className="px-edu-note">{edu.achievements}</div>}
            </div>
          ))}
        </div>
      );

    case 'projects':
      if (!profile.projects?.length) return null;
      return (
        <div className="px-section" key="projects">
          <div className="px-section-title">Projects</div>
          {profile.projects.map((proj, i) => (
            <div className="px-entry" key={i}>
              <div className="px-entry-row1">
                <span className="px-entry-title">
                  {proj.name || 'Project'}
                  {proj.url ? ` | ${displayProfileUrl(proj.url)}` : proj.repo_url ? ` | ${displayProfileUrl(proj.repo_url)}` : ''}
                </span>
                {proj.project_type && <span className="px-entry-date">{proj.project_type}</span>}
              </div>
              {proj.tech_stack && <div className="px-proj-tech">{proj.tech_stack}</div>}
              {proj.bullets?.length ? (
                <ul className="px-bullets">
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
        <div className="px-section" key="skills">
          <div className="px-section-title">Skills</div>
          {profile.skills.map((s, i) => (
            <div className="px-skills-row" key={i}>
              {s.category && <span className="px-skills-label">{s.category}: </span>}
              <span>{(s.items ?? []).join(', ')}</span>
            </div>
          ))}
        </div>
      );

    case 'certifications':
      if (!profile.certifications?.length) return null;
      return (
        <div className="px-section" key="certifications">
          <div className="px-section-title">Certifications</div>
          {profile.certifications.map((c, i) => (
            <div className="px-cert-row" key={i}>
              <span className="px-cert-name">{c.name || ''}</span>
              <span className="px-cert-meta">
                {[c.issuer, c.issue_date].filter(Boolean).join(' | ')}
                {c.expiry_date ? ` | Exp. ${c.expiry_date}` : ''}
              </span>
            </div>
          ))}
        </div>
      );

    case 'languages':
      if (!profile.languages?.length) return null;
      return (
        <div className="px-section" key="languages">
          <div className="px-section-title">Languages</div>
          <div className="px-text-row">
            {profile.languages.map((l, i) => (
              <span key={i}>
                <strong>{l.language}</strong>
                {l.proficiency ? ` (${l.proficiency})` : ''}
                {i < (profile.languages?.length ?? 0) - 1 ? '   |   ' : ''}
              </span>
            ))}
          </div>
        </div>
      );

    case 'awards':
      if (!profile.awards?.length) return null;
      return (
        <div className="px-section" key="awards">
          <div className="px-section-title">Awards & Honours</div>
          {profile.awards.map((a, i) => (
            <div key={i}>
              <div className="px-award-row">
                <span className="px-award-title">{a.title || ''}</span>
                <span className="px-award-meta">{[a.issuer, a.year].filter(Boolean).join(', ')}</span>
              </div>
              {a.description && <div className="px-award-desc">{a.description}</div>}
            </div>
          ))}
        </div>
      );

    case 'publications':
      if (!profile.publications?.length) return null;
      return (
        <div className="px-section" key="publications">
          <div className="px-section-title">Publications</div>
          {profile.publications.map((p, i) => (
            <div className="px-pub-entry" key={i}>
              <strong>{p.title || ''}</strong>
              {p.journal_or_conference ? ` | ${p.journal_or_conference}` : ''}
              {p.year ? ` | ${p.year}` : ''}
              {p.url ? ` | ${displayProfileUrl(p.url)}` : ''}
            </div>
          ))}
        </div>
      );

    case 'references':
      if (!profile.references?.length) return null;
      return (
        <div className="px-section" key="references">
          <div className="px-section-title">References</div>
          {profile.references.map((r, i) => (
            <div className="px-ref-entry" key={i}>
              <span className="px-ref-name">{r.name || ''}</span>
              {(r.job_title || r.company) && <span> | {[r.job_title, r.company].filter(Boolean).join(', ')}</span>}
              {r.email && <span> | {r.email}</span>}
            </div>
          ))}
        </div>
      );

    case 'declaration':
      if (!profile.declaration?.trim()) return null;
      return (
        <div className="px-section" key="declaration">
          <div className="px-section-title">Declaration</div>
          <div className="px-summary">{profile.declaration}</div>
        </div>
      );

    case 'custom_sections':
      if (!profile.custom_sections?.length) return null;
      return (
        <div className="px-section" key="custom_sections">
          {profile.custom_sections.map((section, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <div className="px-section-title">{section.section_title || section.title || `Section ${i + 1}`}</div>
              {section.description && <div className="px-summary">{section.description}</div>}
              {(section.items ?? []).map((item, idx) => {
                if (typeof item === 'string') return <div className="px-ref-entry" key={idx}>• {item}</div>;
                if (!item) return null;
                return (
                  <div className="px-ref-entry" key={idx}>
                    {item.title ? <span className="px-ref-name">{item.title}</span> : null}
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
          <div className="px-section" key={key}>
            <div className="px-section-title">{sectionTitleFromKey(key)}</div>
            <div className="px-summary">{val}</div>
          </div>
        );
      }
      if (Array.isArray(rec[key])) {
        const list = rec[key] as Array<unknown>;
        if (!list.length) return null;
        return (
          <div className="px-section" key={key}>
            <div className="px-section-title">{sectionTitleFromKey(key)}</div>
            {list.map((entry, i) => {
              if (typeof entry === 'string') return <div className="px-ref-entry" key={i}>• {entry}</div>;
              if (!entry || typeof entry !== 'object') return null;
              const obj = entry as Record<string, unknown>;
              const title = (obj.title ?? obj.name ?? obj.role ?? '') as string;
              const description = (obj.description ?? obj.details ?? '') as string;
              return (
                <div className="px-ref-entry" key={i}>
                  {title ? <span className="px-ref-name">{title}</span> : null}
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

export function PrecisionATS({ profile, accentColor = PRAGUE_COLORS[0] }: TemplateProps & { accentColor?: string }) {
  const { personal } = profile;
  const visibleSections = getVisibleSections(profile);
  const showPersonal = visibleSections.includes('personal');

  const contactParts: Array<{ text: string; href?: string }> = [];
  if (personal?.phone) contactParts.push({ text: personal.phone });
  if (personal?.email) contactParts.push({ text: personal.email, href: normalizeHref(`mailto:${personal.email}`) });
  if (personal?.location) contactParts.push({ text: personal.location });
  if (personal?.linkedin_url) contactParts.push({ text: displayProfileUrl(personal.linkedin_url), href: normalizeHref(personal.linkedin_url) });
  if (personal?.github_url) contactParts.push({ text: displayProfileUrl(personal.github_url), href: normalizeHref(personal.github_url) });
  if (personal?.website_url) contactParts.push({ text: displayProfileUrl(personal.website_url), href: normalizeHref(personal.website_url) });
  if (personal?.portfolio_url) contactParts.push({ text: displayProfileUrl(personal.portfolio_url), href: normalizeHref(personal.portfolio_url) });
  if (personal?.custom_links) {
    personal.custom_links.forEach((cl) => {
      if (cl.url) contactParts.push({ text: displayUrl(cl.url, cl.label), href: normalizeHref(cl.url) });
    });
  }

  return (
    <>
      <style>{STYLES}</style>
      <div className="px-wrap" style={{ '--accent': accentColor } as React.CSSProperties}>
        {showPersonal && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16pt', gap: '12pt' }}>
            <div>
              <div className="px-name">
                {personal?.full_name || `${personal?.first_name ?? ''} ${personal?.last_name ?? ''}`.trim() || 'Your Name'}
              </div>
              {personal?.headline && <div className="px-headline">{personal.headline}</div>}
            </div>
            {contactParts.length > 0 && (
              <div className="px-contact-right">
                {contactParts.map((c, i) => (
                  <div key={i}>
                    {c.href ? (
                      <a href={c.href} target="_blank" rel="noreferrer">
                        {c.text}
                      </a>
                    ) : (
                      c.text
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {visibleSections.map((key) => renderSection(key, profile))}
      </div>
    </>
  );
}
