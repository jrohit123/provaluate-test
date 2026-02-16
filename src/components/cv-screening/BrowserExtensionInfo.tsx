import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Mail, Globe, CheckCircle2, FileArchive, ArrowLeft, FileCode } from 'lucide-react';

interface BrowserExtensionInfoProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GMAIL_LOGO = '/assets/GMAIL%20LOGO.png';
const OUTLOOK_LOGO = '/assets/OUTLOOK%20LOGO.png';
const GMAIL_PLUGIN_ZIP_URL = '/downloads/Gmail-Plugin.zip';
const OUTLOOK_MANIFEST_URL = '/downloads/manifest.xml';

function downloadFile(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export const BrowserExtensionInfo = ({
  open,
  onOpenChange,
}: BrowserExtensionInfoProps) => {
  const [selectedProvider, setSelectedProvider] = useState<'gmail' | 'outlook' | null>(null);

  // Reset to provider choice when modal closes
  useEffect(() => {
    if (!open) setSelectedProvider(null);
  }, [open]);

  // Same instructions section height for Gmail and Outlook (no scroll needed for Outlook, no layout jump)
  const instructionsSectionClass = 'space-y-6 mt-4 flex-1 min-h-[420px] overflow-y-auto';

  // Step 1: Choose provider (two cards)
  if (!selectedProvider) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-primary-800">
              ProValuate Email Plugin
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Choose your email provider to get started. Evaluate resumes from your inbox without leaving Gmail or Outlook.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
            <button
              type="button"
              onClick={() => setSelectedProvider('gmail')}
              className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-gray-200 hover:border-[#1e5da8] hover:bg-blue-50/50 transition-all duration-200 text-left"
            >
              <img src={GMAIL_LOGO} alt="Gmail" className="w-14 h-14 object-contain mb-3" />
              <span className="font-semibold text-gray-900">Gmail</span>
              <span className="text-xs text-gray-600 mt-1">Chrome / Edge extension</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedProvider('outlook')}
              className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-gray-200 hover:border-[#1e5da8] hover:bg-blue-50/50 transition-all duration-200 text-left"
            >
              <img src={OUTLOOK_LOGO} alt="Outlook" className="w-14 h-14 object-contain mb-3" />
              <span className="font-semibold text-gray-900">Outlook</span>
              <span className="text-xs text-gray-600 mt-1">Outlook add-in</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 2a: Gmail view (current extension content, Gmail plugin ZIP)
  if (selectedProvider === 'gmail') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-6">
          <DialogHeader className="flex-shrink-0">
            <Button variant="ghost" size="sm" className="absolute left-4 top-4 gap-1" onClick={() => setSelectedProvider(null)}>
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <DialogTitle className="text-2xl font-bold text-primary-800 pt-6">
              ProValuate for Gmail
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Evaluate resumes directly from Gmail. Install the browser extension (Chrome or Edge), then use it from your inbox.
            </DialogDescription>
          </DialogHeader>

          <div className={instructionsSectionClass}>
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
                  <span>Evaluate resumes against job descriptions without leaving Gmail</span>
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

            <div className="border border-green-200 rounded-lg p-5 bg-green-50/50">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileArchive className="w-5 h-5 text-green-600" />
                Installation Instructions
              </h3>
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">For Google Chrome</h4>
                  <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                    <li>Download and extract the Gmail plugin ZIP file below</li>
                    <li>Open Chrome and go to <code className="bg-gray-100 px-1 rounded">chrome://extensions/</code></li>
                    <li>Enable <strong>Developer mode</strong> (top-right)</li>
                    <li>Click <strong>Load unpacked</strong> and select the extracted folder</li>
                  </ol>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-gray-900 mb-3">For Microsoft Edge</h4>
                  <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                    <li>Download and extract the Gmail plugin ZIP file below</li>
                    <li>Open Edge and go to <code className="bg-gray-100 px-1 rounded">edge://extensions/</code></li>
                    <li>Enable <strong>Developer mode</strong> (bottom-left)</li>
                    <li>Click <strong>Load unpacked</strong> and select the extracted folder</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="border border-purple-200 rounded-lg p-5 bg-purple-50/50">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-600" />
                How to Use
              </h3>
              <p className="text-sm text-gray-700">
                After installation, log in to ProValuate in your browser. Open an email with resume attachments in Gmail, click the ProValuate button, select your Job Description and Criteria, then click &quot;Assess Resumes&quot;.
              </p>
            </div>

            <div className="border-2 border-primary-300 rounded-lg p-5 bg-primary-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Get Started?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Download the Gmail plugin package. The same package works for Chrome and Edge.
              </p>
              <Button
                onClick={() => window.open(GMAIL_PLUGIN_ZIP_URL, '_blank')}
                className="flex items-center gap-2"
                size="lg"
              >
                <Download className="w-4 h-4" />
                Download Gmail plugin (ZIP)
                <FileArchive className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 2b: Outlook view (manifest download + sign in)
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-6">
        <DialogHeader className="flex-shrink-0">
          <Button variant="ghost" size="sm" className="absolute left-4 top-4 gap-1" onClick={() => setSelectedProvider(null)}>
            <ArrowLeft className="w-4 h-4" /> Back
          </Button>
          <DialogTitle className="text-2xl font-bold text-primary-800 pt-6">
            ProValuate for Outlook
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Evaluate resume attachments from Outlook. Install the add-in using the manifest file, then sign in with your ProValuate account.
          </DialogDescription>
        </DialogHeader>

        <div className={instructionsSectionClass}>
          <div className="border border-green-200 rounded-lg p-5 bg-green-50/50">
            <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-green-600" />
              Installation &amp; usage
            </h3>
            <ol className="space-y-3 text-sm text-gray-700 list-decimal list-inside">
              <li>Download the manifest (XML) below and add the add-in in Outlook: <strong>Get Add-ins</strong> → <strong>My Add-ins</strong> → <strong>Add a custom add-in</strong> → <strong>Add from file</strong>. Can&apos;t find where? See Microsoft&apos;s guide: <a href="https://aka.ms/olksideload" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline font-medium">aka.ms/olksideload</a>.</li>
              <li>Log in to this website (ProValuate) with your credentials — they will be saved for the add-in.</li>
              <li>In Outlook, open an email that has resume attachments, open the ProValuate pane, and click <strong>Sign in for Outlook</strong>.</li>
              <li>Press <strong>Assess Resumes</strong>. That’s it.</li>
            </ol>
          </div>

          <div className="border-2 border-primary-300 rounded-lg p-5 bg-primary-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Download manifest</h3>
            <p className="text-sm text-gray-600 mb-4">
              Add this manifest in Outlook to install the ProValuate add-in.
            </p>
            <Button
              onClick={() => downloadFile(OUTLOOK_MANIFEST_URL, 'manifest.xml')}
              className="flex items-center gap-2"
              size="lg"
            >
              <FileCode className="w-4 h-4" />
              Download Outlook add-in manifest (XML)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
