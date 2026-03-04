import React, { useEffect, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, X, TrendingDown } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { UsageTrackingService } from '@/services/usageTrackingService';

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

interface LowCVWarning {
  usagePercentage: number;
  remainingCVs: number;
  maxCVs: number;
  isCritical: boolean; // 90%+
  isWarning: boolean;   // 80-89%
}

export function TrialExpirationWarning() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [trialStatus, setTrialStatus] = useState<TrialStatus | null>(null);
  const [lowCVWarning, setLowCVWarning] = useState<LowCVWarning | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [lowCVDismissed, setLowCVDismissed] = useState(false);

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

    const checkCVUsage = async () => {
      try {
        const usageInfo = await UsageTrackingService.checkCVProcessingLimit(user.profile.company_id);
        
        // Only show low CV warning if not on trial (trial warnings take priority)
        if (!usageInfo.isTrial && usageInfo.maxCVs > 0) {
          const usagePercentage = (usageInfo.currentCVCount / usageInfo.maxCVs) * 100;
          const remainingCVs = usageInfo.remainingCVs;
          
          // Show warning at 80% and critical at 90%
          if (usagePercentage >= 90) {
            setLowCVWarning({
              usagePercentage,
              remainingCVs,
              maxCVs: usageInfo.maxCVs,
              isCritical: true,
              isWarning: false
            });
          } else if (usagePercentage >= 80) {
            setLowCVWarning({
              usagePercentage,
              remainingCVs,
              maxCVs: usageInfo.maxCVs,
              isCritical: false,
              isWarning: true
            });
          } else {
            setLowCVWarning(null);
          }
        } else {
          setLowCVWarning(null);
        }
      } catch (error) {
        console.error('Error checking CV usage:', error);
      }
    };

    checkTrialStatus();
    checkCVUsage();
    
    // Check every hour
    const interval = setInterval(() => {
      checkTrialStatus();
      checkCVUsage();
    }, 3600000);
    
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

    const lowCVDismissedKey = `low_cv_warning_dismissed_${user.profile.company_id}`;
    const lowCVDismissedTime = localStorage.getItem(lowCVDismissedKey);
    if (lowCVDismissedTime) {
      const hoursSinceDismiss = (Date.now() - parseInt(lowCVDismissedTime)) / (1000 * 60 * 60);
      if (hoursSinceDismiss < 24) {
        setLowCVDismissed(true);
      } else {
        localStorage.removeItem(lowCVDismissedKey);
      }
    }
  }, [user]);

  const handleUpgrade = () => {
    navigate('/dashboard?section=settings');
  };

  const handleDismiss = () => {
    // Only allow dismiss if not expired and not forcing upgrade
    if (!trialStatus?.is_expired && !trialStatus?.should_force_upgrade) {
      setDismissed(true);
      if (user?.profile?.company_id) {
        localStorage.setItem(
          `trial_warning_dismissed_${user.profile.company_id}`,
          Date.now().toString()
        );
      }
    }
  };

  const handleLowCVDismiss = () => {
    // Only allow dismiss if not critical (90%+)
    if (lowCVWarning && !lowCVWarning.isCritical) {
      setLowCVDismissed(true);
      if (user?.profile?.company_id) {
        localStorage.setItem(
          `low_cv_warning_dismissed_${user.profile.company_id}`,
          Date.now().toString()
        );
      }
    }
  };

  // Show trial warning first (highest priority)
  if (trialStatus && !dismissed) {
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
            {/* {trialStatus.days_remaining !== undefined && trialStatus.days_remaining > 0 && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{trialStatus.days_remaining} day(s) remaining</span>
              </div>
            )} */}
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Show low CV warning if no trial warning
  if (lowCVWarning && !lowCVDismissed) {
    return (
      <Alert
        variant={lowCVWarning.isCritical ? 'destructive' : 'default'}
        className={`mb-4 border-2 ${lowCVWarning.isCritical ? 'border-red-500' : 'border-yellow-500'}`}
      >
        <TrendingDown className="h-4 w-4" />
        <AlertTitle className="flex items-center justify-between">
          <span>
            {lowCVWarning.isCritical 
              ? 'CV Quota Almost Exhausted' 
              : 'CV Quota Running Low'}
          </span>
          {!lowCVWarning.isCritical && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLowCVDismiss}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </AlertTitle>
        <AlertDescription className="space-y-2">
          <p>
            {lowCVWarning.isCritical
              ? `You've used ${Math.round(lowCVWarning.usagePercentage)}% of your CV quota. Only ${lowCVWarning.remainingCVs} CV${lowCVWarning.remainingCVs !== 1 ? 's' : ''} remaining. Please recharge or upgrade soon.`
              : `You've used ${Math.round(lowCVWarning.usagePercentage)}% of your CV quota. ${lowCVWarning.remainingCVs} CV${lowCVWarning.remainingCVs !== 1 ? 's' : ''} remaining. Consider recharging or upgrading.`}
          </p>
          <div className="flex gap-2">
            <Button onClick={handleUpgrade} size="sm" variant={lowCVWarning.isCritical ? 'default' : 'outline'}>
              {lowCVWarning.isCritical ? 'Recharge Now' : 'Recharge or Upgrade'}
            </Button>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <span>{lowCVWarning.remainingCVs} / {lowCVWarning.maxCVs} CVs remaining</span>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
