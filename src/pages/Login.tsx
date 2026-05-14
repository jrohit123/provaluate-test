import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { UserPlus, LogIn, Menu, Eye, EyeOff } from "lucide-react";
import { SessionManager } from '@/utils/sessionManager';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { hasTpoProfile } from '@/lib/authPortalQueries';

const PYTHON_API_BASE = import.meta.env.VITE_PYTHON_URL || 'https://devprovaluate_py.aitamate.com';

// Test credentials
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'testpassword123';

const Login = () => {
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
  const WELCOME_PHRASES = ['Welcome Back, Recruiter!'];
  const [welcomePhraseIndex, setWelcomePhraseIndex] = useState(0);
  const [welcomeCharIndex, setWelcomeCharIndex] = useState(0);
  const [welcomeDeleting, setWelcomeDeleting] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  // Remove useAuth import and usage, use Supabase directly

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // Extract domain from email for domain blocking check
      const domain = email.split('@')[1]?.toLowerCase();
      if (!domain) {
        throw new Error('Invalid email address format.');
      }

      // Temporarily disable domain blocking for testing
      // TODO: Re-enable domain blocking once database is properly configured
      /*
      const { data: blockedDomains, error: blockedDomainError } = await supabase
        .from('blocked_domains')
        .select('domain')
        .eq('domain', domain);

      if (blockedDomainError) {
        console.error('Error checking blocked domains:', blockedDomainError);
        // Continue with authentication if we can't check blocked domains (don't block due to system error)
      } else if (blockedDomains && blockedDomains.length > 0) {
        const blockedDomain = blockedDomains[0];
        throw new Error(`Access denied. Please use your official email ID to sign up.`);
      }
      */

      if (isSignup) {
        // Sign up with Supabase Auth
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast({
          title: "Confirmation Email Sent!",
          description: `An email has been sent to ${email}. Please confirm the email ID to proceed.`,
        });
        setIsSignup(false); // Switch to login view
        setEmail("");
        setPassword("");
        setIsLoading(false);
        return;
      } else {
        // Sign in with Supabase Auth
        console.log('🔐 Attempting login for:', email);
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          console.error('❌ Login error details:', {
            message: error.message,
            status: error.status,
            name: error.name,
            email: email,
          });
          
          // More specific error messages
          if (error.message?.includes('Invalid login credentials') || error.status === 400) {
            console.error('❌ This usually means:');
            console.error('   1. Email address is incorrect');
            console.error('   2. Password is incorrect');
            console.error('   3. Account does not exist');
            console.error('   4. Password was not set correctly');
            console.error('   5. Email not confirmed');
          }
          
          throw error;
        }
        
        if (!data.user) {
          console.error('❌ Login failed: No user data returned');
          throw new Error('Login failed: No user data returned');
        }

        console.log('✅ Login successful for user:', data.user.id, data.user.email);
        const { data: candidateRow } = await supabase.from('candidates').select('candidate_id').eq('auth_user_id', data.user.id).maybeSingle();
        const { data: userProfile } = await supabase.from('users').select('user_id').eq('user_id', data.user.id).maybeSingle();
        if (candidateRow && !userProfile) {
          await supabase.auth.signOut();
          toast({
            title: 'Candidate account',
            description: 'This is a candidate account. Please use the candidate login page.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
        if (!userProfile && (await hasTpoProfile(data.user.id))) {
          await supabase.auth.signOut();
          toast({
            title: 'TPO account',
            description: 'This is a TPO account. Please use the TPO login page.',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
        await completeLogin(data.user.id);
      }
    } catch (error: any) {
      toast({
        title: "Authentication Error",
        description: error.message || "An error occurred during authentication.",
        variant: "destructive",
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
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(resetEmail)) {
        throw new Error('Please enter a valid email address.');
      }

      // Get the current origin for the redirect URL (user=recruiter so ResetPassword redirects back to main login)
      const redirectTo = `${window.location.origin}/reset-password?user=recruiter`;
      
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: redirectTo,
      });
      
      if (error) {
        throw error;
      }
      
      setResetMessage('Password reset email sent! Please check your inbox and spam folder.');
      setResetEmail(''); // Clear the email field
    } catch (error: any) {
      setResetError(error.message || 'Failed to send password reset email.');
    }
    
    setResetLoading(false);
  };

  /**
   * Set a cookie with specified name, value, and expiration
   * @param name - Cookie name
   * @param value - Cookie value
   * @param days - Number of days until expiration (default: 30)
   */
  const setCookie = (name: string, value: string, days: number = 30) => {
    if (!value) return;

    const expires = new Date();
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000);

    const hostname = window.location.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

    const parts = [
      `${name}=${encodeURIComponent(value)}`,
      `expires=${expires.toUTCString()}`,
      'path=/'
    ];

    if (isLocalhost) {
      parts.push('SameSite=Lax');
    } else {
      parts.push('SameSite=None', 'Secure', `domain=${hostname}`);
    }

    const cookieString = parts.join('; ');
    document.cookie = cookieString;
    console.log(`🍪 Cookie set: ${name}`);
  };

  /**
   * Complete the login process by creating a session and navigating to dashboard
   * @param userId - The authenticated user ID
   */
  const completeLogin = async (userId: string) => {
    try {
      // Fetch user profile to get company_id
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .select('user_id, company_id, onboarding_complete')
        .eq('user_id', userId)
        .single();

      // If profile doesn't exist or onboarding not complete, redirect to onboarding
      if (profileError || !userProfile || !userProfile.onboarding_complete) {
        console.log('User profile not found or onboarding incomplete, redirecting to onboarding');
        toast({
          title: "Complete Your Setup",
          description: "Please complete your onboarding to continue.",
        });
        navigate('/onboarding');
        setIsLoading(false);
        return;
      }

      const companyId = userProfile.company_id;
      if (!companyId) {
        // If no company_id, user needs onboarding
        console.log('Company ID not found, redirecting to onboarding');
        navigate('/onboarding');
        setIsLoading(false);
        return;
      }

      // Set cookies for Chrome extension access
      const origin = window.location.origin;

      setCookie('provaluate_user_id', userId, 30);
      setCookie('provaluate_company_id', companyId, 30);
      setCookie('provaluate_api_base', PYTHON_API_BASE, 30);
      setCookie('provaluate_website_url', origin, 30);
      console.log(`✅ Cookies set for extension: user_id=${userId}, company_id=${companyId}`);

      localStorage.setItem('provaluate_user_id', userId);
      localStorage.setItem('provaluate_company_id', companyId);
      localStorage.setItem('provaluate_api_base', PYTHON_API_BASE);
      localStorage.setItem('provaluate_website_url', origin);

      // Create a new session first
      const sessionData = await SessionManager.createSession(userId);
      if (!sessionData) {
        throw new Error('Failed to create session');
      }

      // Wait a moment to ensure session is fully created, then end other sessions
      try {
        console.log(`🔄 About to end other sessions, keeping: ${sessionData.session_id}`);
        // Small delay to ensure session is fully committed to database
        await new Promise(resolve => setTimeout(resolve, 100));
        await SessionManager.endAllOtherSessions(userId, sessionData.session_id);
      } catch (error) {
        console.error('Error ending other sessions after login:', error);
      }

      // Set auth flag
      localStorage.setItem('recruitai_auth', 'true');
      
      // Clear any stale selections for a clean session on login
      localStorage.removeItem('cv-screening-session');
        try {
          sessionStorage.removeItem('selectedJDId');
          sessionStorage.removeItem('selectedCriteriaGridId');
          sessionStorage.removeItem('uploadedFiles');
          sessionStorage.removeItem('selectedCandidatesForInterview');
          // Broadcast session cleared so sections re-sync immediately
          window.dispatchEvent(new Event('session:cleared'));
        } catch (e) {
          // no-op
        }

      // If user came from Outlook add-in sign-in link, redirect to add-in Settings with user_id and company_id
      const searchParams = new URLSearchParams(window.location.search);
      const redirectTo = searchParams.get('redirect');
      if (redirectTo === 'outlook-add-in') {
        const origin = window.location.origin;
        const settingsUrl = `${origin}/outlook-add-in/settings.html?user_id=${encodeURIComponent(userId)}&company_id=${encodeURIComponent(companyId)}&api_base=${encodeURIComponent(PYTHON_API_BASE)}`;
        window.location.href = settingsUrl;
        setIsLoading(false);
        return;
      }

      // Show toast only on desktop
      if (!isMobile) {
        toast({
          title: "Welcome!",
          description: "You've been logged in successfully.",
        });
      }

      navigate('/dashboard?section=main-dashboard');
    } catch (error: any) {
      console.error('Error completing login:', error);
      toast({
        title: 'Login Error',
        description: error.message || 'Failed to complete login process.',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  const featureCards = [
    {
      title: 'Structured Evaluation',
      copy: 'Consistent, criteria-driven assessment-no more gut-feel or panel chaos.',
      className:
        'xl:absolute xl:left-0 xl:top-4 xl:z-20 xl:w-[46%] xl:animate-[cardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_0.15s_both]',
      tone: 'border-[rgba(4,44,83,0.18)] bg-[rgba(8,80,120,0.12)]',
      r: '-3deg',
    },
    {
      title: 'Risk Visibility',
      copy: 'See why Candidate A scored above B. Weighted parameters and clear risk-so you are not operating on intuition.',
      className:
        'xl:absolute xl:right-0 xl:top-10 xl:z-10 xl:w-[46%] xl:animate-[cardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_0.28s_both]',
      tone: 'border-[rgba(4,44,83,0.18)] bg-[rgba(8,80,120,0.12)]',
      r: '3deg',
    },
    {
      title: 'Built for Leadership Hiring',
      copy: 'Mid to senior hiring with the rigor it deserves. Same process, different stakes-handled right.',
      className:
        'xl:absolute xl:left-0 xl:top-[208px] xl:z-20 xl:w-[46%] xl:animate-[cardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_0.41s_both]',
      tone: 'border-[rgba(4,44,83,0.18)] bg-[rgba(8,80,120,0.12)]',
      r: '-2deg',
    },
    {
      title: 'Unified Talent Flow',
      copy: 'Bring applications from every channel into one structured, decision-ready evaluation journey.',
      className:
        'xl:absolute xl:right-0 xl:top-[250px] xl:z-20 xl:w-[46%] xl:animate-[cardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_0.54s_both]',
      tone: 'border-[rgba(4,44,83,0.18)] bg-[rgba(8,80,120,0.12)]',
      r: '2deg',
    },
  ];

  return (
    <div className="min-h-screen w-full bg-white">
      <style>{`
        @keyframes panelIn {
          from { opacity: 0; transform: translateY(12px) scale(0.995); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes floatOrb {
          0%, 100% { transform: translateY(0) scale(1); }
          50% { transform: translateY(-18px) scale(1.05); }
        }
        @keyframes cardIn {
          from { opacity: 0; transform: translateY(10px) rotate(var(--r, 0deg)) scale(0.95); }
          to { opacity: 1; transform: translateY(0) rotate(var(--r, 0deg)) scale(1); }
        }
        @keyframes heroIn {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <section className="flex min-h-screen w-full flex-col animate-[panelIn_0.45s_cubic-bezier(0.25,0.46,0.45,0.94)_both] overflow-hidden bg-white">
          <div className="grid flex-1 grid-cols-1 md:grid-cols-2">
            <div className="order-1 md:order-none relative flex flex-col bg-[linear-gradient(145deg,#F6FAFF_0%,#EEF6FF_55%,#FFFFFF_100%)] p-6 sm:p-8 lg:p-12">
              <header className="relative z-50 -mx-6 -mt-6 mb-6 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:-mx-8 sm:-mt-8 sm:px-8 sm:py-5 lg:-mx-12 lg:-mt-12 lg:px-12 lg:py-6">
                <div className="flex items-center justify-between gap-3 sm:gap-4">
                  <Link to="/">
                    <img
                      src={`${import.meta.env.BASE_URL}Logo_Transparent_BG.png`}
                      alt="ProValuate"
                      className="h-12 w-auto sm:h-14 lg:h-16 cursor-pointer hover:opacity-80 transition-opacity"
                    />
                  </Link>

                  {/* Mobile: slide-over sidebar menu */}
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
                        <Link
                          to="/pricing"
                          className="block rounded-lg px-3 py-2 text-base font-medium text-[#0d6ea3] hover:bg-slate-50 hover:text-[#042C53]"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Pricing
                        </Link>
                        <Link
                          to="/impact"
                          className="block rounded-lg px-3 py-2 text-base font-medium text-[#0d6ea3] hover:bg-slate-50 hover:text-[#042C53]"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Impact
                        </Link>
                        <div className="my-3 h-px bg-slate-200" />
                        <Link
                          to="/"
                          className="block rounded-lg px-3 py-2 text-base font-semibold text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          Choose sign-in role
                        </Link>
                      </div>
                    </SheetContent>
                  </Sheet>

                  {/* Desktop: inline nav */}
                  <nav className="hidden items-center gap-1 sm:flex">
                    <Link
                      to="/pricing"
                      className="px-2.5 py-1.5 text-sm font-medium text-[#0d6ea3] hover:text-[#042C53] transition-colors rounded-md hover:bg-slate-50 sm:text-base"
                    >
                      Pricing
                    </Link>
                    <Link
                      to="/impact"
                      className="px-2.5 py-1.5 text-sm font-medium text-[#0d6ea3] hover:text-[#042C53] transition-colors rounded-md hover:bg-slate-50 sm:text-base"
                    >
                      Impact
                    </Link>

                    <Link
                      to="/"
                      className="rounded-md px-2.5 py-1.5 text-sm font-medium text-[#0d6ea3] transition-colors hover:bg-slate-50 hover:text-[#042C53] sm:text-base"
                    >
                      Choose sign-in role
                    </Link>
                  </nav>
                </div>
              </header>

              <div className="relative z-0 mx-auto -mt-2 flex w-full max-w-[640px] flex-1 flex-col items-center justify-center py-6 sm:-mt-4 lg:-mt-8">
                <div className="mb-6 min-h-8 text-center text-xl font-semibold tracking-[-0.01em] text-[#042C53] sm:mb-10 sm:text-3xl">
                  {animatedWelcome}
                  <span className="ml-0.5 inline-block animate-pulse text-[#0d6ea3]">|</span>
                </div>
                <Card className="group relative w-full overflow-hidden border border-slate-100 bg-white/95 shadow-[0_18px_40px_rgba(15,23,42,0.08)] transition-shadow hover:shadow-[0_24px_52px_rgba(13,110,163,0.16)]">
                  <CardHeader className="space-y-2 px-5 pt-6 sm:px-8 sm:pt-9">
                    {isSignup && (
                      <div className="mb-3 flex items-center justify-center space-x-2 sm:mb-4">
                        <div className="rounded-lg bg-[#0d6ea3] p-2">
                          <UserPlus className="h-5 w-5 text-white" />
                        </div>
                        <CardTitle className="text-center text-xl sm:text-3xl">
                          Create a new Account
                        </CardTitle>
                      </div>
                    )}
                    <CardDescription className="text-center text-sm sm:text-lg">
                      {isSignup ? 'Welcome to ProValuate! Create your account' : 'Sign in to your ProValuate dashboard'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="px-5 pb-6 sm:px-8 sm:pb-9">
                    {!showReset ? (
                      <>
                        <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
                          <div className="space-y-2">
                            <Input
                              type="email"
                              placeholder="Business Email address"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                              className="h-11 border-[#b9d7ea] text-sm focus-visible:ring-[#0d6ea3]/30 sm:h-12 sm:text-lg"
                              disabled={isLoading}
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium text-slate-500">Password</span>
                              {!isSignup && (
                                <button
                                  type="button"
                                  className="text-sm text-[#0d6ea3] transition-colors hover:text-[#042C53]"
                                  onClick={() => setShowReset(true)}
                                  disabled={isLoading}
                                >
                                  Forgot your password?
                                </button>
                              )}
                            </div>
                            <div className="relative">
                              <Input
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                className="h-11 border-[#cfe2ef] pr-11 text-sm focus-visible:ring-[#0d6ea3]/30 sm:h-12 sm:text-lg"
                                disabled={isLoading}
                              />
                              <button
                                type="button"
                                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition-colors hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                                onClick={() => setShowPassword((prev) => !prev)}
                                disabled={isLoading}
                                aria-label={showPassword ? "Hide password" : "Show password"}
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                          <Button
                            type="submit"
                            className="h-11 w-full text-base text-white shadow-[0_4px_18px_rgba(13,110,163,0.28)] transition-shadow hover:shadow-[0_6px_22px_rgba(13,110,163,0.34)] [background:linear-gradient(135deg,#042C53,#0d6ea3)] hover:[background:linear-gradient(135deg,#053565,#0c7eb8)] sm:h-12 sm:text-lg"
                            disabled={isLoading}
                          >
                            {isLoading ? 'Please wait...' : isSignup ? 'Create Account' : 'Sign In'}
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
                        <Button type="submit" className="h-11 w-full bg-indigo-600 text-base hover:bg-indigo-700 sm:h-12 sm:text-lg" disabled={resetLoading}>
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
                        onClick={() => setIsSignup(!isSignup)}
                        className="text-sm text-[#0d6ea3] transition-colors hover:text-[#042C53]"
                        disabled={isLoading}
                      >
                        {isSignup ? 'Already registered? Sign in' : "Don't have an account? Register Now"}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="mt-auto pt-4">
                <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-muted-foreground sm:text-base">
                  <Link to="/privacy" className="font-medium text-[#0d6ea3] hover:text-[#042C53]">Privacy Policy</Link>
                  <span className="text-slate-300">•</span>
                  <Link to="/terms" className="font-medium text-[#0d6ea3] hover:text-[#042C53]">Terms</Link>
                  <span className="text-slate-300">•</span>
                  <a href="mailto:sales@aitamate.com?subject=ProValuate%20Contact" className="font-medium text-[#0d6ea3] hover:text-[#042C53]">Contact</a>
                </div>
              </div>
            </div>

            <div className="order-2 md:order-none relative overflow-hidden bg-[linear-gradient(145deg,#ccddf0_0%,#b0cde5_45%,#8fb8da_100%)] p-6 sm:p-8 lg:flex lg:flex-col lg:justify-center lg:p-10 xl:p-12">
              <div className="pointer-events-none absolute -left-16 -top-16 h-52 w-52 rounded-full bg-[rgba(4,44,83,0.16)] blur-2xl animate-[floatOrb_7s_ease-in-out_infinite]" />
              <div className="pointer-events-none absolute -bottom-12 -right-10 h-44 w-44 rounded-full bg-[rgba(13,110,163,0.15)] blur-2xl animate-[floatOrb_7s_ease-in-out_infinite] [animation-delay:-3.5s]" />

              <div className="relative z-10 mx-auto w-full max-w-[760px]">
                <h1 className="max-w-[720px] text-[2.05rem] font-semibold leading-[1.08] tracking-[-0.015em] text-[#042C53] opacity-0 animate-[heroIn_0.55s_cubic-bezier(0.25,0.46,0.45,0.94)_0.12s_forwards] sm:text-[2.3rem] lg:max-w-none lg:whitespace-nowrap lg:text-[2.65rem] xl:text-[2.9rem]">
                  Hiring-Risk Intelligence Platform
                </h1>
                <p className="mt-5 max-w-[660px] text-base leading-7 text-[#0d4060] opacity-0 animate-[heroIn_0.55s_cubic-bezier(0.25,0.46,0.45,0.94)_0.24s_forwards] sm:text-lg">
                  Eliminate bias with weighted parameters, clear risk visibility, and structured evaluation. Hire on intelligence, not intuition.
                </p>

                <div className="relative mt-7 grid grid-cols-1 gap-4 md:grid-cols-2 xl:h-[520px] xl:block">
                  {featureCards.map((card) => (
                    <div
                      key={card.title}
                      style={{ ['--r' as any]: card.r }}
                      className={`rounded-2xl border p-4 text-[#042C53] opacity-0 shadow-[0_4px_16px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.3)] backdrop-blur-md ${card.tone} animate-[cardIn_0.55s_cubic-bezier(0.34,1.56,0.64,1)_forwards] ${card.className}`}
                    >
                      <div className="text-xs font-medium tracking-[0.03em] text-[#1a5070] sm:text-[13px]">{card.title}</div>
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

export default Login;