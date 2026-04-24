import React from 'react';
import { type TemplateProps, getVisibleSections, dateRange } from './types';
import { displayProfileUrl, displayUrl, normalizeHref } from './resumeLinkUtils';

export const PROFESSIONAL_MAIN_COLORS = ['#0b6e4f', '#9a3412', '#1d4f91', '#5b2a86', '#1f2937'] as const;

const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Lato:ital,wght@0,300;0,400;0,700;1,400&family=PT+Serif:ital,wght@0,400;0,700;1,400&display=swap');

  .pf-wrap {
    width: 794px;
    min-height: 1123px;
    background: #ffffff;
    box-sizing: border-box;
    display: flex;
    flex-direction: row;
    font-family: 'Lato', 'Segoe UI', system-ui, Arial, sans-serif;
    font-size: 10px;
    color: #333333;
    line-height: 1.4;
  }

  /* ── Sidebar ── */
  .pf-sidebar {
    width: 222px;
    min-width: 222px;
    background: var(--pf-main, #1a2535);
    padding: 32px 18px 28px 18px;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .pf-photo-circle {
    width: 80px;
    height: 80px;
    border-radius: 0;
    background: #2d3f55;
    margin-bottom: 14px;
    flex-shrink: 0;
    overflow: hidden;
  }

  .pf-photo-circle img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .pf-sidebar-name {
    font-size: 15px;
    font-weight: 700;
    color: #ffffff;
    text-align: center;
    line-height: 1.3;
    margin-bottom: 5px;
    word-break: break-word;
    width: 100%;
  }

  .pf-sidebar-headline {
    font-size: 7.5px;
    font-weight: 400;
    color: #8fa3b8;
    text-align: center;
    text-transform: uppercase;
    letter-spacing: 1.2px;
    margin-bottom: 14px;
    width: 100%;
    line-height: 1.5;
    word-break: break-word;
  }

  .pf-sidebar-section {
    width: 100%;
    margin-bottom: 18px;
  }

  .pf-sidebar-section-title {
    font-size: 11px;
    font-weight: 700;
    color: #ffffff;
    margin-bottom: 8px;
    letter-spacing: 0.2px;
  }

  .pf-sidebar-item {
    font-size: 8.5px;
    color: #b0c8de;
    margin-bottom: 5px;
    line-height: 1.45;
    word-break: break-all;
    width: 100%;
  }

  .pf-sidebar-item a {
    color: #b0c8de;
    text-decoration: none;
  }

  .pf-skill-tag {
    display: block;
    font-size: 8.5px;
    background: rgba(126, 184, 212, 0.15);
    color: #cce4f4;
    padding: 3px 8px;
    border-radius: 2px;
    margin-bottom: 4px;
    line-height: 1.6;
    width: 100%;
    box-sizing: border-box;
  }

  /* ── Main ── */
  .pf-main {
    flex: 1;
    padding: 28px 26px 32px 26px;
    box-sizing: border-box;
    min-width: 0;
  }

  .pf-section {
    margin-bottom: 16px;
  }

  .pf-section-title {
    font-family: 'PT Serif', Georgia, 'Times New Roman', serif;
    font-size: 16px;
    font-weight: 700;
    color: var(--pf-main, #1a2535);
    margin-bottom: 4px;
    line-height: 1.2;
  }

  .pf-section-rule {
    height: 1px;
    background: #cccccc;
    margin-bottom: 10px;
  }

  .pf-summary {
    font-size: 9.5px;
    line-height: 1.65;
    color: #444444;
  }

  .pf-entry {
    margin-bottom: 11px;
  }

  .pf-entry-row1 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .pf-entry-title {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--pf-main, #1a2535);
    flex: 1;
    min-width: 0;
  }

  .pf-entry-date {
    font-size: 7.5px;
    color: #1a7a72;
    font-weight: 400;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .pf-entry-row2 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin-top: 2px;
  }

  .pf-entry-company {
    font-size: 9px;
    color: #666666;
    flex: 1;
    min-width: 0;
  }

  .pf-entry-location {
    font-size: 8.5px;
    color: #888888;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .pf-bullets {
    margin: 5px 0 0 0;
    padding-left: 16px;
    list-style: disc;
  }

  .pf-bullets li {
    font-size: 9.5px;
    line-height: 1.55;
    color: #444444;
    margin-bottom: 2px;
  }

  .pf-skills-group { margin-top: 2px; }

  .pf-skills-row {
    font-size: 9.5px;
    line-height: 1.8;
    color: #444444;
  }

  .pf-skills-label {
    font-weight: 700;
    color: var(--pf-main, #1a2535);
  }

  .pf-cert-entry { margin-bottom: 5px; }
  .pf-cert-name { font-size: 9.5px; font-weight: 700; color: var(--pf-main, #1a2535); }
  .pf-cert-meta { font-size: 8.5px; color: #888888; display: block; margin-top: 1px; }

  .pf-lang-row { font-size: 9.5px; line-height: 1.8; color: #444444; }

  .pf-award-entry { margin-bottom: 6px; }
  .pf-award-row1 { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
  .pf-award-title { font-size: 9.5px; font-weight: 700; color: var(--pf-main, #1a2535); flex: 1; }
  .pf-award-meta { font-size: 8.5px; color: #888888; white-space: nowrap; }
  .pf-award-desc { font-size: 9px; color: #666666; margin-top: 1px; line-height: 1.45; }

  .pf-pub-entry { font-size: 9.5px; line-height: 1.5; margin-bottom: 4px; color: #444444; }

  .pf-ref-entry { font-size: 9.5px; line-height: 1.55; margin-bottom: 5px; color: #444444; }
  .pf-ref-name { font-weight: 700; color: var(--pf-main, #1a2535); }

  .pf-edu-note { font-size: 8.5px; color: #888888; margin-top: 2px; line-height: 1.4; }
  .pf-proj-tech { font-size: 8.5px; color: #888888; margin-top: 1px; }
`;

function sectionTitleFromKey(key: string): string {
  const labels: Record<string, string> = {
    custom_sections: 'Additional Sections',
    organisations: 'Organisations',
    courses: 'Courses & Training',
  };
  return labels[key] ?? key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function SectionHeader({ title }: { title: string }) {
  return (
    <>
      <div className="pf-section-title">{title}</div>
      <div className="pf-section-rule" />
    </>
  );
}

function renderSection(key: string, profile: NonNullable<TemplateProps['profile']>): React.ReactNode {
  const rec = profile as Record<string, unknown>;

  switch (key) {
    case 'summary':
      if (!profile.summary?.trim()) return null;
      return (
        <div className="pf-section" key="summary">
          <SectionHeader title="Profile" />
          <p className="pf-summary">{profile.summary}</p>
        </div>
      );

    case 'experience':
      if (!profile.experience?.length) return null;
      return (
        <div className="pf-section" key="experience">
          <SectionHeader title="Employment History" />
          {profile.experience.map((exp, i) => (
            <div className="pf-entry" key={i}>
              <div className="pf-entry-row1">
                <span className="pf-entry-title">{exp.job_title || 'Job Title'}</span>
                <span className="pf-entry-date">{dateRange(exp.start_date, exp.end_date)}</span>
              </div>
              <div className="pf-entry-row2">
                <span className="pf-entry-company">
                  {exp.employer || ''}
                  {exp.employment_type ? ` · ${exp.employment_type}` : ''}
                  {exp.work_mode ? ` · ${exp.work_mode}` : ''}
                </span>
                <span className="pf-entry-location">{exp.location || ''}</span>
              </div>
              {exp.bullets?.length ? (
                <ul className="pf-bullets">
                  {exp.bullets.filter(Boolean).map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              ) : exp.description ? (
                <ul className="pf-bullets"><li>{exp.description}</li></ul>
              ) : null}
            </div>
          ))}
        </div>
      );

    case 'education':
      if (!profile.education?.length) return null;
      return (
        <div className="pf-section" key="education">
          <SectionHeader title="Education" />
          {profile.education.map((edu, i) => (
            <div className="pf-entry" key={i}>
              <div className="pf-entry-row1">
                <span className="pf-entry-title">{edu.institution || ''}</span>
                <span className="pf-entry-date">{dateRange(edu.start_date, edu.end_date)}</span>
              </div>
              <div className="pf-entry-row2">
                <span className="pf-entry-company">
                  {[edu.degree, edu.field_of_study].filter(Boolean).join(', ')}
                  {edu.gpa ? ` — ${edu.gpa}` : ''}
                </span>
                <span className="pf-entry-location">{edu.location || ''}</span>
              </div>
              {edu.achievements && <div className="pf-edu-note">{edu.achievements}</div>}
            </div>
          ))}
        </div>
      );

    case 'projects':
      if (!profile.projects?.length) return null;
      return (
        <div className="pf-section" key="projects">
          <SectionHeader title="Projects" />
          {profile.projects.map((proj, i) => (
            <div className="pf-entry" key={i}>
              <div className="pf-entry-row1">
                <span className="pf-entry-title">
                  {proj.name || 'Project'}
                  {proj.url ? (
                    <> · <a href={normalizeHref(proj.url)} style={{ fontWeight: 400, color: '#2a6496' }}>{displayProfileUrl(proj.url)}</a></>
                  ) : proj.repo_url ? (
                    <> · <a href={normalizeHref(proj.repo_url)} style={{ fontWeight: 400, color: '#2a6496' }}>{displayProfileUrl(proj.repo_url)}</a></>
                  ) : null}
                </span>
                {proj.project_type && <span className="pf-entry-date">{proj.project_type}</span>}
              </div>
              {proj.tech_stack && <div className="pf-proj-tech">{proj.tech_stack}</div>}
              {proj.bullets?.length ? (
                <ul className="pf-bullets">
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
        <div className="pf-section" key="skills">
          <SectionHeader title="Skills" />
          <div className="pf-skills-group">
            {profile.skills.map((s, i) => (
              <div className="pf-skills-row" key={i}>
                {s.category && <span className="pf-skills-label">{s.category}: </span>}
                <span>{(s.items ?? []).join(', ')}</span>
              </div>
            ))}
          </div>
        </div>
      );

    case 'certifications':
      if (!profile.certifications?.length) return null;
      return (
        <div className="pf-section" key="certifications">
          <SectionHeader title="Certifications" />
          {profile.certifications.map((c, i) => (
            <div className="pf-cert-entry" key={i}>
              <span className="pf-cert-name">{c.name || ''}</span>
              <span className="pf-cert-meta">
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
        <div className="pf-section" key="languages">
          <SectionHeader title="Languages" />
          <div className="pf-lang-row">
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
        <div className="pf-section" key="awards">
          <SectionHeader title="Awards & Honours" />
          {profile.awards.map((a, i) => (
            <div className="pf-award-entry" key={i}>
              <div className="pf-award-row1">
                <span className="pf-award-title">{a.title || ''}</span>
                <span className="pf-award-meta">{[a.issuer, a.year].filter(Boolean).join(', ')}</span>
              </div>
              {a.description && <div className="pf-award-desc">{a.description}</div>}
            </div>
          ))}
        </div>
      );

    case 'publications':
      if (!profile.publications?.length) return null;
      return (
        <div className="pf-section" key="publications">
          <SectionHeader title="Publications" />
          {profile.publications.map((p, i) => (
            <div className="pf-pub-entry" key={i}>
              <strong>{p.title || ''}</strong>
              {p.journal_or_conference ? ` — ${p.journal_or_conference}` : ''}
              {p.year ? `, ${p.year}` : ''}
              {p.url ? <> · <a href={normalizeHref(p.url)} style={{ color: '#2a6496' }}>{displayProfileUrl(p.url)}</a></> : null}
            </div>
          ))}
        </div>
      );

    case 'references':
      if (!profile.references?.length) return null;
      return (
        <div className="pf-section" key="references">
          <SectionHeader title="References" />
          {profile.references.map((r, i) => (
            <div className="pf-ref-entry" key={i}>
              <span className="pf-ref-name">{r.name || ''}</span>
              {(r.job_title || r.company) && <span> — {[r.job_title, r.company].filter(Boolean).join(', ')}</span>}
              {r.email && <span> · {r.email}</span>}
            </div>
          ))}
        </div>
      );

    case 'declaration':
      if (!profile.declaration?.trim()) return null;
      return (
        <div className="pf-section" key="declaration">
          <SectionHeader title="Declaration" />
          <p className="pf-summary">{profile.declaration}</p>
        </div>
      );

    case 'custom_sections':
      if (!profile.custom_sections?.length) return null;
      return (
        <div className="pf-section" key="custom_sections">
          {profile.custom_sections.map((section, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <SectionHeader title={section.section_title || section.title || `Section ${i + 1}`} />
              {section.description && <p className="pf-summary">{section.description}</p>}
              {(section.items ?? []).map((item, idx) => {
                if (typeof item === 'string') return <div className="pf-ref-entry" key={idx}>• {item}</div>;
                if (!item) return null;
                return (
                  <div className="pf-ref-entry" key={idx}>
                    {item.title ? <span className="pf-ref-name">{item.title}</span> : null}
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
          <div className="pf-section" key={key}>
            <SectionHeader title={sectionTitleFromKey(key)} />
            <p className="pf-summary">{val}</p>
          </div>
        );
      }
      if (Array.isArray(rec[key])) {
        const list = rec[key] as Array<unknown>;
        if (!list.length) return null;
        return (
          <div className="pf-section" key={key}>
            <SectionHeader title={sectionTitleFromKey(key)} />
            {list.map((entry, i) => {
              if (typeof entry === 'string') return <div className="pf-ref-entry" key={i}>• {entry}</div>;
              if (!entry || typeof entry !== 'object') return null;
              const obj = entry as Record<string, unknown>;
              const title = (obj.title ?? obj.name ?? obj.role ?? '') as string;
              const description = (obj.description ?? obj.details ?? '') as string;
              return (
                <div className="pf-ref-entry" key={i}>
                  {title ? <span className="pf-ref-name">{title}</span> : null}
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

export function ProfessionalTemplate({
  profile,
  mainColor = PROFESSIONAL_MAIN_COLORS[4],
}: TemplateProps & { mainColor?: string }) {
  const { personal } = profile;
  const visibleSections = getVisibleSections(profile);
  const showPersonal = visibleSections.includes('personal');

  const sidebarSections = new Set(['personal', 'skills', 'languages']);
  const mainSections = visibleSections.filter((s) => !sidebarSections.has(s));
  const skillItems = (profile.skills ?? []).flatMap((s) => s.items ?? []).filter(Boolean);

  return (
    <>
      <style>{STYLES}</style>
      <div className="pf-wrap" style={{ '--pf-main': mainColor } as React.CSSProperties}>

        <div className="pf-sidebar">
          {showPersonal && (
            <>
              <div className="pf-photo-circle">
                {personal?.photo_url ? <img src={personal.photo_url} alt="Profile" /> : null}
              </div>
              <div className="pf-sidebar-name">
                {personal?.full_name ||
                  `${personal?.first_name ?? ''} ${personal?.last_name ?? ''}`.trim() ||
                  'Your Name'}
              </div>
              {personal?.headline && (
                <div className="pf-sidebar-headline">{personal.headline}</div>
              )}
              <div className="pf-sidebar-section">
                <div className="pf-sidebar-section-title">Details</div>
                {personal?.location && <div className="pf-sidebar-item">{personal.location}</div>}
                {personal?.phone && <div className="pf-sidebar-item">{personal.phone}</div>}
                {personal?.email && (
                  <div className="pf-sidebar-item">
                    <a href={`mailto:${personal.email}`}>{personal.email}</a>
                  </div>
                )}
                {personal?.linkedin_url && (
                  <div className="pf-sidebar-item">
                    <a href={normalizeHref(personal.linkedin_url)}>
                      {displayProfileUrl(personal.linkedin_url)}
                    </a>
                  </div>
                )}
                {personal?.github_url && (
                  <div className="pf-sidebar-item">
                    <a href={normalizeHref(personal.github_url)}>
                      {displayProfileUrl(personal.github_url)}
                    </a>
                  </div>
                )}
                {personal?.website_url && (
                  <div className="pf-sidebar-item">
                    <a href={normalizeHref(personal.website_url)}>
                      {displayProfileUrl(personal.website_url)}
                    </a>
                  </div>
                )}
                {personal?.portfolio_url && personal.portfolio_url !== personal.website_url && (
                  <div className="pf-sidebar-item">
                    <a href={normalizeHref(personal.portfolio_url)}>
                      {displayProfileUrl(personal.portfolio_url)}
                    </a>
                  </div>
                )}
                {(personal?.custom_links ?? []).map((cl, i) =>
                  cl.url ? (
                    <div className="pf-sidebar-item" key={i}>
                      <a href={normalizeHref(cl.url)}>{displayUrl(cl.url, cl.label)}</a>
                    </div>
                  ) : null,
                )}
              </div>
            </>
          )}

          {skillItems.length > 0 && visibleSections.includes('skills') && (
            <div className="pf-sidebar-section">
              <div className="pf-sidebar-section-title">Skills</div>
              {skillItems.map((item, i) => (
                <span className="pf-skill-tag" key={i}>{item}</span>
              ))}
            </div>
          )}

          {(profile.languages ?? []).length > 0 && visibleSections.includes('languages') && (
            <div className="pf-sidebar-section">
              <div className="pf-sidebar-section-title">Languages</div>
              {(profile.languages ?? []).map((l, i) => (
                <div className="pf-sidebar-item" key={i}>
                  <strong style={{ color: '#ffffff' }}>{l.language}</strong>
                  {l.proficiency ? ` — ${l.proficiency}` : ''}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="pf-main">
          {mainSections.map((key) => renderSection(key, profile))}
        </div>

      </div>
    </>
  );
}
