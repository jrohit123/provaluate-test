import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { SessionManager } from '@/utils/sessionManager';
import { useAuthContext } from '@/contexts/AuthContext';

export default function CandidateOnboarding() {
  const navigate = useNavigate();
  const { user, refreshUser } = useAuthContext();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const run = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        navigate('/candidate-login');
        return;
      }
      const { data: candidateRow } = await supabase
        .from('candidates')
        .select('candidate_id')
        .eq('auth_user_id', authUser.id)
        .maybeSingle();
      if (candidateRow) {
        navigate('/candidate-dashboard');
        return;
      }
      setLoading(false);
    };
    run();
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!firstName.trim() || !lastName.trim()) {
      setError('First name and last name are required.');
      return;
    }
    const authUser = user ?? (await supabase.auth.getUser()).data.user;
    if (!authUser?.id || !authUser?.email) {
      setError('Session expired. Please sign in again.');
      navigate('/candidate-login');
      return;
    }
    setSubmitting(true);
    try {
      const { error: insertError } = await supabase.from('candidates').insert({
        auth_user_id: authUser.id,
        email: authUser.email,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      });
      if (insertError) throw insertError;

      const sessionData = await SessionManager.createSession(authUser.id);
      if (!sessionData) throw new Error('Failed to create session');
      await new Promise((r) => setTimeout(r, 100));
      await SessionManager.endAllOtherSessions(authUser.id, sessionData.session_id);
      localStorage.setItem('recruitai_auth', 'true');

      await refreshUser();
      navigate('/candidate-dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-lg text-gray-600">Loading...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md shadow-lg border-0">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-gray-900">Complete your profile</CardTitle>
          <p className="text-sm text-gray-600">Enter your name to continue to your candidate dashboard.</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">First name</label>
              <Input
                placeholder="First name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
                className="h-10"
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Last name</label>
              <Input
                placeholder="Last name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
                className="h-10"
                disabled={submitting}
              />
            </div>
            <Button type="submit" className="w-full h-10 bg-indigo-600 hover:bg-indigo-700" disabled={submitting}>
              {submitting ? 'Saving...' : 'Continue to dashboard'}
            </Button>
            {error && <div className="text-red-600 text-sm text-center">{error}</div>}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
