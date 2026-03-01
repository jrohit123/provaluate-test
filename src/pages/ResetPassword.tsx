import { useState, useEffect, useRef } from 'react';
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
  const [inviteToken, setInviteToken] = useState<string | null>(null); // ✅ Store invite/reset token
  const navigate = useNavigate();
  const location = useLocation();
  const query = useQuery();
  const hashParams = useHashParams();
  const hasProcessedAuth = useRef(false);

  // Extract tokens from either query params or hash fragments
  const accessToken = query.get('access_token') || hashParams.get('access_token');
  const refreshToken = query.get('refresh_token') || hashParams.get('refresh_token');
  const type = query.get('type') || hashParams.get('type'); // recovery or invite

  // CRITICAL: Clean URL hash IMMEDIATELY on mount to prevent Supabase auto-redirect
  useEffect(() => {
    // Clean URL immediately before Supabase processes it
    if (window.location.hash || window.location.search) {
      const currentHash = window.location.hash;
      const currentSearch = window.location.search;
      
      // Store tokens in sessionStorage temporarily before cleaning
      if (currentHash) {
        const hashParams = new URLSearchParams(currentHash.slice(1));
        const tokenAccess = hashParams.get('access_token');
        const tokenRefresh = hashParams.get('refresh_token');
        const tokenType = hashParams.get('type');
        
        if (tokenAccess) {
          sessionStorage.setItem('reset_access_token', tokenAccess);
          if (tokenRefresh) sessionStorage.setItem('reset_refresh_token', tokenRefresh);
          if (tokenType) sessionStorage.setItem('reset_type', tokenType);
        }
      }
      
      if (currentSearch) {
        const searchParams = new URLSearchParams(currentSearch);
        const tokenAccess = searchParams.get('access_token');
        const tokenRefresh = searchParams.get('refresh_token');
        const tokenType = searchParams.get('type');
        const userType = searchParams.get('user'); // 'recruiter' | 'candidate' for post-reset redirect
        if (tokenAccess) {
          sessionStorage.setItem('reset_access_token', tokenAccess);
          if (tokenRefresh) sessionStorage.setItem('reset_refresh_token', tokenRefresh);
          if (tokenType) sessionStorage.setItem('reset_type', tokenType);
        }
        if (userType === 'recruiter' || userType === 'candidate') {
          sessionStorage.setItem('reset_redirect_user', userType);
        }
      }
      
      // Clean the URL immediately to prevent Supabase from processing it
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []); // Run immediately on mount - before anything else

  useEffect(() => {
    // Prevent multiple processing
    if (hasProcessedAuth.current) return;
    
    const setupSession = async () => {
      // ✅ CRITICAL: Get tokens from sessionStorage FIRST (set by pre-React script)
      // This ensures we get the invite/reset link token, not any existing session
      let tokenAccess = sessionStorage.getItem('reset_access_token') || accessToken;
      let tokenRefresh = sessionStorage.getItem('reset_refresh_token') || refreshToken;
      let tokenType = sessionStorage.getItem('reset_type') || type;
      
      console.log('🔍 ResetPassword: Setting up session...', { 
        accessToken: !!tokenAccess, 
        type: tokenType,
        fromStorage: !!sessionStorage.getItem('reset_access_token'),
        fromUrl: !!accessToken
      });
      
      // ✅ CRITICAL FIX: Store token IMMEDIATELY, before any session checks
      // Decode token to verify which user it's for
      if (tokenAccess) {
        try {
          const parts = tokenAccess.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
            console.log('✅ Token decoded - User ID:', payload.sub);
            console.log('✅ Token decoded - Email:', payload.email || 'Not in token');
            console.log('✅ Token decoded - Type:', payload.type || 'Not in token');
            
            // ✅ SECURITY: Sign out any existing session to prevent conflicts
            // This ensures we use the invite token, not an existing logged-in session
            const { data: { session: existingSession } } = await supabase.auth.getSession();
            if (existingSession?.user) {
              console.log('⚠️ Existing session found, signing out to use invite token...');
              console.log('   Existing session user:', existingSession.user.email);
              await supabase.auth.signOut();
              console.log('✅ Signed out existing session');
      }

            // Store the invite token IMMEDIATELY
            setInviteToken(tokenAccess);
            console.log('✅ Stored invite/reset token for password update');
          }
        } catch (e) {
          console.error('Could not decode token:', e);
        }
      }

      // If we have tokens, mark as ready (we'll use token directly, not setSession)
      if (tokenAccess) {
        console.log('✅ ResetPassword: Tokens found, ready for password update');
        hasProcessedAuth.current = true;
        setTokensReady(true);
        setError(''); // Clear any errors
        
        // Optionally set session for UI purposes, but we'll use stored token for API calls
        try {
        const { error: sessionError } = await supabase.auth.setSession({
            access_token: tokenAccess,
            refresh_token: tokenRefresh || ''
        });
        if (sessionError) {
            console.warn('⚠️ Could not set session (non-critical):', sessionError);
            // Don't fail - we have the token and will use it directly
        }
      } catch (err: any) {
          console.warn('⚠️ Session setup error (non-critical):', err);
          // Don't fail - we have the token stored
        }
      } else if (tokenType === 'recovery' || tokenType === 'invite') {
        // We're on a recovery/invite link but no tokens yet - wait for auth state change
        console.log('⚠️ ResetPassword: No tokens found but type indicates recovery/invite, waiting...');
      } else {
        // No tokens and not a recovery/invite link
        console.log('⚠️ ResetPassword: No tokens or invalid link type');
        setError('Invalid or expired reset link. Please request a new password reset link.');
      }
    };

    // Run immediately
    setupSession();

    // Listen for auth state changes (Supabase handles auto-authentication)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 ResetPassword: Auth state change:', event, session?.user?.id);
      
      // Only process if we haven't already processed
      if (hasProcessedAuth.current) {
        console.log('⏭️ ResetPassword: Already processed, skipping');
        return;
      }
      
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          console.log('✅ ResetPassword: User authenticated via auth state change');
          hasProcessedAuth.current = true;
          setTokensReady(true);
          setError('');
          // Clean up stored tokens
          sessionStorage.removeItem('reset_access_token');
          sessionStorage.removeItem('reset_refresh_token');
          sessionStorage.removeItem('reset_type');
          // IMPORTANT: Don't navigate away - user needs to set password
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('⚠️ ResetPassword: User signed out');
        setTokensReady(false);
        hasProcessedAuth.current = false;
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []); // Empty deps - only run once on mount

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
      // ✅ CRITICAL FIX: Use the token from invite/reset link ONLY
      // This MUST be from sessionStorage (set by pre-React script) or inviteToken state
      let tokenToUse = inviteToken || sessionStorage.getItem('reset_access_token');
      
      if (!tokenToUse) {
        console.error('❌ No invite/reset token found!');
        console.error('   inviteToken state:', inviteToken ? 'Set' : 'Not set');
        console.error('   sessionStorage:', sessionStorage.getItem('reset_access_token') ? 'Has token' : 'Empty');
        setError('No active session found. Please use the link from your email again.');
        setLoading(false);
        return;
      }

      // ✅ Verify which user this token is for (debugging)
      console.log('🔐 Calling confirm-password Edge Function...');
      console.log('🔐 Token source:', inviteToken ? 'inviteToken state' : 'sessionStorage');
      
      try {
        const parts = tokenToUse.split('.');
        if (parts.length === 3) {
          const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
          console.log('🔐 Token is for User ID:', payload.sub);
          console.log('🔐 Token email:', payload.email || 'Not in token');
          console.log('🔐 Token type:', payload.type || 'Not in token');
        }
      } catch (e) {
        console.warn('Could not decode token for verification:', e);
      }

      // ✅ Use the invite/reset token, not the current session
      const { data, error } = await supabase.functions.invoke('confirm-password', {
        body: { password },
        headers: {
          Authorization: `Bearer ${tokenToUse}`,
        },
      });

      console.log('📥 Edge function response:', { data, error });

      if (error) {
        console.error('❌ Edge function error:', error);
        setError(error.message || 'Failed to update password. Please try again.');
        setLoading(false);
        return;
      }

      if (data?.success) {
        console.log('✅ Password confirmed successfully:', data);
        setMessage('Password updated successfully! Redirecting to login...');

        // Redirect from Edge Function response (isCandidate set by confirm-password)
        const loginPath = data?.isCandidate === true ? '/candidate-login' : '/login';

        // Navigate first so auth listeners don't override with /login; then sign out and clear
        const delayMs = 500;
        setTimeout(() => {
          navigate(loginPath, { replace: true });
          supabase.auth.signOut();
          localStorage.removeItem('recruitai_auth');
          sessionStorage.removeItem('reset_access_token');
          sessionStorage.removeItem('reset_refresh_token');
          sessionStorage.removeItem('reset_type');
          sessionStorage.removeItem('reset_redirect_user');
          setInviteToken(null);
        }, delayMs);
      } else {
        const errorMsg = data?.error || 'Failed to update password. Please try again.';
        console.error('❌ Password update failed:', errorMsg);
        setError(errorMsg);
      }
    } catch (err: any) {
      console.error('❌ Password update error:', err);
      setError(err.message || 'Failed to update password. Please try again.');
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