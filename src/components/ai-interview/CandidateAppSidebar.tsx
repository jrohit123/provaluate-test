import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Settings,
  UserPlus,
  Briefcase,
  User,
  FileText,
  LayoutDashboard,
  Share2,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Layers,
  Camera,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';

const mainItem = {
  title: 'OVERVIEW',
  icon: LayoutDashboard,
  path: '/candidate-dashboard',
};

const profileManagerItems = [
  { title: 'MY PROFILE', icon: User, path: '/candidate-dashboard/profile' },
  { title: 'RESUME', icon: FileText, path: '/candidate-dashboard/resume-builder' },
];

const interviewModuleItems = [
  { title: 'CUSTOMIZE INTERVIEW', icon: Settings, path: '/candidate-dashboard/jds/configure' },
  { title: 'GENERATE INTERVIEW', icon: UserPlus, path: '/candidate-dashboard/jds/create' },
  { title: 'INTERVIEWS', icon: ClipboardList, path: '/candidate-dashboard/interviews' },
];

const PROFILE_MANAGER_PATH_PREFIXES = profileManagerItems.map((i) => i.path);

const INTERVIEW_MODULE_PATH_PREFIXES = interviewModuleItems.map((i) => i.path);

const otherStepItems = [
  { title: 'ANALYTICS', icon: Briefcase, path: '/candidate-dashboard/performance-report' },
  { title: 'REFERRAL SETTINGS', icon: Share2, path: '/candidate-dashboard/referrals' },
];

function getInitials(firstName?: string, lastName?: string): string {
  const first = (firstName?.trim() ?? '').charAt(0).toUpperCase();
  const last = (lastName?.trim() ?? '').charAt(0).toUpperCase();
  if (first || last) return `${first}${last}`;
  return '?';
}

function getFullName(firstName?: string, lastName?: string): string {
  const first = firstName?.trim() ?? '';
  const last = lastName?.trim() ?? '';
  return [first, last].filter(Boolean).join(' ') || 'Candidate';
}

type CandidateAppSidebarProps = {
  candidateId?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string | null;
};

/** Matches recruiter `AppSidebar`: navy headers, gray hover, ml-4 nested items, default sidebar button sizing. */
export function CandidateAppSidebar({ candidateId, firstName, lastName, avatarUrl }: CandidateAppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = location.pathname;
  const initials = getInitials(firstName, lastName);
  const fullName = getFullName(firstName, lastName);

  const isProfileManagerPathActive = PROFILE_MANAGER_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );

  const isInterviewModulePathActive = INTERVIEW_MODULE_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );

  const [profileManagerOpen, setProfileManagerOpen] = useState(true);
  const [interviewModuleOpen, setInterviewModuleOpen] = useState(true);
  const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl ?? '');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showPhotoActions, setShowPhotoActions] = useState(false);
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [selectedImageDataUrl, setSelectedImageDataUrl] = useState<string | null>(null);
  const [cropZoom, setCropZoom] = useState(110);
  const [cropOffsetX, setCropOffsetX] = useState(50);
  const [cropOffsetY, setCropOffsetY] = useState(50);
  const [cropMinZoom, setCropMinZoom] = useState(100);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isProfileManagerPathActive) setProfileManagerOpen(true);
  }, [isProfileManagerPathActive]);

  useEffect(() => {
    if (isInterviewModulePathActive) setInterviewModuleOpen(true);
  }, [isInterviewModulePathActive]);

  useEffect(() => {
    setCurrentAvatarUrl(avatarUrl ?? '');
  }, [avatarUrl]);

  const isActive = (path: string) => {
    if (path === '/candidate-dashboard') {
      return pathname === '/candidate-dashboard' || pathname === '/candidate-dashboard/';
    }
    return pathname === path || pathname.startsWith(path + '/');
  };

  const handleNav = (path: string) => {
    navigate(path);
    if (isMobile) setOpenMobile(false);
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Could not read image file'));
      reader.readAsDataURL(file);
    });

  const getImageDimensions = (src: string): Promise<{ width: number; height: number }> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new Error('Could not read image dimensions'));
      image.src = src;
    });

  const renderSquareCropDataUrl = async (
    sourceDataUrl: string,
    zoomPercent: number,
    offsetXPercent: number,
    offsetYPercent: number,
  ): Promise<string> => {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Could not load image for crop'));
      img.src = sourceDataUrl;
    });

    const outputSize = 512;
    const canvas = document.createElement('canvas');
    canvas.width = outputSize;
    canvas.height = outputSize;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas unavailable');

    const baseScale = Math.max(outputSize / image.width, outputSize / image.height);
    const scale = baseScale * (zoomPercent / 100);
    const scaledWidth = image.width * scale;
    const scaledHeight = image.height * scale;

    const maxOffsetX = Math.max(0, (scaledWidth - outputSize) / 2);
    const maxOffsetY = Math.max(0, (scaledHeight - outputSize) / 2);
    const pixelOffsetX = ((offsetXPercent - 50) / 50) * maxOffsetX;
    const pixelOffsetY = ((offsetYPercent - 50) / 50) * maxOffsetY;

    const drawX = (outputSize - scaledWidth) / 2 - pixelOffsetX;
    const drawY = (outputSize - scaledHeight) / 2 - pixelOffsetY;

    context.clearRect(0, 0, outputSize, outputSize);
    context.drawImage(image, drawX, drawY, scaledWidth, scaledHeight);

    return canvas.toDataURL('image/jpeg', 0.9);
  };

  const uploadAvatar = async (dataUrl: string) => {
    if (!candidateId) return;
    setUploadingAvatar(true);
    const extension = dataUrl.includes('image/png') ? 'png' : 'jpg';
    const filePath = `${candidateId}/${Date.now()}.${extension}`;
    const [, base64Body = ''] = dataUrl.split(',');
    const binary = Uint8Array.from(atob(base64Body), (ch) => ch.charCodeAt(0));

    const { error: uploadError } = await supabase.storage
      .from('candidate-avatars')
      .upload(filePath, binary, {
        upsert: true,
        cacheControl: '3600',
        contentType: extension === 'png' ? 'image/png' : 'image/jpeg',
      });

    if (uploadError) {
      setUploadingAvatar(false);
      window.alert(`Photo upload failed: ${uploadError.message}`);
      return;
    }

    const { data: publicData } = supabase.storage.from('candidate-avatars').getPublicUrl(filePath);
    const nextAvatarUrl = `${publicData.publicUrl}?t=${Date.now()}`;
    const { error: updateError } = await supabase
      .from('candidates')
      .update({ avatar_url: nextAvatarUrl, updated_at: new Date().toISOString() })
      .eq('candidate_id', candidateId);

    setUploadingAvatar(false);
    if (updateError) {
      window.alert(`Could not save profile photo: ${updateError.message}`);
      return;
    }

    setCurrentAvatarUrl(nextAvatarUrl);
    setShowPhotoActions(false);
  };

  const handleAvatarUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !candidateId) return;
    if (!file.type.startsWith('image/')) {
      window.alert('Please choose an image file.');
      return;
    }
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const dims = await getImageDimensions(dataUrl);
      const minZoom = Math.ceil(
        Math.max(1, Math.max(256 / dims.width, 256 / dims.height)) * 100,
      );
      setSelectedImageDataUrl(dataUrl);
      setCropMinZoom(minZoom);
      setCropZoom(Math.max(110, minZoom));
      setCropOffsetX(50);
      setCropOffsetY(50);
      setCropDialogOpen(true);
      setShowPhotoActions(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to process image.';
      window.alert(message);
    }
  };

  const handleCropAndUpload = async () => {
    if (!selectedImageDataUrl) return;
    try {
      const croppedDataUrl = await renderSquareCropDataUrl(
        selectedImageDataUrl,
        cropZoom,
        cropOffsetX,
        cropOffsetY,
      );
      await uploadAvatar(croppedDataUrl);
      setCropDialogOpen(false);
      setSelectedImageDataUrl(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to crop image.';
      window.alert(message);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!candidateId) return;
    setUploadingAvatar(true);
    const { error } = await supabase
      .from('candidates')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('candidate_id', candidateId);
    setUploadingAvatar(false);
    if (error) {
      window.alert(`Could not remove photo: ${error.message}`);
      return;
    }
    setCurrentAvatarUrl('');
    setShowPhotoActions(false);
  };

  /** Same vertical rhythm as recruiter `AppSidebar`: default menu gap-1, even spacing between groups. */
  const navMenuClass = 'gap-1';
  const navGroupClass = 'p-0 px-2';

  return (
    <Sidebar className="border-r bg-white" data-tour="candidate-sidebar">
      <Dialog
        open={cropDialogOpen}
        onOpenChange={(open) => {
          setCropDialogOpen(open);
          if (!open) setSelectedImageDataUrl(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Crop profile photo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="mx-auto h-64 w-64 overflow-hidden rounded-md border border-slate-200 bg-slate-100">
              {selectedImageDataUrl ? (
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    backgroundImage: `url(${selectedImageDataUrl})`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: `${cropOffsetX}% ${cropOffsetY}%`,
                    backgroundSize: `${cropZoom}%`,
                  }}
                />
              ) : null}
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-600">Zoom</label>
              <input
                type="range"
                min={cropMinZoom}
                max={260}
                value={cropZoom}
                onChange={(event) => setCropZoom(Number(event.target.value))}
                className="w-full"
              />
              <label className="block text-xs font-medium text-slate-600">Horizontal</label>
              <input
                type="range"
                min={0}
                max={100}
                value={cropOffsetX}
                onChange={(event) => setCropOffsetX(Number(event.target.value))}
                className="w-full"
              />
              <label className="block text-xs font-medium text-slate-600">Vertical</label>
              <input
                type="range"
                min={0}
                max={100}
                value={cropOffsetY}
                onChange={(event) => setCropOffsetY(Number(event.target.value))}
                className="w-full"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setCropDialogOpen(false);
                  setSelectedImageDataUrl(null);
                }}
                disabled={uploadingAvatar}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-md bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-700 disabled:opacity-60"
                onClick={handleCropAndUpload}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? 'Saving...' : 'Save photo'}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <SidebarContent className="flex flex-col gap-2 pt-4 pb-4">
        <SidebarGroup className="p-0 px-3 pb-6">
          <div className="flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={() => {
                if (!currentAvatarUrl) fileInputRef.current?.click();
                else setShowPhotoActions((prev) => !prev);
              }}
              disabled={uploadingAvatar}
              className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-sky-100 text-[#042C53] font-semibold text-3xl disabled:cursor-not-allowed"
              aria-label={currentAvatarUrl ? 'Manage profile photo' : 'Add profile photo'}
            >
              {currentAvatarUrl ? (
                <img src={currentAvatarUrl} alt={fullName} className="h-full w-full object-cover" />
              ) : (
                <Camera className="h-4 w-4" />
              )}
            </button>
            <p className="text-center text-base font-medium text-[#042C53] leading-tight break-words max-w-full">
              {fullName}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
            {currentAvatarUrl && showPhotoActions ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="inline-flex items-center gap-1 rounded-md border border-sky-200 px-2 py-1 text-xs font-medium text-sky-700 hover:bg-sky-50 disabled:opacity-60"
                >
                  <Camera className="h-3.5 w-3.5" />
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  disabled={uploadingAvatar}
                  className="inline-flex items-center gap-1 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Remove
                </button>
              </div>
            ) : null}
          </div>
        </SidebarGroup>

        {/* OVERVIEW */}
        <SidebarGroup className={`${navGroupClass} mt-1`}>
          <SidebarGroupContent className="p-0">
            <SidebarMenu className={navMenuClass}>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => handleNav(mainItem.path)}
                  isActive={isActive(mainItem.path)}
                  tooltip={mainItem.title}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <mainItem.icon className="h-4 w-4 shrink-0 text-[#042C53]" />
                  <span className="font-bold tracking-[0.06em] text-[#042C53]">{mainItem.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* PROFILE MANAGER */}
        <SidebarGroup className={navGroupClass}>
          <Collapsible open={profileManagerOpen} onOpenChange={setProfileManagerOpen}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                type="button"
                isActive={isProfileManagerPathActive}
                className="cursor-pointer hover:bg-gray-50 flex w-full items-center justify-between"
                tooltip="PROFILE MANAGER"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <User className="h-4 w-4 shrink-0 text-[#042C53]" aria-hidden />
                  <span className="font-bold tracking-[0.06em] text-[#042C53]">PROFILE MANAGER</span>
                </div>
                {profileManagerOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#042C53]" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#042C53]" aria-hidden />
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent className="p-0">
                <SidebarMenu className={navMenuClass}>
                  {profileManagerItems.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        onClick={() => handleNav(item.path)}
                        isActive={isActive(item.path)}
                        className="group relative ml-4 w-full"
                        tooltip={item.title}
                      >
                        <item.icon className="h-4 w-4 shrink-0 text-[#042C53]" />
                        <span className="font-medium text-[#042C53]">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* INTERVIEW MODULE — trigger layout matches recruiter CV SCREENING / INTERVIEW WORKFLOW + leading icon for column alignment */}
        <SidebarGroup className={navGroupClass}>
          <Collapsible open={interviewModuleOpen} onOpenChange={setInterviewModuleOpen}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton
                type="button"
                isActive={isInterviewModulePathActive}
                className="cursor-pointer hover:bg-gray-50 flex w-full items-center justify-between"
                tooltip="INTERVIEW MODULE"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Layers className="h-4 w-4 shrink-0 text-[#042C53]" aria-hidden />
                  <span className="font-bold tracking-[0.06em] text-[#042C53]">INTERVIEW MODULE</span>
                </div>
                {interviewModuleOpen ? (
                  <ChevronDown className="h-4 w-4 shrink-0 text-[#042C53]" aria-hidden />
                ) : (
                  <ChevronRight className="h-4 w-4 shrink-0 text-[#042C53]" aria-hidden />
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent className="p-0">
                <SidebarMenu className={navMenuClass}>
                  {interviewModuleItems.map((item) => (
                    <SidebarMenuItem key={item.path}>
                      <SidebarMenuButton
                        onClick={() => handleNav(item.path)}
                        isActive={isActive(item.path)}
                        className="group relative ml-4 w-full"
                        tooltip={item.title}
                      >
                        <item.icon className="h-4 w-4 shrink-0 text-[#042C53]" />
                        <span className="font-medium text-[#042C53]">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* ANALYTICS + REFERRAL SETTINGS */}
        <SidebarGroup className={navGroupClass}>
          <SidebarGroupContent className="p-0">
            <SidebarMenu className={navMenuClass}>
              {otherStepItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => handleNav(item.path)}
                    isActive={isActive(item.path)}
                    tooltip={item.title}
                    className="cursor-pointer hover:bg-gray-50"
                  >
                    <item.icon className="h-4 w-4 shrink-0 text-[#042C53]" />
                    <span className="font-bold tracking-[0.06em] text-[#042C53]">{item.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
