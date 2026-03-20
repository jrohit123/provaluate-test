import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { SessionManager } from '@/utils/sessionManager';
import { LogIn, User, ClipboardList, FileText, Mail, UserPlus } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';

const CandidateLogin = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const { candidateSignIn, candidateSignUp } = useAuthContext();

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
          title: 'Use recruiter login',
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

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-sky-50 to-sky-100 overflow-x-hidden">
      {/* Header Section - white like recruiter login */}
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Link to="/candidate-login" className="flex items-center space-x-2 min-h-[44px]">
                <img src="/Logo_Transparent_BG.png" alt="ProValuate" className="h-10 sm:h-16 lg:h-20 w-auto" />
              </Link>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link to="/candidate-pricing" className="min-h-[44px] flex items-center px-2 text-sm sm:text-base text-gray-600 hover:text-gray-900 transition-colors touch-manipulation">
                Pricing
              </Link>
              <Link to="/login" className="min-h-[44px] flex items-center px-2 text-sm sm:text-base text-gray-600 hover:text-gray-900 transition-colors touch-manipulation">
                Recruiter login
              </Link>
              <a href="mailto:sales@aitamate.com?&subject=Provaluate&body=Hi,%0D%0A%0D%0AI'm facing an issue with ProValuate.%0D%0A%0D%0APlease provide me with more information with the below...%0D%0A%0D%0ARegards," target="_top" className="min-h-[44px] min-w-[44px] flex items-center justify-center text-sky-600 hover:text-sky-800 transition-colors touch-manipulation" aria-label="Contact support">
                <Mail className="h-6 w-6 sm:h-8 sm:w-8" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900 mb-3 sm:mb-4 px-4">
            Your Interview & Profile Hub
          </h2>
          <p className="text-base sm:text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto px-4">
            {isSignup
              ? 'Create an account to build your profile and manage your interviews.'
              : 'Sign in to access your candidate profile, job descriptions, and interview results. Take interviews and view your reports in one place.'}
          </p>
        </div>

        {/* Feature Cards Section - candidate focused */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
          <Card className="text-center border-0 shadow-lg">
            <CardContent className="pt-4 sm:pt-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full border-2 border-green-200 flex items-center justify-center">
                <User className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Build Your Profile</h3>
              <p className="text-sm sm:text-base text-gray-600">Create and edit your profile with education, experience, and skills</p>
            </CardContent>
          </Card>

          <Card className="text-center border-0 shadow-lg">
            <CardContent className="pt-4 sm:pt-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full border-2 border-sky-200 flex items-center justify-center">
                <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8 text-sky-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">Track Your Interviews</h3>
              <p className="text-sm sm:text-base text-gray-600">See all your interviews and take new ones from a single dashboard</p>
            </CardContent>
          </Card>

          <Card className="text-center border-0 shadow-lg sm:col-span-2 lg:col-span-1">
            <CardContent className="pt-4 sm:pt-6">
              <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full border-2 border-sky-300 flex items-center justify-center">
                <FileText className="h-6 w-6 sm:h-8 sm:w-8 text-sky-600" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-2">View Your Reports</h3>
              <p className="text-sm sm:text-base text-gray-600">Access detailed feedback and personalised action plans after each interview</p>
            </CardContent>
          </Card>
        </div>

        {/* Login Section */}
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <Card className="shadow-lg border-0">
              <CardHeader className="space-y-1 px-4 sm:px-6 pt-4 sm:pt-6">
                <div className="flex items-center justify-center space-x-2 mb-3 sm:mb-4">
                  <div className="bg-sky-600 p-2 rounded-lg">
                    {isSignup ? (
                      <UserPlus className="h-5 w-5 text-white" />
                    ) : (
                      <LogIn className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <CardTitle className="text-xl sm:text-2xl text-center">
                    {isSignup ? 'Create candidate account' : 'Welcome Back'}
                  </CardTitle>
                </div>
                <CardDescription className="text-center text-sm sm:text-base">
                  {isSignup
                    ? 'Sign up to build your profile and manage your interviews'
                    : 'Enter your credentials to access your candidate dashboard'}
                </CardDescription>
              </CardHeader>
              <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
                {!showReset ? (
                  <>
                    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                      <div className="space-y-2">
                        <Input
                          type="email"
                          placeholder="Email address"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                          className="min-h-[44px] h-11 text-base touch-manipulation"
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
                          minLength={isSignup ? 6 : undefined}
                          className="min-h-[44px] h-11 text-base touch-manipulation"
                          disabled={isLoading}
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full min-h-[44px] h-11 bg-sky-600 hover:bg-sky-700 text-base touch-manipulation"
                        disabled={isLoading}
                      >
                        {isLoading
                          ? 'Please wait...'
                          : isSignup
                            ? 'Create account'
                            : 'Sign In'}
                      </Button>
                    </form>
                    {!isSignup && (
                      <div className="mt-3 sm:mt-4 text-center">
                        <button
                          type="button"
                          className="text-sky-600 hover:text-sky-800 underline text-xs sm:text-sm"
                          onClick={() => setShowReset(true)}
                          disabled={isLoading}
                        >
                          Forgot your password?
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <form onSubmit={handlePasswordReset} className="flex flex-col gap-2 sm:gap-3 mt-4">
                    <Input
                      type="email"
                      placeholder="Enter your email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      required
                      className="min-h-[44px] h-11 text-base touch-manipulation"
                      disabled={resetLoading}
                    />
                    <Button type="submit" className="w-full min-h-[44px] h-11 bg-sky-600 hover:bg-sky-700 text-base touch-manipulation" disabled={resetLoading}>
                      {resetLoading ? 'Sending...' : 'Send Password Reset Email'}
                    </Button>
                    <button
                      type="button"
                      className="text-gray-600 underline text-xs sm:text-sm min-h-[44px] flex items-center justify-center w-full sm:w-auto touch-manipulation"
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
                    type="button"
                    onClick={() => setIsSignup(!isSignup)}
                    className="text-sky-600 hover:text-sky-800 transition-colors text-xs sm:text-sm"
                    disabled={isLoading}
                  >
                    {isSignup
                      ? 'Already have an account? Sign in'
                      : "Don't have an account? Create account"}
                  </button>
                </div>
              </CardContent>
            </Card>

            <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-600 px-4">
              <p>Manage your profile, take AI interviews, and view your results</p>
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
        <div className="bg-gradient-to-r from-sky-600 to-sky-700 py-4 sm:py-6 rounded-lg mx-4 sm:mx-0 mt-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-white mb-1">
              Ready for your next interview?
            </h3>
            <p className="text-base sm:text-lg lg:text-xl text-white mb-3 sm:mb-4">
              Sign in to access your dashboard and view your latest results.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-sky-100 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-xs sm:text-sm text-muted-foreground">
          <Link to="/privacy" className="text-sky-600 hover:text-sky-800 font-medium">Privacy Policy</Link>
          <span className="hidden sm:inline">|</span>
          <Link to="/terms" className="text-sky-600 hover:text-sky-800 font-medium">Terms</Link>
          <span className="hidden sm:inline">|</span>
          <a href="mailto:sales@aitamate.com?subject=ProValuate%20Contact" className="text-sky-600 hover:text-sky-800">Contact</a>
        </div>
      </footer>
    </div>
  );
};

export default CandidateLogin;
