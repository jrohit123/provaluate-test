import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { buildApiUrl } from '@/constants/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Briefcase, FileText, Search, X, Plus, Minus } from 'lucide-react';

const PAGE_SIZE = 5;

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

interface JdCardProps {
  jd: CareerJD;
  companySlug: string;
  isOpen: boolean;
  onToggle: () => void;
}

function formatPostedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

function JdCard({ jd, companySlug, isOpen, onToggle }: JdCardProps) {
  const [description, setDescription] = useState<string | null>(null);
  const [loadingDesc, setLoadingDesc] = useState(false);

  useEffect(() => {
    if (!isOpen || description !== null) return;
    setLoadingDesc(true);
    fetch(buildApiUrl(`/api/career/job_descriptions/${jd.jd_id}/original`))
      .then((res) => res.json())
      .then((json) => {
        if (json.status === 'success' && json.data) {
          setDescription(json.data.description || '');
        } else {
          setDescription('Could not load description.');
        }
      })
      .catch(() => setDescription('Could not load description.'))
      .finally(() => setLoadingDesc(false));
  }, [isOpen, jd.jd_id, description]);

  const postedDate = formatPostedDate(jd.created_at);

  return (
    <Card
      className={`group cursor-pointer transition-all duration-200 border-2 ${
        isOpen
          ? 'border-[#094D7B]/20 shadow-md shadow-[rgba(9,77,123,0.10)]'
          : 'border-gray-200 hover:border-[#094D7B]/20'
      }`}
      onClick={() => !isOpen && onToggle()}
    >
      {/* Collapsed header — always visible */}
      <div
        className="flex items-center gap-3 sm:gap-4 p-4 sm:p-5"
        onClick={() => isOpen && onToggle()}
        onKeyDown={(e) => e.key === 'Enter' && onToggle()}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
      >
        <div
          className={`flex-shrink-0 flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl transition-colors ${
            isOpen ? 'bg-[#094D7B]/15 text-[#094D7B]' : 'bg-gray-100 text-gray-600 group-hover:bg-[#094D7B]/5'
          }`}
        >
          <Briefcase className="h-5 w-5 sm:h-6 sm:w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h3
            className={`font-semibold text-base sm:text-lg break-words transition-colors ${
              isOpen ? 'text-[#094D7B]' : 'text-gray-900 hover:text-[#094D7B]'
            }`}
          >
            {jd.title || 'Untitled role'}
          </h3>
          {postedDate && (
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">Posted {postedDate}</p>
          )}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[#094D7B] text-white transition-colors hover:bg-[#094D7B]/90 sm:h-10 sm:w-10"
          aria-label={isOpen ? 'Collapse' : 'Expand'}
        >
          {isOpen ? <Minus className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
        </button>
      </div>

      {/* Expanded body — full-width JD thumbnail (smooth height transition) */}
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <CardContent className="pt-5 pb-5 sm:pb-6 px-4 sm:px-6" onClick={(e) => e.stopPropagation()}>
            <div className="space-y-4 w-full">
              <h4 className="flex items-center gap-2 text-sm font-medium text-gray-700">
                <FileText className="h-4 w-4 text-[#094D7B]" />
                Job description
              </h4>
              <div className="w-full whitespace-pre-wrap rounded-md border border-[#094D7B]/20 bg-[#094D7B]/5 p-3 text-sm text-gray-700 sm:p-4">
                {loadingDesc ? (
                  <div className="space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-4/5" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ) : description != null ? (
                  description.length > 400 ? `${description.slice(0, 400).trim()}...` : description
                ) : (
                  'Loading...'
                )}
              </div>
              <Link
                to={`/careers/${companySlug}/job/${jd.jd_id}`}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-[#094D7B] hover:text-[#094D7B]/90"
              >
                Read full job description and apply
              </Link>
            </div>
          </CardContent>
        </div>
      </div>
    </Card>
  );
}

export default function CompanyCareerPage() {
  const { companySlug } = useParams<{ companySlug: string }>();
  const [company, setCompany] = useState<CareerCompany | null>(null);
  const [jds, setJds] = useState<CareerJD[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedJdId, setExpandedJdId] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [query, setQuery] = useState('');

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
      } catch {
        setError('Failed to load career page.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [companySlug]);

  const keywords = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const filteredJds =
    keywords.length === 0
      ? jds
      : jds.filter((jd) => {
          const title = (jd.title || '').toLowerCase();
          return keywords.every((k) => title.includes(k));
        });

  const totalPages = Math.max(1, Math.ceil(filteredJds.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const pagedJds = filteredJds.slice(
    currentPage * PAGE_SIZE,
    currentPage * PAGE_SIZE + PAGE_SIZE
  );

  const handleSearch = (val: string) => {
    setQuery(val);
    setPage(0);
    setExpandedJdId(null);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    setExpandedJdId(null);
  };

  // Animated placeholder: typewriter effect cycling through phrases
  const PLACEHOLDER_PHRASES = ['Ready to explore ?', 'Search your dream role here'];
  const [placeholderPhraseIndex, setPlaceholderPhraseIndex] = useState(0);
  const [placeholderCharIndex, setPlaceholderCharIndex] = useState(0);
  const [placeholderDeleting, setPlaceholderDeleting] = useState(false);

  useEffect(() => {
    if (query.trim()) return;
    const phrase = PLACEHOLDER_PHRASES[placeholderPhraseIndex];
    const interval = setInterval(() => {
      if (placeholderDeleting) {
        if (placeholderCharIndex <= 0) {
          setPlaceholderDeleting(false);
          setPlaceholderPhraseIndex((i) => (i + 1) % PLACEHOLDER_PHRASES.length);
          setPlaceholderCharIndex(0);
        } else {
          setPlaceholderCharIndex((c) => c - 1);
        }
      } else {
        if (placeholderCharIndex >= phrase.length) {
          setPlaceholderDeleting(true);
        } else {
          setPlaceholderCharIndex((c) => c + 1);
        }
      }
    }, placeholderDeleting ? 70 : 140);
    return () => clearInterval(interval);
  }, [query, placeholderPhraseIndex, placeholderCharIndex, placeholderDeleting]);

  const animatedPlaceholder = query.trim() ? 'Search your dream role here' : PLACEHOLDER_PHRASES[placeholderPhraseIndex].slice(0, placeholderCharIndex);

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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero header */}
      <header className="relative overflow-hidden border-b border-[#094D7B]/15 bg-gradient-to-br from-[#094D7B]/5 via-[#094D7B]/5 to-[#094D7B]/12 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 translate-x-1/2 -translate-y-1/2 rounded-full bg-[#094D7B]/20 blur-3xl sm:h-96 sm:w-96" />
        <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 -translate-x-1/2 translate-y-1/2 rounded-full bg-[#094D7B]/25 blur-3xl sm:h-72 sm:w-72" />
        <div className="relative flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-6">
          {/* Logo — large and clearly visible */}
          <div className="flex-shrink-0">
            <div className="flex h-28 w-44 min-h-[100px] items-center justify-center rounded-2xl border border-[#094D7B]/15 bg-white p-4 shadow-md sm:h-36 sm:w-56 sm:p-5">
              {company.career_logo_url ? (
                <img
                  src={company.career_logo_url}
                  alt=""
                  className="max-h-full max-w-full w-auto h-20 sm:h-28 object-contain"
                />
              ) : (
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#094D7B] text-2xl font-bold text-white sm:h-16 sm:w-16 sm:text-3xl">
                  {company.company_name?.charAt(0)?.toUpperCase() || '?'}
                </span>
              )}
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">
              {company.company_name}
            </h1>
            {company.career_vision && (() => {
              const raw = (company.career_vision || '').slice(0, 400);
              const vision = raw + ((company.career_vision || '').length > 400 ? '…' : '');
              const parts = vision.split(/\s*•\s*/).map((s) => s.trim()).filter(Boolean);
              if (parts.length <= 1) {
                return (
                  <p className="mt-2 text-gray-600 text-sm sm:text-base leading-relaxed whitespace-pre-wrap">
                    {vision}
                  </p>
                );
              }
              return (
                <ul className="mt-2 text-gray-600 text-sm sm:text-base leading-relaxed list-disc list-inside space-y-1">
                  {parts.map((part, i) => (
                    <li key={i} className="whitespace-pre-wrap">{part}</li>
                  ))}
                </ul>
              );
            })()}
          </div>
          <div className="flex-shrink-0">
            <div className="rounded-2xl border border-[#094D7B]/15 bg-white px-4 py-3 text-center shadow-md sm:px-5 sm:py-4">
              <div className="text-2xl font-bold text-[#094D7B] sm:text-3xl">{jds.length}</div>
              <div className="text-xs uppercase tracking-wide text-gray-500 mt-0.5">Open Roles</div>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-4 sm:space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-900">
            Open positions
            <span className="text-gray-500 font-normal ml-1">
              ({filteredJds.length}
              {query.trim() ? ` of ${jds.length}` : ''})
            </span>
          </h2>
          {totalPages > 1 && (
            <span className="text-sm text-gray-500">Page {currentPage + 1} of {totalPages}</span>
          )}
        </div>

        {jds.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 py-12 px-4 flex flex-col items-center justify-center text-center">
            <Briefcase className="h-12 w-12 text-gray-300 mb-3" />
            <p className="text-gray-600 font-medium">No open positions at the moment. Check back soon.</p>
          </div>
        ) : (
          <>
            {/* Search bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder={animatedPlaceholder}
                value={query}
                onChange={(e) => handleSearch(e.target.value)}
                className="min-h-[48px] w-full rounded-lg border border-gray-200 bg-white py-3.5 pl-10 pr-10 text-sm placeholder:text-gray-400 transition-shadow focus:border-[#094D7B] focus:outline-none focus:ring-2 focus:ring-[#094D7B]/20 sm:text-base"
              />
              {query.trim() && (
                <button
                  type="button"
                  onClick={() => handleSearch('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                  aria-label="Clear search"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            {filteredJds.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-gray-50/50 py-12 px-4 flex flex-col items-center justify-center text-center">
                <span className="text-4xl mb-3" aria-hidden>🔍</span>
                <h3 className="text-lg font-semibold text-gray-800">No roles match &quot;{query}&quot;</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Try a different keyword — e.g. engineer, cloud, python
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => handleSearch('')}
                >
                  Clear search
                </Button>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {pagedJds.map((jd) => (
                    <div key={jd.jd_id} className="group">
                      <JdCard
                        jd={jd}
                        companySlug={companySlug!}
                        isOpen={expandedJdId === jd.jd_id}
                        onToggle={() =>
                          setExpandedJdId((prev) => (prev === jd.jd_id ? null : jd.jd_id))
                        }
                      />
                    </div>
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 0}
                      onClick={() => handlePageChange(currentPage - 1)}
                      className="disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Previous
                    </Button>
                    <div className="flex items-center gap-1.5">
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handlePageChange(i)}
                          className={`rounded-full transition-colors ${
                            i === currentPage
                              ? 'h-2.5 w-2.5 bg-[#094D7B] sm:h-3 sm:w-3'
                              : 'h-2.5 w-2.5 border-2 border-gray-300 hover:border-[#094D7B]/60 sm:h-3 sm:w-3'
                          }`}
                          aria-label={`Page ${i + 1}`}
                          aria-current={i === currentPage ? 'page' : undefined}
                        />
                      ))}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage >= totalPages - 1}
                      onClick={() => handlePageChange(currentPage + 1)}
                      className="disabled:opacity-50 disabled:pointer-events-none"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>

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
