import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function useHashParams() {
  return new URLSearchParams(useLocation().hash.slice(1));
}

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [tokensReady, setTokensReady] = useState(false);
  const navigate = useNavigate();
  const query = useQuery();
  const hashParams = useHashParams();

  // Extract tokens from either query params or hash fragments
  const accessToken = query.get('access_token') || hashParams.get('access_token');
  const refreshToken = query.get('refresh_token') || hashParams.get('refresh_token');

  useEffect(() => {
    const setupSession = async () => {
      if (!accessToken) {
        setError('Invalid or missing access token. Please request a new password reset link.');
        return;
      }

      try {
        // Set the session with both tokens
        const { error: sessionError } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken || ''
        });

        if (sessionError) {
          setError(sessionError.message);
        } else {
          setTokensReady(true);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to validate reset token');
      }
    };

    setupSession();
  }, [accessToken, refreshToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (!tokensReady) {
      setError('Session not ready. Please try again.');
      setLoading(false);
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      setLoading(false);
      return;
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message);
      } else {
        setMessage('Password updated successfully! Redirecting to login...');
        setTimeout(() => navigate('/login'), 3000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 animate-fade-in">
        <h2 className="text-2xl font-bold mb-4 text-center">Reset Password</h2>
        
        {!tokensReady && !error ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
            <p className="text-gray-600">Validating reset token...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="password"
              placeholder="Enter your new password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              disabled={loading || !tokensReady}
            />
            <Button 
              type="submit" 
              className="w-full" 
              disabled={loading || !tokensReady}
            >
              {loading ? 'Updating...' : 'Update Password'}
            </Button>
          </form>
        )}
        
        {message && <div className="text-green-600 text-center mt-4">{message}</div>}
        {error && <div className="text-red-600 text-center mt-4">{error}</div>}
        
        <div className="mt-6 text-center">
          <a href="/login" className="text-blue-600 underline">Back to login</a>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword; 