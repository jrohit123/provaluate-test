import { Upload, FileText, BarChart3, User, Lightbulb, Settings, FileSignature } from 'lucide-react';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { ActiveSection } from '@/pages/Dashboard';

interface AppSidebarProps {
  activeSection: ActiveSection;
  onSectionChange: (section: ActiveSection) => void;
}

const menuItems = [
  {
    title: 'New Job Upload',
    icon: Upload,
    section: 'job-upload' as ActiveSection,
    description: 'Upload job descriptions and criteria'
  },
  {
    title: 'Resume Uploads',
    icon: FileText,
    section: 'resume-upload' as ActiveSection,
    description: 'Upload and manage candidate resumes'
  },
  {
    title: 'Match Scorecard',
    icon: BarChart3,
    section: 'match-scorecard' as ActiveSection,
    description: 'View candidate scoring and rankings'
  },
  {
    title: 'Candidate Deep Dive',
    icon: User,
    section: 'candidate-dive' as ActiveSection,
    description: 'Detailed candidate analysis'
  },
  {
    title: 'Smart Insights',
    icon: Lightbulb,
    section: 'insights' as ActiveSection,
    description: 'AI-powered match insights'
  },
  {
    title: 'Contracts',
    icon: FileSignature,
    section: 'contracts' as ActiveSection,
    description: 'Manage client contracts'
  },
  {
    title: 'Settings',
    icon: Settings,
    section: 'settings' as ActiveSection,
    description: 'Configure preferences'
  },
];

export function AppSidebar({ activeSection, onSectionChange }: AppSidebarProps) {
  return (
    <Sidebar className="border-r bg-white">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-primary-800 font-semibold">
            Evaluation Tools
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.section}>
                  <SidebarMenuButton
                    onClick={() => onSectionChange(item.section)}
                    isActive={activeSection === item.section}
                    className="group relative"
                    tooltip={item.title}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="font-medium">{item.title}</span>
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
