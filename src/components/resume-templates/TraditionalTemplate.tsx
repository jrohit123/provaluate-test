import React from 'react';
import { type TemplateProps, getVisibleSections, dateRange } from './types';
import { displayProfileUrl, displayUrl, normalizeHref } from './resumeLinkUtils';

// ─── Scoped CSS ──────────────────────────────────────────────────────────────
// Prefix: .td- (traditional)
// Design: EB Garamond serif throughout, centered ornate header, small-caps
// section titles, dual rule divider — mirrors classic academic/legal resume style
// ─────────────────────────────────────────────────────────────────────────────
const STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap');

  .td-wrap {
    width: 794px;
    min-height: 1123px;
    background: #ffffff;
    padding: 44px 58px 40px 58px;
    box-sizing: border-box;
    font-family: 'EB Garamond', Georgia, 'Times New Roman', serif;
    font-size: 10.5px;
    color: #111111;
    line-height: 1.4;
  }

  /* ── Header ── */
  .td-name {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 27px;
    font-weight: 700;
    text-align: center;
    letter-spacing: 0.5px;
    color: #000000;
    margin: 0 0 3px 0;
    line-height: 1.1;
  }

  .td-headline {
    text-align: center;
    font-size: 11px;
    color: #333333;
    margin-bottom: 4px;
  }

  .td-address {
    text-align: center;
    font-size: 9px;
    color: #555555;
    margin-bottom: 5px;
  }

  .td-contact {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 9px;
    color: #444444;
    border-top: 1px solid #555555;
    border-bottom: 1px solid #555555;
    padding: 4px 0;
    margin-top: 5px;
    margin-bottom: 0;
  }

  .td-contact a {
    color: #444444;
    text-decoration: none;
  }

  .td-contact-left {
    color: #444444;
  }

  .td-contact-right {
    display: flex;
    align-items: center;
    gap: 6px;
    color: #444444;
  }

  .td-contact-sep {
    margin: 0 4px;
    color: #aaaaaa;
  }

  /* ── Section ── */
  .td-section {
    margin-top: 20px;
  }

  .td-section-title {
    font-family: 'EB Garamond', Georgia, serif;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2.5px;
    color: #000000;
    text-align: center;
    background-color: #ececec;
    padding: 3px 0;
    border-top: 1px solid #444444;
    border-bottom: 1px solid #444444;
    margin-bottom: 8px;
    margin-top: 2px;
  }

  /* ── Summary ── */
  .td-summary {
    font-size: 10px;
    line-height: 1.65;
    color: #222222;
    text-align: justify;
    font-style: italic;
  }

  /* ── Entry ── */
  .td-entry {
    margin-bottom: 12px;
  }

  .td-entry-row1 {
    display: flex;
    align-items: baseline;
    gap: 0;
  }

  .td-dots {
    flex: 1;
    border-bottom: 1px dotted #999999;
    margin: 0 4px 2px 4px;
    min-width: 12px;
  }

  .td-entry-title {
    display: inline-flex;
    align-items: center;
    font-weight: 700;
    font-size: 10.5px;
    color: #000000;
    flex: 1;
    min-width: 0;
  }

  .td-entry-date {
    font-style: italic;
    font-size: 9.5px;
    color: #555555;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .td-entry-row2 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    margin-top: 1px;
  }

  .td-entry-sub {
    display: inline-flex;
    align-items: center;
    font-style: italic;
    font-size: 10px;
    color: #333333;
    flex: 1;
    min-width: 0;
  }

  .td-entry-loc {
    font-size: 9px;
    color: #666666;
    white-space: nowrap;
    flex-shrink: 0;
  }

  .td-entry-diamond {
    display: inline-block;
    width: 6px;
    height: 6px;
    background-color: #000000;
    transform: rotate(45deg);
    margin-right: 6px;
    margin-bottom: -1px;
    flex-shrink: 0;
  }

  /* ── Bullets ── */
  .td-bullets {
    margin: 3px 0 0 18px;
    padding: 0;
    list-style: disc;
  }

  .td-bullets li {
    font-size: 10px;
    line-height: 1.5;
    color: #222222;
    margin-bottom: 1.5px;
    padding-left: 2px;
  }

  /* ── Skills ── */
  .td-skills-row {
    font-size: 10px;
    line-height: 1.8;
    color: #222222;
  }

  .td-skills-label {
    font-weight: 700;
  }

  /* ── Inline row (certs, etc.) ── */
  .td-inline-row {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    font-size: 10px;
    margin-bottom: 3.5px;
    gap: 8px;
  }

  .td-inline-left { flex: 1; min-width: 0; }
  .td-inline-right {
    font-style: italic;
    font-size: 9px;
    color: #555555;
    white-space: nowrap;
    flex-shrink: 0;
    margin-left: 8px;
  }

  /* ── Pub / Ref ── */
  .td-pub-entry {
    font-size: 10px;
    line-height: 1.5;
    margin-bottom: 4px;
    color: #1a1a1a;
  }

  .td-ref-entry {
    font-size: 10px;
    line-height: 1.55;
    margin-bottom: 4px;
    color: #1a1a1a;
  }

  .td-ref-name { font-weight: 700; }

  /* ── Awards ── */
  .td-award-entry { margin-bottom: 6px; }

  .td-award-row1 {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }

  .td-award-title {
    font-weight: 700;
    font-size: 10.5px;
    color: #000000;
    flex: 1;
  }

  .td-award-meta {
    font-style: italic;
    font-size: 9px;
    color: #555555;
    white-space: nowrap;
  }

  .td-award-desc {
    font-size: 9.5px;
    color: #444444;
    margin-top: 1px;
    line-height: 1.45;
  }

  /* ── Lang ── */
  .td-lang-row {
    font-size: 10px;
    line-height: 1.8;
    color: #222222;
  }

  /* ── Generic ── */
  .td-generic-text {
    font-size: 10px;
    line-height: 1.6;
    color: #222222;
  }

  .td-edu-note {
    font-size: 9.5px;
    color: #555555;
    margin-top: 2px;
    font-style: italic;
  }

  .td-proj-tech {
    font-style: italic;
    font-size: 9.5px;
    color: #555555;
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
        <div className="td-section" key="summary">
          <div className="td-section-title">Profile</div>
          <p className="td-summary">{profile.summary}</p>
        </div>
      );

    case 'experience':
      if (!profile.experience?.length) return null;
      return (
        <div className="td-section" key="experience">
          <div className="td-section-title">Experience</div>
          {profile.experience.map((exp, i) => (
            <div className="td-entry" key={i}>
              <div className="td-entry-row1">
                <span className="td-entry-title">
                  <span className="td-entry-diamond" />
                  {exp.job_title || 'Job Title'}
                  {exp.employer ? ` - ${exp.employer}` : ''}
                  {exp.employment_type ? ` · ${exp.employment_type}` : ''}
                </span>
                <span className="td-dots"></span>
                <span className="td-entry-date">{dateRange(exp.start_date, exp.end_date)}</span>
              </div>
              {(exp.location || exp.work_mode) && (
                <div className="td-entry-row2">
                  <span className="td-entry-sub" style={{ flex: 1 }}>{exp.work_mode || ''}</span>
                  <span className="td-entry-loc">{exp.location || ''}</span>
                </div>
              )}
              {exp.bullets?.length ? (
                <ul className="td-bullets">
                  {exp.bullets.filter(Boolean).map((b, j) => <li key={j}>{b}</li>)}
                </ul>
              ) : exp.description ? (
                <ul className="td-bullets"><li>{exp.description}</li></ul>
              ) : null}
            </div>
          ))}
        </div>
      );

    case 'education':
      if (!profile.education?.length) return null;
      return (
        <div className="td-section" key="education">
          <div className="td-section-title">Education</div>
          {profile.education.map((edu, i) => (
            <div className="td-entry" key={i}>
              <div className="td-entry-row1">
                <span className="td-entry-sub">
                  <span className="td-entry-diamond" />
                  {[edu.degree, edu.field_of_study].filter(Boolean).join(', ') || edu.institution || ''}
                </span>
                <span className="td-dots"></span>
                <span className="td-entry-date">{dateRange(edu.start_date, edu.end_date)}</span>
              </div>
              <div className="td-entry-row2">
                <span className="td-entry-sub">
                  {edu.institution || ''}
                  {edu.gpa ? ` — GPA: ${edu.gpa}` : ''}
                </span>
                {edu.location && (
                  <span className="td-entry-loc">{edu.location}</span>
                )}
              </div>
              {edu.achievements && <div className="td-edu-note">{edu.achievements}</div>}
            </div>
          ))}
        </div>
      );

    case 'projects':
      if (!profile.projects?.length) return null;
      return (
        <div className="td-section" key="projects">
          <div className="td-section-title">Projects</div>
          {profile.projects.map((proj, i) => (
            <div className="td-entry" key={i}>
              <div className="td-entry-row1">
                <span className="td-entry-title">
                  {proj.name || 'Project'}
                  {proj.url ? (
                    <> · <a href={normalizeHref(proj.url)} style={{ fontWeight: 400, fontStyle: 'italic', color: '#444' }}>{displayProfileUrl(proj.url)}</a></>
                  ) : proj.repo_url ? (
                    <> · <a href={normalizeHref(proj.repo_url)} style={{ fontWeight: 400, fontStyle: 'italic', color: '#444' }}>{displayProfileUrl(proj.repo_url)}</a></>
                  ) : null}
                </span>
                {proj.project_type && <span className="td-entry-date">{proj.project_type}</span>}
              </div>
              {proj.tech_stack && <div className="td-proj-tech">{proj.tech_stack}</div>}
              {proj.bullets?.length ? (
                <ul className="td-bullets">
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
        <div className="td-section" key="skills">
          <div className="td-section-title">Skills &amp; Competencies</div>
          {profile.skills.map((s, i) => (
            <div className="td-skills-row" key={i}>
              {s.category && <span className="td-skills-label">{s.category}: </span>}
              <span>{(s.items ?? []).join(', ')}</span>
            </div>
          ))}
        </div>
      );

    case 'certifications':
      if (!profile.certifications?.length) return null;
      return (
        <div className="td-section" key="certifications">
          <div className="td-section-title">Certifications</div>
          {profile.certifications.map((c, i) => {
            const metaParts = [
              [c.issuer, c.issue_date].filter(Boolean).join(' · '),
              c.expiry_date ? `Exp. ${c.expiry_date}` : '',
              c.credential_id ? `ID: ${c.credential_id}` : '',
            ].filter(Boolean).join(' — ');
            return (
              <div key={i} style={{ marginBottom: '5px' }}>
                <div style={{ fontWeight: 700, fontSize: '10px', color: '#000000' }}>{c.name}</div>
                {metaParts && (
                  <div style={{ fontSize: '9px', color: '#555555', fontStyle: 'italic', marginTop: '1px' }}>
                    {metaParts}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      );

    case 'languages':
      if (!profile.languages?.length) return null;
      return (
        <div className="td-section" key="languages">
          <div className="td-section-title">Languages</div>
          <div className="td-lang-row">
            {profile.languages.map((l, i) => (
              <span key={i}>
                <span style={{ fontWeight: 700 }}>{l.language}</span>
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
        <div className="td-section" key="awards">
          <div className="td-section-title">Honours &amp; Awards</div>
          {profile.awards.map((a, i) => (
            <div className="td-award-entry" key={i}>
              <div className="td-award-row1">
                <span className="td-award-title">{a.title || ''}</span>
                <span className="td-award-meta">{[a.issuer, a.year].filter(Boolean).join(', ')}</span>
              </div>
              {a.description && <div className="td-award-desc">{a.description}</div>}
            </div>
          ))}
        </div>
      );

    case 'publications':
      if (!profile.publications?.length) return null;
      return (
        <div className="td-section" key="publications">
          <div className="td-section-title">Publications</div>
          {profile.publications.map((p, i) => (
            <div className="td-pub-entry" key={i}>
              <em>{p.title || ''}</em>
              {p.journal_or_conference ? ` — ${p.journal_or_conference}` : ''}
              {p.year ? `, ${p.year}` : ''}
              {p.url ? <> · <a href={normalizeHref(p.url)} style={{ color: '#444', textDecoration: 'none' }}>{displayProfileUrl(p.url)}</a></> : null}
            </div>
          ))}
        </div>
      );

    case 'references':
      if (!profile.references?.length) return null;
      return (
        <div className="td-section" key="references">
          <div className="td-section-title">References</div>
          {profile.references.map((r, i) => (
            <div className="td-ref-entry" key={i}>
              <span className="td-ref-name">{r.name || ''}</span>
              {(r.job_title || r.company) && <span> — {[r.job_title, r.company].filter(Boolean).join(', ')}</span>}
              {r.email && <span> · {r.email}</span>}
            </div>
          ))}
        </div>
      );

    case 'declaration':
      if (!profile.declaration?.trim()) return null;
      return (
        <div className="td-section" key="declaration">
          <div className="td-section-title">Declaration</div>
          <div className="td-summary">{profile.declaration}</div>
        </div>
      );

    case 'custom_sections':
      if (!profile.custom_sections?.length) return null;
      return (
        <div className="td-section" key="custom_sections">
          {profile.custom_sections.map((section, i) => (
            <div key={i} style={{ marginBottom: '8px' }}>
              <div className="td-section-title">{section.section_title || section.title || `Section ${i + 1}`}</div>
              {section.description && <div className="td-summary">{section.description}</div>}
              {(section.items ?? []).map((item, idx) => {
                if (typeof item === 'string') return <div className="td-ref-entry" key={idx}>• {item}</div>;
                if (!item) return null;
                return (
                  <div className="td-ref-entry" key={idx}>
                    {item.title ? <span className="td-ref-name">{item.title}</span> : null}
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
          <div className="td-section" key={key}>
            <div className="td-section-title">{sectionTitleFromKey(key)}</div>
            <div className="td-summary">{val}</div>
          </div>
        );
      }
      if (Array.isArray(rec[key])) {
        const list = rec[key] as Array<unknown>;
        if (!list.length) return null;
        return (
          <div className="td-section" key={key}>
            <div className="td-section-title">{sectionTitleFromKey(key)}</div>
            {list.map((entry, i) => {
              if (typeof entry === 'string') return <div className="td-ref-entry" key={i}>• {entry}</div>;
              if (!entry || typeof entry !== 'object') return null;
              const obj = entry as Record<string, unknown>;
              const title = (obj.title ?? obj.name ?? obj.role ?? '') as string;
              const description = (obj.description ?? obj.details ?? '') as string;
              return (
                <div className="td-ref-entry" key={i}>
                  {title ? <span className="td-ref-name">{title}</span> : null}
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

export function TraditionalTemplate({ profile }: TemplateProps) {
  const { personal } = profile;
  const visibleSections = getVisibleSections(profile);
  const showPersonal = visibleSections.includes('personal');

  const rightContactItems: React.ReactNode[] = [];
  if (personal?.email) rightContactItems.push(<a key="email" href={`mailto:${personal.email}`}>{personal.email}</a>);
  if (personal?.linkedin_url) rightContactItems.push(<a key="li" href={normalizeHref(personal.linkedin_url)}>{displayProfileUrl(personal.linkedin_url)}</a>);
  if (personal?.github_url) rightContactItems.push(<a key="gh" href={normalizeHref(personal.github_url)}>{displayProfileUrl(personal.github_url)}</a>);
  if (personal?.website_url) rightContactItems.push(<a key="web" href={normalizeHref(personal.website_url)}>{displayProfileUrl(personal.website_url)}</a>);
  if (personal?.portfolio_url) rightContactItems.push(<a key="portfolio" href={normalizeHref(personal.portfolio_url)}>{displayProfileUrl(personal.portfolio_url)}</a>);
  if (personal?.custom_links) {
    personal.custom_links.forEach((cl, i) => {
      if (cl.url) rightContactItems.push(<a key={`cl${i}`} href={normalizeHref(cl.url)}>{displayUrl(cl.url, cl.label)}</a>);
    });
  }

  const rightContactWithSeps: React.ReactNode[] = [];
  rightContactItems.forEach((item, i) => {
    rightContactWithSeps.push(item);
    if (i < rightContactItems.length - 1) {
      rightContactWithSeps.push(<span key={`sep${i}`} className="td-contact-sep">·</span>);
    }
  });

  return (
    <>
      <style>{STYLES}</style>
      <div className="td-wrap">
        {showPersonal && (
          <>
            <div className="td-name">
              {personal?.full_name || `${personal?.first_name ?? ''} ${personal?.last_name ?? ''}`.trim() || 'Your Name'}
            </div>
            {personal?.headline && <div className="td-headline">{personal.headline}</div>}
            {personal?.location && <div className="td-address">{personal.location}</div>}
            {(personal?.phone || rightContactWithSeps.length > 0) && (
              <div className="td-contact">
                <span className="td-contact-left">{personal?.phone || ''}</span>
                <span className="td-contact-right">{rightContactWithSeps}</span>
              </div>
            )}
          </>
        )}
        {visibleSections.map((key) => renderSection(key, profile))}
      </div>
    </>
  );
}
