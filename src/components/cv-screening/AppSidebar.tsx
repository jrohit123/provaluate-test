import { Upload, FileText, BarChart3, User, Lightbulb, Settings, Users, Monitor, Wrench, Cog, ChevronDown, ChevronRight, Search, Video } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from '@/components/ui/sidebar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ActiveSection } from '@/pages/Dashboard';
import { useAuth } from '@/hooks/use-auth';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/contexts/SessionContext';
import { Card, CardContent } from '@/components/ui/card';
import { useState } from 'react';

interface AppSidebarProps {
  activeSection: ActiveSection;
  onSectionChange: (section: ActiveSection) => void;
}

// Main Dashboard (always visible)
const mainDashboardItem = {
  title: 'Main Dashboard',
  icon: Monitor,
  section: 'main-dashboard' as ActiveSection,
  description: 'Overview and quick actions'
};

// CV Screening section items
const cvScreeningItems = [
  {
    title: 'New Job Upload',
    icon: Upload,
    section: 'job-upload' as ActiveSection,
    description: 'Upload job descriptions and criteria'
  },
  {
    title: 'Evaluation Criteria',
    icon: Wrench,
    section: 'evaluation-criteria' as ActiveSection,
    description: 'Set up assessment parameters and criteria'
  },
  {
    title: 'Resume Upload',
    icon: FileText,
    section: 'resume-upload' as ActiveSection,
    description: 'Upload and manage candidate resumes'
  },
  {
    title: 'View All Results',
    icon: BarChart3,
    section: 'match-scorecard' as ActiveSection,
    description: 'View candidate scoring and rankings'
  }
];

// Interview Management section items
const interviewManagementItems = [
  {
    title: 'Interview Creation',
    icon: Cog,
    section: 'setup' as ActiveSection,
    description: 'Configure interview parameters and job descriptions'
  },
  {
    title: 'Send Interview',
    icon: Users,
    section: 'ai-interview' as ActiveSection,
    description: 'View and manage assessment frameworks'
  },
  {
    title: 'Interview Dashboard',
    icon: Monitor,
    section: 'interview-dashboard' as ActiveSection,
    description: 'View and manage interview sessions'
  }
];

// Settings (separate section)
const settingsItem = {
  title: 'Settings',
  icon: Settings,
  section: 'settings' as ActiveSection,
  description: 'Configure preferences'
};

export function AppSidebar({ activeSection, onSectionChange }: AppSidebarProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { currentJobDescription, currentEvaluationCriteria, isSessionComplete } = useSession();
  
  // State for collapsible sections
  const [isCvScreeningOpen, setIsCvScreeningOpen] = useState(true);
  const [isInterviewManagementOpen, setIsInterviewManagementOpen] = useState(true);
  
  // Check if user can access settings
  const canAccessSettings = user?.profile?.role === 'admin' || user?.profile?.role === 'superadmin';

  // Handle section change with URL navigation
  const handleSectionChange = (section: ActiveSection) => {
    onSectionChange(section);
    navigate(`/dashboard?section=${section}`);
  };

  return (
    <Sidebar className="border-r bg-white">
      <SidebarContent className="space-y-0">
        {/* Main Dashboard - Always visible */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => handleSectionChange(mainDashboardItem.section)}
                  isActive={activeSection === mainDashboardItem.section}
                  className="group relative"
                  tooltip={mainDashboardItem.title}
                >
                  <mainDashboardItem.icon className="w-4 h-4" />
                  <span className="font-medium">{mainDashboardItem.title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* CV Screening - Collapsible */}
        <SidebarGroup>
          <Collapsible open={isCvScreeningOpen} onOpenChange={setIsCvScreeningOpen}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton className="cursor-pointer hover:bg-gray-50 flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Search className="w-4 h-4" />
                  <span className="font-medium">CV Screening</span>
                </div>
                {isCvScreeningOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {cvScreeningItems.map((item) => (
                    <SidebarMenuItem key={item.section}>
                      <SidebarMenuButton
                        onClick={() => handleSectionChange(item.section)}
                        isActive={activeSection === item.section}
                        className="group relative ml-4"
                        tooltip={item.title}
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="font-medium">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Interview Management - Collapsible */}
        <SidebarGroup>
          <Collapsible open={isInterviewManagementOpen} onOpenChange={setIsInterviewManagementOpen}>
            <CollapsibleTrigger asChild>
              <SidebarMenuButton className="cursor-pointer hover:bg-gray-50 flex items-center justify-between w-full">
                <div className="flex items-center gap-2">
                  <Video className="w-4 h-4" />
                  <span className="font-medium">Interview Management</span>
                </div>
                {isInterviewManagementOpen ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>
                  {interviewManagementItems.map((item) => (
                    <SidebarMenuItem key={item.section}>
                      <SidebarMenuButton
                        onClick={() => handleSectionChange(item.section)}
                        isActive={activeSection === item.section}
                        className="group relative ml-4"
                        tooltip={item.title}
                      >
                        <item.icon className="w-4 h-4" />
                        <span className="font-medium">{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        {/* Settings - Separate section */}
        {canAccessSettings && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => handleSectionChange(settingsItem.section)}
                    isActive={activeSection === settingsItem.section}
                    className="group relative"
                    tooltip={settingsItem.title}
                  >
                    <settingsItem.icon className="w-4 h-4" />
                    <span className="font-medium">{settingsItem.title}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      
      <SidebarFooter className="p-4">
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-blue-900">Current Session</h3>
              {isSessionComplete ? (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-green-600 font-medium">Complete</span>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                  <span className="text-xs text-orange-600 font-medium">In Progress</span>
                </div>
              )}
            </div>
            
            <div className="space-y-3">
              <div className="bg-white/60 backdrop-blur-sm rounded-md p-3 border border-blue-100">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-3 h-3 text-blue-600" />
                  <span className="text-xs font-medium text-blue-800">Job Description</span>
                </div>
                <div className="text-xs text-gray-700 truncate pl-5">
                  {currentJobDescription ? currentJobDescription.title || 'Selected' : 'Not selected'}
                </div>
              </div>
              
              <div className="bg-white/60 backdrop-blur-sm rounded-md p-3 border border-blue-100">
                <div className="flex items-center gap-2 mb-1">
                  <Wrench className="w-3 h-3 text-blue-600" />
                  <span className="text-xs font-medium text-blue-800">Evaluation Criteria</span>
                </div>
                <div className="text-xs text-gray-700 truncate pl-5">
                  {currentEvaluationCriteria ? currentEvaluationCriteria.name || 'Selected' : 'Not selected'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
