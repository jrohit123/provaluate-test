import { useEffect, useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { buildApiUrl } from '@/constants/api';
import { Globe, ExternalLink, Loader2, Save } from 'lucide-react';

interface CareerPortalSectionProps {
  onSectionReady?: () => void;
}

interface CompanyCareer {
  company_id: string;
  company_name: string;
  career_slug: string | null;
  career_logo_url: string | null;
  career_vision: string | null;
  career_page_enabled: boolean | null;
}

interface JobDescription {
  jd_id: string;
  title: string | null;
  default_criteria_id: string | null;
  post_on_career_page: boolean | null;
}

interface CriteriaOption {
  criteria_id: string;
  criteria_name: string;
}

export function CareerPortalSection({ onSectionReady }: CareerPortalSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyId = user?.profile?.company_id ?? user?.company?.company_id;
  const [company, setCompany] = useState<CompanyCareer | null>(null);
  const [jds, setJds] = useState<JobDescription[]>([]);
  const [criteriaByJd, setCriteriaByJd] = useState<Record<string, CriteriaOption[]>>({});
  const [loading, setLoading] = useState(true);
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingJd, setSavingJd] = useState<string | null>(null);
  const [formSlug, setFormSlug] = useState('');
  const [formLogoUrl, setFormLogoUrl] = useState('');
  const [formVision, setFormVision] = useState('');
  const [selectedJdId, setSelectedJdId] = useState<string>('');
  const onSectionReadyRef = useRef(onSectionReady);
  onSectionReadyRef.current = onSectionReady;

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    const fetchCompany = async () => {
      try {
        const res = await fetch(buildApiUrl(`/api/companies/${companyId}`));
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          const c = json.data;
          setCompany(c);
          setFormSlug(c.career_slug?.trim() || c.company_name || '');
          setFormLogoUrl(c.career_logo_url ?? '');
          setFormVision(c.career_vision ?? '');
        }
      } catch {
        toast({ title: 'Failed to load company', variant: 'destructive' });
      }
    };
    const fetchJds = async () => {
      try {
        // Only fetch active JDs so Career Portal list matches what can appear on the public career page
        const res = await fetch(buildApiUrl(`/api/job_descriptions?company_id=${companyId}`));
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          setJds(json.data);
          for (const jd of json.data) {
            fetchCriteriaForJd(jd.jd_id);
          }
        }
      } catch {
        toast({ title: 'Failed to load job descriptions', variant: 'destructive' });
      }
    };
    const fetchCriteriaForJd = async (jdId: string) => {
      try {
        const res = await fetch(buildApiUrl(`/api/criteria?company_id=${companyId}&jd_id=${jdId}`));
        const json = await res.json();
        if (json.status === 'success' && json.data) {
          setCriteriaByJd((prev) => ({
            ...prev,
            [jdId]: json.data.map((x: { criteria_id: string; criteria_name: string }) => ({
              criteria_id: x.criteria_id,
              criteria_name: x.criteria_name,
            })),
          }));
        }
      } catch {
        setCriteriaByJd((prev) => ({ ...prev, [jdId]: [] }));
      }
    };
    Promise.all([fetchCompany(), fetchJds()]).finally(() => {
      setLoading(false);
      onSectionReadyRef.current?.();
    });
    // Only re-fetch when companyId changes so user input in the form is not overwritten by refetch
  }, [companyId]);

  const handleSaveCompany = async () => {
    if (!companyId) return;
    setSavingCompany(true);
    try {
      const res = await fetch(buildApiUrl(`/api/companies/${companyId}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          career_slug: formSlug.trim() || null,
          career_logo_url: formLogoUrl.trim() || null,
          career_vision: formVision.trim().slice(0, 400) || null,
        }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        const data = json.data || {};
        setCompany((prev) => (prev ? { ...prev, ...data } : null));
        // Sync form from response so the text box shows persisted values (e.g. normalized slug) and stays editable for further changes
        setFormSlug(data.career_slug ?? '');
        setFormLogoUrl(data.career_logo_url ?? '');
        setFormVision(data.career_vision ?? '');
        toast({ title: 'Company career details saved' });
      } else {
        toast({ title: json.error || 'Failed to save', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSavingCompany(false);
    }
  };

  const handleSetDefaultCriteria = async (jdId: string, criteriaId: string) => {
    if (!companyId || !user?.id) return;
    setSavingJd(jdId);
    try {
      const res = await fetch(buildApiUrl(`/api/job_descriptions/${jdId}/set_default_criteria`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          criteria_id: criteriaId,
          user_id: user.id,
          company_id: companyId,
        }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setJds((prev) =>
          prev.map((j) => (j.jd_id === jdId ? { ...j, default_criteria_id: criteriaId } : j))
        );
        toast({ title: 'Default criteria saved' });
      } else {
        toast({ title: json.error || 'Failed to save', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to save', variant: 'destructive' });
    } finally {
      setSavingJd(null);
    }
  };

  const handleSetPostOnCareerPage = async (jdId: string, value: boolean) => {
    if (!companyId) return;
    setSavingJd(jdId);
    try {
      const res = await fetch(buildApiUrl(`/api/job_descriptions/${jdId}/post_on_career_page`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ post_on_career_page: value, company_id: companyId }),
      });
      const json = await res.json();
      if (json.status === 'success') {
        setJds((prev) =>
          prev.map((j) => (j.jd_id === jdId ? { ...j, post_on_career_page: value } : j))
        );
        toast({ title: value ? 'Posted on career page' : 'Removed from career page' });
      } else {
        toast({ title: json.error || 'Failed to update', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'Failed to update', variant: 'destructive' });
    } finally {
      setSavingJd(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!companyId) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          You need to be associated with a company to manage the career portal.
        </CardContent>
      </Card>
    );
  }

  const careerUrl =
    company?.career_slug
      ? `${typeof window !== 'undefined' ? window.location.origin : ''}${import.meta.env.BASE_URL}careers/${company.career_slug}`
      : '';

  return (
    <div className="space-y-6 p-3 sm:p-4 md:p-6" data-tour="career-portal-section">
      <Card data-tour="career-portal-company-details">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Globe className="h-5 w-5 flex-shrink-0" />
            Company career details
          </CardTitle>
          <CardDescription className="text-sm">
            Set your company&apos;s career page slug, logo URL, and vision (for {company?.company_name ?? 'your company'}). Editable; click Save to update. Only JDs with default criteria set and
            &quot;Post on career page&quot; on will appear on your public career page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 p-4 sm:p-6">
          <div className="grid gap-2">
            <Label htmlFor="career-slug">Career page slug</Label>
            <Input
              id="career-slug"
              placeholder="e.g. accenture"
              value={formSlug}
              onChange={(e) => setFormSlug(e.target.value)}
              className="w-full max-w-xs min-h-10 touch-manipulation"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="career-logo">Logo URL</Label>
            <Input
              id="career-logo"
              placeholder="https://..."
              value={formLogoUrl}
              onChange={(e) => setFormLogoUrl(e.target.value)}
              className="w-full min-h-10 touch-manipulation"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="career-vision">Vision / about text (max 400 characters)</Label>
            <Textarea
              id="career-vision"
              placeholder="Short description for candidates..."
              value={formVision}
              onChange={(e) => setFormVision(e.target.value.slice(0, 400))}
              maxLength={400}
              rows={4}
              className="min-h-[100px] touch-manipulation resize-y"
            />
            {formVision.length > 0 && (
              <span className="text-xs text-muted-foreground">{formVision.length}/400</span>
            )}
          </div>
          <Button
            onClick={handleSaveCompany}
            disabled={savingCompany}
            className="min-h-10 touch-manipulation bg-[#094D7B] px-4 text-white hover:bg-[#094D7B]/90"
          >
            {savingCompany ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save
          </Button>
          {careerUrl && (
            <div className="rounded-lg border bg-muted/50 p-3 sm:p-4 space-y-2">
              <Label className="text-muted-foreground text-sm">Your career page URL</Label>
              <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                <code className="text-xs sm:text-sm break-all">{careerUrl}</code>
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="min-h-9 touch-manipulation shrink-0"
                >
                  <a href={careerUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open
                  </a>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card data-tour="career-portal-jd-list">
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Job descriptions</CardTitle>
          <CardDescription className="text-sm">
            Select a job description below to set its default criteria and &quot;Post on career page&quot;.
            Only JDs with both default criteria set and Post on career page on will appear on your
            public career page.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 sm:p-6">
          {jds.length === 0 ? (
            <p className="text-muted-foreground text-sm">No job descriptions yet. Upload JDs in New Job Upload.</p>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="career-portal-jd-select">Select job description</Label>
                <Select value={selectedJdId} onValueChange={setSelectedJdId}>
                  <SelectTrigger id="career-portal-jd-select" className="w-full min-h-10 touch-manipulation">
                    <SelectValue placeholder="Choose a job description" />
                  </SelectTrigger>
                  <SelectContent>
                    {jds.map((jd) => (
                      <SelectItem key={jd.jd_id} value={jd.jd_id}>
                        <div className="flex w-full items-center justify-between gap-2">
                          <span className="truncate">{jd.title || 'Untitled'}</span>
                          <span
                            className={`shrink-0 text-xs font-medium ${
                              jd.post_on_career_page ? 'text-emerald-600' : 'text-slate-500'
                            }`}
                          >
                            {jd.post_on_career_page ? '● Active' : '○ Inactive'}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedJdId && (() => {
                const jd = jds.find((j) => j.jd_id === selectedJdId);
                if (!jd) return null;
                return (
                  <div className="flex flex-col gap-4 p-3 sm:p-4 rounded-lg border">
                    <div className="min-w-0">
                      <p className="font-medium truncate text-sm sm:text-base">{jd.title || 'Untitled'}</p>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3">
                      <div className="flex flex-col sm:flex-row sm:items-center gap-2 min-w-0">
                        <Label htmlFor={`criteria-${jd.jd_id}`} className="text-sm text-muted-foreground shrink-0">
                          Default criteria
                        </Label>
                        <Select
                          value={jd.default_criteria_id ?? ''}
                          onValueChange={(v) => v && handleSetDefaultCriteria(jd.jd_id, v)}
                          disabled={!!savingJd}
                        >
                          <SelectTrigger id={`criteria-${jd.jd_id}`} className="w-full sm:w-[200px] min-h-10 touch-manipulation">
                            <SelectValue placeholder="Select criteria" />
                          </SelectTrigger>
                          <SelectContent>
                            {(criteriaByJd[jd.jd_id] ?? []).map((c) => (
                              <SelectItem key={c.criteria_id} value={c.criteria_id}>
                                {c.criteria_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`post-${jd.jd_id}`}
                          checked={jd.post_on_career_page ?? false}
                          onCheckedChange={(v) => handleSetPostOnCareerPage(jd.jd_id, v)}
                          disabled={!!savingJd}
                          className="touch-manipulation data-[state=checked]:bg-[#094D7B] data-[state=unchecked]:bg-input"
                        />
                        <Label htmlFor={`post-${jd.jd_id}`} className="text-sm cursor-pointer">
                          Post on career page
                        </Label>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
