import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const ResetPassword = () => {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const query = useQuery();
  const accessToken = query.get('access_token');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');
    if (!accessToken) {
      setError('Invalid or missing access token.');
      setLoading(false);
      return;
    }
    // Set the access token as the current session
    const { error: sessionError } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: '' });
    if (sessionError) {
      setError(sessionError.message);
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setMessage('Password updated! You can now log in with your new password.');
      setTimeout(() => navigate('/login'), 2000);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 p-4">
      <div className="w-full max-w-md bg-white rounded-lg shadow-lg p-8 animate-fade-in">
        <h2 className="text-2xl font-bold mb-4 text-center">Reset Password</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            disabled={loading}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
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