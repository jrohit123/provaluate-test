import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Mail, Globe, ExternalLink, CheckCircle2, FileArchive } from 'lucide-react';

interface BrowserExtensionInfoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const BrowserExtensionInfo = ({ 
  open, 
  onOpenChange,
}: BrowserExtensionInfoProps) => {
  // Extension ZIP file download URL - using the actual filename from public/downloads
  const extensionZipUrl = '/downloads/browser-extension-file.zip';
  
  const handleDownload = () => {
    window.open(extensionZipUrl, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary-800">
            ProValuate Browser Extension
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Evaluate resumes directly from your email inbox without switching tabs. 
            Streamline your recruitment workflow with our powerful browser extension.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* What it does */}
          <div className="border border-blue-200 rounded-lg p-5 bg-blue-50/50">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-600" />
              What It Does
            </h3>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Automatically detects resume attachments in your emails</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Evaluate resumes against job descriptions without leaving Gmail/Outlook</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Batch process multiple resumes at once</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>Direct integration with your ProValuate account</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                <span>View assessment results directly in your dashboard</span>
              </li>
            </ul>
          </div>

          {/* Installation Instructions */}
          <div className="border border-green-200 rounded-lg p-5 bg-green-50/50">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileArchive className="w-5 h-5 text-green-600" />
              Installation Instructions
            </h3>
            <div className="space-y-4">
              {/* Chrome Instructions */}
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <img 
                    src="/assets/chrome-icon.png" 
                    alt="Chrome" 
                    className="w-5 h-5" 
                  />
                  <h4 className="font-semibold text-gray-900">For Google Chrome</h4>
                </div>
                <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                  <li>Download and extract the ZIP file</li>
                  <li>Open Chrome and navigate to <code className="bg-gray-100 px-1 rounded">chrome://extensions/</code></li>
                  <li>Enable <strong>Developer mode</strong> (toggle in top-right corner)</li>
                  <li>Click <strong>Load unpacked</strong></li>
                  <li>Select the extracted <code className="bg-gray-100 px-1 rounded">ProValuate-Extension</code> folder</li>
                </ol>
              </div>

              {/* Edge Instructions */}
              <div className="bg-white rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <img 
                    src="/assets/edge-icon.png" 
                    alt="Edge" 
                    className="w-5 h-5" 
                  />
                  <h4 className="font-semibold text-gray-900">For Microsoft Edge</h4>
                </div>
                <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                  <li>Download and extract the ZIP file</li>
                  <li>Open Edge and navigate to <code className="bg-gray-100 px-1 rounded">edge://extensions/</code></li>
                  <li>Enable <strong>Developer mode</strong> (toggle in bottom-left corner)</li>
                  <li>Click <strong>Load unpacked</strong></li>
                  <li>Select the extracted <code className="bg-gray-100 px-1 rounded">ProValuate-Extension</code> folder</li>
                </ol>
              </div>
            </div>
          </div>

          {/* How to use */}
          <div className="border border-purple-200 rounded-lg p-5 bg-purple-50/50">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Globe className="w-5 h-5 text-purple-600" />
              How to Use
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="bg-white border-2 border-purple-600 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold text-purple-600 text-xs">
                  1
                </div>
                <p className="text-sm text-gray-700 flex-1">
                  After installation, log in to your ProValuate account in your browser (credentials sync automatically)
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-white border-2 border-purple-600 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold text-purple-600 text-xs">
                  2
                </div>
                <p className="text-sm text-gray-700 flex-1">
                  Open an email with resume attachments in Gmail or Outlook
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-white border-2 border-purple-600 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold text-purple-600 text-xs">
                  3
                </div>
                <p className="text-sm text-gray-700 flex-1">
                  Click the ProValuate floating button that appears in the email
                </p>
              </div>
              <div className="flex items-start gap-3">
                <div className="bg-white border-2 border-purple-600 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 mt-0.5 font-semibold text-purple-600 text-xs">
                  4
                </div>
                <p className="text-sm text-gray-700 flex-1">
                  Select your Job Description and Evaluation Criteria, then click "Assess Resumes"
                </p>
              </div>
            </div>
          </div>

          {/* Browser compatibility */}
          <div className="border border-amber-200 rounded-lg p-5 bg-amber-50/50">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <Globe className="w-5 h-5 text-amber-600" />
              Browser Compatibility
            </h3>
            <div className="grid grid-cols-2 gap-4 mb-3">
              <div className="bg-white rounded-lg p-3 flex items-center gap-3">
                <img 
                  src="/assets/chrome-icon.png" 
                  alt="Chrome" 
                  className="w-6 h-6" 
                />
                <div>
                  <p className="font-medium text-gray-900">Google Chrome</p>
                  <p className="text-xs text-gray-600">Fully Supported</p>
                </div>
              </div>
              <div className="bg-white rounded-lg p-3 flex items-center gap-3">
                <img 
                  src="/assets/edge-icon.png" 
                  alt="Edge" 
                  className="w-6 h-6" 
                />
                <div>
                  <p className="font-medium text-gray-900">Microsoft Edge</p>
                  <p className="text-xs text-gray-600">Fully Supported</p>
                </div>
              </div>
            </div>
            <div className="p-3 bg-white border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800">
                <strong>Coming Soon:</strong> Support for additional browsers (Firefox, Safari) and email providers (Yahoo Mail, etc.)
              </p>
            </div>
          </div>

          {/* Download section */}
          <div className="border-2 border-primary-300 rounded-lg p-5 bg-primary-50">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Ready to Get Started?
                </h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download the extension package and follow the installation instructions above. 
                  The same package works for both Chrome and Edge browsers.
                </p>
                <Button 
                  onClick={handleDownload}
                  className="flex items-center gap-2"
                  size="lg"
                >
                  <Download className="w-4 h-4" />
                  Download Extension (ZIP)
                  <FileArchive className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
