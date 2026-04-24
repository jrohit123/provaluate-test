import { useEffect, useMemo, useRef, useState } from 'react';
import { FileDown, MessageSquare, Sparkles, SlidersHorizontal } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { ResumePdfDocument } from '@/components/ai-interview/resumePdfTemplates';
import {
  TEMPLATE_COMPONENTS,
  TEMPLATE_REGISTRY as BUILDER_TEMPLATE_REGISTRY,
  PROFESSION_DEFAULT_TEMPLATE,
  isValidTemplateId,
  PRAGUE_COLORS,
  PROFESSIONAL_MAIN_COLORS,
  HEADER_ATS_COLORS,
  MODERN_MAIN_COLORS,
  PrecisionATS,
  HeaderATS,
  ModernTemplate,
  ProfessionalTemplate,
} from '@/components/resume-templates';
import type { TemplateId as BuilderTemplateId, ProfileData as BuilderProfileData } from '@/components/resume-templates';

type ProfessionId =
  | 'software'
  | 'product'
  | 'design'
  | 'finance'
  | 'consulting'
  | 'marketing'
  | 'law'
  | 'academia'
  | 'healthcare'
  | 'operations'
  | 'data'
  | 'other';

type TemplateId = BuilderTemplateId;

type ProfileData = {
  profession?: ProfessionId;
  personal?: {
    full_name?: string;
    email?: string;
    phone?: string;
    location?: string;
    linkedin_url?: string;
    website_url?: string;
    github_url?: string;
    headline?: string;
    photo_url?: string;
  };
  summary?: string;
  experience?: Array<{
    job_title?: string;
    employer?: string;
    start_date?: string;
    end_date?: string;
    location?: string;
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
  }>;
  projects?: Array<{
    name?: string;
    tech_stack?: string;
    bullets?: string[];
    url?: string;
    repo_url?: string;
  }>;
  skills?: Array<{ category?: string; items?: string[] }>;
  certifications?: Array<{ name?: string; issuer?: string; issue_date?: string; expiry_date?: string; url?: string }>;
  languages?: Array<{ language?: string; proficiency?: string }>;
  awards?: Array<{ title?: string; issuer?: string; year?: string; description?: string }>;
  publications?: Array<{ title?: string; year?: string; journal_or_conference?: string }>;
  references?: Array<{ name?: string; job_title?: string; company?: string }>;
  resume_config?: {
    selected_template?: TemplateId;
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

type ChatMessage = { role: 'user' | 'assistant'; content: string };

type Suggestion = {
  id: number;
  section: 'experience' | 'projects';
  entryIndex: number;
  bulletIndex: number;
  original: string;
  improved: string;
  reason: string;
  status: 'pending' | 'accepted' | 'rejected';
};

const SECTION_LABELS: Record<string, string> = {
  personal: 'Personal Information',
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  projects: 'Projects',
  skills: 'Skills',
  certifications: 'Certifications',
  languages: 'Languages',
  awards: 'Awards',
  publications: 'Publications',
  references: 'References',
  organisations: 'Organisations',
  courses: 'Courses & Training',
  interests: 'Interests',
  declaration: 'Declaration',
  custom_sections: 'Custom Sections',
};

const TEMPLATE_REGISTRY = BUILDER_TEMPLATE_REGISTRY;

function resolveTemplateId(value: unknown, fallback: TemplateId = 'jake-classic'): TemplateId {
  if (isValidTemplateId(value)) {
    return value;
  }
  return fallback;
}

function defaultSectionOrder(profile: ProfileData): string[] {
  const preferredOrder = [
    'personal',
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
  const profileRecord = profile as Record<string, unknown>;
  const existingKeys = Object.keys(profileRecord).filter((key) => !['personal', 'profession', 'resume_config'].includes(key) && hasContent(profileRecord[key]));
  const finalOrder = [...preferredOrder];
  existingKeys.forEach((key) => {
    if (!finalOrder.includes(key)) finalOrder.push(key);
  });
  return finalOrder.filter((key) => hasContent(profileRecord[key]));
}

function getFilledSectionKeys(profile: ProfileData): string[] {
  const hasContent = (value: unknown): boolean => {
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (value && typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
    return false;
  };
  const record = profile as Record<string, unknown>;
  return Object.keys(record).filter((key) => !['profession', 'resume_config'].includes(key) && hasContent(record[key]));
}

function mergeSectionOrder(profile: ProfileData, existingOrder?: string[]): string[] {
  const fallback = defaultSectionOrder(profile);
  if (!existingOrder?.length) return fallback;
  const merged = [...existingOrder];
  const mergedSet = new Set(merged);
  fallback.forEach((key) => {
    if (!mergedSet.has(key)) merged.push(key);
  });
  return merged;
}

function normalizeProfileData(incoming: ProfileData): ProfileData {
  const personalValue = (incoming as { personal?: unknown }).personal;
  const normalizedPersonal = typeof personalValue === 'string'
    ? { headline: personalValue }
    : ((personalValue as ProfileData['personal'] | undefined) ?? {});

  const resolvedSummary = incoming.summary?.trim() || (typeof personalValue === 'string' ? personalValue : '');

  const normalized: ProfileData = {
    ...incoming,
    summary: resolvedSummary,
    personal: normalizedPersonal,
  };

  const incomingResumeConfig = normalized.resume_config ?? {};
  return {
    ...normalized,
    resume_config: {
      ...incomingResumeConfig,
      section_order: mergeSectionOrder(normalized, incomingResumeConfig.section_order),
    },
  };
}

function extractKeywords(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .replace(/ci\s*\/\s*cd/g, 'ci/cd')
    .replace(/node\.js/g, 'nodejs')
    .replace(/react\.js/g, 'reactjs')
    .replace(/machine learning/g, 'machine-learning')
    .replace(/distributed systems/g, 'distributed-systems')
    .replace(/rest apis?/g, 'rest-api')
    .replace(/[^a-z0-9+\-/. ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const words = normalized
    .split(/\s+/)
    .filter((token) => token.length > 1);
  const stop = new Set(['the', 'and', 'with', 'for', 'you', 'your', 'this', 'that', 'are', 'was', 'from', 'will', 'have', 'has', 'our']);
  const freq = new Map<string, number>();
  words.forEach((word) => {
    if (!stop.has(word)) freq.set(word, (freq.get(word) ?? 0) + 1);
  });
  for (let i = 0; i < words.length - 1; i += 1) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (!stop.has(words[i]) && !stop.has(words[i + 1])) freq.set(bigram, (freq.get(bigram) ?? 0) + 1);
  }
  for (let i = 0; i < words.length - 2; i += 1) {
    const trigram = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    if (!stop.has(words[i])) freq.set(trigram, (freq.get(trigram) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k]) => k);
}

export function ResumeBuilderPage({ candidateId }: { candidateId: string | undefined }) {
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [selectedTemplateId, setSelectedTemplateId] = useState<TemplateId>('jake-classic');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'template' | 'sections' | 'ats' | 'ai'>('template');
  const [zoom, setZoom] = useState(120);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [showTemplateSidebar, setShowTemplateSidebar] = useState(true);
  const [atsScore, setAtsScore] = useState(0);
  const [matchedKeywords, setMatchedKeywords] = useState<string[]>([]);
  const [missingKeywords, setMissingKeywords] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [sectionView, setSectionView] = useState<'edit' | 'arrange'>('edit');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'assistant', content: 'Resume assistant is ready. Use quick actions to improve and tailor this resume.' },
  ]);
  const loadedRef = useRef(false);
  const persistTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!candidateId) {
      setLoading(false);
      return;
    }
    (async () => {
      const [{ data: profileRow }, { data: candidateRow }] = await Promise.all([
        supabase
          .from('candidate_profile_details')
          .select('profile_data')
          .eq('candidate_id', candidateId)
          .maybeSingle(),
        supabase
          .from('candidates')
          .select('avatar_url')
          .eq('candidate_id', candidateId)
          .maybeSingle(),
      ]);

      const incoming = normalizeProfileData(((profileRow?.profile_data as ProfileData | null) ?? {}) as ProfileData);
      const mergedPersonal = {
        ...(incoming.personal ?? {}),
        photo_url: candidateRow?.avatar_url ?? incoming.personal?.photo_url,
      };
      const sectionOrder = mergeSectionOrder(incoming, incoming.resume_config?.section_order);
      setProfileData({
        ...incoming,
        personal: mergedPersonal,
        profession: incoming.profession ?? 'other',
        resume_config: {
          selected_template: resolveTemplateId(
            incoming.resume_config?.selected_template,
            PROFESSION_DEFAULT_TEMPLATE[incoming.profession ?? 'other'] ?? 'jake-classic',
          ),
          precision_accent_color: incoming.resume_config?.precision_accent_color ?? PRAGUE_COLORS[0],
          professional_main_color: incoming.resume_config?.professional_main_color ?? PROFESSIONAL_MAIN_COLORS[4],
          header_main_color: incoming.resume_config?.header_main_color ?? HEADER_ATS_COLORS[0],
          modern_main_color: incoming.resume_config?.modern_main_color ?? MODERN_MAIN_COLORS[0],
          section_order: sectionOrder,
          hidden_sections: incoming.resume_config?.hidden_sections ?? [],
          target_job_title: incoming.resume_config?.target_job_title ?? '',
          target_company: incoming.resume_config?.target_company ?? '',
          jd_text: incoming.resume_config?.jd_text ?? '',
        },
      });
      setSelectedTemplateId(resolveTemplateId(
        incoming.resume_config?.selected_template,
        PROFESSION_DEFAULT_TEMPLATE[incoming.profession ?? 'other'] ?? 'jake-classic',
      ));
      loadedRef.current = true;
      setLoading(false);
    })();
  }, [candidateId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const media = window.matchMedia('(max-width: 1023px)');
    const fitMobileZoom = () => {
      const availableWidth = Math.max(320, window.innerWidth - 32);
      const fitted = Math.floor((availableWidth / 794) * 100);
      return Math.max(35, Math.min(100, fitted));
    };
    const updateLayout = () => {
      const mobile = media.matches;
      setIsMobileLayout(mobile);
      if (!mobile) setShowTemplateSidebar(true);
      setZoom((current) => {
        if (mobile) return fitMobileZoom();
        if (!mobile && current < 80) return 120;
        return current;
      });
    };
    updateLayout();
    media.addEventListener('change', updateLayout);
    window.addEventListener('resize', updateLayout);
    return () => {
      media.removeEventListener('change', updateLayout);
      window.removeEventListener('resize', updateLayout);
    };
  }, []);

  const persist = async (next: ProfileData) => {
    if (!candidateId) return;
    setSaving(true);
    await supabase
      .from('candidate_profile_details')
      .upsert({ candidate_id: candidateId, profile_data: next, updated_at: new Date().toISOString() }, { onConflict: 'candidate_id' });
    setSaving(false);
  };

  const selectedTemplate = selectedTemplateId;
  const visibleSections = useMemo(() => {
    const hidden = new Set(profileData.resume_config?.hidden_sections ?? []);
    const order = profileData.resume_config?.section_order ?? defaultSectionOrder(profileData);
    return order.filter((key) => !hidden.has(key));
  }, [profileData]);

  const templateCards = useMemo(() => {
    const profession = profileData.profession ?? 'other';
    return [...TEMPLATE_REGISTRY]
      .filter((template) => template.id !== 'two-column-modern' && template.id !== 'jake-classic')
      .sort((a, b) => {
      const aMatch = PROFESSION_DEFAULT_TEMPLATE[profession] === a.id ? 1 : 0;
      const bMatch = PROFESSION_DEFAULT_TEMPLATE[profession] === b.id ? 1 : 0;
      return bMatch - aMatch;
    });
  }, [profileData.profession]);

  const resumeText = useMemo(() => JSON.stringify(profileData).toLowerCase(), [profileData]);

  const setResumeConfig = (patch: Partial<NonNullable<ProfileData['resume_config']>>) => {
    const fallbackTemplate = PROFESSION_DEFAULT_TEMPLATE[profileData.profession ?? 'other'] ?? 'jake-classic';
    const resolvedTemplate = resolveTemplateId(
      patch.selected_template ?? profileData.resume_config?.selected_template,
      fallbackTemplate,
    );
    if (patch.selected_template) setSelectedTemplateId(resolvedTemplate);
    const next: ProfileData = {
      ...profileData,
      resume_config: {
        section_order: profileData.resume_config?.section_order ?? defaultSectionOrder(profileData),
        hidden_sections: profileData.resume_config?.hidden_sections ?? [],
        target_job_title: profileData.resume_config?.target_job_title ?? '',
        target_company: profileData.resume_config?.target_company ?? '',
        jd_text: profileData.resume_config?.jd_text ?? '',
        precision_accent_color: profileData.resume_config?.precision_accent_color ?? PRAGUE_COLORS[0],
        professional_main_color: profileData.resume_config?.professional_main_color ?? PROFESSIONAL_MAIN_COLORS[4],
        header_main_color: profileData.resume_config?.header_main_color ?? HEADER_ATS_COLORS[0],
        modern_main_color: profileData.resume_config?.modern_main_color ?? MODERN_MAIN_COLORS[0],
        ...patch,
        selected_template: resolvedTemplate,
      },
    };
    setProfileData(next);
  };

  useEffect(() => {
    if (!loadedRef.current) return;
    if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    persistTimeoutRef.current = setTimeout(() => {
      void persist(profileData);
    }, 800);
    return () => {
      if (persistTimeoutRef.current) clearTimeout(persistTimeoutRef.current);
    };
  }, [profileData]); // debounced autosave

  useEffect(() => {
    if (!loadedRef.current) return;
    setProfileData((prev) => {
      const currentOrder = prev.resume_config?.section_order ?? [];
      const filled = getFilledSectionKeys(prev);
      const filledSet = new Set(filled);
      const preserved = currentOrder.filter((key) => key === 'personal' || filledSet.has(key));
      const nextOrder = [...preserved];
      filled.forEach((key) => {
        if (!nextOrder.includes(key)) nextOrder.push(key);
      });
      if (
        nextOrder.length === currentOrder.length &&
        nextOrder.every((key, idx) => key === currentOrder[idx])
      ) {
        return prev;
      }
      return {
        ...prev,
        resume_config: {
          section_order: nextOrder,
          hidden_sections: prev.resume_config?.hidden_sections ?? [],
          target_job_title: prev.resume_config?.target_job_title ?? '',
          target_company: prev.resume_config?.target_company ?? '',
          jd_text: prev.resume_config?.jd_text ?? '',
          precision_accent_color: prev.resume_config?.precision_accent_color ?? PRAGUE_COLORS[0],
          professional_main_color: prev.resume_config?.professional_main_color ?? PROFESSIONAL_MAIN_COLORS[4],
          header_main_color: prev.resume_config?.header_main_color ?? HEADER_ATS_COLORS[0],
          modern_main_color: prev.resume_config?.modern_main_color ?? MODERN_MAIN_COLORS[0],
          selected_template: prev.resume_config?.selected_template,
        },
      };
    });
  }, [profileData.personal, profileData.summary, profileData.experience, profileData.education, profileData.projects, profileData.skills, profileData.certifications, profileData.languages, profileData.awards, profileData.publications, profileData.references, (profileData as Record<string, unknown>).organisations, (profileData as Record<string, unknown>).courses, (profileData as Record<string, unknown>).interests, (profileData as Record<string, unknown>).declaration, (profileData as Record<string, unknown>).custom_sections]);

  const toggleSection = (sectionKey: string) => {
    const hidden = new Set(profileData.resume_config?.hidden_sections ?? []);
    if (hidden.has(sectionKey)) hidden.delete(sectionKey);
    else hidden.add(sectionKey);
    setResumeConfig({ hidden_sections: [...hidden] });
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const order = [...(profileData.resume_config?.section_order ?? [])];
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= order.length) return;
    [order[index], order[nextIndex]] = [order[nextIndex], order[index]];
    setResumeConfig({ section_order: order });
  };

  const handleSectionDragStart = (event: React.DragEvent<HTMLDivElement>, index: number) => {
    event.dataTransfer.setData('text/plain', String(index));
    event.dataTransfer.effectAllowed = 'move';
  };

  const handleSectionDrop = (event: React.DragEvent<HTMLDivElement>, dropIndex: number) => {
    event.preventDefault();
    const sourceIndex = Number(event.dataTransfer.getData('text/plain'));
    if (Number.isNaN(sourceIndex) || sourceIndex === dropIndex) return;
    const order = [...(profileData.resume_config?.section_order ?? [])];
    if (!order[sourceIndex] || !order[dropIndex]) return;
    const [moved] = order.splice(sourceIndex, 1);
    order.splice(dropIndex, 0, moved);
    setResumeConfig({ section_order: order });
  };

  const formatSectionLabel = (sectionKey: string) =>
    SECTION_LABELS[sectionKey] ?? sectionKey.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());

  const analyzeJD = () => {
    const jdText = profileData.resume_config?.jd_text ?? '';
    const jdKeywords = extractKeywords(jdText);
    const matched = jdKeywords.filter((keyword) => resumeText.includes(keyword));
    const missing = jdKeywords.filter((keyword) => !resumeText.includes(keyword));
    const baseScore = jdKeywords.length ? Math.round((matched.length / jdKeywords.length) * 100) : 0;
    const weakBullets = (profileData.experience ?? []).flatMap((entry) => entry.bullets ?? []).filter((bullet) => bullet.trim().split(/\s+/).length > 0 && bullet.trim().split(/\s+/).length < 8).length;
    const score = Math.max(0, Math.min(100, baseScore - weakBullets * 2));
    setMatchedKeywords(matched.slice(0, 10).map((k) => k.toUpperCase()));
    setMissingKeywords(missing.slice(0, 10).map((k) => k.toUpperCase()));
    setAtsScore(score);
    const nextSuggestions: Suggestion[] = [];
    (profileData.experience ?? []).forEach((entry, entryIndex) => {
      (entry.bullets ?? []).forEach((bullet, bulletIndex) => {
        if (nextSuggestions.length >= 3) return;
        if (bullet.trim().split(/\s+/).length < 10) {
          nextSuggestions.push({
            id: nextSuggestions.length + 1,
            section: 'experience',
            entryIndex,
            bulletIndex,
            original: bullet,
            improved: `${bullet.replace(/\.$/, '')}, delivering measurable business impact at scale.`,
            reason: 'Adds stronger impact framing and ATS-friendly wording.',
            status: 'pending',
          });
        }
      });
    });
    setSuggestions(nextSuggestions);
  };

  const applySuggestion = async (id: number) => {
    const suggestion = suggestions.find((item) => item.id === id && item.status === 'pending');
    if (!suggestion) return;
    const next: ProfileData = { ...profileData };
    if (suggestion.section === 'experience') {
      const exp = [...(next.experience ?? [])];
      if (!exp[suggestion.entryIndex]) return;
      const bullets = [...(exp[suggestion.entryIndex].bullets ?? [])];
      if (!bullets[suggestion.bulletIndex]) return;
      bullets[suggestion.bulletIndex] = suggestion.improved;
      exp[suggestion.entryIndex] = { ...exp[suggestion.entryIndex], bullets };
      next.experience = exp;
    }
    setProfileData(next);
    setSuggestions((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'accepted' } : item)));
    setAtsScore((prev) => Math.min(100, prev + 3));
  };

  const updatePersonalField = (key: keyof NonNullable<ProfileData['personal']>, value: string) => {
    setProfileData((prev) => ({ ...prev, personal: { ...(prev.personal ?? {}), [key]: value } }));
  };

  const updateSummary = (value: string) => {
    setProfileData((prev) => ({ ...prev, summary: value }));
  };

  const updateExperienceField = (entryIndex: number, key: keyof NonNullable<ProfileData['experience']>[number], value: string) => {
    setProfileData((prev) => {
      const list = [...(prev.experience ?? [])];
      if (!list[entryIndex]) return prev;
      list[entryIndex] = { ...list[entryIndex], [key]: value };
      return { ...prev, experience: list };
    });
  };

  const updateExperienceBullet = (entryIndex: number, bulletIndex: number, value: string) => {
    setProfileData((prev) => {
      const list = [...(prev.experience ?? [])];
      if (!list[entryIndex]) return prev;
      const bullets = [...(list[entryIndex].bullets ?? [])];
      bullets[bulletIndex] = value;
      list[entryIndex] = { ...list[entryIndex], bullets };
      return { ...prev, experience: list };
    });
  };

  const quickActionsByProfession: Record<ProfessionId, string[]> = {
    software: ['Improve all bullets', 'Fix grammar', 'Highlight tech stack', 'Tailor to JD'],
    product: ['Strengthen impact metrics', 'Fix grammar', 'Prioritize leadership bullets', 'Tailor to JD'],
    design: ['Emphasize case studies', 'Fix grammar', 'Portfolio guidance', 'Tailor to JD'],
    finance: ['Quantify achievements', 'Fix grammar', 'Highlight certifications', 'Executive tone'],
    consulting: ['Quantify client impact', 'Fix grammar', 'Executive tone', 'Tailor to JD'],
    marketing: ['Highlight campaign metrics', 'Fix grammar', 'Tailor to JD', 'Shorten bullets'],
    law: ['Refine legal phrasing', 'Fix grammar', 'Highlight publications', 'Tailor to JD'],
    academia: ['Format research impact', 'Fix grammar', 'Citation guidance', 'Tailor to JD'],
    healthcare: ['Highlight clinical outcomes', 'Fix grammar', 'Licenses emphasis', 'Tailor to JD'],
    operations: ['Process improvement framing', 'Fix grammar', 'Scale metrics', 'Tailor to JD'],
    data: ['Model impact framing', 'Fix grammar', 'Highlight research', 'Tailor to JD'],
    other: ['Improve all bullets', 'Fix grammar', 'Shorten resume', 'Tailor to JD'],
  };

  const appendChat = (userText: string) => {
    const reply = userText.toLowerCase().includes('ats')
      ? `Current ATS score is ${atsScore}/100.`
      : userText.toLowerCase().includes('grammar')
      ? 'Grammar looks good overall; I suggest tightening long bullets and removing filler words.'
      : 'Good prompt. I recommend stronger action verbs and quantified outcomes in each major bullet.';
    setChatHistory((prev) => [...prev.slice(-18), { role: 'user', content: userText }, { role: 'assistant', content: reply }]);
  };

  const sendChat = () => {
    const value = chatInput.trim();
    if (!value) return;
    setChatInput('');
    appendChat(value);
  };

  const toDataUrl = async (imageUrl: string): Promise<string | null> => {
    try {
      const response = await fetch(imageUrl, { cache: 'no-store' });
      if (!response.ok) return null;
      const blob = await response.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
        reader.onerror = () => reject(new Error('Failed to read image blob'));
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  };

  const downloadPdf = async () => {
    const fallback = PROFESSION_DEFAULT_TEMPLATE[profileData.profession ?? 'other'] ?? 'jake-classic';
    const templateId = resolveTemplateId(selectedTemplate, fallback) as BuilderTemplateId;
    const personal = profileData.personal ?? {};
    const photoUrl = personal.photo_url?.trim();
    const embeddedPhoto =
      photoUrl && !photoUrl.startsWith('data:image/')
        ? await toDataUrl(photoUrl)
        : photoUrl ?? null;
    const pdfProfileData: BuilderProfileData = embeddedPhoto
      ? ({
          ...profileData,
          personal: {
            ...personal,
            photo_url: embeddedPhoto,
          },
        } as BuilderProfileData)
      : (profileData as BuilderProfileData);

    const blob = await pdf(
      <ResumePdfDocument key={templateId} templateId={templateId} profileData={pdfProfileData} />,
    ).toBlob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${(profileData.personal?.full_name || 'Candidate').replace(/\s+/g, '_')}_${templateId}_Resume.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="p-4 text-sm text-slate-600">Loading resume builder...</div>;

  const zoomScale = zoom / 100;
  const hidden = new Set(profileData.resume_config?.hidden_sections ?? []);
  const profession = profileData.profession ?? 'other';
  const ActiveTemplate = TEMPLATE_COMPONENTS[selectedTemplate] ?? TEMPLATE_COMPONENTS['jake-classic'];

  return (
    <div className="relative w-full overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 lg:h-[calc(100vh-120px)] lg:min-h-[720px] lg:overflow-hidden">
      <div className="flex min-h-full flex-col lg:h-full lg:flex-row">
        <section className={`${isMobileLayout && !showTemplateSidebar ? 'hidden' : 'block'} w-full border-b border-slate-200 bg-white lg:h-full lg:w-[420px] lg:border-b-0 lg:border-r`}>
          <div className="flex items-center justify-between border-b border-slate-200 text-[15px]">
            <div className="flex items-center gap-1">
              <button className={`p-2 ${activeTab === 'template' ? 'border-b-2 border-sky-500 font-semibold text-sky-700' : 'text-slate-500'}`} onClick={() => setActiveTab('template')}>Template</button>
              <button className={`p-2 ${activeTab === 'sections' ? 'border-b-2 border-sky-500 font-semibold text-sky-700' : 'text-slate-500'}`} onClick={() => setActiveTab('sections')}>Sections</button>
            </div>
            {isMobileLayout && (
              <Button type="button" size="sm" variant="ghost" className="mr-1 h-8 px-2 text-xs" onClick={() => setShowTemplateSidebar(false)}>
                Close
              </Button>
            )}
            {/* <button className={`p-2 ${activeTab === 'ats' ? 'border-b-2 border-sky-500 font-semibold text-sky-700' : 'text-slate-500'}`} onClick={() => setActiveTab('ats')}>ATS</button>
            <button className={`p-2 ${activeTab === 'ai' ? 'border-b-2 border-sky-500 font-semibold text-sky-700' : 'text-slate-500'}`} onClick={() => setActiveTab('ai')}>AI</button> */}
          </div>

          <div className="space-y-3 p-3 lg:h-[calc(100%-41px)] lg:overflow-y-auto">
            {activeTab === 'template' && (
              <>
                {templateCards.map((template) => (
                  <button
                    key={template.id}
                    className={`w-full rounded border p-3 text-left ${selectedTemplate === template.id ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white'}`}
                    onClick={() => {
                      setSelectedTemplateId(template.id);
                      setResumeConfig({ selected_template: template.id });
                    }}
                  >
                    <div className="text-[15px] font-semibold text-slate-800">{template.displayName}</div>
                    <div className="mt-1 text-[13px] text-slate-600">{template.description}</div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      <span className={`rounded px-2 py-0.5 text-xs ${PROFESSION_DEFAULT_TEMPLATE[profession] === template.id ? 'bg-sky-200 text-sky-800' : 'bg-slate-100 text-slate-600'}`}>
                        {template.tag}
                      </span>
                      <span className="rounded px-2 py-0.5 text-xs bg-slate-100 text-slate-600">
                        {template.bestFor}
                      </span>
                    </div>
                    {template.id === 'precision-ats' && selectedTemplate === 'precision-ats' && (
                      <div className="mt-3 rounded border border-slate-200 bg-white p-2">
                        <div className="text-sm font-medium text-slate-700">Color</div>
                        <div className="mt-2 flex gap-2">
                          {PRAGUE_COLORS.map((color) => {
                            const isActive = (profileData.resume_config?.precision_accent_color ?? PRAGUE_COLORS[0]) === color;
                            return (
                              <button
                                key={color}
                                type="button"
                                className={`h-7 w-7 rounded-full border ${isActive ? 'ring-2 ring-sky-400 ring-offset-1' : 'border-slate-300'}`}
                                style={{ backgroundColor: color }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setResumeConfig({ precision_accent_color: color });
                                }}
                                aria-label={`Set accent color ${color}`}
                                title={color}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {template.id === 'professional' && selectedTemplate === 'professional' && (
                      <div className="mt-3 rounded border border-slate-200 bg-white p-2">
                        <div className="text-sm font-medium text-slate-700">Main color</div>
                        <div className="mt-2 flex gap-2">
                          {PROFESSIONAL_MAIN_COLORS.map((color) => {
                            const isActive = (profileData.resume_config?.professional_main_color ?? PROFESSIONAL_MAIN_COLORS[4]) === color;
                            return (
                              <button
                                key={color}
                                type="button"
                                className={`h-7 w-7 rounded-full border ${isActive ? 'ring-2 ring-sky-400 ring-offset-1' : 'border-slate-300'}`}
                                style={{ backgroundColor: color }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setResumeConfig({ professional_main_color: color });
                                }}
                                aria-label={`Set main color ${color}`}
                                title={color}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {template.id === 'header-ats' && selectedTemplate === 'header-ats' && (
                      <div className="mt-3 rounded border border-slate-200 bg-white p-2">
                        <div className="text-sm font-medium text-slate-700">Main color</div>
                        <div className="mt-2 flex gap-2">
                          {HEADER_ATS_COLORS.map((color) => {
                            const isActive = (profileData.resume_config?.header_main_color ?? HEADER_ATS_COLORS[0]) === color;
                            return (
                              <button
                                key={color}
                                type="button"
                                className={`h-7 w-7 rounded-full border ${isActive ? 'ring-2 ring-sky-400 ring-offset-1' : 'border-slate-300'}`}
                                style={{ backgroundColor: color }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setResumeConfig({ header_main_color: color });
                                }}
                                aria-label={`Set header color ${color}`}
                                title={color}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                    {template.id === 'modern' && selectedTemplate === 'modern' && (
                      <div className="mt-3 rounded border border-slate-200 bg-white p-2">
                        <div className="text-sm font-medium text-slate-700">Main color</div>
                        <div className="mt-2 flex gap-2">
                          {MODERN_MAIN_COLORS.map((color) => {
                            const isActive = (profileData.resume_config?.modern_main_color ?? MODERN_MAIN_COLORS[0]) === color;
                            return (
                              <button
                                key={color}
                                type="button"
                                className={`h-7 w-7 rounded-full border ${isActive ? 'ring-2 ring-sky-400 ring-offset-1' : 'border-slate-300'}`}
                                style={{ backgroundColor: color }}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setResumeConfig({ modern_main_color: color });
                                }}
                                aria-label={`Set modern color ${color}`}
                                title={color}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </>
            )}

            {activeTab === 'sections' && (
              <div className="rounded border border-slate-200 bg-white p-2 text-[15px]">
                <div className="mb-2 font-semibold text-slate-700">Visible Sections</div>
                <div className="mb-2 text-[12px] text-slate-500">Drag and drop to reorder sections.</div>
                <div className="space-y-1.5">
                  {(profileData.resume_config?.section_order ?? []).map((sectionKey, index) => (
                    <div
                      key={`visible-${sectionKey}`}
                      className="flex cursor-move items-center justify-between gap-2 rounded border border-transparent px-1 py-1 hover:border-slate-200 hover:bg-slate-50"
                      draggable
                      onDragStart={(event) => handleSectionDragStart(event, index)}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => handleSectionDrop(event, index)}
                    >
                      <span className="text-slate-700">⋮⋮ {formatSectionLabel(sectionKey)}</span>
                      <input
                        type="checkbox"
                        checked={!hidden.has(sectionKey)}
                        onChange={() => toggleSection(sectionKey)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* {activeTab === 'ats' && (
              <>
                <Textarea
                  className="min-h-24"
                  placeholder="Paste job description to run ATS analysis..."
                  value={profileData.resume_config?.jd_text ?? ''}
                  onChange={(e) => setResumeConfig({ jd_text: e.target.value })}
                />
                <Button className="w-full" onClick={analyzeJD}>
                  <Sparkles className="mr-1 h-3.5 w-3.5" />
                  Analyze JD
                </Button>
                <div className="rounded border border-slate-200 bg-white p-3 text-xs">
                  <div className="font-semibold text-slate-800">ATS Score: {atsScore}/100</div>
                  <div className="mt-2 text-[11px] text-emerald-700">Matched: {matchedKeywords.join(', ') || '-'}</div>
                  <div className="mt-1 text-[11px] text-red-700">Missing: {missingKeywords.join(', ') || '-'}</div>
                </div>
                {suggestions.filter((s) => s.status !== 'rejected').map((s) => (
                  <div key={s.id} className="rounded border border-slate-200 bg-white p-3 text-xs">
                    <div className="line-through text-slate-500">{s.original}</div>
                    <div className="mt-1 rounded bg-emerald-50 p-2 text-emerald-800">{s.improved}</div>
                    <div className="mt-1 italic text-slate-500">{s.reason}</div>
                    <div className="mt-2 flex gap-2">
                      {s.status === 'accepted' ? (
                        <span className="text-emerald-700">Applied</span>
                      ) : (
                        <>
                          <Button size="sm" className="h-7 text-[11px]" onClick={() => void applySuggestion(s.id)}>Accept</Button>
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setSuggestions((prev) => prev.map((it) => (it.id === s.id ? { ...it, status: 'rejected' } : it)))}>Reject</Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </>
            )} */}

            {/* {activeTab === 'ai' && (
              <div className="flex h-full flex-col rounded border border-slate-200 bg-white p-2">
                <div className="mb-2 flex flex-wrap gap-1">
                  {(quickActionsByProfession[profession] ?? quickActionsByProfession.other).map((action) => (
                    <button key={action} className="rounded-full border border-slate-300 px-2 py-1 text-[11px]" onClick={() => appendChat(action)}>
                      {action}
                    </button>
                  ))}
                </div>
                <div className="flex-1 space-y-2 overflow-y-auto p-1">
                  {chatHistory.map((m, i) => (
                    <div key={`chat-${i}`} className={`rounded p-2 text-xs ${m.role === 'assistant' ? 'bg-slate-100' : 'bg-sky-50'}`}>
                      {m.content}
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Ask AI assistant..." onKeyDown={(e) => e.key === 'Enter' && sendChat()} />
                  <Button size="sm" onClick={sendChat}><MessageSquare className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
            )} */}
          </div>
        </section>

        <section className="flex min-h-[70vh] min-w-0 flex-1 flex-col bg-slate-200 lg:min-h-0">
          <div className="flex flex-col gap-2 border-b border-slate-300 bg-white px-3 py-2 text-[14px] sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:text-[15px]">
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              {isMobileLayout && !showTemplateSidebar && (
                <Button type="button" size="sm" variant="outline" className="h-9 w-full sm:w-auto" onClick={() => setShowTemplateSidebar(true)}>
                  <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
                  Templates
                </Button>
              )}
              <div className="truncate font-semibold text-slate-700">Live Preview — {TEMPLATE_REGISTRY.find((t) => t.id === selectedTemplate)?.displayName ?? 'Template'}</div>
              <Button size="sm" className="h-9 w-full bg-sky-600 text-sm text-white hover:bg-sky-700 sm:w-auto" onClick={downloadPdf}>
                <FileDown className="mr-1 h-3.5 w-3.5" />
                Download PDF
              </Button>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(30, z - 10))}>-</Button>
              <span className="w-10 text-center">{zoom}%</span>
              <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.min(160, z + 10))}>+</Button>
            </div>
          </div>
          <div className="flex flex-1 overflow-auto p-1 sm:p-2">
            <div className="flex min-w-full justify-center">
              <div
                style={{
                  width: `${794 * zoomScale}px`,
                  height: `${1123 * zoomScale}px`,
                  flexShrink: 0,
                  position: 'relative',
                }}
              >
                <div
                  className="min-h-[1123px] w-[794px] bg-white shadow-lg"
                  style={{
                    transform: `scale(${zoomScale})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  }}
                >
                  {selectedTemplate === 'precision-ats' ? (
                    <PrecisionATS
                      profile={profileData as BuilderProfileData}
                      accentColor={profileData.resume_config?.precision_accent_color ?? PRAGUE_COLORS[0]}
                    />
                  ) : selectedTemplate === 'header-ats' ? (
                    <HeaderATS
                      profile={profileData as BuilderProfileData}
                      mainColor={profileData.resume_config?.header_main_color ?? HEADER_ATS_COLORS[0]}
                    />
                  ) : selectedTemplate === 'professional' ? (
                    <ProfessionalTemplate
                      profile={profileData as BuilderProfileData}
                      mainColor={profileData.resume_config?.professional_main_color ?? PROFESSIONAL_MAIN_COLORS[4]}
                    />
                  ) : selectedTemplate === 'modern' ? (
                    <ModernTemplate
                      profile={profileData as BuilderProfileData}
                      mainColor={profileData.resume_config?.modern_main_color ?? MODERN_MAIN_COLORS[0]}
                    />
                  ) : (
                    <ActiveTemplate profile={profileData as BuilderProfileData} />
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {saving && (
        <div className="absolute bottom-3 right-3 rounded bg-slate-900 px-3 py-1 text-xs text-white">
          Saving...
        </div>
      )}
    </div>
  );
}
