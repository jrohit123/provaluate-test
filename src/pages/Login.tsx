import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';

// Test credentials
const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'testpassword123';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signIn, signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // For testing, accept only test credentials
      if (email === TEST_EMAIL && password === TEST_PASSWORD) {
        if (isSignup) {
          await signUp(email, password, {
            email,
            first_name: '',
            last_name: '',
            role: 'user',
            user_status: 'active'
          });
          localStorage.setItem('recruitai_auth', 'true');
          toast({
            title: "Account created successfully!",
            description: "Welcome to Provaluate.",
          });
        } else {
          await signIn(email, password);
          localStorage.setItem('recruitai_auth', 'true');
          toast({
            title: "Welcome back!",
            description: "You've been logged in successfully.",
          });
        }
        navigate('/dashboard');
      } else {
        throw new Error('Invalid credentials. Please use the test account.');
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-primary-800 mb-2">Provaluate</h1>
          <p className="text-muted-foreground">Smart Resume Evaluation Platform</p>
        </div>
        
        <Card className="shadow-lg border-0">
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl text-center">
              {isSignup ? 'Create Account' : 'Welcome Back'}
            </CardTitle>
            <CardDescription className="text-center">
              {isSignup 
                ? 'Enter your details to create your account' 
                : 'Enter your credentials to access your dashboard'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
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

            <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm">
              <p className="font-medium text-gray-600">Test Account Credentials:</p>
              <p>Email: {TEST_EMAIL}</p>
              <p>Password: {TEST_PASSWORD}</p>
            </div>
          </CardContent>
        </Card>
        
        <div className="mt-8 text-center text-sm text-muted-foreground">
          <p>Powered by AI | Coming soon: Automated JD parsing and resume ranking engine</p>
        </div>
      </div>
    </div>
  );
};

export default Login;
