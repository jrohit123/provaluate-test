/**
 * Session Conflict Dialog Component
 * Displays when user attempts to login from another device/browser
 * while already having an active session elsewhere
 * Allows user to choose which session to keep
 */

import { useState } from 'react';
import { AlertCircle, Smartphone, Monitor, LogOut } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { SessionData } from '@/utils/sessionManager';

interface SessionConflictDialogProps {
  isOpen: boolean;
  existingSession: SessionData | undefined;
  onKeepExisting: () => void;
  onReplaceWithNew: () => void;
}

/**
 * Dialog shown when user tries to login from multiple locations
 * Displays device info of existing session and prompts user to choose
 */
export const SessionConflictDialog = ({
  isOpen,
  existingSession,
  onKeepExisting,
  onReplaceWithNew,
}: SessionConflictDialogProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const parseDeviceInfo = (deviceInfoJson: string) => {
    try {
      return JSON.parse(deviceInfoJson);
    } catch {
      return {
        userAgent: 'Unknown Device',
        language: 'Unknown',
        platform: 'Unknown',
      };
    }
  };

  const getDeviceType = (userAgent: string) => {
    if (/iPad|iPhone|iPod/.test(userAgent)) return 'iPhone/iPad';
    if (/Android/.test(userAgent)) return 'Android Phone';
    if (/Windows/.test(userAgent)) return 'Windows PC';
    if (/Mac/.test(userAgent)) return 'Mac';
    if (/Linux/.test(userAgent)) return 'Linux';
    return 'Unknown Device';
  };

  const handleKeepExisting = async () => {
    setIsLoading(true);
    await onKeepExisting();
    setIsLoading(false);
  };

  const handleReplaceWithNew = async () => {
    setIsLoading(true);
    await onReplaceWithNew();
    setIsLoading(false);
  };

  const existingDeviceInfo = existingSession
    ? parseDeviceInfo(existingSession.device_info || '{}')
    : null;
  const existingDevice = existingDeviceInfo
    ? getDeviceType(existingDeviceInfo.userAgent || '')
    : 'Unknown Device';

  return (
    <AlertDialog open={isOpen} onOpenChange={() => {}}>
      <AlertDialogContent className="max-w-md border-2 border-orange-200 bg-white">
        <AlertDialogHeader>
          <div className="flex items-center gap-3">
            <div className="bg-orange-100 p-2 rounded-full">
              <AlertCircle className="h-5 w-5 text-orange-600" />
            </div>
            <AlertDialogTitle className="text-lg">Active Session Detected</AlertDialogTitle>
          </div>
        </AlertDialogHeader>

        <AlertDialogDescription className="space-y-4">
          <p className="text-sm text-gray-700">
            You're already logged in on another device. For security reasons, only one active session per user is allowed at a time.
          </p>

          {existingSession && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-gray-600 uppercase">Active Session</p>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700">
                    <strong>Device:</strong> {existingDevice}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-gray-500" />
                  <span className="text-sm text-gray-700">
                    <strong>Language:</strong> {existingDeviceInfo?.language || 'Unknown'}
                  </span>
                </div>
                <div className="text-xs text-gray-500">
                  Last active:{' '}
                  {new Date(existingSession.last_activity).toLocaleString()}
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs text-blue-900">
              ℹ️ Choose which session to keep active. The other will be logged out.
            </p>
          </div>
        </AlertDialogDescription>

        <div className="flex flex-col gap-3 mt-6">
          <Button
            onClick={handleKeepExisting}
            disabled={isLoading}
            variant="outline"
            className="border-gray-300 hover:bg-gray-50"
          >
            {isLoading ? 'Processing...' : 'Keep Existing Session'}
          </Button>
          <Button
            onClick={handleReplaceWithNew}
            disabled={isLoading}
            className="bg-orange-600 hover:bg-orange-700 text-white"
          >
            {isLoading ? 'Processing...' : 'Login Here (Logout Other)'}
          </Button>
        </div>

        <p className="text-xs text-gray-500 text-center mt-4">
          For your security, you can only stay logged in on one device at a time.
        </p>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default SessionConflictDialog;

