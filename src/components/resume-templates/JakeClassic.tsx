import React from 'react';
import { type TemplateProps, getVisibleSections, dateRange } from './types';
import { displayProfileUrl, displayUrl, normalizeHref } from './resumeLinkUtils';

// ─── Scoped CSS ──────────────────────────────────────────────────────────────
// All classes prefixed with .jk- to avoid any collision with host app styles.
// Font choices deliberately match the original Jake LaTeX template:
//   - Name: Georgia (serif, weight 700) — same visual weight as LaTeX bold serif
//   - All body text: Arial / Helvetica — clean, ATS-safe, widely supported
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
  .jk-wrap {
    width: 794px;
    min-height: 1123px;
    background: #ffffff;
    padding: 36px 52px 36px 52px;
    box-sizing: border-box;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10px;
    color: #000000;
    line-height: 1.35;
  }

  /* ── Header ── */
  .jk-name {
    font-family: Georgia, 'Times New Roman', Times, serif;
    font-size: 24px;
    font-weight: 700;
    text-align: center;
    letter-spacing: 1.8px;
    text-transform: uppercase;
    color: #000000;
    margin: 0 0 5px 0;
  }

  .jk-contact {
    display: flex;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    gap: 0 4px;
    font-size: 9px;
    color: #333333;
    margin-bottom: 2px;
  }

  .jk-contact-sep {
    color: #999999;
    font-size: 8px;
  }

  .jk-contact a {
    color: #333333;
    text-decoration: none;
  }

  .jk-divider {
    border: none;
    border-top: 1px solid #000000;
    margin: 7px 0 0 0;
  }

  /* ── Section ── */
  .jk-section {
    margin-top: 10px;
  }

  .jk-section-title {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.9px;
    color: #000000;
    border-bottom: 1px solid #000000;
    padding-bottom: 2px;
    margin-bottom: 6px;
  }

  /* ── Summary ── */
  .jk-summary {
    font-size: 9.5px;
    line-height: 1.55;
    color: #1a1a1a;
    margin-bottom: 2px;
  }

  /* ── Entry (Experience / Education / Projects) ── */
  .jk-entry {
    margin-bottom: 8px;
  }

  .jk-entry-row1 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .jk-entry-title {
    font-weight: 700;
    font-size: 10px;
    color: #000000;
    flex: 1;
    min-width: 0;
  }

  .jk-entry-date {
    font-size: 9px;
    color: #333333;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .jk-entry-row2 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin-top: 1px;
  }

  .jk-entry-company {
    font-size: 9.5px;
    font-style: italic;
    color: #222222;
    flex: 1;
    min-width: 0;
  }

  .jk-entry-location {
    font-size: 9px;
    color: #444444;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── Bullets ── */
  .jk-bullets {
    margin: 3px 0 0 16px;
    padding: 0;
    list-style: disc;
  }

  .jk-bullets li {
    font-size: 9.5px;
    line-height: 1.5;
    color: #1a1a1a;
    margin-bottom: 1.5px;
    padding-left: 2px;
  }

  /* ── Skills ── */
  .jk-skills-row {
    font-size: 9.5px;
    line-height: 1.75;
    color: #1a1a1a;
  }

  .jk-skills-label {
    font-weight: 700;
  }

  /* ── Certifications ── */
  .jk-cert-entry {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 9.5px;
    margin-bottom: 3px;
  }

  .jk-cert-name {
    font-weight: 700;
    color: #000000;
    flex: 1;
  }

  .jk-cert-meta {
    font-style: italic;
    color: #444444;
    font-size: 9px;
    text-align: right;
    flex-shrink: 0;
    margin-left: 8px;
  }

  /* ── Languages ── */
  .jk-lang-row {
    font-size: 9.5px;
    line-height: 1.75;
    color: #1a1a1a;
  }

  /* ── Awards ── */
  .jk-award-entry {
    margin-bottom: 5px;
  }

  .jk-award-row1 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
  }

  .jk-award-title {
    font-weight: 700;
    font-size: 9.5px;
    color: #000000;
  }

  .jk-award-year {
    font-size: 9px;
    color: #444444;
  }

  .jk-award-desc {
    font-size: 9px;
    color: #333333;
    line-height: 1.45;
    margin-top: 1px;
  }

  /* ── Publications ── */
  .jk-pub-entry {
    font-size: 9.5px;
    line-height: 1.5;
    margin-bottom: 4px;
    color: #1a1a1a;
  }

  /* ── References ── */
  .jk-ref-entry {
    font-size: 9.5px;
    line-height: 1.55;
    margin-bottom: 4px;
  }

  .jk-ref-name {
    font-weight: 700;
  }

  /* ── Education GPA / achievements ── */
  .jk-edu-note {
    font-size: 9px;
    color: #444444;
    line-height: 1.45;
    margin-top: 2px;
  }

  /* ── Projects tech line ── */
  .jk-project-tech {
    font-style: italic;
    font-size: 9px;
    color: #444444;
    margin-top: 1px;
  }
`;

function sectionTitleFromKey(key: string): string {
  const labels: Record<string, string> = {
    custom_sections: 'Custom Sections',
    organisations: 'Organisations',
    courses: 'Courses & Training',
  };
  return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

// ─── Helper: render a section given its key ──────────────────────────────────
function renderSection(key: string, profile: ProfileData): React.ReactNode {
  const profileRecord = profile as Record<string, unknown>;
  switch (key) {

    case 'summary':
      if (!profile.summary?.trim()) return null;
      return (
        <div className="jk-section" key="summary">
          <div className="jk-section-title">Summary</div>
          <p className="jk-summary">{profile.summary}</p>
        </div>
      );

    case 'experience':
      if (!profile.experience?.length) return null;
      return (
        <div className="jk-section" key="experience">
          <div className="jk-section-title">Professional Experience</div>
          {profile.experience.map((exp, i) => (
            <div className="jk-entry" key={i}>
              <div className="jk-entry-row1">
                <span className="jk-entry-title">{exp.job_title || 'Job Title'}</span>
                <span className="jk-entry-date">{dateRange(exp.start_date, exp.end_date)}</span>
              </div>
              <div className="jk-entry-row2">
                <span className="jk-entry-company">
                  {exp.employer || ''}
                  {exp.employment_type ? ` · ${exp.employment_type}` : ''}
                  {exp.work_mode ? ` · ${exp.work_mode}` : ''}
                </span>
                <span className="jk-entry-location">{exp.location || ''}</span>
              </div>
              {(exp.bullets && exp.bullets.length > 0) ? (
                <ul className="jk-bullets">
                  {exp.bullets.filter(Boolean).map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              ) : exp.description ? (
                <ul className="jk-bullets"><li>{exp.description}</li></ul>
              ) : null}
            </div>
          ))}
        </div>
      );

    case 'education':
      if (!profile.education?.length) return null;
      return (
        <div className="jk-section" key="education">
          <div className="jk-section-title">Education</div>
          {profile.education.map((edu, i) => (
            <div className="jk-entry" key={i}>
              <div className="jk-entry-row1">
                <span className="jk-entry-title">{edu.institution || ''}</span>
                <span className="jk-entry-date">{edu.location || ''}</span>
              </div>
              <div className="jk-entry-row2">
                <span className="jk-entry-company">
                  {[edu.degree, edu.field_of_study].filter(Boolean).join(', ')}
                  {edu.gpa ? ` — ${edu.gpa}` : ''}
                </span>
                <span className="jk-entry-date">{dateRange(edu.start_date, edu.end_date)}</span>
              </div>
              {edu.achievements && (
                <div className="jk-edu-note">{edu.achievements}</div>
              )}
            </div>
          ))}
        </div>
      );

    case 'projects':
      if (!profile.projects?.length) return null;
      return (
        <div className="jk-section" key="projects">
          <div className="jk-section-title">Projects</div>
          {profile.projects.map((proj, i) => (
            <div className="jk-entry" key={i}>
              <div className="jk-entry-row1">
                <span className="jk-entry-title">
                  {proj.name || 'Project'}
                  {proj.url ? (
                    <> · <a href={normalizeHref(proj.url)} style={{ fontWeight: 400, fontStyle: 'italic', color: '#333' }}>{displayProfileUrl(proj.url)}</a></>
                  ) : proj.repo_url ? (
                    <> · <a href={normalizeHref(proj.repo_url)} style={{ fontWeight: 400, fontStyle: 'italic', color: '#333' }}>{displayProfileUrl(proj.repo_url)}</a></>
                  ) : null}
                </span>
                {proj.project_type && (
                  <span className="jk-entry-date">{proj.project_type}</span>
                )}
              </div>
              {proj.tech_stack && (
                <div className="jk-project-tech">{proj.tech_stack}</div>
              )}
              {(proj.bullets && proj.bullets.length > 0) && (
                <ul className="jk-bullets">
                  {proj.bullets.filter(Boolean).map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      );

    case 'skills':
      if (!profile.skills?.length) return null;
      return (
        <div className="jk-section" key="skills">
          <div className="jk-section-title">Skills</div>
          {profile.skills.map((s, i) => (
            <div className="jk-skills-row" key={i}>
              {s.category && <span className="jk-skills-label">{s.category}: </span>}
              <span>{(s.items ?? []).join(', ')}</span>
            </div>
          ))}
        </div>
      );

    case 'certifications':
      if (!profile.certifications?.length) return null;
      return (
        <div className="jk-section" key="certifications">
          <div className="jk-section-title">Certifications</div>
          {profile.certifications.map((c, i) => (
            <div className="jk-cert-entry" key={i}>
              <span className="jk-cert-name">{c.name || ''}</span>
              <span className="jk-cert-meta">
                {[c.issuer, c.issue_date].filter(Boolean).join(' · ')}
                {c.expiry_date ? ` — Expires ${c.expiry_date}` : ''}
              </span>
            </div>
          ))}
        </div>
      );

    case 'languages':
      if (!profile.languages?.length) return null;
      return (
        <div className="jk-section" key="languages">
          <div className="jk-section-title">Languages</div>
          <div className="jk-lang-row">
            {profile.languages.map((l, i) => (
              <span key={i}>
                {l.language}{l.proficiency ? ` (${l.proficiency})` : ''}
                {i < (profile.languages?.length ?? 0) - 1 ? '  ·  ' : ''}
              </span>
            ))}
          </div>
        </div>
      );

    case 'awards':
      if (!profile.awards?.length) return null;
      return (
        <div className="jk-section" key="awards">
          <div className="jk-section-title">Awards & Honours</div>
          {profile.awards.map((a, i) => (
            <div className="jk-award-entry" key={i}>
              <div className="jk-award-row1">
                <span className="jk-award-title">{a.title || ''}</span>
                <span className="jk-award-year">
                  {[a.issuer, a.year].filter(Boolean).join(', ')}
                </span>
              </div>
              {a.description && <div className="jk-award-desc">{a.description}</div>}
            </div>
          ))}
        </div>
      );

    case 'publications':
      if (!profile.publications?.length) return null;
      return (
        <div className="jk-section" key="publications">
          <div className="jk-section-title">Publications</div>
          {profile.publications.map((p, i) => (
            <div className="jk-pub-entry" key={i}>
              <strong>{p.title || ''}</strong>
              {p.journal_or_conference ? ` — ${p.journal_or_conference}` : ''}
              {p.year ? `, ${p.year}` : ''}
              {p.url ? <> · <a href={normalizeHref(p.url)} style={{ color: '#333', fontStyle: 'italic' }}>{displayProfileUrl(p.url)}</a></> : null}
            </div>
          ))}
        </div>
      );

    case 'references':
      if (!profile.references?.length) return null;
      return (
        <div className="jk-section" key="references">
          <div className="jk-section-title">References</div>
          {profile.references.map((r, i) => (
            <div className="jk-ref-entry" key={i}>
              <span className="jk-ref-name">{r.name || ''}</span>
              {(r.job_title || r.company) && (
                <span> — {[r.job_title, r.company].filter(Boolean).join(', ')}</span>
              )}
              {r.email && <span> · {r.email}</span>}
            </div>
          ))}
        </div>
      );

    case 'declaration':
      if (!profile.declaration?.trim()) return null;
      return (
        <div className="jk-section" key="declaration">
          <div className="jk-section-title">Declaration</div>
          <div className="jk-summary">{profile.declaration}</div>
        </div>
      );

    case 'custom_sections':
      if (!profile.custom_sections?.length) return null;
      return (
        <div className="jk-section" key="custom_sections">
          {profile.custom_sections.map((section, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <div className="jk-section-title">{section.section_title || section.title || `Custom Section ${i + 1}`}</div>
              {section.description ? <div className="jk-summary">{section.description}</div> : null}
              {(section.items ?? []).map((item, idx) => {
                if (typeof item === 'string') return <div className="jk-ref-entry" key={idx}>• {item}</div>;
                if (!item) return null;
                return (
                  <div className="jk-ref-entry" key={idx}>
                    {item.title ? <span className="jk-ref-name">{item.title}</span> : null}
                    {item.description ? <span>{item.title ? ` — ${item.description}` : item.description}</span> : null}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );

    default:
      if (!Object.prototype.hasOwnProperty.call(profileRecord, key)) return null;
      if (key === 'personal' || key === 'profession' || key === 'resume_config') return null;
      if (typeof profileRecord[key] === 'string') {
        const value = String(profileRecord[key]).trim();
        if (!value) return null;
        return (
          <div className="jk-section" key={key}>
            <div className="jk-section-title">{sectionTitleFromKey(key)}</div>
            <div className="jk-summary">{value}</div>
          </div>
        );
      }
      if (Array.isArray(profileRecord[key])) {
        const list = profileRecord[key] as Array<unknown>;
        if (!list.length) return null;
        return (
          <div className="jk-section" key={key}>
            <div className="jk-section-title">{sectionTitleFromKey(key)}</div>
            {list.map((entry, i) => {
              if (typeof entry === 'string') return <div className="jk-ref-entry" key={i}>• {entry}</div>;
              if (!entry || typeof entry !== 'object') return null;
              const obj = entry as Record<string, unknown>;
              const title = (obj.title ?? obj.name ?? obj.role ?? '') as string;
              const description = (obj.description ?? obj.details ?? '') as string;
              if (!title && !description) return <div className="jk-ref-entry" key={i}>• {JSON.stringify(obj)}</div>;
              return (
                <div className="jk-ref-entry" key={i}>
                  {title ? <span className="jk-ref-name">{title}</span> : null}
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

// ─── Component ───────────────────────────────────────────────────────────────
export function JakeClassic({ profile }: TemplateProps) {
  const { personal } = profile;
  const visibleSections = getVisibleSections(profile);
  const showPersonal = visibleSections.includes('personal');

  const contactItems: React.ReactNode[] = [];
  if (personal?.phone) contactItems.push(<span key="phone">{personal.phone}</span>);
  if (personal?.email) contactItems.push(<a key="email" href={`mailto:${personal.email}`}>{personal.email}</a>);
  if (personal?.linkedin_url) contactItems.push(<a key="li" href={normalizeHref(personal.linkedin_url)}>{displayProfileUrl(personal.linkedin_url)}</a>);
  if (personal?.github_url) contactItems.push(<a key="gh" href={normalizeHref(personal.github_url)}>{displayProfileUrl(personal.github_url)}</a>);
  if (personal?.website_url) contactItems.push(<a key="web" href={normalizeHref(personal.website_url)}>{displayProfileUrl(personal.website_url)}</a>);
  if (personal?.portfolio_url) contactItems.push(<a key="portfolio" href={normalizeHref(personal.portfolio_url)}>{displayProfileUrl(personal.portfolio_url)}</a>);
  if (personal?.location) contactItems.push(<span key="loc">{personal.location}</span>);
  if (personal?.custom_links) {
    personal.custom_links.forEach((cl, i) => {
      if (cl.url) contactItems.push(<a key={`cl${i}`} href={normalizeHref(cl.url)}>{displayUrl(cl.url, cl.label)}</a>);
    });
  }

  const contactWithSeps: React.ReactNode[] = [];
  contactItems.forEach((item, i) => {
    contactWithSeps.push(item);
    if (i < contactItems.length - 1) {
      contactWithSeps.push(<span key={`sep${i}`} className="jk-contact-sep"> | </span>);
    }
  });

  return (
    <>
      <style>{STYLES}</style>
      <div className="jk-wrap">

        {/* ── Header ── */}
        {showPersonal ? (
          <>
            <div className="jk-name">
              {personal?.full_name || `${personal?.first_name ?? ''} ${personal?.last_name ?? ''}`.trim() || 'Your Name'}
            </div>

            {personal?.headline && (
              <div style={{ textAlign: 'center', fontSize: '9.5px', color: '#444', marginBottom: '3px', fontStyle: 'italic' }}>
                {personal.headline}
              </div>
            )}

            {contactItems.length > 0 && (
              <div className="jk-contact">{contactWithSeps}</div>
            )}

            <hr className="jk-divider" />
          </>
        ) : null}

        {/* ── Sections in configured order ── */}
        {visibleSections.map((key) => renderSection(key, profile))}

      </div>
    </>
  );
}
