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
  /** ProValuate user ID (UUID) for Connect Zoho Mail link; optional */
  userId?: string;
}

const GMAIL_LOGO = `${import.meta.env.BASE_URL}assets/GMAIL%20LOGO.png`;
const OUTLOOK_LOGO = `${import.meta.env.BASE_URL}assets/OUTLOOK%20LOGO.png`;
const LINKEDIN_LOGO = `${import.meta.env.BASE_URL}assets/LINKEDIN%20LOGO.png`;
const ZOHO_LOGO = `${import.meta.env.BASE_URL}assets/ZOHO%20LOGO.png?v=2`;
const TELEGRAM_LOGO = `${import.meta.env.BASE_URL}assets/TELEGRAM%20LOGO.png`;
const GMAIL_PLUGIN_ZIP_URL = `${import.meta.env.BASE_URL}downloads/Gmail-Plugin.zip`;
const OUTLOOK_MANIFEST_URL = `${import.meta.env.BASE_URL}downloads/manifest.xml`;
const LINKEDIN_PLUGIN_ZIP_URL = `${import.meta.env.BASE_URL}downloads/Linkedin-Plugin.zip`;
const ZOHO_PLUGIN_ZIP_URL = `${import.meta.env.BASE_URL}downloads/Zoho-Plugin.zip`;

function downloadFile(url: string, filename: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

const PYTHON_API_BASE = import.meta.env.VITE_PYTHON_URL || (typeof localStorage !== 'undefined' ? localStorage.getItem('provaluate_api_base') : null) || 'https://flask-6421997997235322.kloudbeansite.com';

export const BrowserExtensionInfo = ({
  open,
  onOpenChange,
  userId,
}: BrowserExtensionInfoProps) => {
  const [selectedProvider, setSelectedProvider] = useState<'gmail' | 'outlook' | 'linkedin' | 'zoho' | 'telegram' | null>(null);
  const [telegramConnectInfo, setTelegramConnectInfo] = useState<{
    deep_link: string;
    bot_username: string;
    manual_command: string;
    expires_in_minutes: number;
  } | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleConnectTelegram = async () => {
    setTelegramLoading(true);
    try {
      const telegramRegisterUrl = `${PYTHON_API_BASE.replace(/\/$/, '')}/api/telegram/register-start${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`;
      const res = await fetch(telegramRegisterUrl);
      const data = await res.json();
      setTelegramConnectInfo(data);
      window.open(data.deep_link, '_blank', 'noopener,noreferrer');
    } catch (e) {
      console.error('Failed to start Telegram connection', e);
    } finally {
      setTelegramLoading(false);
    }
  };

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
            <DialogTitle className="text-2xl font-bold text-[#094D7B]">
              ProValuate Plugins
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Choose your provider to get started. Evaluate resumes from your inbox or LinkedIn without leaving Gmail, Outlook, Zoho, or LinkedIn.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-6">
            <button
              type="button"
              onClick={() => setSelectedProvider('gmail')}
              className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-gray-200 hover:border-[#094D7B] hover:bg-[#094D7B]/5 transition-all duration-200 text-left"
            >
              <img src={GMAIL_LOGO} alt="Gmail" className="w-14 h-14 object-contain mb-3" />
              <span className="font-semibold text-[#094D7B]">Gmail</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedProvider('outlook')}
              className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-gray-200 hover:border-[#094D7B] hover:bg-[#094D7B]/5 transition-all duration-200 text-left"
            >
              <img src={OUTLOOK_LOGO} alt="Outlook" className="w-14 h-14 object-contain mb-3" />
              <span className="font-semibold text-[#094D7B]">Outlook</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedProvider('zoho')}
              className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-gray-200 hover:border-[#094D7B] hover:bg-[#094D7B]/5 transition-all duration-200 text-left"
            >
              <img src={ZOHO_LOGO} alt="Zoho Mail" className="w-14 h-14 object-contain mb-3" />
              <span className="font-semibold text-[#094D7B]">Zoho</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedProvider('linkedin')}
              className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-gray-200 hover:border-[#094D7B] hover:bg-[#094D7B]/5 transition-all duration-200 text-left"
            >
              <img src={LINKEDIN_LOGO} alt="LinkedIn" className="w-14 h-14 object-contain mb-3" />
              <span className="font-semibold text-[#094D7B]">LinkedIn</span>
            </button>
            <button
              type="button"
              onClick={() => setSelectedProvider('telegram')}
              className="flex flex-col items-center justify-center p-6 rounded-xl border-2 border-gray-200 hover:border-[#094D7B] hover:bg-[#094D7B]/5 transition-all duration-200 text-left"
            >
              <img src={TELEGRAM_LOGO} alt="Telegram" className="w-14 h-14 object-contain mb-3" />
              <span className="font-semibold text-[#094D7B]">Telegram</span>
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
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-4 top-4 gap-1 text-sm md:text-base"
              onClick={() => setSelectedProvider(null)}
            >
              <ArrowLeft className="w-5 h-5" /> Back
            </Button>
            <DialogTitle className="text-2xl font-bold text-[#094D7B] pt-10">
              ProValuate for Gmail
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Evaluate resumes directly from Gmail. Install the browser extension (Chrome or Edge), then use it from your inbox.
            </DialogDescription>
          </DialogHeader>

          <div className={instructionsSectionClass}>
            <div className="border border-[#094D7B]/20 rounded-lg p-5 bg-[#094D7B]/5">
              <h3 className="text-lg font-semibold text-[#094D7B] mb-3 flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#094D7B]" />
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
              <h3 className="text-lg font-semibold text-[#094D7B] mb-3 flex items-center gap-2">
                <FileArchive className="w-5 h-5 text-green-600" />
                Installation Instructions
              </h3>
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-[#094D7B] mb-3">For Google Chrome</h4>
                  <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                    <li>Download and extract the Gmail plugin ZIP file below</li>
                    <li>Open Chrome and go to <code className="bg-gray-100 px-1 rounded">chrome://extensions/</code></li>
                    <li>Enable <strong>Developer mode</strong> (top-right)</li>
                    <li>Click <strong>Load unpacked</strong> and select the extracted folder</li>
                  </ol>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-[#094D7B] mb-3">For Microsoft Edge</h4>
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
              <h3 className="text-lg font-semibold text-[#094D7B] mb-3 flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-600" />
                How to Use
              </h3>
              <p className="text-sm text-gray-700">
                After installation, log in to ProValuate in your browser. Open an email with resume attachments in Gmail, click the ProValuate button, select your Job Description and Criteria, then click &quot;Assess Resumes&quot;.
              </p>
            </div>

            <div className="border-2 border-[#094D7B]/30 rounded-lg p-5 bg-[#094D7B]/5">
              <h3 className="text-lg font-semibold text-[#094D7B] mb-2">Ready to Get Started?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Download the Gmail plugin package. The same package works for Chrome and Edge.
              </p>
              <Button
                onClick={() => window.open(GMAIL_PLUGIN_ZIP_URL, '_blank')}
                className="flex items-center gap-2 bg-[#094D7B] text-white shadow-[0_4px_18px_rgba(9,77,123,0.28)] transition-shadow hover:bg-[#094D7B] hover:shadow-[0_6px_22px_rgba(9,77,123,0.34)]"
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

  // Step 2c: LinkedIn view (LinkedIn plugin ZIP)
  if (selectedProvider === 'linkedin') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-6">
          <DialogHeader className="flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-4 top-4 gap-1 text-sm md:text-base"
              onClick={() => setSelectedProvider(null)}
            >
              <ArrowLeft className="w-5 h-5" /> Back
            </Button>
            <DialogTitle className="text-2xl font-bold text-[#094D7B] pt-10">
              ProValuate for LinkedIn
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Assess LinkedIn profiles directly from the browser. Install the Chrome or Edge extension, then use it on any LinkedIn profile page.
            </DialogDescription>
          </DialogHeader>

          <div className={instructionsSectionClass}>
            <div className="border border-[#094D7B]/20 rounded-lg p-5 bg-[#094D7B]/5">
              <h3 className="text-lg font-semibold text-[#094D7B] mb-3 flex items-center gap-2">
                <Globe className="w-5 h-5 text-[#094D7B]" />
                What It Does
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Assess LinkedIn profiles against job descriptions and criteria without leaving LinkedIn</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>One-click &quot;Assess on ProValuate&quot; on any profile page</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Credentials sync automatically after you log in to ProValuate</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>View assessment results in your ProValuate dashboard</span>
                </li>
              </ul>
            </div>

            <div className="border border-green-200 rounded-lg p-5 bg-green-50/50">
              <h3 className="text-lg font-semibold text-[#094D7B] mb-3 flex items-center gap-2">
                <FileArchive className="w-5 h-5 text-green-600" />
                Installation Instructions
              </h3>
              <div className="space-y-4">
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-[#094D7B] mb-3">For Google Chrome</h4>
                  <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                    <li>Download and extract the LinkedIn plugin ZIP file below</li>
                    <li>Open Chrome and go to <code className="bg-gray-100 px-1 rounded">chrome://extensions/</code></li>
                    <li>Enable <strong>Developer mode</strong> (top-right)</li>
                    <li>Click <strong>Load unpacked</strong> and select the extracted folder</li>
                  </ol>
                </div>
                <div className="bg-white rounded-lg p-4">
                  <h4 className="font-semibold text-[#094D7B] mb-3">For Microsoft Edge</h4>
                  <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                    <li>Download and extract the LinkedIn plugin ZIP file below</li>
                    <li>Open Edge and go to <code className="bg-gray-100 px-1 rounded">edge://extensions/</code></li>
                    <li>Enable <strong>Developer mode</strong> (bottom-left)</li>
                    <li>Click <strong>Load unpacked</strong> and select the extracted folder</li>
                  </ol>
                </div>
              </div>
            </div>

            <div className="border border-purple-200 rounded-lg p-5 bg-purple-50/50">
              <h3 className="text-lg font-semibold text-[#094D7B] mb-3 flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-600" />
                How to Use
              </h3>
              <p className="text-sm text-gray-700">
                Log in to ProValuate in your browser (credentials sync automatically). Open any LinkedIn profile (e.g. linkedin.com/in/username), click the ProValuate button, select your Job Description and Criteria, then click &quot;Assess Candidate&quot;.
              </p>
            </div>

            <div className="border-2 border-[#094D7B]/30 rounded-lg p-5 bg-[#094D7B]/5">
              <h3 className="text-lg font-semibold text-[#094D7B] mb-2">Ready to Get Started?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Download the LinkedIn plugin package. The same package works for Chrome and Edge.
              </p>
              <Button
                onClick={() => window.open(LINKEDIN_PLUGIN_ZIP_URL, '_blank')}
                className="flex items-center gap-2 bg-[#094D7B] text-white shadow-[0_4px_18px_rgba(9,77,123,0.28)] transition-shadow hover:bg-[#094D7B] hover:shadow-[0_6px_22px_rgba(9,77,123,0.34)]"
                size="lg"
              >
                <Download className="w-4 h-4" />
                Download LinkedIn plugin (ZIP)
                <FileArchive className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 2d: Telegram view (Connect Telegram bot)
  if (selectedProvider === 'telegram') {
    const telegramRegisterUrl = `${PYTHON_API_BASE.replace(/\/$/, '')}/api/telegram/register-start${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`;
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-6">
          <DialogHeader className="flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-4 top-4 gap-1 text-sm md:text-base"
              onClick={() => setSelectedProvider(null)}
            >
              <ArrowLeft className="w-5 h-5" /> Back
            </Button>
            <DialogTitle className="text-2xl font-bold text-[#094D7B] pt-10">
              ProValuate for Telegram
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Connect your Telegram account once, then screen CVs directly from the chat without leaving the app.
            </DialogDescription>
          </DialogHeader>

          <div className={instructionsSectionClass}>
            <div className="border border-[#094D7B]/20 rounded-lg p-5 bg-[#094D7B]/5">
              <h3 className="text-lg font-semibold text-[#094D7B] mb-3 flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#094D7B]" />
                What you need
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Be logged in to ProValuate (this dashboard)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Connect Telegram once using the button below</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Send CVs as files to the bot for instant scoring</span>
                </li>
              </ul>
            </div>

            <div className="border border-green-200 rounded-lg p-5 bg-green-50/50">
              <h3 className="text-lg font-semibold text-[#094D7B] mb-3 flex items-center gap-2">
                <Globe className="w-5 h-5 text-green-600" />
                Connect Telegram (one-time)
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                Click below to open Telegram and start a chat with the ProValuate bot. You only need to do this once.
              </p>
              <Button
                onClick={handleConnectTelegram}
                disabled={telegramLoading}
                className="flex items-center gap-2 bg-[#094D7B] text-white shadow-[0_4px_18px_rgba(9,77,123,0.28)] transition-shadow hover:bg-[#094D7B] hover:shadow-[0_6px_22px_rgba(9,77,123,0.34)]"
                size="lg"
              >
                <Mail className="w-4 h-4" />
                {telegramLoading ? 'Opening...' : 'Connect Telegram'}
              </Button>
              {!userId && (
                <p className="text-xs text-amber-700 mt-2">
                  For the best experience, ensure you are logged in to ProValuate before connecting.
                </p>
              )}
              {telegramConnectInfo && (
                <div className="mt-4 border border-gray-200 rounded-lg p-4 bg-gray-50">
                  <p className="text-sm text-gray-700 mb-2">
                    Didn't open Telegram automatically? Open Telegram yourself (the app, or{' '}
                    <a href="https://web.telegram.org" target="_blank" rel="noopener noreferrer" className="underline">
                      web.telegram.org
                    </a>
                    ), search for <strong>@{telegramConnectInfo.bot_username}</strong>, and send:
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 text-sm bg-white border border-gray-300 rounded px-3 py-2 font-mono">
                      {telegramConnectInfo.manual_command}
                    </code>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(telegramConnectInfo.manual_command);
                        setCopied(true);
                        setTimeout(() => setCopied(false), 2000);
                      }}
                    >
                      {copied ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    This link expires in {telegramConnectInfo.expires_in_minutes} minutes.
                  </p>
                </div>
              )}
            </div>

            <div className="border border-purple-200 rounded-lg p-5 bg-purple-50/50">
              <h3 className="text-lg font-semibold text-[#094D7B] mb-3 flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-600" />
                How to Use
              </h3>
              <p className="text-sm text-gray-700">
                After connecting, open your Telegram chat with ProValuate. Send /newassessment to pick a job and criteria, then upload the candidate's CV as a file (PDF, DOC, DOCX, or TXT). You'll receive the score and recommendation directly in the chat.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  // Step 2: Zoho view (Connect Zoho Mail + Zoho Add-on)
  if (selectedProvider === 'zoho') {
    const zohoRegisterUrl = `${PYTHON_API_BASE.replace(/\/$/, '')}/api/zoho/register-start${userId ? `?user_id=${encodeURIComponent(userId)}` : ''}`;
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-6">
          <DialogHeader className="flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="absolute left-4 top-4 gap-1 text-sm md:text-base"
              onClick={() => setSelectedProvider(null)}
            >
              <ArrowLeft className="w-5 h-5" /> Back
            </Button>
            <DialogTitle className="text-2xl font-bold text-[#094D7B] pt-10">
              ProValuate for Zoho Mail
            </DialogTitle>
            <DialogDescription className="text-base mt-2">
              Connect your Zoho Mail account once, then assess resume attachments from the Zoho Add-on or dashboard.
            </DialogDescription>
          </DialogHeader>

          <div className={instructionsSectionClass}>
            <div className="border border-[#094D7B]/20 rounded-lg p-5 bg-[#094D7B]/5">
              <h3 className="text-lg font-semibold text-[#094D7B] mb-3 flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#094D7B]" />
                What you need
              </h3>
              <ul className="space-y-2 text-sm text-gray-700">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Be logged in to ProValuate (this dashboard)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Connect Zoho Mail once using the button below</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Install the Zoho Add-on (Chrome/Edge) to assess resumes inside mail.zoho.com</span>
                </li>
              </ul>
            </div>

            <div className="border border-green-200 rounded-lg p-5 bg-green-50/50">
              <h3 className="text-lg font-semibold text-[#094D7B] mb-3 flex items-center gap-2">
                <Globe className="w-5 h-5 text-green-600" />
                Connect Zoho Mail (one-time)
              </h3>
              <p className="text-sm text-gray-700 mb-4">
                Click below to sign in with Zoho and allow ProValuate to read your mail. You only need to do this once.
              </p>
              <Button
                onClick={() => window.open(zohoRegisterUrl, '_blank', 'noopener,noreferrer')}
                className="flex items-center gap-2 bg-[#094D7B] text-white shadow-[0_4px_18px_rgba(9,77,123,0.28)] transition-shadow hover:bg-[#094D7B] hover:shadow-[0_6px_22px_rgba(9,77,123,0.34)]"
                size="lg"
              >
                <Mail className="w-4 h-4" />
                Connect Zoho Mail
              </Button>
              {!userId && (
                <p className="text-xs text-amber-700 mt-2">
                  For the best experience, ensure you are logged in to ProValuate before connecting.
                </p>
              )}
            </div>

            <div className="border border-green-200 rounded-lg p-5 bg-green-50/50">
              <h3 className="text-lg font-semibold text-[#094D7B] mb-3 flex items-center gap-2">
                <FileArchive className="w-5 h-5 text-green-600" />
                Installation Instructions (Zoho Add-on)
              </h3>
              <div className="bg-white rounded-lg p-4">
                <ol className="space-y-2 text-sm text-gray-700 list-decimal list-inside">
                  <li>Download and extract the Zoho plugin ZIP file below</li>
                  <li>
                    Open <strong>Chrome</strong> or <strong>Edge</strong> and go to{' '}
                    <code className="bg-gray-100 px-1 rounded">chrome://extensions/</code> or{' '}
                    <code className="bg-gray-100 px-1 rounded">edge://extensions/</code>
                  </li>
                  <li>Enable <strong>Developer mode</strong></li>
                  <li>Click <strong>Load unpacked</strong> and select the extracted folder</li>
                </ol>
              </div>
            </div>

            <div className="border border-purple-200 rounded-lg p-5 bg-purple-50/50">
              <h3 className="text-lg font-semibold text-[#094D7B] mb-3 flex items-center gap-2">
                <Globe className="w-5 h-5 text-purple-600" />
                How to Use
              </h3>
              <p className="text-sm text-gray-700">
                Open an email with resume attachments in Zoho Mail (mail.zoho.com or mail.zoho.in), click the ProValuate icon, select JD and Criteria, then click &quot;Assess Resumes&quot;. Connect Zoho Mail once (link in the add-on modal) if you haven&apos;t already.
              </p>
            </div>

            <div className="border-2 border-[#094D7B]/30 rounded-lg p-5 bg-[#094D7B]/5">
              <h3 className="text-lg font-semibold text-[#094D7B] mb-2">Ready to Get Started?</h3>
              <p className="text-sm text-gray-600 mb-4">
                Download the Zoho Add-on package. The same package works for Chrome and Edge.
              </p>
              <Button
                onClick={() => downloadFile(ZOHO_PLUGIN_ZIP_URL, 'Zoho-Plugin.zip')}
                className="flex items-center gap-2 bg-[#094D7B] text-white shadow-[0_4px_18px_rgba(9,77,123,0.28)] transition-shadow hover:bg-[#094D7B] hover:shadow-[0_6px_22px_rgba(9,77,123,0.34)]"
                size="lg"
              >
                <Download className="w-4 h-4" />
                Download Zoho Add-on (ZIP)
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
          <Button
            variant="ghost"
            size="sm"
            className="absolute left-4 top-4 gap-1 text-sm md:text-base"
            onClick={() => setSelectedProvider(null)}
          >
            <ArrowLeft className="w-5 h-5" /> Back
          </Button>
          <DialogTitle className="text-2xl font-bold text-[#094D7B] pt-10">
            ProValuate for Outlook
          </DialogTitle>
          <DialogDescription className="text-base mt-2">
            Evaluate resume attachments from Outlook. Install the add-in using the manifest file, then sign in with your ProValuate account.
          </DialogDescription>
        </DialogHeader>

        <div className={instructionsSectionClass}>
          <div className="border border-green-200 rounded-lg p-5 bg-green-50/50">
            <h3 className="text-lg font-semibold text-[#094D7B] mb-3 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-green-600" />
              Installation &amp; usage
            </h3>
            <ol className="space-y-3 text-sm text-gray-700 list-decimal list-inside">
              <li>Download the manifest (XML) below and add the add-in in Outlook: <strong>Get Add-ins</strong> → <strong>My Add-ins</strong> → <strong>Add a custom add-in</strong> → <strong>Add from file</strong>. Can&apos;t find where? See Microsoft&apos;s guide: <a href="https://aka.ms/olksideload" target="_blank" rel="noopener noreferrer" className="text-[#094D7B] hover:underline font-medium">aka.ms/olksideload</a>.</li>
              <li>Log in to this website (ProValuate) with your credentials — they will be saved for the add-in.</li>
              <li>In Outlook, open an email that has resume attachments, open the ProValuate pane, and click <strong>Sign in for Outlook</strong>.</li>
              <li>Press <strong>Assess Resumes</strong>. That’s it.</li>
            </ol>
          </div>

          <div className="border-2 border-[#094D7B]/30 rounded-lg p-5 bg-[#094D7B]/5">
            <h3 className="text-lg font-semibold text-[#094D7B] mb-2">Download manifest</h3>
            <p className="text-sm text-gray-600 mb-4">
              Add this manifest in Outlook to install the ProValuate add-in.
            </p>
            <Button
              onClick={() => downloadFile(OUTLOOK_MANIFEST_URL, 'manifest.xml')}
              className="flex items-center gap-2 bg-[#094D7B] text-white shadow-[0_4px_18px_rgba(9,77,123,0.28)] transition-shadow hover:bg-[#094D7B] hover:shadow-[0_6px_22px_rgba(9,77,123,0.34)]"
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
