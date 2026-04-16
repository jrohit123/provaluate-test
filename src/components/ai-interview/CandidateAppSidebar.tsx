import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Settings,
  UserPlus,
  Briefcase,
  LayoutDashboard,
  Share2,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Layers,
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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

const interviewModuleItems = [
  { title: 'Customize Interview', icon: Settings, path: '/candidate-dashboard/jds/configure' },
  { title: 'Generate Interview', icon: UserPlus, path: '/candidate-dashboard/jds/create' },
  { title: 'Interviews', icon: ClipboardList, path: '/candidate-dashboard/interviews' },
];

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
  firstName?: string;
  lastName?: string;
};

/** Matches recruiter `AppSidebar`: navy headers, gray hover, ml-4 nested items, default sidebar button sizing. */
export function CandidateAppSidebar({ firstName, lastName }: CandidateAppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = location.pathname;
  const initials = getInitials(firstName, lastName);
  const fullName = getFullName(firstName, lastName);

  const isInterviewModulePathActive = INTERVIEW_MODULE_PATH_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + '/'),
  );

  const [interviewModuleOpen, setInterviewModuleOpen] = useState(true);

  useEffect(() => {
    if (isInterviewModulePathActive) setInterviewModuleOpen(true);
  }, [isInterviewModulePathActive]);

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

  /** Same vertical rhythm as recruiter `AppSidebar`: default menu gap-1, even spacing between groups. */
  const navMenuClass = 'gap-1';
  const navGroupClass = 'p-0 px-2';

  return (
    <Sidebar className="border-r bg-white" data-tour="candidate-sidebar">
      <SidebarContent className="flex flex-col gap-2 pt-4 pb-4">
        <SidebarGroup className="p-0 px-3 pb-6">
          <div className="flex flex-col items-center gap-4">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[#042C53] font-semibold text-3xl"
              aria-hidden
            >
              {initials}
            </div>
            <p className="text-center text-base font-medium text-[#042C53] leading-tight break-words max-w-full">
              {fullName}
            </p>
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
