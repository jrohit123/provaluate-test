import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, X } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';

interface TrialStatus {
  is_trial: boolean;
  is_expired: boolean;
  is_expiring_soon: boolean;
  days_remaining: number;
  cvs_exhausted: boolean;
  should_force_upgrade: boolean;
  warning_message: string | null;
  plan_name: string;
}

export function TrialExpirationWarning() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user?.profile?.company_id) return;

    const checkTrialStatus = async () => {
      try {
        const API_BASE_URL = import.meta.env.VITE_PYTHON_URL;
        const response = await fetch(
          `${API_BASE_URL}/subscription/check-trial-status?company_id=${user.profile.company_id}`
        );

        if (response.ok) {
          const data = await response.json();
          if (data.is_trial && (data.show_warning || data.is_expired || data.should_force_upgrade)) {
            setTrialStatus(data);
          }
        }
      } catch (error) {
        console.error('Error checking trial status:', error);
      }
    };

    checkTrialStatus();
    // Check every hour
    const interval = setInterval(checkTrialStatus, 3600000);
    return () => clearInterval(interval);
  }, [user]);

  // Check if dismissed in last 24 hours
  useEffect(() => {
    if (!user?.profile?.company_id) return;
    
    const dismissedKey = `trial_warning_dismissed_${user.profile.company_id}`;
    const dismissedTime = localStorage.getItem(dismissedKey);
    if (dismissedTime) {
      const hoursSinceDismiss = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60);
      if (hoursSinceDismiss < 24) {
        setDismissed(true);
      } else {
        localStorage.removeItem(dismissedKey);
      }
    }
  }, [user]);

  if (!trialStatus || dismissed) return null;

  const handleUpgrade = () => {
    navigate('/admin/user-management');
  };

  const handleDismiss = () => {
    // Only allow dismiss if not expired and not forcing upgrade
    if (!trialStatus.is_expired && !trialStatus.should_force_upgrade) {
      setDismissed(true);
      // Store dismissal in localStorage for 24 hours
      if (user?.profile?.company_id) {
        localStorage.setItem(
          `trial_warning_dismissed_${user.profile.company_id}`,
          Date.now().toString()
        );
      }
    }
  };

  const isCritical = trialStatus.is_expired || trialStatus.should_force_upgrade;

  return (
    <Alert
      variant={isCritical ? 'destructive' : 'default'}
      className="mb-4 border-2"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center justify-between">
        <span>
          {trialStatus.is_expired
            ? 'Trial Expired'
            : trialStatus.cvs_exhausted
            ? 'CV Quota Exhausted'
            : 'Trial Expiring Soon'}
        </span>
        {!isCritical && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{trialStatus.warning_message}</p>
        <div className="flex gap-2">
          <Button onClick={handleUpgrade} size="sm">
            {trialStatus.is_expired ? 'Upgrade Now' : 'Upgrade Plan'}
          </Button>
          {trialStatus.days_remaining !== undefined && trialStatus.days_remaining > 0 && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              <span>{trialStatus.days_remaining} day(s) remaining</span>
            </div>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
}

