import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Users, Clock, CheckCircle, Shield, Mail, FileText, BarChart, UserPlus, LogIn } from "lucide-react";

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
        navigate('/dashboard?section=main-dashboard');
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
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header Section */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div>
                <img src="/logo.png" alt="ProValuate" className="h-8 w-8" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">ProValuate</h1>
            </div>
            <div className="text-right">
              <a href="mailto:rj@aitamate.com?&subject=Provaluate&body=Hi,%0D%0A%0D%0AI'm facing an issue with ProValuate.%0D%0A%0D%0APlease provide me with more information with the below...%0D%0A%0D%0ARegards," target="_top" className="text-indigo-600 hover:text-indigo-800 transition-colors">
                <Mail className="h-8 w-8" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            AI-Powered Resume Assessment & Ranking
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Upload job descriptions and resumes to get intelligent candidate rankings based on your custom criteria. Save time, improve accuracy, and make better hiring decisions.
          </p>
        </div>

        {/* Feature Cards Section */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card className="text-center border-0 shadow-lg">
            <CardContent className="pt-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-green-200 flex items-center justify-center">
                <Clock className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">70% Time Saved</h3>
              <p className="text-gray-600">Automated resume screening and ranking eliminates hours of manual review</p>
            </CardContent>
          </Card>

          <Card className="text-center border-0 shadow-lg">
            <CardContent className="pt-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-blue-200 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-blue-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">98% Accuracy</h3>
              <p className="text-gray-600">AI-powered assessment ensures consistent and objective candidate evaluation</p>
            </CardContent>
          </Card>

          <Card className="text-center border-0 shadow-lg">
            <CardContent className="pt-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-purple-200 flex items-center justify-center">
                <Shield className="h-8 w-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Enterprise Ready</h3>
              <p className="text-gray-600">Secure, scalable, and compliant with enterprise-grade security standards</p>
            </CardContent>
          </Card>
        </div>
        
        {/* Call to Action Section */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-500 py-6 rounded-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h3 className="text-3xl font-bold text-white mb-1">
              ⚡ 30-Day Free Trial
            </h3>
            <p className="text-xl text-white mb-4">
              Start assessing candidates today - no credit card required!
            </p>
            <div className="flex items-center justify-center text-white">
              <span className="text-lg">⭐ Join 50+ companies already using ProValuate</span>
            </div>
          </div>
        </div><br></br>    

        {/* Login Section */}
        <div className="flex justify-center">
          <div className="w-full max-w-md">
            <Card className="shadow-lg border-0">
              <CardHeader className="space-y-1">
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <div className="bg-indigo-600 p-2 rounded-lg">
                    {isSignup ? (
                      <UserPlus className="h-5 w-5 text-white" />
                    ) : (
                      <LogIn className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <CardTitle className="text-2xl text-center">
                    {isSignup ? 'Create a new Account' : 'Welcome Back'}
                  </CardTitle>
                </div>
                <CardDescription className="text-center">
                  {isSignup 
                    ? 'Welcome to ProValuate! Create your account' 
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
                          placeholder="Business Email address"
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
                        className="w-full h-11 bg-indigo-600 hover:bg-indigo-700"
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
                        className="text-indigo-600 underline text-sm"
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
                    <Button type="submit" className="w-full h-11 bg-indigo-600 hover:bg-indigo-700" disabled={resetLoading}>
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
                    className="text-indigo-600 hover:text-indigo-800 transition-colors"
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
            
            <div className="mt-8 text-center text-sm text-gray-600">
              <p>Powered by AI | Automated JD parsing and resume ranking engine based on customized selection criteria</p>
            </div>
          </div>
        </div>
      </main>

      {/* Statistics Cards Section */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-6">
          <Card className="text-center border-0 shadow-lg">
              <CardContent className="pt-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-green-200 flex items-center justify-center">
                  <Users className="h-8 w-8 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">2,500+</h3>
                <p className="text-gray-600">Resumes Processed</p>
              </CardContent>
            </Card>

            <Card className="text-center border-0 shadow-lg">
              <CardContent className="pt-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-blue-200 flex items-center justify-center">
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">180+</h3>
                <p className="text-gray-600">Job Descriptions</p>
              </CardContent>
            </Card>

            <Card className="text-center border-0 shadow-lg">
              <CardContent className="pt-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-purple-200 flex items-center justify-center">
                  <BarChart className="h-8 w-8 text-purple-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">50+</h3>
                <p className="text-gray-600">Companies Trust Us</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
