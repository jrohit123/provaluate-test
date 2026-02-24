import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuthContext, isCandidate } from '@/contexts/AuthContext';
import { FileText, User, Briefcase, ArrowLeft, ExternalLink, ClipboardList, Trash2, Upload, Loader2, Globe, Award, Lightbulb, BookOpen, Heart, Trophy, FolderGit2, Users, Building2, PenLine, BookMarked, Hash, X, Check, Settings, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SessionManager } from '@/utils/sessionManager';
import type { Tables } from '@/integrations/supabase/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import CandidateJdInterviewConfig from '@/components/ai-interview/CandidateJdInterviewConfig';
import CandidateJdInterviewCreate from '@/components/ai-interview/CandidateJdInterviewCreate';

const CandidateDashboard = () => {
  const { user } = useAuthContext();
  const location = useLocation();
  const navigate = useNavigate();
  const candidate = isCandidate(user) ? user.candidate : null;
  const path = location.pathname;
  const isHome = path === '/candidate-dashboard' || path === '/candidate-dashboard/';
  const isProfile = path.startsWith('/candidate-dashboard/profile');
  const isJds = path.startsWith('/candidate-dashboard/jds');
  const isJdsConfigure = path.startsWith('/candidate-dashboard/jds/configure');
  const isJdsCreate = path.startsWith('/candidate-dashboard/jds/create');
  const isInterviews = path.startsWith('/candidate-dashboard/interviews');

  const handleSignOut = useCallback(async () => {
    await supabase.auth.signOut();
    SessionManager.clearSession();
    localStorage.removeItem('recruitai_auth');
    navigate('/candidate-login');
  }, [navigate]);

  const firstName = candidate?.first_name?.trim() || '';
  const greeting = firstName ? `Welcome back, ${firstName}` : 'Welcome back';
  const truncatedGreeting = greeting.length > 30 ? `${greeting.substring(0, 27)}...` : greeting;

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-[#1e5da8] border-b px-3 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-1">
          {!isHome && (
            <Link to="/candidate-dashboard" className="text-white flex-shrink-0 p-1 -m-1 rounded hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="text-base sm:text-xl font-semibold text-white truncate">ProValuate</h1>
            <p className="text-xs sm:text-sm text-white hidden sm:block">Smart Candidate Evaluation Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <div className="text-xs sm:text-sm text-white hidden md:block truncate max-w-[200px]">
            {greeting}
          </div>
          <div className="text-xs text-white md:hidden truncate max-w-[120px]" title={greeting}>
            {truncatedGreeting}
          </div>
          <Button
            variant="outline"
            onClick={handleSignOut}
            className="text-xs sm:text-sm px-3 sm:px-4 h-10 min-h-[44px] flex-shrink-0"
          >
            <span>Logout</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {isHome && (
          <>
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Welcome back</h1>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link
                to="/candidate-dashboard/profile"
                className="flex items-center gap-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow transition"
              >
                <div className="p-3 rounded-lg bg-indigo-100">
                  <User className="h-8 w-8 text-indigo-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Profile builder</h2>
                  <p className="text-sm text-gray-600">Build and edit your profile (education, experience, skills, etc.)</p>
                </div>
              </Link>
              <Link
                to="/candidate-dashboard/jds"
                className="flex items-center gap-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow transition"
              >
                <div className="p-3 rounded-lg bg-amber-100">
                  <FileText className="h-8 w-8 text-amber-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Interview Manager</h2>
                  <p className="text-sm text-gray-600">Configure and create interviews for your JDs</p>
                </div>
              </Link>
              <Link
                to="/candidate-dashboard/interviews"
                className="flex items-center gap-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow transition"
              >
                <div className="p-3 rounded-lg bg-green-100">
                  <Briefcase className="h-8 w-8 text-green-600" />
                </div>
                <div>
                  <h2 className="font-semibold text-gray-900">Interview Dashboard</h2>
                  <p className="text-sm text-gray-600">See your interviews results and access reports</p>
                </div>
              </Link>
            </div>
          </>
        )}
        {isProfile && (
          <ProfileBuilderSection candidateId={candidate?.candidate_id} />
        )}
        {isJdsConfigure && (
          <CandidateJdInterviewConfig candidateId={candidate?.candidate_id ?? ''} />
        )}
        {isJdsCreate && (
          <CandidateJdInterviewCreate candidateId={candidate?.candidate_id ?? ''} />
        )}
        {isJds && !isJdsConfigure && !isJdsCreate && (
          <MyJdsSection candidateId={candidate?.candidate_id} />
        )}
        {isInterviews && (
          <MyInterviewsSection candidateId={candidate?.candidate_id} candidateEmail={candidate?.email ?? undefined} />
        )}
      </main>
    </div>
  );
};

// --- My Interviews (by candidate_id and by candidate_email when candidate_id null) ---
type InterviewRow = { id: string; position: string | null; status: string | null; created_at: string; candidate_name?: string | null };
function MyInterviewsSection({ candidateId, candidateEmail }: { candidateId: string | undefined; candidateEmail?: string }) {
  const [list, setList] = useState<InterviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId && !candidateEmail) {
      setLoading(false);
      return;
    }
    (async () => {
      setError(null);
      const seen = new Set<string>();
      const merged: InterviewRow[] = [];
      const selectCols = 'id, position, status, created_at, candidate_name';
      if (candidateId) {
        const { data, error: e } = await supabase
          .from('interviews')
          .select(selectCols)
          .eq('candidate_id', candidateId)
          .order('created_at', { ascending: false });
        if (e) {
          setError(e.message);
          setList([]);
          setLoading(false);
          return;
        }
        for (const row of (data ?? []) as InterviewRow[]) {
          if (!seen.has(row.id)) {
            seen.add(row.id);
            merged.push(row);
          }
        }
      }
      if (candidateEmail) {
        const { data, error: e } = await supabase
          .from('interviews')
          .select(selectCols)
          .is('candidate_id', null)
          .eq('candidate_email', candidateEmail)
          .order('created_at', { ascending: false });
        if (!e && data) {
          for (const row of (data ?? []) as InterviewRow[]) {
            if (!seen.has(row.id)) {
              seen.add(row.id);
              merged.push(row);
            }
          }
        }
      }
      merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setList(merged);
      setLoading(false);
    })();
  }, [candidateId, candidateEmail]);

  if (!candidateId && !candidateEmail) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">My interviews</h1>
        <p className="text-gray-600">Sign in to see your interviews.</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-4">My interviews</h1>
      {loading && (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      )}
      {error && <p className="text-red-600 mb-4">{error}</p>}
      {!loading && list.length === 0 && !error && (
        <p className="text-gray-600">You have no interviews linked to your account yet. Open an interview link from your email to have it appear here.</p>
      )}
      {!loading && list.length > 0 && (
        <ul className="space-y-3">
          {list.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white rounded-lg border border-gray-200">
              <div>
                <p className="font-medium text-gray-900">{i.position ?? 'Interview'}</p>
                <p className="text-sm text-gray-500">
                  {i.status ?? '—'} · {new Date(i.created_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <Button asChild size="sm" variant="outline">
                  <Link to={`/interview/${i.id}`}>
                    <ClipboardList className="mr-1 h-4 w-4" />
                    Take interview
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <a href={`/final-results/${i.id}`} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-1 h-4 w-4" />
                    View report
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// --- My JDs: two services only (Interview configuration & Interview creation) ---
function MyJdsSection({ candidateId }: { candidateId: string | undefined }) {
  if (!candidateId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">My JDs</h1>
        <p className="text-gray-600">Sign in to manage your JDs.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          to="/candidate-dashboard/jds/configure"
          className="flex items-center gap-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow transition"
        >
          <div className="p-3 rounded-lg bg-blue-100">
            <Settings className="h-8 w-8 text-blue-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Interview configuration</h2>
            <p className="text-sm text-gray-600">Set up assessment parameters and interview type for your roles</p>
          </div>
        </Link>
        <Link
          to="/candidate-dashboard/jds/create"
          className="flex items-center gap-4 p-6 bg-white rounded-lg border border-gray-200 shadow-sm hover:border-indigo-300 hover:shadow transition"
        >
          <div className="p-3 rounded-lg bg-green-100">
            <UserPlus className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">Interview creation</h2>
            <p className="text-sm text-gray-600">Create interview links and send invites from your JDs</p>
          </div>
        </Link>
      </div>
    </div>
  );
}

// --- Profile builder (candidate_profile_details.profile_data) ---
type ProfileData = Record<string, unknown>;

type EducationEntry = { degree?: string; school?: string; school_url?: string; start_date?: string; end_date?: string; location?: string; description?: string };
type ExperienceEntry = { job_title?: string; employer?: string; employer_url?: string; start_date?: string; end_date?: string; location?: string; description?: string };
type SkillEntry = { skill?: string; information?: string; level?: string };
type GenericEntry = { title?: string; description?: string };

const STRUCTURED_SECTION_IDS = ['education', 'experience', 'skills'];

function normalizeListItems(list: unknown[]): GenericEntry[] {
  return list.map((item) => {
    if (item && typeof item === 'object' && 'title' in item) return item as GenericEntry;
    if (typeof item === 'string') return { title: item, description: '' };
    if (item && typeof item === 'object') return { title: String((item as Record<string, unknown>).title ?? (item as Record<string, unknown>).name ?? 'Entry'), description: String((item as Record<string, unknown>).description ?? '') };
    return { title: 'Entry', description: '' };
  });
}

const SKILL_LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'Expert'];

const PROFILE_SECTIONS: {
  id: string;
  dataKey: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  isArray: boolean;
}[] = [
  { id: 'profile', dataKey: 'summary', title: 'Profile', description: 'Add a short summary of your key strengths, experience, and career goals.', icon: User, isArray: false },
  { id: 'education', dataKey: 'education', title: 'Education', description: 'Add your degrees and schools. Include your focus, honors, or exchange terms.', icon: BookOpen, isArray: true },
  { id: 'experience', dataKey: 'experience', title: 'Professional Experience', description: 'Add your professional roles and employer history including internships.', icon: Briefcase, isArray: true },
  { id: 'languages', dataKey: 'languages', title: 'Languages', description: 'Add your languages and proficiency level to show your communication range.', icon: Globe, isArray: true },
  { id: 'certificates', dataKey: 'certificates', title: 'Certificates', description: 'Add your industry certificates or licences. Include issuer and date earned.', icon: Award, isArray: true },
  { id: 'skills', dataKey: 'skills', title: 'Skills', description: 'Add your hard and soft skills that help you stand out from the crowd today.', icon: Lightbulb, isArray: true },
  { id: 'courses', dataKey: 'courses', title: 'Courses', description: 'Add online or in-person courses and trainings you joined and completed.', icon: BookOpen, isArray: true },
  { id: 'interests', dataKey: 'interests', title: 'Interests', description: 'Add relevant personal interests that support your career story and cultural fit.', icon: Heart, isArray: true },
  { id: 'awards', dataKey: 'awards', title: 'Awards', description: 'Add your awards and recognitions from industry, competitions, or academia.', icon: Trophy, isArray: true },
  { id: 'projects', dataKey: 'projects', title: 'Projects', description: 'Add key projects you participated in and highlight your challenges, role, and impact.', icon: FolderGit2, isArray: true },
  { id: 'references', dataKey: 'references', title: 'References', description: 'Add your references from managers or coworkers, including their contact details.', icon: Users, isArray: true },
  { id: 'organisations', dataKey: 'organisations', title: 'Organisations', description: 'Add your memberships or volunteering with organisations including your role.', icon: Building2, isArray: true },
  { id: 'declaration', dataKey: 'declaration', title: 'Declaration', description: 'Add your declaration by creating or uploading your personal signature.', icon: PenLine, isArray: false },
  { id: 'publications', dataKey: 'publications', title: 'Publications', description: 'Add publications, articles, or books you wrote or contributed to.', icon: BookMarked, isArray: true },
  { id: 'custom', dataKey: 'custom_sections', title: 'Custom', description: 'Add a custom section for anything else, or combine sections cleanly.', icon: Hash, isArray: true },
];

function ProfileBuilderSection({ candidateId }: { candidateId: string | undefined }) {
  const navigate = useNavigate();
  const [profileData, setProfileData] = useState<ProfileData>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<typeof PROFILE_SECTIONS[0] | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | 'new' | null>(null);
  const [educationEntry, setEducationEntry] = useState<EducationEntry>({});
  const [experienceEntry, setExperienceEntry] = useState<ExperienceEntry>({});
  const [skillEntry, setSkillEntry] = useState<SkillEntry>({});
  const [genericEntry, setGenericEntry] = useState<GenericEntry>({ title: '', description: '' });

  useEffect(() => {
    if (!candidateId) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error: e } = await supabase
        .from('candidate_profile_details')
        .select('profile_data')
        .eq('candidate_id', candidateId)
        .maybeSingle();
      if (!e && data) setProfileData((data.profile_data as ProfileData) ?? {});
      setLoading(false);
    })();
  }, [candidateId]);

  const persistProfile = useCallback(async (next: ProfileData) => {
    if (!candidateId) return;
    setSaving(true);
    setError(null);
    const { error: e } = await supabase
      .from('candidate_profile_details')
      .upsert({ candidate_id: candidateId, profile_data: next, updated_at: new Date().toISOString() }, { onConflict: 'candidate_id' });
    setSaving(false);
    if (e) setError(e.message);
    return e;
  }, [candidateId]);

  const saveSection = useCallback(async () => {
    if (!candidateId || !editingSection) return;
    setError(null);
    let value: unknown;
    if (editingSection.isArray) {
      try {
        value = editValue.trim() ? JSON.parse(editValue) : [];
      } catch {
        value = editValue.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
      }
      if (!Array.isArray(value)) value = [];
    } else {
      value = editValue.trim();
    }
    const next = { ...profileData, [editingSection.dataKey]: value };
    setProfileData(next);
    const err = await persistProfile(next);
    if (!err) setEditingSection(null);
  }, [candidateId, editingSection, editValue, profileData, persistProfile]);

  const saveStructuredEntry = useCallback(async (sectionId: string, dataKey: string, entry: EducationEntry | ExperienceEntry | SkillEntry | GenericEntry) => {
    const list = Array.isArray(profileData[dataKey]) ? [...(profileData[dataKey] as object[])] : [];
    const idx = editingEntryIndex === 'new' ? list.length : editingEntryIndex;
    if (typeof idx === 'number' && idx >= 0 && idx < list.length) {
      list[idx] = entry;
    } else {
      list.push(entry);
    }
    const next = { ...profileData, [dataKey]: list };
    setProfileData(next);
    const err = await persistProfile(next);
    if (!err) setEditingEntryIndex(null);
  }, [profileData, editingEntryIndex, persistProfile]);

  const deleteStructuredEntry = useCallback(async (dataKey: string, index?: number) => {
    const idx = index ?? (editingEntryIndex === 'new' ? -1 : editingEntryIndex);
    if (idx === null || idx === 'new' || idx < 0) {
      setEditingSection(null);
      setEditingEntryIndex(null);
      return;
    }
    const list = Array.isArray(profileData[dataKey]) ? [...(profileData[dataKey] as object[])] : [];
    if (idx >= list.length) return;
    list.splice(idx, 1);
    const next = { ...profileData, [dataKey]: list };
    setProfileData(next);
    const err = await persistProfile(next);
    if (!err) {
      setEditingSection(null);
      setEditingEntryIndex(null);
    }
  }, [profileData, editingEntryIndex, persistProfile]);

  const openSection = useCallback((section: typeof PROFILE_SECTIONS[0]) => {
    const raw = profileData[section.dataKey];
    setEditingEntryIndex(null);
    if (STRUCTURED_SECTION_IDS.includes(section.id)) {
      setEducationEntry({});
      setExperienceEntry({});
      setSkillEntry({});
    } else if (section.isArray) {
      setGenericEntry({ title: '', description: '' });
    } else {
      setEditValue(typeof raw === 'string' ? raw : raw != null ? String(raw) : '');
    }
    setEditingSection(section);
    setError(null);
  }, [profileData]);

  const openEntryAtIndex = useCallback((section: typeof PROFILE_SECTIONS[0], index: number) => {
    const raw = profileData[section.dataKey];
    const list = Array.isArray(raw) ? (raw as unknown[]) : [];
    const item = list[index];
    setEditingSection(section);
    setEditingEntryIndex(index);
    if (section.id === 'education') setEducationEntry((item || {}) as EducationEntry);
    else if (section.id === 'experience') setExperienceEntry((item || {}) as ExperienceEntry);
    else if (section.id === 'skills') setSkillEntry((item || {}) as SkillEntry);
    else setGenericEntry(normalizeListItems(list)[index] ?? { title: '', description: '' });
    setError(null);
  }, [profileData]);

  if (!candidateId) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Profile builder</h1>
        <p className="text-gray-600">Sign in to edit your profile.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl">
      {/* Header: Add content + Close */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Add content</h1>
        <Button variant="ghost" size="icon" onClick={() => navigate('/candidate-dashboard')} aria-label="Close">
          <X className="h-5 w-5" />
        </Button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-gray-600">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      )}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PROFILE_SECTIONS.map((section) => {
            const Icon = section.icon;
            const isCustom = section.id === 'custom';
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => openSection(section)}
                className={`text-left p-4 rounded-lg border bg-white transition shadow-sm hover:shadow-md hover:border-indigo-200 flex flex-col gap-2 ${isCustom ? 'border-dashed border-2 border-gray-300' : 'border-gray-200'}`}
              >
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600">
                    <Icon className="h-5 w-5" />
                  </div>
                  <span className="font-semibold text-gray-900">{section.title}</span>
                </div>
                <p className="text-sm text-gray-600">{section.description}</p>
              </button>
            );
          })}
        </div>
      )}

      {error && <p className="text-red-600 mt-4">{error}</p>}

      <Dialog open={!!editingSection} onOpenChange={(open) => !open && (setEditingSection(null), setEditingEntryIndex(null))}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {editingSection && editingSection.isArray ? (
            editingEntryIndex === null ? (
              <>
                <DialogHeader className="flex flex-row items-center justify-between space-y-0">
                  <DialogTitle>{editingSection.title}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3">
                  {(() => {
                    const rawList = Array.isArray(profileData[editingSection.dataKey]) ? (profileData[editingSection.dataKey] as unknown[]) : [];
                    const isStructured = STRUCTURED_SECTION_IDS.includes(editingSection.id);
                    const list = isStructured ? rawList : normalizeListItems(rawList);
                    return (
                      <>
                        {list.length > 0 ? (
                          <ul className="space-y-3">
                            {list.map((item: Record<string, unknown> | GenericEntry, i: number) => (
                              <li key={i} className="flex gap-3 rounded border bg-gray-50 px-3 py-3 text-sm">
                                <div className="flex-1 min-w-0 space-y-1">
                                  {editingSection.id === 'education' && (
                                    <>
                                      {(item.degree || item.school) && <p className="font-medium text-gray-900">{[item.degree, item.school].filter(Boolean).join(' · ')}</p>}
                                      {(item.start_date || item.end_date) && <p className="text-gray-600">{[item.start_date, item.end_date].filter(Boolean).join(' – ')}</p>}
                                      {item.location && <p className="text-gray-600">{String(item.location)}</p>}
                                      {item.description && <p className="text-gray-600 whitespace-pre-wrap">{String(item.description)}</p>}
                                    </>
                                  )}
                                  {editingSection.id === 'experience' && (
                                    <>
                                      {(item.job_title || item.employer) && <p className="font-medium text-gray-900">{[item.job_title, item.employer].filter(Boolean).join(' · ')}</p>}
                                      {(item.start_date || item.end_date) && <p className="text-gray-600">{[item.start_date, item.end_date].filter(Boolean).join(' – ')}</p>}
                                      {item.location && <p className="text-gray-600">{String(item.location)}</p>}
                                      {item.description && <p className="text-gray-600 whitespace-pre-wrap">{String(item.description)}</p>}
                                    </>
                                  )}
                                  {editingSection.id === 'skills' && (
                                    <>
                                      {item.skill && <p className="font-medium text-gray-900">{String(item.skill)}</p>}
                                      {item.level && <p className="text-gray-600">Level: {String(item.level)}</p>}
                                      {item.information && <p className="text-gray-600 whitespace-pre-wrap">{String(item.information)}</p>}
                                    </>
                                  )}
                                  {!isStructured && (
                                    <>
                                      {(item.title || item.name) && <p className="font-medium text-gray-900">{String(item.title || item.name)}</p>}
                                      {item.description && <p className="text-gray-600 whitespace-pre-wrap">{String(item.description)}</p>}
                                    </>
                                  )}
                                </div>
                                <div className="flex shrink-0 gap-1 self-start">
                                  <Button variant="ghost" size="sm" onClick={() => openEntryAtIndex(editingSection, i)}>Edit</Button>
                                  <Button variant="ghost" size="sm" onClick={() => deleteStructuredEntry(editingSection.dataKey, i)}>Delete</Button>
                                </div>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-500 py-2">No entries yet.</p>
                        )}
                        <Button className="w-full" variant="outline" onClick={() => { setEditingEntryIndex('new'); setEducationEntry({}); setExperienceEntry({}); setSkillEntry({}); setGenericEntry({ title: '', description: '' }); }}>
                          Add entry
                        </Button>
                      </>
                    );
                  })()}
                </div>
              </>
            ) : (
              <>
                <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <DialogTitle>{editingSection.title}</DialogTitle>
                  <Button variant="ghost" size="sm" onClick={() => deleteStructuredEntry(editingSection.dataKey)}><Trash2 className="h-4 w-4 text-red-600" /></Button>
                </DialogHeader>
                {editingSection.id === 'education' && (
                  <div className="space-y-3">
                    <div><Label>Degree</Label><Input placeholder="Enter Degree / Field Of Study" value={educationEntry.degree || ''} onChange={(e) => setEducationEntry((p) => ({ ...p, degree: e.target.value }))} className="mt-1" /></div>
                    <div><Label>School</Label><Input placeholder="Enter school / university" value={educationEntry.school || ''} onChange={(e) => setEducationEntry((p) => ({ ...p, school: e.target.value }))} className="mt-1" /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label>Start Date</Label><Input placeholder="MM/YYYY" value={educationEntry.start_date || ''} onChange={(e) => setEducationEntry((p) => ({ ...p, start_date: e.target.value }))} className="mt-1" /></div>
                      <div><Label>End Date</Label><Input placeholder="MM/YYYY" value={educationEntry.end_date || ''} onChange={(e) => setEducationEntry((p) => ({ ...p, end_date: e.target.value }))} className="mt-1" /></div>
                      <div><Label>Location</Label><Input placeholder="City, Country" value={educationEntry.location || ''} onChange={(e) => setEducationEntry((p) => ({ ...p, location: e.target.value }))} className="mt-1" /></div>
                    </div>
                    <div><Label>Description</Label><Textarea placeholder="Add a description of your education entry..." value={educationEntry.description || ''} onChange={(e) => setEducationEntry((p) => ({ ...p, description: e.target.value }))} className="mt-1 min-h-[80px]" /></div>
                    <Button className="w-full bg-[#1e5da8] hover:bg-[#1e5da8]/90 text-white" onClick={() => saveStructuredEntry('education', 'education', educationEntry)} disabled={saving}><Check className="h-4 w-4 mr-2" /> Done</Button>
                  </div>
                )}
                {editingSection.id === 'experience' && (
                  <div className="space-y-3">
                    <div><Label>Job Title</Label><Input placeholder="Enter Job Title" value={experienceEntry.job_title || ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, job_title: e.target.value }))} className="mt-1" /></div>
                    <div><Label>Employer</Label><Input placeholder="Enter employer" value={experienceEntry.employer || ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, employer: e.target.value }))} className="mt-1" /></div>
                    <div className="grid grid-cols-3 gap-2">
                      <div><Label>Start Date</Label><Input placeholder="MM/YYYY" value={experienceEntry.start_date || ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, start_date: e.target.value }))} className="mt-1" /></div>
                      <div><Label>End Date</Label><Input placeholder="MM/YYYY" value={experienceEntry.end_date || ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, end_date: e.target.value }))} className="mt-1" /></div>
                      <div><Label>Location</Label><Input placeholder="City, Country" value={experienceEntry.location || ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, location: e.target.value }))} className="mt-1" /></div>
                    </div>
                    <div><Label>Description</Label><Textarea placeholder="Describe your role & achievements" value={experienceEntry.description || ''} onChange={(e) => setExperienceEntry((p) => ({ ...p, description: e.target.value }))} className="mt-1 min-h-[80px]" /></div>
                    <Button className="w-full bg-[#1e5da8] hover:bg-[#1e5da8]/90 text-white" onClick={() => saveStructuredEntry('experience', 'experience', experienceEntry)} disabled={saving}><Check className="h-4 w-4 mr-2" /> Done</Button>
                  </div>
                )}
                {editingSection.id === 'skills' && (
                  <div className="space-y-3">
                    <div><Label>Skill</Label><Input placeholder="Enter Skill" value={skillEntry.skill || ''} onChange={(e) => setSkillEntry((p) => ({ ...p, skill: e.target.value }))} className="mt-1" /></div>
                    <div><Label>Information / Sub-skills</Label><Textarea placeholder="Enter information or sub-skills" value={skillEntry.information || ''} onChange={(e) => setSkillEntry((p) => ({ ...p, information: e.target.value }))} className="mt-1 min-h-[60px]" /></div>
                    <div><Label>Skill level</Label><Select value={skillEntry.level || ''} onValueChange={(v) => setSkillEntry((p) => ({ ...p, level: v }))}><SelectTrigger className="mt-1"><SelectValue placeholder="Select skill level" /></SelectTrigger><SelectContent>{SKILL_LEVELS.map((l) => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent></Select></div>
                    <Button className="w-full bg-[#1e5da8] hover:bg-[#1e5da8]/90 text-white" onClick={() => saveStructuredEntry('skills', 'skills', skillEntry)} disabled={saving}><Check className="h-4 w-4 mr-2" /> Done</Button>
                  </div>
                )}
                {STRUCTURED_SECTION_IDS.includes(editingSection.id) === false && (
                  <div className="space-y-3">
                    <div><Label>Title / Name</Label><Input placeholder="Enter title or name" value={genericEntry.title || ''} onChange={(e) => setGenericEntry((p) => ({ ...p, title: e.target.value }))} className="mt-1" /></div>
                    <div><Label>Description / Details</Label><Textarea placeholder="Add details (optional)" value={genericEntry.description || ''} onChange={(e) => setGenericEntry((p) => ({ ...p, description: e.target.value }))} className="mt-1 min-h-[80px]" /></div>
                    <Button className="w-full bg-[#1e5da8] hover:bg-[#1e5da8]/90 text-white" onClick={() => saveStructuredEntry(editingSection.id, editingSection.dataKey, genericEntry)} disabled={saving}><Check className="h-4 w-4 mr-2" /> Done</Button>
                  </div>
                )}
              </>
            )
          ) : editingSection ? (
            <>
              <DialogHeader className="flex flex-row items-center justify-between space-y-0">
                <DialogTitle>{editingSection.title}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Label>{editingSection.isArray ? 'Content (JSON array or comma-separated)' : 'Content'}</Label>
                <Textarea value={editValue} onChange={(e) => setEditValue(e.target.value)} className="min-h-[200px] font-mono text-sm" placeholder={editingSection.isArray ? '[] or ["Item 1", "Item 2"]' : 'Enter text…'} />
                <Button className="w-full bg-[#1e5da8] hover:bg-[#1e5da8]/90 text-white" onClick={saveSection} disabled={saving}>{saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />} Done</Button>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default CandidateDashboard;
