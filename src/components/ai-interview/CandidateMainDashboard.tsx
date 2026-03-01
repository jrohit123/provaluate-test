import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { User, Settings, UserPlus, Briefcase } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/** Profile section keys in candidate_profile_details.profile_data (must match Profile Builder). */
const PROFILE_SECTION_KEYS = [
  'summary', 'education', 'experience', 'languages', 'certificates', 'skills', 'courses',
  'interests', 'awards', 'projects', 'references', 'organisations', 'declaration', 'publications', 'custom_sections',
];
const PROFILE_NON_ARRAY_KEYS = ['summary', 'declaration'];

function countProfileSectionsCompleted(profileData: Record<string, unknown> | null): { completed: number; total: number } {
  const total = PROFILE_SECTION_KEYS.length;
  if (!profileData || typeof profileData !== 'object') return { completed: 0, total };
  let completed = 0;
  for (const key of PROFILE_SECTION_KEYS) {
    const v = profileData[key];
    if (PROFILE_NON_ARRAY_KEYS.includes(key)) {
      if (typeof v === 'string' && v.trim().length > 0) completed += 1;
    } else {
      if (Array.isArray(v) && v.length > 0) completed += 1;
    }
  }
  return { completed, total };
}

interface CandidateMainDashboardProps {
  candidateId: string | undefined;
  candidateEmail: string | undefined;
  onNavigate: (path: string) => void;
}

export function CandidateMainDashboard({ candidateId, candidateEmail, onNavigate }: CandidateMainDashboardProps) {
  const [stats, setStats] = useState({
    jobDescriptions: 0,
    interviewsCompleted: 0,
    profileSectionsCompleted: 0,
    profileSectionsTotal: PROFILE_SECTION_KEYS.length,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!candidateId && !candidateEmail) {
      setLoading(false);
      return;
    }
    (async () => {
      const completedIds = new Set<string>();
      const seenIds = new Set<string>();
      let profileData: Record<string, unknown> | null = null;
      let jdCount = 0;
      try {
        const rows: { id?: string; position: string | null; status: string | null }[] = [];
        if (candidateId) {
          const [intRes, profileRes, jdRes] = await Promise.all([
            supabase.from('interviews').select('id, position, status').eq('candidate_id', candidateId),
            supabase.from('candidate_profile_details').select('profile_data').eq('candidate_id', candidateId).maybeSingle(),
            supabase.from('jd_candidates').select('id', { count: 'exact', head: true }).eq('candidate_id', candidateId),
          ]);
          const data = intRes.data || [];
          data.forEach((r) => {
            if (r.id) seenIds.add(r.id);
            rows.push(r);
          });
          if (profileRes.data?.profile_data) profileData = profileRes.data.profile_data as Record<string, unknown>;
          jdCount = jdRes.count ?? (jdRes.data?.length ?? 0);
        }
        if (candidateEmail) {
          const { data } = await supabase
            .from('interviews')
            .select('id, position, status')
            .is('candidate_id', null)
            .eq('candidate_email', candidateEmail);
          (data || []).forEach((r) => {
            if (r.id && !seenIds.has(r.id)) {
              seenIds.add(r.id);
              rows.push(r);
            }
          });
        }
        rows.forEach((r) => {
          if (r.id && r.status === 'completed') completedIds.add(r.id);
        });
        const profile = countProfileSectionsCompleted(profileData);
        setStats({
          jobDescriptions: jdCount,
          interviewsCompleted: completedIds.size,
          profileSectionsCompleted: profile.completed,
          profileSectionsTotal: profile.total,
        });
      } catch {
        setStats({
          jobDescriptions: 0,
          interviewsCompleted: 0,
          profileSectionsCompleted: 0,
          profileSectionsTotal: PROFILE_SECTION_KEYS.length,
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [candidateId, candidateEmail]);

  const steps = [
    { title: 'Profile overview', icon: User, path: '/candidate-dashboard/profile' },
    { title: 'Interview config', icon: Settings, path: '/candidate-dashboard/jds/configure' },
    { title: 'Interview creation', icon: UserPlus, path: '/candidate-dashboard/jds/create' },
    { title: 'Interview dashboard', icon: Briefcase, path: '/candidate-dashboard/interviews' },
  ];

  const quickActionCardClass =
    'h-auto min-h-[80px] sm:min-h-[88px] p-4 sm:p-5 flex flex-col items-center justify-center gap-2 rounded-lg bg-sky-50 border border-sky-100 hover:border-sky-200 hover:bg-sky-100/80 transition-colors text-gray-900 font-semibold text-base sm:text-lg text-center touch-manipulation';

  return (
    <div className="w-full min-w-0 p-3 sm:p-6 space-y-6 sm:space-y-8 overflow-x-hidden">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm sm:text-base text-gray-600 mb-1">Welcome to your candidate workspace</p>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
        </div>
      </div>

      {/* Quick Stats - full width, single row */}
      <Card className="w-full border border-sky-100 shadow-sm overflow-hidden">
        <CardHeader className="pb-2 px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg md:text-xl text-gray-900">Quick Stats</CardTitle>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6">
            <div className="text-center p-4 sm:p-5 rounded-lg bg-sky-50 border border-sky-100">
              <div className="text-2xl sm:text-3xl font-bold text-sky-800">
                {loading ? '...' : stats.jobDescriptions}
              </div>
              <div className="text-sm sm:text-base text-gray-600 mt-1">JOB DESCRIPTIONS</div>
            </div>
            <div className="text-center p-4 sm:p-5 rounded-lg bg-sky-50 border border-sky-100">
              <div className="text-2xl sm:text-3xl font-bold text-sky-800">
                {loading ? '...' : stats.interviewsCompleted}
              </div>
              <div className="text-sm sm:text-base text-gray-600 mt-1">INTERVIEWS COMPLETED</div>
            </div>
            <div className="text-center p-4 sm:p-5 rounded-lg bg-sky-50 border border-sky-100">
              <div className="text-2xl sm:text-3xl font-bold text-sky-800">
                {loading ? '...' : `${stats.profileSectionsCompleted}/${stats.profileSectionsTotal}`}
              </div>
              <div className="text-sm sm:text-base text-gray-600 mt-1">PROFILE SECTIONS COMPLETED</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions - same card style as Quick Stats */}
      <Card className="w-full border border-sky-100 shadow-sm overflow-hidden">
        <CardHeader className="pb-2 px-3 sm:px-6">
          <CardTitle className="text-base sm:text-lg md:text-xl text-gray-900">Quick Actions</CardTitle>
          <CardDescription className="text-sm sm:text-base text-gray-600">
            Use the steps below or the sidebar to navigate
          </CardDescription>
        </CardHeader>
        <CardContent className="px-3 sm:px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            {steps.map((step) => (
              <Button
                key={step.path}
                onClick={() => onNavigate(step.path)}
                variant="ghost"
                className={quickActionCardClass}
              >
                <step.icon className="w-8 h-8 text-sky-600 flex-shrink-0" />
                <span>{step.title}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
