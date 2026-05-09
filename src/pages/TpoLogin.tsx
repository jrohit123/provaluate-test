import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { API_CONFIG, buildApiUrl } from '@/constants/api';
import { LogIn, Menu, UserPlus, Eye, EyeOff } from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

type TpoMeResponse = {
  requires_onboarding: boolean;
  domain_allowed?: boolean;
  message?: string;
  college?: { id: string; college_name: string; college_code: string };
  admin_taken?: boolean;
  available_roles?: string[];
  default_role?: string;
  tpo_user?: {
    id: string;
    full_name: string;
    role: 'tpo_admin' | 'tpo_staff';
    college: { id: string; college_name: string; college_code: string };
  };
};

const TpoLogin = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const WELCOME_PHRASES = ['Welcome to the TPO Portal'];
  const [welcomePhraseIndex, setWelcomePhraseIndex] = useState(0);
  const [welcomeCharIndex, setWelcomeCharIndex] = useState(0);
  const [welcomeDeleting, setWelcomeDeleting] = useState(false);

  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [selectedRole, setSelectedRole] = useState<'tpo_admin' | 'tpo_staff'>('tpo_staff');
  const [availableRoles, setAvailableRoles] = useState<Array<'tpo_admin' | 'tpo_staff'>>(['tpo_staff']);
  const [collegeName, setCollegeName] = useState('');

  const roleOptions = useMemo(() => {
    return availableRoles.map((r) => ({
      value: r,
      label: r === 'tpo_admin' ? 'TPO Admin' : 'TPO Staff',
    }));
  }, [availableRoles]);

  useEffect(() => {
    const phrase = WELCOME_PHRASES[welcomePhraseIndex];
    const interval = setInterval(() => {
      if (welcomeDeleting) {
        if (welcomeCharIndex <= 0) {
          setWelcomeDeleting(false);
          setWelcomePhraseIndex((i) => (i + 1) % WELCOME_PHRASES.length);
          setWelcomeCharIndex(0);
        } else {
          setWelcomeCharIndex((c) => c - 1);
        }
      } else if (welcomeCharIndex >= phrase.length) {
        setWelcomeDeleting(true);
      } else {
        setWelcomeCharIndex((c) => c + 1);
      }
    }, welcomeDeleting ? 70 : 120);
    return () => clearInterval(interval);
  }, [welcomePhraseIndex, welcomeCharIndex, welcomeDeleting]);

  const animatedWelcome = WELCOME_PHRASES[welcomePhraseIndex].slice(0, welcomeCharIndex);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
  };

  const loadTpoProfile = async () => {
    const headers = await getAuthHeaders();
    const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_ME), {
      method: 'GET',
      headers,
    });
    const data = (await res.json().catch(() => ({}))) as TpoMeResponse;
    if (!res.ok) {
      throw new Error((data as { error?: string })?.error || 'Failed to load TPO profile.');
    }

    if (data.requires_onboarding) {
      if (data.domain_allowed === false) {
        await supabase.auth.signOut();
        throw new Error(data.message || 'TPO access is not enabled for this email domain.');
      }
      const roles = (data.available_roles || ['tpo_staff']) as Array<'tpo_admin' | 'tpo_staff'>;
      setAvailableRoles(roles);
      setSelectedRole((data.default_role as 'tpo_admin' | 'tpo_staff') || roles[0] || 'tpo_staff');
      setCollegeName(data.college?.college_name || '');
      setNeedsOnboarding(true);
      return;
    }

    navigate('/tpo-dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isSignup) {
        const emailRedirectTo = `${window.location.origin}/tpo-login`;
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo },
        });
        if (error) throw error;
        toast({
          title: 'Confirmation email sent',
          description: `An email has been sent to ${email}. Please confirm your email, then sign in.`,
        });
        setIsSignup(false);
        setEmail('');
        setPassword('');
        return;
      }

      const { data: signData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const uid = signData.user?.id;
      if (!uid) throw new Error('Login failed: no user returned.');
      const { data: recruiterRow } = await supabase.from('users').select('user_id').eq('user_id', uid).maybeSingle();
      if (recruiterRow) {
        await supabase.auth.signOut();
        throw new Error('This account is a recruiter account. Please use the recruiter login page.');
      }
      const { data: candidateRow } = await supabase.from('candidates').select('candidate_id').eq('auth_user_id', uid).maybeSingle();
      if (candidateRow) {
        await supabase.auth.signOut();
        throw new Error('This account is a candidate account. Please use the candidate login page.');
      }
      await loadTpoProfile();
    } catch (err: unknown) {
      toast({
        title: isSignup ? 'Sign up error' : 'Login error',
        description: err instanceof Error ? err.message : 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteOnboarding = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (!firstName.trim()) {
        throw new Error('First name is required.');
      }
      const headers = await getAuthHeaders();
      const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.TPO_ONBOARDING_COMPLETE), {
        method: 'POST',
        headers,
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          role: selectedRole,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as { error?: string })?.error || 'Failed to complete onboarding.');
      }
      toast({
        title: 'Welcome to TPO dashboard',
        description: 'Your TPO profile is ready.',
      });
      navigate('/tpo-dashboard');
    } catch (err: unknown) {
      toast({
        title: 'Onboarding error',
        description: err instanceof Error ? err.message : 'Could not complete onboarding.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage('');
    setResetError('');
    setResetLoading(true);
    try {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(resetEmail)) {
        throw new Error('Please enter a valid email address.');
      }
      const redirectTo = `${window.location.origin}/reset-password?user=tpo`;
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo,
      });
      if (error) throw error;
      setResetMessage('Password reset email sent! Please check your inbox and spam folder.');
      setResetEmail('');
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Failed to send password reset email.');
    } finally {
      setResetLoading(false);
    }
  };

  if (needsOnboarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 to-sky-100 p-3 sm:p-4 overflow-x-hidden">
        <Card className="w-full max-w-2xl shadow-lg border-0 mx-2">
          <CardHeader className="px-4 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-xl sm:text-2xl font-bold text-gray-900">Complete your TPO profile</CardTitle>
            <CardDescription>
              {collegeName
                ? `Your email matches ${collegeName}. Complete details to continue.`
                : 'Complete details to continue.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <form onSubmit={handleCompleteOnboarding} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First name</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  required
                  className="min-h-[44px] h-11 text-base touch-manipulation"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last name</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="min-h-[44px] h-11 text-base touch-manipulation"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role">Role</Label>
                <select
                  id="role"
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as 'tpo_admin' | 'tpo_staff')}
                  disabled={isLoading}
                  className="w-full min-h-[44px] h-11 rounded-md border border-input bg-background px-3 text-base touch-manipulation"
                >
                  {roleOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                {availableRoles.length === 1 && availableRoles[0] === 'tpo_staff' && (
                  <p className="text-xs text-gray-500">TPO Admin is already assigned for this college.</p>
                )}
              </div>
              <Button type="submit" className="w-full min-h-[44px] h-11 text-base bg-indigo-600 hover:bg-indigo-700 touch-manipulation" disabled={isLoading}>
                {isLoading ? 'Please wait...' : 'Continue to dashboard'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  const featureCards = [
    {
      title: 'College Scoped Access',
      copy: 'TPO users manage interviews only for their mapped college.',
      className: 'xl:absolute xl:left-0 xl:top-4 xl:z-20 xl:w-[46%] xl:animate-[cardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_0.15s_both]',
      tone: 'border-[rgba(4,44,83,0.18)] bg-[rgba(129,140,248,0.14)]',
      r: '-3deg',
    },
    {
      title: 'Campus Interview Setup',
      copy: 'Configure role-wise interviews and assign them to college courses.',
      className: 'xl:absolute xl:right-0 xl:top-10 xl:z-10 xl:w-[46%] xl:animate-[cardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_0.28s_both]',
      tone: 'border-[rgba(4,44,83,0.18)] bg-[rgba(147,197,253,0.18)]',
      r: '3deg',
    },
    {
      title: 'Unified Student Analytics',
      copy: 'Track attempts, outcomes, and engagement with structured insights.',
      className: 'xl:absolute xl:left-0 xl:top-[208px] xl:z-20 xl:w-[46%] xl:animate-[cardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_0.41s_both]',
      tone: 'border-[rgba(4,44,83,0.18)] bg-[rgba(59,130,246,0.12)]',
      r: '-2deg',
    },
    {
      title: 'Unified Talent Flow',
      copy: 'Bring applications from every channel into one structured, decision-ready journey.',
      className: 'xl:absolute xl:right-0 xl:top-[250px] xl:z-20 xl:w-[46%] xl:animate-[cardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_0.54s_both]',
      tone: 'border-[rgba(4,44,83,0.18)] bg-[rgba(199,210,254,0.22)]',
      r: '2deg',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-white">
      <style>{`
        @keyframes panelIn { from { opacity: 0; transform: translateY(12px) scale(0.995); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes floatOrb { 0%,100% { transform: translateY(0) scale(1); } 50% { transform: translateY(-18px) scale(1.05); } }
        @keyframes cardIn { from { opacity: 0; transform: translateY(10px) rotate(var(--r, 0deg)) scale(0.95); } to { opacity: 1; transform: translateY(0) rotate(var(--r, 0deg)) scale(1); } }
        @keyframes heroIn { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <section className="flex min-h-screen w-full flex-col animate-[panelIn_0.45s_cubic-bezier(0.25,0.46,0.45,0.94)_both] overflow-hidden bg-white">
        <div className="grid flex-1 grid-cols-1 md:grid-cols-2">
          {/* LEFT */}
          <div className="order-1 md:order-none relative flex flex-col bg-[linear-gradient(145deg,#F6FAFF_0%,#EEF6FF_55%,#FFFFFF_100%)] p-6 sm:p-8 lg:p-12">
            <header className="relative z-50 -mx-6 -mt-6 mb-6 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:-mt-8 sm:px-8 sm:py-5 lg:-mx-12 lg:-mt-12 lg:px-12 lg:py-6">
              <div className="flex items-center justify-between gap-3 sm:gap-4">
                <Link to="/">
                  <img src="/Logo_Transparent_BG.png" alt="ProValuate" className="h-12 w-auto sm:h-14 lg:h-16 cursor-pointer hover:opacity-80 transition-opacity" />
                </Link>

                <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                  <SheetTrigger asChild>
                    <button
                      type="button"
                      className="sm:hidden inline-flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      aria-label="Open menu"
                    >
                      <Menu className="h-5 w-5" />
                    </button>
                  </SheetTrigger>
                  <SheetContent side="right" className="w-64">
                    <div className="pt-8 space-y-2">
                      <Link to="/" className="block rounded-lg px-3 py-2 text-base text-slate-700 hover:bg-slate-50 hover:text-slate-900" onClick={() => setMobileMenuOpen(false)}>
                        Choose sign-in role
                      </Link>
                    </div>
                  </SheetContent>
                </Sheet>

                <nav className="hidden items-center gap-1 sm:flex">
                  <Link to="/" className="rounded-md px-2.5 py-1.5 text-sm font-medium text-[#042C53] transition-colors hover:bg-slate-50 hover:text-[#020f1a] sm:text-base">
                    Choose sign-in role
                  </Link>
                </nav>
              </div>
            </header>

            <div className="relative z-0 mx-auto -mt-2 flex w-full max-w-[640px] flex-1 flex-col items-center justify-center py-6 sm:-mt-4 lg:-mt-8">
              <div className="mb-6 min-h-8 text-center text-xl font-semibold tracking-[-0.01em] text-[#020f1a] sm:mb-10 sm:text-3xl">
                {animatedWelcome}
                <span className="ml-0.5 inline-block animate-pulse text-[#0d6ea3]">|</span>
              </div>

              <Card className="group relative w-full overflow-hidden border border-slate-100 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_24px_52px_rgba(4,44,83,0.16)]">
                <CardHeader className="space-y-2 px-5 pt-6 sm:px-8 sm:pt-9">
                  {isSignup && (
                    <div className="mb-3 flex items-center justify-center space-x-2 sm:mb-4">
                      <div className="rounded-lg bg-[#042C53] p-2">
                        <UserPlus className="h-5 w-5 text-white" />
                      </div>
                      <CardTitle className="text-center text-xl sm:text-3xl">
                        Create TPO account
                      </CardTitle>
                    </div>
                  )}
                  <CardDescription className="text-center text-sm sm:text-lg">
                    {isSignup ? 'Sign up using your approved TPO email.' : 'Sign in to access your TPO dashboard.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-5 pb-6 sm:px-8 sm:pb-9">
                  {!showReset ? (
                    <>
                      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                        <div className="space-y-2">
                          <Input
                            type="email"
                            placeholder="Work email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="h-11 border-[#b9d7ea] text-sm focus-visible:ring-[#042C53]/30 sm:h-12 sm:text-lg"
                            disabled={isLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-500">Password</span>
                            {!isSignup && (
                              <button
                                type="button"
                                className="text-sm text-[#042C53] transition-colors hover:text-[#020f1a]"
                                onClick={() => setShowReset(true)}
                                disabled={isLoading}
                              >
                                Forgot your password?
                              </button>
                            )}
                          </div>
                          <div className="relative">
                            <Input
                              type={showPassword ? 'text' : 'password'}
                              placeholder="Password"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                              minLength={isSignup ? 6 : undefined}
                              className="h-11 border-[#cfe2ef] pr-11 text-sm focus-visible:ring-[#042C53]/30 sm:h-12 sm:text-lg"
                              disabled={isLoading}
                            />
                            <button
                              type="button"
                              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition-colors hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                              onClick={() => setShowPassword((prev) => !prev)}
                              disabled={isLoading}
                              aria-label={showPassword ? 'Hide password' : 'Show password'}
                            >
                              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </button>
                          </div>
                        </div>
                        <Button
                          type="submit"
                          className="h-11 w-full text-base text-white shadow-[0_4px_18px_rgba(4,44,83,0.30)] transition-shadow hover:shadow-[0_6px_22px_rgba(4,44,83,0.35)] [background:linear-gradient(135deg,#020f1a,#042C53)] hover:[background:linear-gradient(135deg,#031525,#053565)] sm:h-12 sm:text-lg"
                          disabled={isLoading}
                        >
                          {isLoading ? 'Please wait...' : isSignup ? 'Create account' : 'Sign in'}
                        </Button>
                      </form>

                      <div className="mt-4 text-center sm:mt-6">
                        <button
                          type="button"
                          onClick={() => setIsSignup(!isSignup)}
                          className="text-sm text-[#042C53] transition-colors hover:text-[#020f1a]"
                          disabled={isLoading}
                        >
                          {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Create account"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <form onSubmit={handlePasswordReset} className="mt-4 flex flex-col gap-2 sm:gap-3">
                      <Input
                        type="email"
                        placeholder="Enter your email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        required
                        className="h-11 text-sm sm:h-12 sm:text-lg"
                        disabled={resetLoading}
                      />
                      <Button
                        type="submit"
                        className="h-11 w-full text-base text-white shadow-[0_4px_18px_rgba(4,44,83,0.30)] transition-shadow hover:shadow-[0_6px_22px_rgba(4,44,83,0.35)] [background:linear-gradient(135deg,#020f1a,#042C53)] hover:[background:linear-gradient(135deg,#031525,#053565)] sm:h-12 sm:text-lg"
                        disabled={resetLoading}
                      >
                        {resetLoading ? 'Sending...' : 'Send Password Reset Email'}
                      </Button>
                      <button
                        type="button"
                        className="text-sm text-gray-600 underline"
                        onClick={() => setShowReset(false)}
                        disabled={resetLoading}
                      >
                        Back to login
                      </button>
                      {resetMessage && <div className="text-sm text-green-600">{resetMessage}</div>}
                      {resetError && <div className="text-sm text-red-600">{resetError}</div>}
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>

            <div className="mt-auto pt-4">
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground sm:text-base">
                <Link to="/privacy" className="font-medium text-[#042C53] hover:text-[#020f1a]">Privacy Policy</Link>
                <span className="text-slate-300">•</span>
                <Link to="/terms" className="font-medium text-[#042C53] hover:text-[#020f1a]">Terms</Link>
                <span className="text-slate-300">•</span>
                <a href="mailto:sales@aitamate.com?subject=ProValuate%20Contact" className="font-medium text-[#042C53] hover:text-[#020f1a]">Contact</a>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="order-2 md:order-none relative overflow-hidden bg-[linear-gradient(145deg,#EEF2FF_0%,#DCE7FF_42%,#BFD7FF_100%)] p-6 sm:p-8 lg:flex lg:flex-col lg:justify-center lg:p-10 xl:p-12">
            <div className="pointer-events-none absolute -left-16 -top-16 h-60 w-60 rounded-full bg-[rgba(129,140,248,0.22)] blur-2xl animate-[floatOrb_7s_ease-in-out_infinite]" />
            <div className="pointer-events-none absolute -bottom-12 -right-10 h-52 w-52 rounded-full bg-[rgba(59,130,246,0.18)] blur-2xl animate-[floatOrb_7s_ease-in-out_infinite] [animation-delay:-3.5s]" />

            <div className="relative z-10 mx-auto w-full max-w-[760px]">
              <h1 className="max-w-[720px] text-[2.05rem] font-semibold leading-[1.08] tracking-[-0.015em] text-[#020f1a] opacity-0 animate-[heroIn_0.55s_cubic-bezier(0.25,0.46,0.45,0.94)_0.12s_forwards] sm:text-[2.3rem] lg:max-w-none lg:whitespace-nowrap lg:text-[2.65rem] xl:text-[2.9rem]">
                Campus Interview Portal
              </h1>
              <p className="mt-5 max-w-[660px] text-base leading-7 text-[#1a3a50] opacity-0 animate-[heroIn_0.55s_cubic-bezier(0.25,0.46,0.45,0.94)_0.24s_forwards] sm:text-lg">
                Campus placement, structured & scalable — manage drives, assign interviews, and monitor student outcomes in one place.
              </p>

              <div className="relative mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:h-[520px] xl:block">
                {featureCards.map((card) => (
                  <div
                    key={card.title}
                    style={{ ['--r' as any]: card.r }}
                    className={`rounded-2xl border p-4 text-[#020f1a] opacity-0 shadow-[0_4px_16px_rgba(0,0,0,0.10),inset_0_1px_0_rgba(255,255,255,0.32)] backdrop-blur-md ${card.tone} animate-[cardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_forwards] ${card.className}`}
                  >
                    <div className="text-xs font-medium tracking-[0.03em] text-[#28445a] sm:text-[13px]">{card.title}</div>
                    <div className="mt-2 text-sm font-semibold leading-6 text-[#020f1a] sm:text-base">{card.copy}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default TpoLogin;
