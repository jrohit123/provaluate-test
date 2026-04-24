import React from 'react';
import { type TemplateProps, getVisibleSections, dateRange } from './types';
import { displayProfileUrl, displayUrl, normalizeHref } from './resumeLinkUtils';

// ─── Scoped CSS ──────────────────────────────────────────────────────────────
// All classes prefixed .tc- (two-column)
// Design: deep navy sidebar (#1e3a5f) + white main
// Font: DM Sans / Segoe UI / system sans throughout — no serif
// Section headers in main: navy colour + thin rule
// Skills in sidebar: pill tags
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&display=swap');

  .tc-wrap {
    width: 794px;
    min-height: 1123px;
    background: #ffffff;
    display: grid;
    grid-template-columns: 220px 1fr;
    grid-template-rows: auto;
    box-sizing: border-box;
    font-family: 'DM Sans', 'Segoe UI', system-ui, Arial, sans-serif;
    font-size: 10px;
    color: #1a1a1a;
  }

  /* ── Sidebar ── */
  .tc-sidebar {
    background: #1e3a5f;
    padding: 32px 18px 32px 20px;
    box-sizing: border-box;
    min-height: 1123px;
    display: flex;
    flex-direction: column;
    gap: 0;
  }

  .tc-sidebar-name {
    font-size: 17px;
    font-weight: 600;
    color: #ffffff;
    line-height: 1.2;
    letter-spacing: -0.2px;
    margin-bottom: 3px;
  }

  .tc-sidebar-headline {
    font-size: 9px;
    color: #93c5fd;
    font-weight: 400;
    line-height: 1.4;
    margin-bottom: 14px;
  }

  .tc-sidebar-section-title {
    font-size: 8px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.4px;
    color: #7dd3fc;
    margin-top: 16px;
    margin-bottom: 7px;
    padding-bottom: 3px;
    border-bottom: 0.5px solid rgba(125,211,252,0.3);
  }

  /* ── Sidebar contact ── */
  .tc-sidebar-contact {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 2px;
  }

  .tc-contact-item {
    display: flex;
    align-items: flex-start;
    gap: 5px;
    font-size: 8.5px;
    color: #bfdbfe;
    line-height: 1.4;
    word-break: break-all;
  }

  .tc-contact-icon {
    font-size: 9px;
    flex-shrink: 0;
    margin-top: 1px;
    opacity: 0.75;
  }

  .tc-contact-item a {
    color: #bfdbfe;
    text-decoration: none;
  }

  /* ── Sidebar skills ── */
  .tc-sidebar-skill-group {
    margin-bottom: 8px;
  }

  .tc-sidebar-skill-cat {
    font-size: 8px;
    font-weight: 600;
    color: #7dd3fc;
    margin-bottom: 4px;
    text-transform: uppercase;
    letter-spacing: 0.6px;
  }

  .tc-sidebar-skill-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 3px;
  }

  .tc-sidebar-skill-tag {
    font-size: 8px;
    padding: 2px 7px;
    border-radius: 3px;
    background: rgba(255,255,255,0.1);
    color: #e0f2fe;
    border: 0.5px solid rgba(255,255,255,0.15);
    line-height: 1.5;
  }

  /* ── Sidebar languages ── */
  .tc-lang-item {
    font-size: 8.5px;
    color: #bfdbfe;
    line-height: 1.6;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .tc-lang-name { font-weight: 500; color: #e0f2fe; }
  .tc-lang-level { font-size: 8px; color: #93c5fd; }

  /* ── Sidebar certifications ── */
  .tc-sb-cert {
    font-size: 8.5px;
    color: #bfdbfe;
    line-height: 1.5;
    margin-bottom: 5px;
  }

  .tc-sb-cert-name {
    font-weight: 500;
    color: #e0f2fe;
    display: block;
  }

  .tc-sb-cert-meta {
    font-size: 8px;
    color: #93c5fd;
  }

  /* ── Main column ── */
  .tc-main {
    background: #ffffff;
    padding: 32px 32px 32px 28px;
    box-sizing: border-box;
  }

  /* ── Main header (name shown here only if sidebar hidden) ── */
  .tc-main-section-title {
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.9px;
    color: #1e3a5f;
    border-bottom: 1px solid #1e3a5f;
    padding-bottom: 2px;
    margin-bottom: 7px;
    margin-top: 12px;
  }

  .tc-main-section-title:first-child {
    margin-top: 0;
  }

  /* ── Summary ── */
  .tc-summary {
    font-size: 9.5px;
    line-height: 1.6;
    color: #334155;
  }

  /* ── Experience entry ── */
  .tc-entry {
    margin-bottom: 10px;
  }

  .tc-entry-row1 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .tc-entry-title {
    font-size: 10px;
    font-weight: 600;
    color: #0f172a;
    flex: 1;
    min-width: 0;
  }

  .tc-entry-date {
    font-size: 8.5px;
    color: #64748b;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .tc-entry-row2 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin-top: 1px;
  }

  .tc-entry-company {
    font-size: 9px;
    color: #475569;
    font-style: italic;
    flex: 1;
    min-width: 0;
  }

  .tc-entry-location {
    font-size: 8.5px;
    color: #64748b;
    white-space: nowrap;
    flex-shrink: 0;
  }

  /* ── Bullets ── */
  .tc-bullets {
    margin: 4px 0 0 14px;
    padding: 0;
    list-style: disc;
  }

  .tc-bullets li {
    font-size: 9.5px;
    line-height: 1.55;
    color: #1e293b;
    margin-bottom: 2px;
  }

  /* ── Education ── */
  .tc-edu-entry {
    margin-bottom: 8px;
  }

  .tc-edu-note {
    font-size: 9px;
    color: #64748b;
    margin-top: 2px;
    line-height: 1.45;
  }

  /* ── Projects ── */
  .tc-proj-tech {
    font-size: 8.5px;
    color: #64748b;
    font-style: italic;
    margin-top: 1px;
  }

  /* ── Awards ── */
  .tc-award-entry {
    margin-bottom: 6px;
  }

  .tc-award-row1 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .tc-award-title {
    font-size: 9.5px;
    font-weight: 600;
    color: #0f172a;
    flex: 1;
  }

  .tc-award-meta {
    font-size: 8.5px;
    color: #64748b;
    white-space: nowrap;
  }

  .tc-award-desc {
    font-size: 9px;
    color: #475569;
    line-height: 1.45;
    margin-top: 1px;
  }

  /* ── Publications ── */
  .tc-pub-entry {
    font-size: 9.5px;
    line-height: 1.5;
    margin-bottom: 4px;
    color: #1e293b;
  }

  /* ── References ── */
  .tc-ref-entry {
    font-size: 9.5px;
    line-height: 1.55;
    margin-bottom: 4px;
    color: #1e293b;
  }
`;

// ─── Sidebar rendering ───────────────────────────────────────────────────────
function Sidebar({ profile, showPersonal }: { profile: NonNullable<TemplateProps['profile']>; showPersonal: boolean }) {
  const p = profile.personal;

  return (
    <div className="tc-sidebar">
      {showPersonal ? (
        <>
          {/* Name + headline */}
          <div className="tc-sidebar-name">
            {p?.full_name || `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Your Name'}
          </div>
          {p?.headline && <div className="tc-sidebar-headline">{p.headline}</div>}

          {/* Contact */}
          <div className="tc-sidebar-section-title">Contact</div>
          <div className="tc-sidebar-contact">
            {p?.email && (
              <div className="tc-contact-item">
                <span className="tc-contact-icon">✉</span>
                <a href={`mailto:${p.email}`}>{p.email}</a>
              </div>
            )}
            {p?.phone && (
              <div className="tc-contact-item">
                <span className="tc-contact-icon">☎</span>
                <span>{p.phone}</span>
              </div>
            )}
            {p?.location && (
              <div className="tc-contact-item">
                <span className="tc-contact-icon">◎</span>
                <span>{p.location}</span>
              </div>
            )}
            {p?.linkedin_url && (
              <div className="tc-contact-item">
                <span className="tc-contact-icon">in</span>
                <a href={normalizeHref(p.linkedin_url)}>{displayProfileUrl(p.linkedin_url)}</a>
              </div>
            )}
            {p?.github_url && (
              <div className="tc-contact-item">
                <span className="tc-contact-icon">⌥</span>
                <a href={normalizeHref(p.github_url)}>{displayProfileUrl(p.github_url)}</a>
              </div>
            )}
            {p?.website_url && (
              <div className="tc-contact-item">
                <span className="tc-contact-icon">⊕</span>
                <a href={normalizeHref(p.website_url)}>{displayProfileUrl(p.website_url)}</a>
              </div>
            )}
            {p?.custom_links?.map((cl, i) => cl.url ? (
              <div className="tc-contact-item" key={i}>
                <span className="tc-contact-icon">→</span>
                <a href={normalizeHref(cl.url)}>{displayUrl(cl.url, cl.label)}</a>
              </div>
            ) : null)}
          </div>
        </>
      ) : null}

    </div>
  );
}

// ─── Main column section rendering ──────────────────────────────────────────
function renderMainSection(key: string, profile: NonNullable<TemplateProps['profile']>): React.ReactNode {
  const profileRecord = profile as Record<string, unknown>;
  const sectionTitle = (sectionKey: string) =>
    ({ custom_sections: 'Custom Sections', organisations: 'Organisations', courses: 'Courses & Training' } as Record<string, string>)[sectionKey]
    ?? sectionKey.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

  switch (key) {

    case 'summary':
      if (!profile.summary?.trim()) return null;
      return (
        <div key="summary">
          <div className="tc-main-section-title">Summary</div>
          <p className="tc-summary">{profile.summary}</p>
        </div>
      );

    case 'experience':
      if (!profile.experience?.length) return null;
      return (
        <div key="experience">
          <div className="tc-main-section-title">Professional Experience</div>
          {profile.experience.map((exp, i) => (
            <div className="tc-entry" key={i}>
              <div className="tc-entry-row1">
                <span className="tc-entry-title">{exp.job_title}</span>
                <span className="tc-entry-date">{dateRange(exp.start_date, exp.end_date)}</span>
              </div>
              <div className="tc-entry-row2">
                <span className="tc-entry-company">
                  {exp.employer}
                  {exp.employment_type ? ` · ${exp.employment_type}` : ''}
                  {exp.work_mode ? ` · ${exp.work_mode}` : ''}
                </span>
                <span className="tc-entry-location">{exp.location}</span>
              </div>
              {(exp.bullets && exp.bullets.length > 0) ? (
                <ul className="tc-bullets">
                  {exp.bullets.filter(Boolean).map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              ) : exp.description ? (
                <ul className="tc-bullets"><li>{exp.description}</li></ul>
              ) : null}
            </div>
          ))}
        </div>
      );

    case 'education':
      if (!profile.education?.length) return null;
      return (
        <div key="education">
          <div className="tc-main-section-title">Education</div>
          {profile.education.map((edu, i) => (
            <div className="tc-edu-entry" key={i}>
              <div className="tc-entry-row1">
                <span className="tc-entry-title">{edu.institution}</span>
                <span className="tc-entry-date">{dateRange(edu.start_date, edu.end_date)}</span>
              </div>
              <div className="tc-entry-row2">
                <span className="tc-entry-company">
                  {[edu.degree, edu.field_of_study].filter(Boolean).join(', ')}
                  {edu.gpa ? ` — ${edu.gpa}` : ''}
                </span>
                <span className="tc-entry-location">{edu.location}</span>
              </div>
              {edu.achievements && <div className="tc-edu-note">{edu.achievements}</div>}
            </div>
          ))}
        </div>
      );

    case 'projects':
      if (!profile.projects?.length) return null;
      return (
        <div key="projects">
          <div className="tc-main-section-title">Projects</div>
          {profile.projects.map((proj, i) => (
            <div className="tc-entry" key={i}>
              <div className="tc-entry-row1">
                <span className="tc-entry-title">
                  {proj.name}
                  {proj.url ? (
                    <> · <a href={normalizeHref(proj.url)} style={{ fontWeight: 400, fontStyle: 'italic', color: '#475569' }}>{displayProfileUrl(proj.url)}</a></>
                  ) : proj.repo_url ? (
                    <> · <a href={normalizeHref(proj.repo_url)} style={{ fontWeight: 400, fontStyle: 'italic', color: '#475569' }}>{displayProfileUrl(proj.repo_url)}</a></>
                  ) : null}
                </span>
                {proj.project_type && <span className="tc-entry-date">{proj.project_type}</span>}
              </div>
              {proj.tech_stack && <div className="tc-proj-tech">{proj.tech_stack}</div>}
              {proj.bullets && proj.bullets.length > 0 && (
                <ul className="tc-bullets">
                  {proj.bullets.filter(Boolean).map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              )}
            </div>
          ))}
        </div>
      );

    case 'awards':
      if (!profile.awards?.length) return null;
      return (
        <div key="awards">
          <div className="tc-main-section-title">Awards & Honours</div>
          {profile.awards.map((a, i) => (
            <div className="tc-award-entry" key={i}>
              <div className="tc-award-row1">
                <span className="tc-award-title">{a.title}</span>
                <span className="tc-award-meta">{[a.issuer, a.year].filter(Boolean).join(', ')}</span>
              </div>
              {a.description && <div className="tc-award-desc">{a.description}</div>}
            </div>
          ))}
        </div>
      );

    case 'skills':
      if (!profile.skills?.length) return null;
      return (
        <div key="skills">
          <div className="tc-main-section-title">Skills</div>
          {profile.skills.map((s, i) => (
            <div className="tc-ref-entry" key={i}>
              {s.category ? <strong>{s.category}: </strong> : null}
              {(s.items ?? []).join(', ')}
            </div>
          ))}
        </div>
      );

    case 'languages':
      if (!profile.languages?.length) return null;
      return (
        <div key="languages">
          <div className="tc-main-section-title">Languages</div>
          {profile.languages.map((l, i) => (
            <div className="tc-ref-entry" key={i}>
              <strong>{l.language}</strong>
              {l.proficiency ? ` — ${l.proficiency}` : ''}
            </div>
          ))}
        </div>
      );

    case 'certifications':
      if (!profile.certifications?.length) return null;
      return (
        <div key="certifications">
          <div className="tc-main-section-title">Certifications</div>
          {profile.certifications.map((c, i) => (
            <div className="tc-ref-entry" key={i}>
              <strong>{c.name}</strong>
              {` — ${[c.issuer, c.issue_date].filter(Boolean).join(' · ')}`}
            </div>
          ))}
        </div>
      );

    case 'declaration':
      if (!profile.declaration?.trim()) return null;
      return (
        <div key="declaration">
          <div className="tc-main-section-title">Declaration</div>
          <p className="tc-summary">{profile.declaration}</p>
        </div>
      );

    case 'custom_sections':
      if (!profile.custom_sections?.length) return null;
      return (
        <div key="custom_sections">
          {profile.custom_sections.map((section, i) => (
            <div key={i}>
              <div className="tc-main-section-title">{section.section_title || section.title || `Custom Section ${i + 1}`}</div>
              {section.description ? <p className="tc-summary">{section.description}</p> : null}
              {(section.items ?? []).map((item, idx) => {
                if (typeof item === 'string') return <div className="tc-ref-entry" key={idx}>• {item}</div>;
                if (!item) return null;
                return (
                  <div className="tc-ref-entry" key={idx}>
                    {item.title ? <strong>{item.title}</strong> : null}
                    {item.description ? `${item.title ? ' — ' : ''}${item.description}` : ''}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      );

    case 'publications':
      if (!profile.publications?.length) return null;
      return (
        <div key="publications">
          <div className="tc-main-section-title">Publications</div>
          {profile.publications.map((p, i) => (
            <div className="tc-pub-entry" key={i}>
              <strong>{p.title}</strong>
              {p.journal_or_conference ? ` — ${p.journal_or_conference}` : ''}
              {p.year ? `, ${p.year}` : ''}
              {p.url ? <> · <a href={normalizeHref(p.url)} style={{ color: '#475569', fontStyle: 'italic' }}>{displayProfileUrl(p.url)}</a></> : null}
            </div>
          ))}
        </div>
      );

    case 'references':
      if (!profile.references?.length) return null;
      return (
        <div key="references">
          <div className="tc-main-section-title">References</div>
          {profile.references.map((r, i) => (
            <div className="tc-ref-entry" key={i}>
              <strong>{r.name}</strong>
              {(r.job_title || r.company) && ` — ${[r.job_title, r.company].filter(Boolean).join(', ')}`}
              {r.email && ` · ${r.email}`}
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
          <div key={key}>
            <div className="tc-main-section-title">{sectionTitle(key)}</div>
            <p className="tc-summary">{value}</p>
          </div>
        );
      }
      if (Array.isArray(profileRecord[key])) {
        const list = profileRecord[key] as Array<unknown>;
        if (!list.length) return null;
        return (
          <div key={key}>
            <div className="tc-main-section-title">{sectionTitle(key)}</div>
            {list.map((entry, i) => {
              if (typeof entry === 'string') return <div className="tc-ref-entry" key={i}>• {entry}</div>;
              if (!entry || typeof entry !== 'object') return null;
              const obj = entry as Record<string, unknown>;
              const title = (obj.title ?? obj.name ?? obj.role ?? '') as string;
              const description = (obj.description ?? obj.details ?? '') as string;
              return (
                <div className="tc-ref-entry" key={i}>
                  {title ? <strong>{title}</strong> : null}
                  {description ? `${title ? ' — ' : ''}${description}` : ''}
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
export function TwoColumnModern({ profile }: TemplateProps) {
  const visibleSections = getVisibleSections(profile);
  const showPersonal = visibleSections.includes('personal');

  return (
    <>
      <style>{STYLES}</style>
      <div className="tc-wrap">
        <Sidebar profile={profile} showPersonal={showPersonal} />
        <div className="tc-main">
          {visibleSections.map((key) => renderMainSection(key, profile))}
        </div>
      </div>
    </>
  );
}
