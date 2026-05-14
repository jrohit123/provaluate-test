import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { UserPlus, Mail } from 'lucide-react';
import { useAuthContext } from '@/contexts/AuthContext';

const CandidateSignUp = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { candidateSignUp } = useAuthContext();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { error } = await candidateSignUp(email, password);
      if (error) throw new Error(error.message);
      toast({
        title: 'Confirmation email sent',
        description: `An email has been sent to ${email}. Please confirm your email, then sign in on the candidate login page.`,
      });
      navigate('/candidate-login');
    } catch (err: unknown) {
      toast({
        title: 'Sign up error',
        description: err instanceof Error ? err.message : 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-sky-50 to-sky-100 overflow-x-hidden">
      <header className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex justify-between items-center gap-2">
            <Link to="/candidate-login" className="flex items-center min-h-[44px]">
              <img src={`${import.meta.env.BASE_URL}Logo_Transparent_BG.png`} alt="ProValuate" className="h-10 sm:h-12 w-auto" />
            </Link>
            <Link
              to="/candidate-login"
              className="text-sm sm:text-base text-sky-600 hover:text-sky-800 font-medium min-h-[44px] flex items-center touch-manipulation"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-3 sm:px-4 py-6 sm:py-12">
        <Card className="shadow-lg border-0">
          <CardHeader className="space-y-1 px-4 sm:px-6 pt-4 sm:pt-6">
            <div className="flex items-center justify-center space-x-2 mb-2">
              <div className="bg-sky-600 p-2 rounded-lg">
                <UserPlus className="h-5 w-5 text-white" />
              </div>
              <CardTitle className="text-lg sm:text-xl text-center">Create candidate account</CardTitle>
            </div>
            <CardDescription className="text-center text-sm sm:text-base">
              Sign up to build your profile and manage your interviews
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Email</label>
                <Input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="min-h-[44px] h-11 text-base touch-manipulation"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700">Password</label>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="min-h-[44px] h-11 text-base touch-manipulation"
                  disabled={isLoading}
                />
              </div>
              <Button
                type="submit"
                className="w-full min-h-[44px] h-11 text-base bg-sky-600 hover:bg-sky-700 touch-manipulation"
                disabled={isLoading}
              >
                {isLoading ? 'Creating account...' : 'Create account'}
              </Button>
            </form>
            <p className="mt-4 text-center text-xs sm:text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/candidate-login" className="text-sky-600 hover:underline touch-manipulation">
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
        <p className="mt-6 text-center text-xs sm:text-sm text-gray-500 px-2">
          Recruiter? <Link to="/login" className="text-sky-600 hover:underline touch-manipulation">Log in here</Link>
        </p>
      </main>
    </div>
  );
};

export default CandidateSignUp;
