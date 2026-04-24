export type ProfileData = {
  profession?: string;
  personal?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin_url?: string;
    github_url?: string;
    website_url?: string;
    portfolio_url?: string;
    headline?: string;
    photo_url?: string;
    custom_links?: Array<{ label?: string; url?: string }>;
  };
  summary?: string;
  experience?: Array<{
    job_title?: string;
    employer?: string;
    employment_type?: string;
    start_date?: string;
    end_date?: string;
    location?: string;
    work_mode?: string;
    bullets?: string[];
    description?: string;
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
    bullets?: string[];
    url?: string;
    repo_url?: string;
  }>;
  skills?: Array<{ category?: string; items?: string[] }>;
  certifications?: Array<{
    name?: string;
    issuer?: string;
    issue_date?: string;
    expiry_date?: string;
    credential_id?: string;
    url?: string;
  }>;
  languages?: Array<{ language?: string; proficiency?: string }>;
  publications?: Array<{
    title?: string;
    year?: string;
    journal_or_conference?: string;
    url?: string;
  }>;
  awards?: Array<{
    title?: string;
    issuer?: string;
    year?: string;
    description?: string;
  }>;
  references?: Array<{
    name?: string;
    job_title?: string;
    company?: string;
    email?: string;
  }>;
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
    selected_template?: string;
    precision_accent_color?: string;
    professional_main_color?: string;
    header_main_color?: string;
    modern_main_color?: string;
    section_order?: string[];
    hidden_sections?: string[];
    target_job_title?: string;
    target_company?: string;
    jd_text?: string;
  };
};

export type TemplateProps = {
  profile: ProfileData;
};

// Returns the ordered, visible section keys for rendering
export function getVisibleSections(profile: ProfileData): string[] {
  const defaultOrder = [
    'summary',
    'experience',
    'education',
    'projects',
    'skills',
    'certifications',
    'languages',
    'awards',
    'publications',
    'references',
    'organisations',
    'courses',
    'interests',
    'declaration',
    'custom_sections',
  ];
  const hasContent = (value: unknown): boolean => {
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
    return false;
  };
  const dynamicKeys = Object.keys(profile as Record<string, unknown>).filter(
    (key) => !['profession', 'resume_config'].includes(key) && hasContent((profile as Record<string, unknown>)[key]),
  );
  const order = profile.resume_config?.section_order?.length
    ? profile.resume_config.section_order
    : defaultOrder;
  const mergedOrder = [...order];
  dynamicKeys.forEach((key) => {
    if (!mergedOrder.includes(key)) mergedOrder.push(key);
  });
  const hidden = new Set(profile.resume_config?.hidden_sections ?? []);
  return mergedOrder.filter((key) => !hidden.has(key) && (key === 'personal' || hasContent((profile as Record<string, unknown>)[key])));
}

// Format date range
export function dateRange(start?: string, end?: string): string {
  if (!start && !end) return '';
  if (!end) return start ?? '';
  return `${start ?? ''} – ${end}`;
}
