import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import AIsetup, { type InjectedJD } from './AIsetup';
import { Loader2 } from 'lucide-react';
import { API_CONFIG, buildApiUrl } from '@/constants/api';

type TemplateRow = {
  id: string;
  title?: string | null;
  position?: string | null;
  created_at?: string;
  jd_file?: string | null;
  extracted_jd_text?: string | null;
  generation_hints?: string[] | null;
  custom_role_parameters_id?: string | null;
  interview_mode?: 'ai' | 'structured' | null;
  interview_type?: 'functional' | 'behavioral' | 'mixed' | 'technical' | null;
};

interface TpoJdInterviewConfigProps {
  tpoWorkflowStepIndex: number;
  onTpoWorkflowStepClick: (stepIndex: number) => void;
}

function mapTplToInjectedJD(t: TemplateRow): InjectedJD {
  const title = t.title ?? t.position ?? null;
  return {
    jd_id: t.id,
    title,
    extracted_text: t.extracted_jd_text ?? null,
    jd_file: t.jd_file ?? null,
    created_at: t.created_at,
    generation_hints: t.generation_hints ?? null,
    jd_source: 'campus_interview_templates',
    custom_role_parameters_id: t.custom_role_parameters_id ?? null,
    interview_mode: t.interview_mode ?? null,
    interview_type: t.interview_type ?? null,
  };
}

/** TPO configure step: same UI as candidate AIsetup; JDs from campus_interview_templates. */
export default function TpoJdInterviewConfig({
  tpoWorkflowStepIndex,
  onTpoWorkflowStepClick,
}: TpoJdInterviewConfigProps) {
  const [injectedJobDescriptions, setInjectedJobDescriptions] = useState<InjectedJD[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadJobDescriptions = useCallback(async (options?: { silent?: boolean }) => {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_CAMPUS_INTERVIEWS), {
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const json = (await res.json().catch(() => ({}))) as { templates?: TemplateRow[] };
      if (!res.ok) {
        setInjectedJobDescriptions([]);
        return;
      }
      const list = json.templates || [];
      setInjectedJobDescriptions(list.map(mapTplToInjectedJD));
    } catch {
      setInjectedJobDescriptions([]);
    } finally {
      if (!options?.silent) setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobDescriptions();
  }, [loadJobDescriptions]);

  return (
    <div className="w-full min-w-0 space-y-4 overflow-x-hidden">
      {initialLoading ? (
        <div className="flex items-center gap-2 text-gray-600 py-8">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading your job descriptions…
        </div>
      ) : (
        <AIsetup
          injectedJobDescriptions={injectedJobDescriptions}
          injectedLoadJobDescriptions={() => loadJobDescriptions({ silent: true })}
          tpoCampusTemplatePersist
          tpoWorkflowStepIndex={tpoWorkflowStepIndex}
          onTpoWorkflowStepClick={onTpoWorkflowStepClick}
        />
      )}
    </div>
  );
}
