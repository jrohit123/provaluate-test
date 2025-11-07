/**
 * Session Timeout Dialog Component
 * Displays when user is about to be logged out due to inactivity
 * Allows user to stay logged in by clicking "Continue Session"
 */

import { useEffect, useState } from 'react';
import { AlertCircle, Clock } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { SessionManager } from '@/utils/sessionManager';

interface SessionTimeoutDialogProps {
  isOpen: boolean;
  remainingMinutes: number;
  onContinue: () => void;
  onLogout: () => void;
}

/**
 * Dialog that appears to warn user about session timeout
 * Shows remaining time and provides options to continue or logout
 */
export const SessionTimeoutDialog = ({
  isOpen,
  remainingMinutes,
  onContinue,
  onLogout,
}: SessionTimeoutDialogProps) => {
  const [displayMinutes, setDisplayMinutes] = useState(remainingMinutes);

  useEffect(() => {
    if (!isOpen) return;

    // Update display every 10 seconds
    const interval = setInterval(() => {
      const remaining = SessionManager.getRemainingSessionTime();
      setDisplayMinutes(remaining);

      // Auto logout if time runs out
      if (remaining <= 0) {
        clearInterval(interval);
        onLogout();
      }
    }, 10000);

    return () => clearInterval(interval);
  }, [isOpen, onLogout]);

  return (
    <AlertDialog open={isOpen} onOpenChange={(open) => !open}>
      <AlertDialogContent className="border-2 border-yellow-200 bg-white">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-yellow-100 p-2 rounded-full">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <AlertDialogTitle className="text-xl">Session Timeout Warning</AlertDialogTitle>
          </div>
        </AlertDialogHeader>

        <AlertDialogDescription className="space-y-4">
          <div className="flex items-start gap-3 text-sm">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-gray-900 mb-2">
                Your session will expire due to inactivity
              </p>
              <p className="text-gray-700">
                You will be automatically logged out in{' '}
                <span className="font-bold text-red-600">{displayMinutes} minute{displayMinutes !== 1 ? 's' : ''}</span> if you don't continue your session.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-gray-600">
              💡 <strong>Tip:</strong> Your session automatically extends when you're actively using the system.
              Click "Continue Session" to reset the inactivity timer.
            </p>
          </div>
        </AlertDialogDescription>

        <div className="flex gap-3 mt-6">
          <AlertDialogCancel
            onClick={onLogout}
            className="bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
          >
            Logout Now
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onContinue}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            Continue Session
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SessionTimeoutDialog;

