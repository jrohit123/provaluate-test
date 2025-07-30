import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';

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
  const navigate = useNavigate();
  const { toast } = useToast();
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

      // Check if domain is blocked before proceeding with authentication
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
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        localStorage.setItem('recruitai_auth', 'true');
        toast({
          title: "Welcome back!",
          description: "You've been logged in successfully.",
        });
        navigate('/dashboard');
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

      // Get the current origin for the redirect URL
      const redirectTo = `${window.location.origin}/reset-password`;
      
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">          
          <h1 className="text-3xl font-bold text-primary-800 mb-2"><img src="/logo.png" alt="ProValuate" className="w-24 h-24 mx-auto mb-2" />ProValuate</h1>
          <p className="text-muted-foreground">Smart Resume Evaluation Platform</p>
        </div>
        
        <Card className="shadow-lg border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {isSignup ? 'Create a new Account' : 'Welcome Back'}
            </CardTitle>
            <CardDescription className="text-center">
              {isSignup 
                ? 'Enter your details to create your account' 
                : 'Enter your credentials to access your dashboard'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!showReset ? (
              <>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Input
                      type="email"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-11"
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
                      className="h-11"
                      disabled={isLoading}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full h-11 bg-primary-800 hover:bg-primary-900"
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
                <div className="mt-2 text-center">
                  <button
                    type="button"
                    className="text-blue-600 underline text-sm"
                    onClick={() => setShowReset(true)}
                    disabled={isLoading}
                  >
                    Forgot your password?
                  </button>
                </div>
              </>
            ) : (
              <form onSubmit={handlePasswordReset} className="flex flex-col gap-2 mt-4">
                <Input
                  type="email"
                  placeholder="Enter your email"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                  className="h-11"
                  disabled={resetLoading}
                />
                <Button type="submit" className="w-full h-11 bg-primary-800 hover:bg-primary-900" disabled={resetLoading}>
                  {resetLoading ? 'Sending...' : 'Send Password Reset Email'}
                </Button>
                <button
                  type="button"
                  className="text-gray-600 underline text-sm"
                  onClick={() => setShowReset(false)}
                  disabled={resetLoading}
                >
                  Back to login
                </button>
                {resetMessage && <div className="text-green-600 text-sm">{resetMessage}</div>}
                {resetError && <div className="text-red-600 text-sm">{resetError}</div>}
              </form>
            )}
            <div className="mt-6 text-center">
              <button
                onClick={() => setIsSignup(!isSignup)}
                className="text-primary-600 hover:text-primary-800 transition-colors"
                disabled={isLoading}
              >
                {isSignup 
                  ? 'Already have an account? Sign in' 
                  : "Don't have an account? Sign up"
                }
              </button>
            </div>

            {/* Remove the test account credentials display at the bottom */}
          </CardContent>
        </Card>
        
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Powered by AI | Automated JD parsing and resume ranking engine based on customized selection criteria</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
