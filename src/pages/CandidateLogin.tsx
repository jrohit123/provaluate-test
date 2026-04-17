import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { SessionManager } from '@/utils/sessionManager';
import { ClipboardList, FileText, LogIn, Menu, User, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const CandidateLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const WELCOME_PHRASES = ['Welcome Back, Candidate!'];
  const [welcomePhraseIndex, setWelcomePhraseIndex] = useState(0);
  const [welcomeCharIndex, setWelcomeCharIndex] = useState(0);
  const [welcomeDeleting, setWelcomeDeleting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { candidateSignIn, candidateSignUp } = useAuthContext();

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

  const completeCandidateLogin = async (userId: string) => {
    const sessionData = await SessionManager.createSession(userId);
    if (!sessionData) throw new Error('Failed to create session');
    await new Promise((r) => setTimeout(r, 100));
    await SessionManager.endAllOtherSessions(userId, sessionData.session_id);
    localStorage.setItem('recruitai_auth', 'true');
    navigate('/candidate-dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isSignup) {
        const { error } = await candidateSignUp(email, password);
        if (error) throw new Error(error.message);
        toast({
          title: 'Confirmation email sent',
          description: `An email has been sent to ${email}. Please confirm your email, then sign in below.`,
        });
        setIsSignup(false);
        setEmail('');
        setPassword('');
        setIsLoading(false);
        return;
      }
      const { user, error, needsOnboarding } = await candidateSignIn(email, password);
      if (error) {
        toast({
          title: 'Wrong login page',
          description: error.message || 'Something went wrong.',
          variant: 'destructive',
        });
        return;
      }
      if (!user?.id) throw new Error('Login failed');
      if (needsOnboarding) {
        navigate('/candidate-onboarding');
        return;
      }
      await completeCandidateLogin(user.id);
      if (!isMobile) {
        toast({ title: 'Welcome back!', description: "You're logged in." });
      }
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
      const redirectTo = `${window.location.origin}/reset-password?user=candidate`;
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

  const featureCards = [
    {
      title: 'Build Your Profile',
      copy: 'Create and refine your profile with education, experience, and skills.',
      className: 'xl:absolute xl:left-0 xl:top-4 xl:z-20 xl:w-[46%] xl:animate-[cardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_0.15s_both]',
      tone: 'border-[rgba(10,58,90,0.18)] bg-[rgba(26,159,214,0.12)]',
      r: '-3deg',
    },
    {
      title: 'Track Your Interviews',
      copy: 'See upcoming interviews, attempt history, and progress in one dashboard.',
      className: 'xl:absolute xl:right-0 xl:top-10 xl:z-10 xl:w-[46%] xl:animate-[cardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_0.28s_both]',
      tone: 'border-[rgba(10,58,90,0.18)] bg-[rgba(37,99,235,0.10)]',
      r: '3deg',
    },
    {
      title: 'View Your Reports',
      copy: 'Get detailed feedback and personalised action plans after each interview.',
      className: 'xl:absolute xl:left-0 xl:top-[208px] xl:z-20 xl:w-[46%] xl:animate-[cardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_0.41s_both]',
      tone: 'border-[rgba(10,58,90,0.18)] bg-[rgba(26,159,214,0.10)]',
      r: '-2deg',
    },
    {
      title: 'Unified Talent Flow',
      copy: 'Bring applications from every channel into one structured, decision-ready journey.',
      className: 'xl:absolute xl:right-0 xl:top-[250px] xl:z-20 xl:w-[46%] xl:animate-[cardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_0.54s_both]',
      tone: 'border-[rgba(10,58,90,0.18)] bg-[rgba(37,99,235,0.10)]',
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
                <img src="/Logo_Transparent_BG.png" alt="ProValuate" className="h-12 w-auto sm:h-14 lg:h-16" />

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
                      <Link to="/candidate-pricing" className="block rounded-lg px-3 py-2 text-base font-medium text-[#1a9fd6] hover:bg-slate-50 hover:text-[#0a3a5a]" onClick={() => setMobileMenuOpen(false)}>
                        Pricing
                      </Link>
                      <Link to="/" className="block rounded-lg px-3 py-2 text-base text-slate-700 hover:bg-slate-50 hover:text-slate-900" onClick={() => setMobileMenuOpen(false)}>
                        Choose sign-in role
                      </Link>
                    </div>
                  </SheetContent>
                </Sheet>

                <nav className="hidden items-center gap-1 sm:flex">
                  <Link to="/candidate-pricing" className="px-2.5 py-1.5 text-sm font-medium text-[#1a9fd6] hover:text-[#0a3a5a] transition-colors rounded-md hover:bg-slate-50 sm:text-base">
                    Pricing
                  </Link>
                  <Link to="/" className="rounded-md px-2.5 py-1.5 text-sm font-medium text-[#1a9fd6] transition-colors hover:bg-slate-50 hover:text-[#0a3a5a] sm:text-base">
                    Choose sign-in role
                  </Link>
                </nav>
              </div>
            </header>

            <div className="relative z-0 mx-auto -mt-2 flex w-full max-w-[640px] flex-1 flex-col items-center justify-center py-6 sm:-mt-4 lg:-mt-8">
              <div className="mb-6 min-h-8 text-center text-xl font-semibold tracking-[-0.01em] text-[#0a3a5a] sm:mb-10 sm:text-3xl">
                {animatedWelcome}
                <span className="ml-0.5 inline-block animate-pulse text-[#1a9fd6]">|</span>
              </div>

              <Card className="group relative w-full overflow-hidden border border-slate-100 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_24px_52px_rgba(26,159,214,0.16)]">
                <CardHeader className="space-y-2 px-5 pt-6 sm:px-8 sm:pt-9">
                  {isSignup && (
                    <div className="mb-3 flex items-center justify-center space-x-2 sm:mb-4">
                      <div className="rounded-lg bg-[#1a9fd6] p-2">
                        <UserPlus className="h-5 w-5 text-white" />
                      </div>
                      <CardTitle className="text-center text-xl sm:text-3xl">
                        Create candidate account
                      </CardTitle>
                    </div>
                  )}
                  <CardDescription className="text-center text-sm sm:text-lg">
                    {isSignup
                      ? 'Sign up to build your profile and manage your interviews.'
                      : 'Sign in to your candidate dashboard.'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-5 pb-6 sm:px-8 sm:pb-9">
                  {!showReset ? (
                    <>
                      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                        <div className="space-y-2">
                          <Input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="h-11 border-[#b9d7ea] text-sm focus-visible:ring-[#1a9fd6]/30 sm:h-12 sm:text-lg"
                            disabled={isLoading}
                          />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-500">Password</span>
                            {!isSignup && (
                              <button
                                type="button"
                                className="text-sm text-[#1a9fd6] transition-colors hover:text-[#0a3a5a]"
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
                              className="h-11 border-[#cfe2ef] pr-11 text-sm focus-visible:ring-[#1a9fd6]/30 sm:h-12 sm:text-lg"
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
                          className="h-11 w-full text-base text-white shadow-[0_4px_18px_rgba(37,99,235,0.28)] transition-shadow hover:shadow-[0_6px_22px_rgba(37,99,235,0.34)] [background:linear-gradient(135deg,#1a9fd6,#2563eb)] hover:[background:linear-gradient(135deg,#1490c0,#1d4ed8)] sm:h-12 sm:text-lg"
                          disabled={isLoading}
                        >
                          {isLoading ? 'Please wait...' : isSignup ? 'Create account' : 'Sign in'}
                        </Button>
                      </form>
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
                      <Button type="submit" className="h-11 w-full bg-[#1a9fd6] text-base hover:bg-[#1490c0] sm:h-12 sm:text-lg" disabled={resetLoading}>
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
                  <div className="mt-4 text-center sm:mt-6">
                    <button
                      type="button"
                      onClick={() => setIsSignup(!isSignup)}
                      className="text-sm text-[#1a9fd6] transition-colors hover:text-[#0a3a5a]"
                      disabled={isLoading}
                    >
                      {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Create account"}
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="mt-auto pt-4">
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground sm:text-base">
                <Link to="/privacy" className="font-medium text-[#1a9fd6] hover:text-[#0a3a5a]">Privacy Policy</Link>
                <span className="text-slate-300">•</span>
                <Link to="/terms" className="font-medium text-[#1a9fd6] hover:text-[#0a3a5a]">Terms</Link>
                <span className="text-slate-300">•</span>
                <a href="mailto:sales@aitamate.com?subject=ProValuate%20Contact" className="font-medium text-[#1a9fd6] hover:text-[#0a3a5a]">Contact</a>
              </div>
            </div>
          </div>

          {/* RIGHT */}
          <div className="order-2 md:order-none relative overflow-hidden bg-[linear-gradient(145deg,#cceefa_0%,#a8e2f6_45%,#78ccee_100%)] p-6 sm:p-8 lg:flex lg:flex-col lg:justify-center lg:p-10 xl:p-12">
            <div className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-[rgba(26,159,214,0.20)] blur-2xl animate-[floatOrb_7s_ease-in-out_infinite]" />
            <div className="pointer-events-none absolute -bottom-12 -right-10 h-44 w-44 rounded-full bg-[rgba(37,99,235,0.14)] blur-2xl animate-[floatOrb_7s_ease-in-out_infinite] [animation-delay:-3.5s]" />

            <div className="relative z-10 mx-auto w-full max-w-[760px]">
              <h1 className="max-w-[720px] text-[2.05rem] font-semibold leading-[1.08] tracking-[-0.015em] text-[#0a3a5a] opacity-0 animate-[heroIn_0.55s_cubic-bezier(0.25,0.46,0.45,0.94)_0.12s_forwards] sm:text-[2.3rem] lg:max-w-none lg:whitespace-nowrap lg:text-[2.65rem] xl:text-[2.9rem]">
                Your Interview & Profile Hub
              </h1>
              <p className="mt-5 max-w-[660px] text-base leading-7 text-[#1a5070] opacity-0 animate-[heroIn_0.55s_cubic-bezier(0.25,0.46,0.45,0.94)_0.24s_forwards] sm:text-lg">
                AI-powered interviews, profile builder, and performance tracking — everything a serious candidate needs.
              </p>

              <div className="relative mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:h-[520px] xl:block">
                {featureCards.map((card) => (
                  <div
                    key={card.title}
                    style={{ ['--r' as any]: card.r }}
                    className={`rounded-2xl border p-4 text-[#0a3a5a] opacity-0 shadow-[0_4px_16px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-md ${card.tone} animate-[cardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_forwards] ${card.className}`}
                  >
                    <div className="text-xs font-medium tracking-[0.03em] text-[#1a6090] sm:text-[13px]">{card.title}</div>
                    <div className="mt-2 text-sm font-semibold leading-6 sm:text-base">{card.copy}</div>
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

export default CandidateLogin;
