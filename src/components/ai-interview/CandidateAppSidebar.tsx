import { useLocation, useNavigate } from 'react-router-dom';
import { User, Settings, UserPlus, Briefcase, LayoutDashboard, Share2 } from 'lucide-react';
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
  title: 'My Dashboard',
  icon: LayoutDashboard,
  path: '/candidate-dashboard',
};

const stepItems = [
  // { title: 'My Profile', icon: User, path: '/candidate-dashboard/profile' },
  { title: 'Customize Interview', icon: Settings, path: '/candidate-dashboard/jds/configure' },
  { title: 'Generate Interview', icon: UserPlus, path: '/candidate-dashboard/jds/create' },
  { title: 'Performance Report', icon: Briefcase, path: '/candidate-dashboard/interviews' },
  { title: 'Revenue & Billing', icon: Share2, path: '/candidate-dashboard/referrals' },
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

export function CandidateAppSidebar({ firstName, lastName }: CandidateAppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { isMobile, setOpenMobile } = useSidebar();
  const pathname = location.pathname;
  const initials = getInitials(firstName, lastName);
  const fullName = getFullName(firstName, lastName);

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

  const menuBtnClass =
    'py-3.5 px-3 text-lg font-medium text-gray-800 hover:bg-sky-50 hover:text-sky-800 data-[active=true]:bg-sky-100 data-[active=true]:text-sky-800 [&>svg]:w-6 [&>svg]:h-6';

  return (
    <Sidebar className="border-r border-sky-100 bg-white" data-tour="candidate-sidebar">
      <SidebarContent className="gap-0 pt-4 pb-4">
        {/* Profile: circle with initials + full name */}
        <SidebarGroup className="px-3 pb-4">
          <div className="flex flex-col items-center gap-4">
            <div
              className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800 font-semibold text-3xl"
              aria-hidden
            >
              {initials}
            </div>
            <p className="text-center text-lg font-medium text-gray-900 leading-tight break-words max-w-full">
              {fullName}
            </p>
          </div>
        </SidebarGroup>

        <SidebarGroup className="pt-8 pb-0">
          <SidebarGroupContent className="py-0">
            <SidebarMenu className="flex flex-col gap-3">
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => handleNav(mainItem.path)}
                  isActive={isActive(mainItem.path)}
                  tooltip={mainItem.title}
                  className={menuBtnClass}
                >
                  <mainItem.icon className="w-6 h-6 shrink-0" />
                  <span>{mainItem.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {stepItems.map((item) => (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton
                    onClick={() => handleNav(item.path)}
                    isActive={isActive(item.path)}
                    tooltip={item.title}
                    className={menuBtnClass}
                  >
                    <item.icon className="w-6 h-6 shrink-0" />
                    <span>{item.title}</span>
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
