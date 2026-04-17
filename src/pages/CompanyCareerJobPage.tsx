import { useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { buildApiUrl } from '@/constants/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, FileText } from 'lucide-react';

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

export default function CompanyCareerJobPage() {
  const { companySlug, jdId } = useParams<{ companySlug: string; jdId: string }>();
  const [company, setCompany] = useState<CareerCompany | null>(null);
  const [jd, setJd] = useState<CareerJD | null>(null);
  const [description, setDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!companySlug || !jdId) {
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
          setError('Job not found.');
          setLoading(false);
          return;
        }
        const jdsJson = await jdsRes.json();
        const list: CareerJD[] = jdsJson.data || [];
        const match = list.find((j: CareerJD) => j.jd_id === jdId);
        if (!match) {
          setError('Job not found.');
          setLoading(false);
          return;
        }
        setJd(match);

        const descRes = await fetch(buildApiUrl(`/api/career/job_descriptions/${jdId}/original`));
        const descJson = await descRes.json();
        if (descJson.status === 'success' && descJson.data) {
          setDescription(descJson.data.description || '');
        } else {
          setDescription('Could not load description.');
        }
      } catch {
        setError('Failed to load page.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [companySlug, jdId]);

  const handleUpload = async (file: File) => {
    if (!companySlug || !jd) return;
    setUploading(true);
    setUploadError(null);
    setUploadSuccess(false);
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
        setUploadSuccess(true);
        setUploadError(null);
        setSelectedFile(null);
        setTimeout(() => setUploadSuccess(false), 5000);
      } else {
        setUploadError(json.error || 'Upload failed.');
      }
    } catch {
      setUploadError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:px-8">
        <div className="w-full space-y-4">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (error || !company || !jd) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6">
        <Card className="max-w-md w-full mx-2">
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">Job not available</CardTitle>
            <CardDescription className="text-sm">{error || 'Job not found.'}</CardDescription>
            {companySlug && (
              <Link
                to={`/careers/${companySlug}`}
                className="mt-4 inline-flex items-center gap-2 text-sm text-[#094D7B] hover:text-[#094D7B]/90"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to open positions
              </Link>
            )}
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <header className="relative w-full overflow-hidden border-b border-[#094D7B]/15 bg-gradient-to-br from-[#094D7B]/5 via-[#094D7B]/5 to-[#094D7B]/12 px-3 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#094D7B]/20 blur-3xl sm:h-96 sm:w-96" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#094D7B]/25 blur-3xl sm:h-72 sm:w-72" />
        <div className="relative w-full flex flex-row items-start sm:items-center justify-between gap-3 sm:gap-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 min-w-0 flex-1">
            <div className="flex h-20 w-24 flex-shrink-0 items-center justify-center rounded-xl border border-[#094D7B]/15 bg-white p-3 shadow-md sm:min-h-[100px] sm:h-28 sm:w-44 sm:rounded-2xl sm:p-5 lg:h-36 lg:w-56">
              {company.career_logo_url ? (
                <img
                  src={company.career_logo_url}
                  alt=""
                  className="max-h-full max-w-full w-auto h-14 sm:h-28 object-contain"
                />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#094D7B] text-xl font-bold text-white sm:h-14 sm:w-14 sm:text-3xl lg:h-16 lg:w-16">
                  {company.company_name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-words">
                {company.company_name}
              </h2>
              {company.career_vision && (() => {
                const raw = (company.career_vision || '').slice(0, 400);
                const vision = raw + ((company.career_vision || '').length > 400 ? '…' : '');
                const parts = vision.split(/\s*•\s*/).map((s) => s.trim()).filter(Boolean);
                if (parts.length <= 1) {
                  return (
                    <p className="mt-1.5 sm:mt-2 text-gray-600 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                      {vision}
                    </p>
                  );
                }
                return (
                  <ul className="mt-1.5 sm:mt-2 text-gray-600 text-sm sm:text-base leading-relaxed list-disc list-inside space-y-0.5 sm:space-y-1">
                    {parts.map((part, i) => (
                      <li key={i} className="whitespace-pre-wrap break-words">{part}</li>
                    ))}
                  </ul>
                );
              })()}
            </div>
          </div>
          <Link
            to={`/careers/${companySlug}`}
            className="min-h-[44px] touch-manipulation inline-flex flex-shrink-0 items-center justify-center rounded-xl border border-[#094D7B]/15 bg-white px-4 py-3 text-sm font-medium text-[#094D7B] shadow-md transition-colors hover:text-[#094D7B]/90 active:bg-gray-100 sm:rounded-2xl sm:px-5 sm:py-3"
          >
            <span className="sm:hidden">Back</span>
            <span className="hidden sm:inline">Back to roles</span>
          </Link>
        </div>
      </header>

      <main className="w-full px-3 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 pb-24 sm:pb-6 lg:pb-8 space-y-4 sm:space-y-6">
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 break-words leading-tight">
            {jd.title || 'Untitled role'}
          </h1>
          <div className="pt-2">
            {jd.created_at && (
              <p className="text-sm text-gray-500 mb-2">
                Posted on {new Date(jd.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setSelectedFile(file);
                  setUploadError(null);
                  setUploadSuccess(false);
                }
                e.target.value = '';
              }}
              disabled={uploading}
            />
            <div className="hidden items-center gap-2 sm:flex">
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="min-h-[44px] touch-manipulation rounded-lg bg-[#094D7B] px-5 py-2.5 font-medium text-white hover:bg-[#094D7B]/90"
              >
                {selectedFile ? 'Change file' : 'Select file'}
              </Button>
              <Button
                type="button"
                onClick={() => selectedFile && handleUpload(selectedFile)}
                disabled={uploading || !selectedFile}
                className="min-h-[44px] touch-manipulation rounded-lg bg-[#094D7B] px-5 py-2.5 font-medium text-white hover:bg-[#094D7B]/90 disabled:opacity-60"
              >
                {uploading ? 'Submitting...' : 'Submit'}
              </Button>
            </div>
            {selectedFile && (
              <p className="mt-2 text-xs sm:text-sm text-gray-600">
                Selected file: <span className="font-medium">{selectedFile.name}</span>
              </p>
            )}
            <p className="mt-2 text-xs sm:text-sm text-gray-500">Supported formats: PDF, DOCX, or TXT.</p>
            {uploadSuccess && (
              <p className="mt-1 text-sm text-green-600">
                Uploaded successfully. We&apos;re processing your application and will be in touch if your profile matches.
              </p>
            )}
            {uploadError && <p className="mt-1 text-sm text-red-600">{uploadError}</p>}
          </div>
        </div>

        <Card className="w-full overflow-hidden">
          <CardHeader className="pb-2 px-3 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4 flex-shrink-0 text-[#094D7B] sm:h-5 sm:w-5" />
              <span>Job Description</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 sm:px-6 pb-4 sm:pb-6 w-full">
            <div className="min-h-0 w-full max-w-none overflow-x-auto break-words whitespace-pre-wrap rounded-lg border border-[#094D7B]/20 bg-[#094D7B]/5 p-3 text-base leading-relaxed text-gray-700 sm:rounded-md sm:p-6">
              {description ?? 'Loading...'}
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Fixed Apply bar for mobile only */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-3 bg-white border-t border-gray-200 sm:hidden">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="min-h-[48px] flex-1 touch-manipulation rounded-lg bg-[#094D7B] py-3 font-medium text-white hover:bg-[#094D7B]/90"
          >
            {selectedFile ? 'Change file' : 'Select file'}
          </Button>
          <Button
            type="button"
            onClick={() => selectedFile && handleUpload(selectedFile)}
            disabled={uploading || !selectedFile}
            className="min-h-[48px] flex-1 touch-manipulation rounded-lg bg-[#094D7B] py-3 font-medium text-white hover:bg-[#094D7B]/90 disabled:opacity-60"
          >
            {uploading ? 'Submitting...' : 'Submit'}
          </Button>
        </div>
      </div>

      <footer className="border-t mt-8 sm:mt-12 py-4 px-4 sm:px-6 lg:px-8 text-center text-xs text-gray-500">
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
          <Link to="/privacy" className="text-[#094D7B] hover:text-[#094D7B]/90">Privacy Policy</Link>
          <span>|</span>
          <Link to="/terms" className="text-[#094D7B] hover:text-[#094D7B]/90">Terms</Link>
          <span>|</span>
          <a href="mailto:sales@aitamate.com?subject=ProValuate%20Contact" className="text-[#094D7B] hover:text-[#094D7B]/90">Contact</a>
          <span>|</span>
          <span>Powered by ProValuate</span>
        </div>
      </footer>
    </div>
  );
}
