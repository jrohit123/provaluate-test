import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users, Clock, CheckCircle, Shield, Mail, FileText, BarChart, UserPlus, LogIn, Menu } from "lucide-react";
import { SessionManager } from '@/utils/sessionManager';
import { useIsMobile } from '@/hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';

const PYTHON_API_BASE = import.meta.env.VITE_PYTHON_URL || 'https://devprovaluate_py.aitamate.com';

// Test credentials
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'testpassword123';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  // Remove useAuth import and usage, use Supabase directly

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
            title: 'Use candidate login',
            description: 'This account is a candidate account. Please sign in on the candidate login page.',
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

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header Section */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div>
              <img src="/Logo_Transparent_BG.png" alt="ProValuate" className="h-12 sm:h-16 lg:h-20" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 hidden sm:block"></h1>
            </div>
            <div className="flex items-center space-x-3 sm:space-x-6">
              <Link to="/candidate-login" className="hidden sm:inline-block text-sm sm:text-base text-gray-600 hover:text-gray-900 transition-colors">
                Candidate login
              </Link>
              {/* Desktop: Pricing & Impact visible */}
              <a href="/pricing" className="hidden sm:inline-block text-sm sm:text-base text-gray-600 hover:text-gray-900 transition-colors">
                Pricing
              </a>
              <a href="/impact" className="hidden sm:inline-block text-sm sm:text-base text-gray-600 hover:text-gray-900 transition-colors">
                Impact
              </a>
              {/* Mobile: hamburger menu with Pricing & Impact */}
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    className="sm:hidden p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 transition-colors"
                    aria-label="Open menu"
                  >
                    <Menu className="h-6 w-6" />
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-56">
                  <nav className="flex flex-col gap-4 pt-8">
                    <Link
                      to="/candidate-login"
                      className="text-base font-medium text-gray-700 hover:text-gray-900 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Candidate login
                    </Link>
                    <a
                      href="/pricing"
                      className="text-base font-medium text-gray-700 hover:text-gray-900 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Pricing
                    </a>
                    <a
                      href="/impact"
                      className="text-base font-medium text-gray-700 hover:text-gray-900 transition-colors"
                      onClick={() => setMobileMenuOpen(false)}
                    >
                      Impact
                    </a>
                  </nav>
                </SheetContent>
              </Sheet>
              <a href="mailto:sales@aitamate.com?&subject=Provaluate&body=Hi,%0D%0A%0D%0AI'm facing an issue with ProValuate.%0D%0A%0D%0APlease provide me with more information with the below...%0D%0A%0D%0ARegards," target="_top" className="text-indigo-600 hover:text-indigo-800 transition-colors">
                <Mail className="h-6 w-6 sm:h-8 sm:w-8" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-4">
            Hiring-Risk Intelligence Platform
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto px-4">
            Eliminate bias with weighted parameters, clear risk visibility, and structured evaluation. Hire on intelligence, not intuition.
          </p>
        </div>

        {/* Feature Cards Section */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <Card className="text-center border-0 shadow-lg">
            <CardContent className="pt-4 sm:pt-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full border-2 border-green-200 flex items-center justify-center">
                <Clock className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Structured Evaluation</h3>
              <p className="text-sm sm:text-base text-gray-600">Consistent, criteria-driven assessment—no more gut-feel or panel chaos.</p>
            </CardContent>
          </Card>

          <Card className="text-center border-0 shadow-lg">
            <CardContent className="pt-4 sm:pt-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full border-2 border-blue-200 flex items-center justify-center">
                <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Risk Visibility</h3>
              <p className="text-sm sm:text-base text-gray-600">See why Candidate A scored above B. Weighted parameters and clear risk—so you&apos;re not operating on intuition.</p>
            </CardContent>
          </Card>

          <Card className="text-center border-0 shadow-lg sm:col-span-2 lg:col-span-1">
            <CardContent className="pt-4 sm:pt-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full border-2 border-purple-200 flex items-center justify-center">
                <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Built for Leadership Hiring</h3>
              <p className="text-sm sm:text-base text-gray-600">Mid to senior hiring with the rigor it deserves. Same process, different stakes—handled right.</p>
            </CardContent>
          </Card>
        </div>

        {/* Login Section */}
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <Card className="shadow-lg border-0">
              <CardHeader className="space-y-1 px-4 sm:px-6 pt-4 sm:pt-6">
                <div className="flex items-center justify-center space-x-2 mb-3 sm:mb-4">
                  <div className="bg-indigo-600 p-2 rounded-lg">
                    {isSignup ? (
                      <UserPlus className="h-5 w-5 text-white" />
                    ) : (
                      <LogIn className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <CardTitle className="text-xl sm:text-2xl text-center">
                    {isSignup ? 'Create a new Account' : 'Welcome Back'}
                  </CardTitle>
                </div>
                <CardDescription className="text-center text-sm sm:text-base">
                  {isSignup 
                    ? 'Welcome to ProValuate! Create your account' 
                    : 'Enter your credentials to access your dashboard'
                  }
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                {!showReset ? (
                  <>
                    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                      <div className="space-y-2">
                        <Input
                          type="email"
                          placeholder="Business Email address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="h-10 sm:h-11 text-base"
                          disabled={isLoading}
                        />
                      </div>
                      <div className="space-y-2">
                        <Input
                          type="password"
                          placeholder="Password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          className="h-10 sm:h-11 text-base"
                          disabled={isLoading}
                        />
                      </div>
                      <Button 
                        type="submit" 
                        className="w-full h-10 sm:h-11 bg-indigo-600 hover:bg-indigo-700 text-base"
                        disabled={isLoading}
                      >
                        {isLoading 
                          ? 'Please wait...' 
                          : isSignup 
                            ? 'Create Account' 
                            : 'Sign In'
                        }
                      </Button>
                    </form>
                    <div className="mt-3 sm:mt-4 text-center">
                      <button
                        type="button"
                        className="text-indigo-600 underline text-xs sm:text-sm"
                        onClick={() => setShowReset(true)}
                        disabled={isLoading}
                      >
                        Forgot your password?
                      </button>
                    </div>
                  </>
                ) : (
                  <form onSubmit={handlePasswordReset} className="flex flex-col gap-2 sm:gap-3 mt-4">
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      className="h-10 sm:h-11 text-base"
                      disabled={resetLoading}
                    />
                    <Button type="submit" className="w-full h-10 sm:h-11 bg-indigo-600 hover:bg-indigo-700 text-base" disabled={resetLoading}>
                      {resetLoading ? 'Sending...' : 'Send Password Reset Email'}
                    </Button>
                    <button
                      type="button"
                      className="text-gray-600 underline text-xs sm:text-sm"
                      onClick={() => setShowReset(false)}
                      disabled={resetLoading}
                    >
                      Back to login
                    </button>
                    {resetMessage && <div className="text-green-600 text-xs sm:text-sm">{resetMessage}</div>}
                    {resetError && <div className="text-red-600 text-xs sm:text-sm">{resetError}</div>}
                  </form>
                )}
                <div className="mt-4 sm:mt-6 text-center">
                  <button
                    onClick={() => setIsSignup(!isSignup)}
                    className="text-indigo-600 hover:text-indigo-800 transition-colors text-xs sm:text-sm"
                    disabled={isLoading}
                  >
                    {isSignup 
                      ? 'Already registered? Sign in' 
                      : "Don't have an account? Register Now"
                    }
                  </button>
                </div>

                {/* Remove the test account credentials display at the bottom */}
              </CardContent>
            </Card>
            
            <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-600 px-4">
              <p>Structured evaluation from job description to interview. Built for mid to senior hiring.</p>
              <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row items-center justify-center space-y-2 sm:space-y-0 sm:space-x-2">
                <span className="text-gray-500">Powered by</span>
                <a 
                  href="https://aitamate.com/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 hover:opacity-80 transition-opacity"
                >
                  <img 
                    src="https://aitamate.com/Logo-transparent_bg.png" 
                    alt="aitamate" 
                    className="h-4 w-auto"
                  />
                  <span className="text-gray-600 font-medium">aitamate</span>
                </a>
              </div>
            </div>
          </div>
        </div>
        
        {/* Call to Action Section */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-500 py-4 sm:py-6 rounded-lg mx-4 sm:mx-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-2">
              Start hiring on intelligence—not intuition.
            </h3>
            <p className="text-base sm:text-lg text-white/95 max-w-2xl mx-auto">
              See why every candidate ranks the way they do. Weighted criteria, clear risk, and one place to run it all.
            </p>
          </div>
        </div>
      </main>

      {/* Statistics Cards Section */}
      <div className="bg-white py-8 sm:py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          <Card className="text-center border-0 shadow-lg">
              <CardContent className="pt-4 sm:pt-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full border-2 border-green-200 flex items-center justify-center">
                  <Users className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">2,500+</h3>
                <p className="text-sm sm:text-base text-gray-600">Resumes Processed</p>
              </CardContent>
            </Card>

            <Card className="text-center border-0 shadow-lg">
              <CardContent className="pt-4 sm:pt-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full border-2 border-blue-200 flex items-center justify-center">
                  <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">180+</h3>
                <p className="text-sm sm:text-base text-gray-600">Job Descriptions</p>
              </CardContent>
            </Card>

            <Card className="text-center border-0 shadow-lg sm:col-span-2 lg:col-span-1">
              <CardContent className="pt-4 sm:pt-6">
                <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full border-2 border-purple-200 flex items-center justify-center">
                  <BarChart className="h-6 w-6 sm:h-8 sm:w-8 text-purple-600" />
                </div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">50+</h3>
                <p className="text-sm sm:text-base text-gray-600">Companies Trust Us</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t py-4">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground">
          <Link to="/privacy" className="text-indigo-600 hover:text-indigo-800 font-medium">Privacy Policy</Link>
          <span className="hidden sm:inline">|</span>
          <Link to="/terms" className="text-indigo-600 hover:text-indigo-800 font-medium">Terms</Link>
          <span className="hidden sm:inline">|</span>
          <a href="mailto:sales@aitamate.com?subject=ProValuate%20Contact" className="text-indigo-600 hover:text-indigo-800">Contact</a>
        </div>
      </footer>
    </div>
  );
};

export default Login;