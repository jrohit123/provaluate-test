import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import AIsetup, { type InjectedJD } from './AIsetup';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';

interface CandidateJdInterviewConfigProps {
  candidateId: string;
}

function mapRowToInjectedJD(row: { id: string; title: string | null; extracted_text?: string | null; jd_file?: string | null; created_at?: string }): InjectedJD {
  return {
    jd_id: row.id,
    title: row.title ?? null,
    extracted_text: row.extracted_text ?? null,
    jd_file: row.jd_file ?? null,
    created_at: row.created_at,
  };
}

/**
 * Interview configuration (AIsetup) for candidate dashboard.
 * Loads JDs from jd_candidates only; recruiter flow is unchanged.
 */
export default function CandidateJdInterviewConfig({ candidateId }: CandidateJdInterviewConfigProps) {
  const [injectedJobDescriptions, setInjectedJobDescriptions] = useState<InjectedJD[]>([]);
  const [loading, setLoading] = useState(true);

  const loadJobDescriptions = useCallback(async () => {
    if (!candidateId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('jd_candidates')
      .select('id, title, jd_file, extracted_text, created_at')
      .eq('candidate_id', candidateId)
      .order('created_at', { ascending: false });
    if (!error && data) {
      setInjectedJobDescriptions(data.map(mapRowToInjectedJD));
    } else {
      setInjectedJobDescriptions([]);
    }
    setLoading(false);
  }, [candidateId]);

  useEffect(() => {
    loadJobDescriptions();
  }, [loadJobDescriptions]);

  if (!candidateId) {
    return (
      <div className="space-y-4">
        <p className="text-gray-600">Sign in to configure interviews.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/candidate-dashboard/jds">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to My JDs
          </Link>
        </Button>
      </div>
      {loading ? (
        <div className="flex items-center gap-2 text-gray-600 py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your job descriptions…
        </div>
      ) : (
        <AIsetup
          injectedJobDescriptions={injectedJobDescriptions}
          injectedLoadJobDescriptions={loadJobDescriptions}
          candidateId={candidateId}
        />
      )}
    </div>
  );
}
