import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { buildApiUrl } from '@/constants/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Upload } from 'lucide-react';

interface CareerCompany {
  company_id: string;
  company_name: string;
  career_logo_url: string | null;
  career_vision: string | null;
}

interface CareerJD {
  jd_id: string;
  title: string | null;
  default_criteria_id: string;
  created_at: string;
}

export default function CompanyCareerPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const [company, setCompany] = useState<CareerCompany | null>(null);
  const [jds, setJds] = useState<CareerJD[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedJdId, setSelectedJdId] = useState<string>('');
  const [jdDescription, setJdDescription] = useState<Record<string, string>>({});
  const [uploadingForJd, setUploadingForJd] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadErrorJdId, setUploadErrorJdId] = useState<string | null>(null);

  useEffect(() => {
    if (!companySlug) {
      setError('Invalid URL');
      setLoading(false);
      return;
    }
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [companyRes, jdsRes] = await Promise.all([
          fetch(buildApiUrl(`/api/career/company/${companySlug}`)),
          fetch(buildApiUrl(`/api/career/company/${companySlug}/job_descriptions`)),
        ]);
        if (!companyRes.ok) {
          setError('Company not found or career page not available.');
          setLoading(false);
          return;
        }
        const companyJson = await companyRes.json();
        if (companyJson.status !== 'success' || !companyJson.data) {
          setError('Company not found or career page not available.');
          setLoading(false);
          return;
        }
        setCompany(companyJson.data);

        if (!jdsRes.ok) {
          setJds([]);
          setLoading(false);
          return;
        }
        const jdsJson = await jdsRes.json();
        setJds(jdsJson.data || []);
      } catch (e) {
        setError('Failed to load career page.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [companySlug]);

  const fetchJdDescription = async (jdId: string) => {
    if (jdDescription[jdId]) return;
    try {
      const res = await fetch(buildApiUrl(`/api/career/job_descriptions/${jdId}/original`));
      const json = await res.json();
      if (json.status === 'success' && json.data) {
        setJdDescription((prev) => ({ ...prev, [jdId]: json.data.description || '' }));
      }
    } catch {
      setJdDescription((prev) => ({ ...prev, [jdId]: 'Could not load description.' }));
    }
  };

  useEffect(() => {
    if (selectedJdId) fetchJdDescription(selectedJdId);
  }, [selectedJdId]);

  const handleUpload = async (jd: CareerJD, file: File) => {
    if (!companySlug) return;
    setUploadingForJd(jd.jd_id);
    setUploadError(null);
    setUploadSuccess(null);
    const formData = new FormData();
    formData.append('jd_id', jd.jd_id);
    formData.append('criteria_id', jd.default_criteria_id);
    formData.append('file', file);
    try {
      const res = await fetch(buildApiUrl(`/api/career/company/${companySlug}/upload_resume`), {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();
      if (json.status === 'success') {
        setUploadSuccess(jd.jd_id);
        setUploadError(null);
        setUploadErrorJdId(null);
        setTimeout(() => setUploadSuccess(null), 5000);
      } else {
        setUploadError(json.error || 'Upload failed.');
        setUploadErrorJdId(jd.jd_id);
      }
    } catch {
      setUploadError('Upload failed. Please try again.');
      setUploadErrorJdId(jd.jd_id);
    } finally {
      setUploadingForJd(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:px-8">
        <div className="w-full space-y-4 sm:space-y-6">
          <Skeleton className="h-24 sm:h-32 w-full rounded-lg" />
          <Skeleton className="h-20 sm:h-24 w-full rounded-lg" />
          <Skeleton className="h-40 sm:h-48 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6">
        <Card className="max-w-md w-full mx-2">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Career page not available</CardTitle>
            <CardDescription className="text-sm">{error || 'Company not found.'}</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  const selectedJd = selectedJdId ? jds.find((j) => j.jd_id === selectedJdId) : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Same header style as dashboard: blue bar with logo */}
      <header className="bg-[#1e5da8] border-b pl-0 pr-3 sm:pr-6 py-0 h-14 sm:h-16 flex items-center justify-start gap-2 sm:gap-4">
        <div className="flex items-center h-full">
          {company.career_logo_url && (
            <img
              src={company.career_logo_url}
              alt=""
              className="h-full w-auto max-h-14 sm:max-h-16 flex-shrink-0 object-contain"
            />
          )}
        </div>
      </header>

      {company.career_vision && (
        <section className="bg-white border-b">
          <div className="w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-2 sm:mb-3">Our Vision</h2>
            <div className="text-gray-600 text-sm sm:text-base whitespace-pre-wrap leading-relaxed max-w-full">
              {company.career_vision}
            </div>
          </div>
        </section>
      )}

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4 sm:space-y-6">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Open positions</h2>
        {jds.length === 0 ? (
          <Card>
            <CardContent className="py-6 sm:py-8 text-center text-gray-500 text-sm sm:text-base px-4">
              No open positions at the moment. Check back later.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="career-role-select">Select role</Label>
              <Select value={selectedJdId} onValueChange={setSelectedJdId}>
                <SelectTrigger id="career-role-select" className="w-full min-h-10 touch-manipulation">
                  <SelectValue placeholder="Choose a role to apply" />
                </SelectTrigger>
                <SelectContent>
                  {jds.map((jd) => (
                    <SelectItem key={jd.jd_id} value={jd.jd_id}>
                      {jd.title || 'Untitled role'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedJd && (
              <Card>
                <CardHeader className="pb-2 p-4 sm:p-6 sm:pb-2">
                  <CardTitle className="text-base sm:text-lg break-words">{selectedJd.title || 'Untitled role'}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
                  <div>
                    <h3 className="text-sm font-medium text-gray-700 mb-2">Job description</h3>
                    <div className="rounded-md bg-gray-50 border p-3 sm:p-4 text-sm text-gray-700 whitespace-pre-wrap max-h-64 overflow-y-auto overscroll-contain">
                      {jdDescription[selectedJd.jd_id] ?? 'Loading...'}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-gray-700">Upload your CV</h3>
                    <p className="text-xs text-muted-foreground">Supported formats: PDF, DOCX or TXT.</p>
                    <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2">
                      <label className="flex items-center gap-2 cursor-pointer min-h-10 touch-manipulation w-full sm:w-auto">
                        <Upload className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm">Choose file (PDF, DOCX, TXT)</span>
                        <input
                          type="file"
                          accept=".pdf,.docx,.txt"
                          className="text-sm file:mr-2 file:py-2 file:px-4 file:rounded file:border-0 file:bg-primary file:text-primary-foreground file:text-sm file:min-h-10 file:touch-manipulation flex-1 min-w-0"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleUpload(selectedJd, file);
                            e.target.value = '';
                          }}
                          disabled={!!uploadingForJd}
                        />
                      </label>
                      {uploadingForJd === selectedJd.jd_id && (
                        <span className="text-sm text-gray-500">Uploading...</span>
                      )}
                      {uploadSuccess === selectedJd.jd_id && (
                        <div className="text-sm text-green-600 space-y-1">
                          <p className="font-medium">Uploaded successfully.</p>
                          <p className="text-muted-foreground font-normal">You can close this page now—we&apos;re processing your application and will be in touch if your profile matches.</p>
                        </div>
                      )}
                    </div>
                  </div>
                  {uploadError && uploadErrorJdId === selectedJd.jd_id && (
                    <p className="text-sm text-red-600">{uploadError}</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
      <footer className="border-t mt-8 sm:mt-12 py-4 px-4 sm:px-6 lg:px-8 text-center text-xs text-gray-500">
        Powered by ProValuate
      </footer>
    </div>
  );
}
