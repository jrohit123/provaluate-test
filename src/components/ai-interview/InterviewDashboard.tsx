import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { buildApiUrl, API_CONFIG } from '@/constants/api';
import { useAuth } from '@/hooks/use-auth';
import { CompactStepProgress } from '@/components/cv-screening/CompactStepProgress';
import { useInterviewCurrentStep, useInterviewNavigateToStep, INTERVIEW_WORKFLOW_STEPS } from '@/hooks/useWorkflowNavigation';
import { 
  Search, 
  Users, 
  Clock, 
  Calendar, 
  BarChart3, 
  Play, 
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Maximize2,
  Minimize2,
  Link
} from 'lucide-react';

interface Interview {
  id: string;
  candidate_name: string;
  candidate_email: string;
  position: string;
  status: 'active' | 'completed' | 'terminated';
  duration_minutes: number;
  actual_duration_minutes?: number;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  terminated_at?: string;
  termination_reason?: string;
  current_question_index: number;
  total_questions: number;
  overall_score?: number;
  interview_type: string;
  // New HR fields
  decision?: 'accept' | 'reject' | null;
  hr_comments?: string;
  reminder_sent?: boolean;
  reminder_sent_at?: string;
}

interface InterviewDashboardProps {
  onSectionChange?: (section: string) => void;
  onSectionReady?: () => void;
}

const InterviewDashboard: React.FC<InterviewDashboardProps> = ({ onSectionChange, onSectionReady }) => {
  const { user } = useAuth();
  const interviewCurrentStep = useInterviewCurrentStep();
  const interviewNavigateToStep = useInterviewNavigateToStep();
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // State for HR decision management
  const [saveStates, setSaveStates] = useState<{[key: string]: 'idle' | 'saving' | 'saved' | 'error'}>({});
  const [reminderStates, setReminderStates] = useState<{[key: string]: 'idle' | 'sending' | 'sent' | 'error'}>({});
  const [localDecisions, setLocalDecisions] = useState<{[key: string]: string}>({});
  const [localComments, setLocalComments] = useState<{[key: string]: string}>({});
  const [savedDecisions, setSavedDecisions] = useState<{[key: string]: string}>({});
  const [savedComments, setSavedComments] = useState<{[key: string]: string}>({});
  const [expandedComments, setExpandedComments] = useState<{[key: string]: boolean}>({});
  const [expandDialogStates, setExpandDialogStates] = useState<{[key: string]: boolean}>({});
  const [linkModalInterviewId, setLinkModalInterviewId] = useState<string | null>(null);

  useEffect(() => {
    fetchInterviews();
  }, [user?.profile?.company_id]);

  // Signal section ready on mount so the tour can start immediately (like AIsetup / HRInterviewCreator).
  // Do not wait for fetchInterviews() — tour targets are in the DOM as soon as the section renders.
  useEffect(() => {
    const t = setTimeout(() => onSectionReady?.(), 400);
    return () => clearTimeout(t);
  }, [onSectionReady]);

  const fetchInterviews = async () => {
    if (!user?.profile?.company_id) {
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const apiUrl = `${buildApiUrl(API_CONFIG.ENDPOINTS.GET_ALL_INTERVIEWS)}?company_id=${user.profile.company_id}`;
      const response = await fetch(apiUrl);
      if (response.ok) {
        const data = await response.json();
        const interviewsData = data.interviews || [];
        setInterviews(interviewsData);
        
        // Initialize saved states with current database values
        const initialSavedDecisions: {[key: string]: string} = {};
        const initialSavedComments: {[key: string]: string} = {};
        const initialLocalDecisions: {[key: string]: string} = {};
        const initialLocalComments: {[key: string]: string} = {};
        
        interviewsData.forEach((interview: Interview) => {
          const decision = interview.decision || '';
          const comments = interview.hr_comments || '';
          
          initialSavedDecisions[interview.id] = decision;
          initialSavedComments[interview.id] = comments;
          initialLocalDecisions[interview.id] = decision;
          initialLocalComments[interview.id] = comments;
        });
        
        setSavedDecisions(initialSavedDecisions);
        setSavedComments(initialSavedComments);
        setLocalDecisions(initialLocalDecisions);
        setLocalComments(initialLocalComments);
      }
    } catch (error) {
      console.error('Error fetching interviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredInterviews = interviews.filter(interview => {
    try {
      const searchLower = searchTerm?.toLowerCase() || '';
      const matchesSearch = (interview.candidate_name?.toLowerCase().includes(searchLower) || false) ||
                           (interview.position?.toLowerCase().includes(searchLower) || false) ||
                           (interview.candidate_email?.toLowerCase().includes(searchLower) || false);
      const matchesStatus = statusFilter === 'all' || interview.status === statusFilter;
      return matchesSearch && matchesStatus;
    } catch (error) {
      console.error('Error filtering interview:', error, interview);
      return false;
    }
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <Play className="w-4 h-4" />;
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      case 'terminated':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'terminated':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatDuration = (minutes: number) => {
    const roundedMinutes = Math.round(minutes);
    if (roundedMinutes < 60) {
      return `${roundedMinutes}m`;
    }
    const hours = Math.floor(roundedMinutes / 60);
    const remainingMinutes = roundedMinutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  };

  // Calculate duration from timestamps as fallback
  const calculateDurationFromTimestamps = (interview: Interview): number | null => {
    const startedAt = interview.started_at;
    const endedAt = interview.terminated_at || interview.completed_at;
    
    if (startedAt && endedAt) {
      try {
        const start = new Date(startedAt);
        const end = new Date(endedAt);
        const diffMs = end.getTime() - start.getTime();
        const diffMinutes = diffMs / (1000 * 60);
        return Math.round(diffMinutes);
      } catch (error) {
        console.error('Error calculating duration from timestamps:', error);
        return null;
      }
    }
    return null;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Handler functions for HR decision management
  const handleDecisionChange = (interviewId: string, decision: string) => {
    setLocalDecisions(prev => ({...prev, [interviewId]: decision}));
  };

  const handleCommentsChange = (interviewId: string, comments: string) => {
    setLocalComments(prev => ({...prev, [interviewId]: comments}));
  };

  const toggleCommentsExpanded = (interviewId: string) => {
    setExpandedComments(prev => ({
      ...prev,
      [interviewId]: !prev[interviewId]
    }));
  };

  const toggleExpandDialog = (interviewId: string) => {
    setExpandDialogStates(prev => ({
      ...prev,
      [interviewId]: !prev[interviewId]
    }));
  };

  // Check if text is long enough to benefit from expansion
  const isLongText = (text: string) => {
    return text && text.length > 100;
  };

  // Check if there are unsaved changes for an interview
  const hasUnsavedChanges = (interviewId: string) => {
    const currentDecision = localDecisions[interviewId] || '';
    const currentComments = localComments[interviewId] || '';
    const savedDecision = savedDecisions[interviewId] || '';
    const savedComment = savedComments[interviewId] || '';
    
    return currentDecision !== savedDecision || currentComments !== savedComment;
  };

  const handleSave = async (interviewId: string) => {
    setSaveStates(prev => ({...prev, [interviewId]: 'saving'}));
    
    try {
      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.UPDATE_INTERVIEW_DECISION), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interview_id: interviewId,
          decision: localDecisions[interviewId] || null,
          hr_comments: localComments[interviewId] || null
        })
      });
      
      if (response.ok) {
        setSaveStates(prev => ({...prev, [interviewId]: 'saved'}));
        
        // Update the interviews state with the new data
        const result = await response.json();
        setInterviews(prev => prev.map(interview => 
          interview.id === interviewId 
            ? { ...interview, decision: result.data.decision, hr_comments: result.data.hr_comments }
            : interview
        ));
        
        // Update saved states to match current local states
        setSavedDecisions(prev => ({
          ...prev,
          [interviewId]: localDecisions[interviewId] || ''
        }));
        setSavedComments(prev => ({
          ...prev,
          [interviewId]: localComments[interviewId] || ''
        }));
        
        // Auto-reset to idle after 3 seconds
        setTimeout(() => {
          setSaveStates(prev => ({...prev, [interviewId]: 'idle'}));
        }, 3000);
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      console.error('Error saving decision:', error);
      setSaveStates(prev => ({...prev, [interviewId]: 'error'}));
      
      // Auto-reset to idle after 3 seconds
      setTimeout(() => {
        setSaveStates(prev => ({...prev, [interviewId]: 'idle'}));
      }, 3000);
    }
  };

  const handleRemind = async (interviewId: string) => {
    const interview = interviews.find(i => i.id === interviewId);
    if (!interview) return;

    // Set sending state
    setReminderStates(prev => ({...prev, [interviewId]: 'sending'}));

    try {
      const interviewLink = `${window.location.origin}${import.meta.env.BASE_URL}interview/${interviewId}`;
      
      const response = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.SEND_INTERVIEW_EMAIL), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidate_email: interview.candidate_email,
          candidate_name: interview.candidate_name,
          interview_link: interviewLink,
          position: interview.position,
          interview_type: interview.interview_type || 'mixed'
        })
      });
      
      const result = await response.json();
      
      if (result.success) {
        setReminderStates(prev => ({...prev, [interviewId]: 'sent'}));
        
        // Auto-reset to idle after 3 seconds
        setTimeout(() => {
          setReminderStates(prev => ({...prev, [interviewId]: 'idle'}));
        }, 3000);
      } else {
        setReminderStates(prev => ({...prev, [interviewId]: 'error'}));
        
        // Auto-reset to idle after 3 seconds
        setTimeout(() => {
          setReminderStates(prev => ({...prev, [interviewId]: 'idle'}));
        }, 3000);
      }
    } catch (error) {
      console.error('Error sending reminder email:', error);
      setReminderStates(prev => ({...prev, [interviewId]: 'error'}));
      
      // Auto-reset to idle after 3 seconds
      setTimeout(() => {
        setReminderStates(prev => ({...prev, [interviewId]: 'idle'}));
      }, 3000);
    }
  };

  // Add error boundary for debugging
  if (!interviews) {
    return <div className="p-6">Loading...</div>;
  }

  try {
    return (
      <div className="min-h-screen">
      <div className="lg:hidden">
        <CompactStepProgress
          current={interviewCurrentStep}
          total={INTERVIEW_WORKFLOW_STEPS.length}
          steps={INTERVIEW_WORKFLOW_STEPS}
          onStepClick={interviewNavigateToStep}
        />
      </div>
      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-primary-800 mb-2">Interview Sessions</h2>
        <p className="text-sm sm:text-base text-muted-foreground">Monitor and manage all interview sessions</p>
      </div>

      <div data-tour="interview-dashboard-stats" className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between mb-4 sm:mb-6 gap-3">
        <div></div>
        <Button 
          onClick={() => onSectionChange?.('ai-interview')}
          className="w-full bg-[#094D7B] text-white hover:bg-[#094D7B]/90 sm:w-auto"
        >
          Start New Interview
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <Card className="animate-fade-in">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs sm:text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-xl sm:text-2xl font-bold text-primary-800">{interviews.length}</p>
              </div>
              <Users className="w-6 h-6 sm:w-8 sm:h-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Active</p>
                <p className="text-2xl font-bold text-primary-600">
                  {interviews.filter(i => i.status === 'active').length}
                </p>
              </div>
              <Play className="w-8 h-8 text-primary-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold text-green-600">
                  {interviews.filter(i => i.status === 'completed').length}
                </p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Terminated</p>
                <p className="text-2xl font-bold text-red-600">
                  {interviews.filter(i => i.status === 'terminated').length}
                </p>
              </div>
              <XCircle className="w-8 h-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>
      </div>

      {/* Filters */}
      <div data-tour="interview-dashboard-filters" className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search interviews..."
            value={searchTerm}
            onChange={(e) => {
              console.log('Search term changed:', e.target.value);
              setSearchTerm(e.target.value);
            }}
            className="pl-10 text-sm sm:text-base"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="terminated">Terminated</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="animate-fade-in" data-tour="interview-dashboard-area">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary-600" />
            Interview Sessions
          </CardTitle>
          <CardDescription>
            View and manage all interview sessions
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2 ml-2">Loading interviews...</p>
            </div>
          ) : filteredInterviews.length === 0 ? (
            <div className="text-center py-8">
              <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No interviews found</p>
              <p className="text-sm text-muted-foreground mt-2">Start your first interview to see results here</p>
              <Button
                onClick={() => onSectionChange?.('ai-interview')}
                className="mt-4 bg-[#094D7B] text-white hover:bg-[#094D7B]/90"
              >
                Start New Interview
              </Button>
            </div>
          ) : (
            <>
              {/* Mobile Card View - shown on screens smaller than md */}
              <div className="md:hidden space-y-4 p-4">
                {filteredInterviews.map((interview) => (
                  <Card key={interview.id} className="border border-gray-200">
                    <CardContent className="p-4 space-y-4">
                      {/* Header Section */}
                      <div className="flex items-start justify-between border-b pb-3">
                        <div className="flex-1">
                          <div className="font-semibold text-base text-gray-900 mb-1">
                            {interview.candidate_name}
                          </div>
                          <div className="text-xs text-gray-500 break-words mb-2">
                            {interview.candidate_email}
                          </div>
                          <button
                            type="button"
                            onClick={() => setLinkModalInterviewId(interview.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                          >
                            <Link className="h-3 w-3 flex-shrink-0" />
                            {interview.position}
                          </button>
                        </div>
                        <Badge className={`${getStatusColor(interview.status)} text-xs`}>
                          {getStatusIcon(interview.status)}
                          <span className="ml-1 capitalize">
                            {interview.status}
                          </span>
                        </Badge>
                      </div>

                      {/* Info Grid */}
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div>
                            <div className="text-xs text-gray-500">Duration</div>
                            <div className="font-medium text-gray-900">
                              {interview.actual_duration_minutes 
                                ? formatDuration(interview.actual_duration_minutes)
                                : (() => {
                                    const calculated = calculateDurationFromTimestamps(interview);
                                    return calculated !== null 
                                      ? formatDuration(calculated)
                                      : formatDuration(interview.duration_minutes);
                                  })()
                              }
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <div>
                            <div className="text-xs text-gray-500">Created</div>
                            <div className="font-medium text-gray-900">{formatDate(interview.created_at)}</div>
                          </div>
                        </div>
                        {interview.overall_score !== null && interview.overall_score !== undefined && (
                          <div className="flex items-center gap-2">
                            <BarChart3 className="w-4 h-4 text-gray-400 flex-shrink-0" />
                            <div>
                              <div className="text-xs text-gray-500">Score</div>
                              <div className="font-medium text-gray-900">{interview.overall_score != null ? (Math.round(Number(interview.overall_score) * 10) / 10).toFixed(1) : '—'}</div>
                            </div>
                          </div>
                        )}
                        {(interview.status === 'completed' || interview.status === 'terminated') && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`${import.meta.env.BASE_URL}final-results/${interview.id}?variant=recruiter`, '_blank')}
                              className="w-full"
                            >
                              <BarChart3 className="w-4 h-4 mr-2" />
                              View Details
                            </Button>
                          </div>
                        )}
                      </div>

                      {/* Decision Section */}
                      <div className="space-y-2">
                        <Label className="text-xs font-medium text-gray-700">Decision</Label>
                        <Select
                          value={localDecisions[interview.id] || interview.decision || ''}
                          onValueChange={(value) => handleDecisionChange(interview.id, value)}
                        >
                          <SelectTrigger className="w-full text-xs">
                            <SelectValue placeholder="Select decision" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="accept">Accept</SelectItem>
                            <SelectItem value="reject">Reject</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Comments Section */}
                      <div className="space-y-2">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                          <Label className="text-xs font-medium text-gray-700">Comments</Label>
                          {(localComments[interview.id] || interview.hr_comments || '') && (
                            <Dialog open={expandDialogStates[interview.id] || false} onOpenChange={(open) => setExpandDialogStates(prev => ({...prev, [interview.id]: open}))}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-blue-600 hover:text-blue-700 flex items-center gap-1 w-full sm:w-auto"
                                >
                                  <Maximize2 className="h-4 w-4" />
                                  Expand
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh] overflow-hidden">
                                <DialogHeader>
                                  <DialogTitle className="text-lg sm:text-xl">Interview Comments - {interview.candidate_name}</DialogTitle>
                                  <DialogDescription className="text-sm sm:text-base">
                                    View and edit detailed comments for this candidate interview.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="overflow-y-auto max-h-[60vh]">
                                  <textarea
                                    value={localComments[interview.id] || interview.hr_comments || ''}
                                    onChange={(e) => handleCommentsChange(interview.id, e.target.value)}
                                    placeholder="Enter your comments..."
                                    className="w-full p-3 sm:p-4 border border-gray-300 rounded-md text-sm sm:text-base resize-none focus:outline-none focus:border-gray-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                                    rows={15}
                                  />
                                </div>
                                <div className="flex justify-end gap-2 p-4 border-t">
                                  <Button
                                    variant="outline"
                                    onClick={() => setExpandDialogStates(prev => ({...prev, [interview.id]: false}))}
                                  >
                                    Close
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      handleSave(interview.id);
                                      setExpandDialogStates(prev => ({...prev, [interview.id]: false}));
                                    }}
                                    disabled={saveStates[interview.id] === 'saving' || !hasUnsavedChanges(interview.id)}
                                    className={`
                                      transition-all duration-200
                                      ${saveStates[interview.id] === 'saved' 
                                        ? 'bg-green-500 text-white hover:bg-green-600' 
                                        : saveStates[interview.id] === 'saving'
                                        ? 'bg-yellow-500 text-white cursor-not-allowed' 
                                        : saveStates[interview.id] === 'error'
                                        ? 'bg-red-500 text-white hover:bg-red-600'
                                        : hasUnsavedChanges(interview.id)
                                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                                        : 'bg-gray-400 text-white cursor-not-allowed'
                                      }
                                    `}
                                  >
                                    {saveStates[interview.id] === 'saved' ? '✓ Saved' : 
                                     saveStates[interview.id] === 'saving' ? 'Saving...' :
                                     saveStates[interview.id] === 'error' ? '✗ Error' :
                                     hasUnsavedChanges(interview.id) ? 'Save' : '✓ Saved'}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </div>
                        <div className="relative">
                          <textarea
                            value={localComments[interview.id] || interview.hr_comments || ''}
                            onChange={(e) => handleCommentsChange(interview.id, e.target.value)}
                            placeholder="Enter your comments..."
                            className="w-full p-2 pr-8 border border-gray-300 rounded-md text-xs resize-none focus:outline-none focus:border-gray-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                            rows={2}
                          />
                          <Dialog open={expandDialogStates[interview.id] || false} onOpenChange={(open) => setExpandDialogStates(prev => ({...prev, [interview.id]: open}))}>
                            <DialogTrigger asChild>
                              <button
                                className="absolute top-2 right-2 p-1 transition-colors rounded text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                title="Open in expanded view"
                              >
                                <Maximize2 className="w-4 h-4" />
                              </button>
                            </DialogTrigger>
                            <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh] overflow-hidden">
                              <DialogHeader>
                                <DialogTitle className="text-lg sm:text-xl">Interview Comments - {interview.candidate_name}</DialogTitle>
                                <DialogDescription className="text-sm sm:text-base">
                                  View and edit detailed comments for this candidate interview.
                                </DialogDescription>
                              </DialogHeader>
                              <div className="overflow-y-auto max-h-[60vh]">
                                <textarea
                                  value={localComments[interview.id] || interview.hr_comments || ''}
                                  onChange={(e) => handleCommentsChange(interview.id, e.target.value)}
                                  placeholder="Enter your comments..."
                                  className="w-full p-3 sm:p-4 border border-gray-300 rounded-md text-sm sm:text-base resize-none focus:outline-none focus:border-gray-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                                  rows={15}
                                />
                              </div>
                              <div className="flex justify-end gap-2 p-4 border-t">
                                <Button
                                  variant="outline"
                                  onClick={() => setExpandDialogStates(prev => ({...prev, [interview.id]: false}))}
                                >
                                  Close
                                </Button>
                                <Button
                                  onClick={() => {
                                    handleSave(interview.id);
                                    setExpandDialogStates(prev => ({...prev, [interview.id]: false}));
                                  }}
                                  disabled={saveStates[interview.id] === 'saving' || !hasUnsavedChanges(interview.id)}
                                  className={`
                                    transition-all duration-200
                                    ${saveStates[interview.id] === 'saved' 
                                      ? 'bg-green-500 text-white hover:bg-green-600' 
                                      : saveStates[interview.id] === 'saving'
                                      ? 'bg-yellow-500 text-white cursor-not-allowed' 
                                      : saveStates[interview.id] === 'error'
                                      ? 'bg-red-500 text-white hover:bg-red-600'
                                      : hasUnsavedChanges(interview.id)
                                      ? 'bg-blue-500 text-white hover:bg-blue-600'
                                      : 'bg-gray-400 text-white cursor-not-allowed'
                                      }
                                    `}
                                >
                                  {saveStates[interview.id] === 'saved' ? '✓ Saved' : 
                                   saveStates[interview.id] === 'saving' ? 'Saving...' :
                                   saveStates[interview.id] === 'error' ? '✗ Error' :
                                   hasUnsavedChanges(interview.id) ? 'Save' : '✓ Saved'}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-col gap-2 pt-2 border-t">
                        <Button
                          size="sm"
                          onClick={() => handleSave(interview.id)}
                          disabled={saveStates[interview.id] === 'saving' || !hasUnsavedChanges(interview.id)}
                          className={`
                            text-xs px-3 py-2 h-auto transition-all duration-200 w-full
                            ${saveStates[interview.id] === 'saved' 
                              ? 'bg-green-500 text-white hover:bg-green-600' 
                              : saveStates[interview.id] === 'saving'
                              ? 'bg-yellow-500 text-white cursor-not-allowed' 
                              : saveStates[interview.id] === 'error'
                              ? 'bg-red-500 text-white hover:bg-red-600'
                              : hasUnsavedChanges(interview.id)
                              ? 'bg-blue-500 text-white hover:bg-blue-600'
                              : 'bg-gray-400 text-white cursor-not-allowed'
                            }
                          `}
                        >
                          {saveStates[interview.id] === 'saved' ? '✓ Saved' : 
                           saveStates[interview.id] === 'saving' ? 'Saving...' :
                           saveStates[interview.id] === 'error' ? '✗ Error' :
                           hasUnsavedChanges(interview.id) ? 'Save' : '✓ Saved'}
                        </Button>
                        
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRemind(interview.id)}
                          disabled={reminderStates[interview.id] === 'sending' || interview.status !== 'active'}
                          className={`
                            text-xs px-3 py-2 h-auto transition-all duration-200 w-full
                            ${reminderStates[interview.id] === 'sent' 
                              ? 'bg-green-100 text-green-700 border-green-300' 
                              : reminderStates[interview.id] === 'sending'
                              ? 'bg-yellow-100 text-yellow-700 border-yellow-300 cursor-not-allowed'
                              : reminderStates[interview.id] === 'error'
                              ? 'bg-red-100 text-red-700 border-red-300'
                              : interview.status !== 'active'
                              ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                              : 'hover:bg-gray-50'
                            }
                          `}
                        >
                          {reminderStates[interview.id] === 'sent' ? '✓ Sent' : 
                           reminderStates[interview.id] === 'sending' ? 'Sending...' :
                           reminderStates[interview.id] === 'error' ? '✗ Error' :
                           'Remind'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Desktop Table View - shown on md and larger screens */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full border border-gray-200">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200 text-sm">Candidate</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200 text-sm">Position</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200 text-sm">Status</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200 text-sm">Duration</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200 text-sm">Created</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200 text-sm">View Details</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200 text-sm">Score</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200 text-sm">Decision</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200 text-sm">Comments</th>
                      <th className="text-center py-3 px-4 font-medium text-gray-900 text-sm">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredInterviews.map((interview) => (
                      <tr key={interview.id} className="border-b border-gray-200 hover:bg-gray-50">
                        <td className="py-3 px-4 border-r border-gray-200">
                          <div>
                            <div className="font-medium text-gray-900 text-sm">{interview.candidate_name}</div>
                            <div className="text-xs text-gray-500 break-words">{interview.candidate_email}</div>
                          </div>
                        </td>
                        <td className="py-3 px-4 border-r border-gray-200">
                          <button
                            type="button"
                            onClick={() => setLinkModalInterviewId(interview.id)}
                            className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-0.5 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground cursor-pointer"
                          >
                            <Link className="h-3 w-3 flex-shrink-0" />
                            {interview.position}
                          </button>
                        </td>
                        <td className="py-3 px-4 border-r border-gray-200">
                          <Badge className={`${getStatusColor(interview.status)} text-xs`}>
                            {getStatusIcon(interview.status)}
                            <span className="ml-1 capitalize">
                              {interview.status}
                              {interview.status === 'terminated' && interview.termination_reason && (
                                <span className="ml-1">({interview.termination_reason})</span>
                              )}
                            </span>
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-sm border-r border-gray-200">
                          <div className="flex items-center">
                            <Clock className="w-4 h-4 text-gray-400 mr-2" />
                            <span>
                              {interview.actual_duration_minutes 
                                ? formatDuration(interview.actual_duration_minutes)
                                : (() => {
                                    const calculated = calculateDurationFromTimestamps(interview);
                                    return calculated !== null 
                                      ? formatDuration(calculated)
                                      : formatDuration(interview.duration_minutes);
                                  })()
                              }
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm border-r border-gray-200 text-center">
                          <div className="flex items-center justify-center">
                            <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                            <span>{formatDate(interview.created_at)}</span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-center border-r border-gray-200">
                          {(interview.status === 'completed' || interview.status === 'terminated') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(`${import.meta.env.BASE_URL}final-results/${interview.id}?variant=recruiter`, '_blank')}
                              title={interview.status === 'terminated' ? 'View Interview Details (Terminated)' : 'View Final Results'}
                              className="h-8 w-8 p-0"
                            >
                              <BarChart3 className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                        <td className="py-3 px-4 border-r border-gray-200">
                          <div className="flex items-center justify-center">
                            <span className="text-sm">{interview.overall_score != null ? (Math.round(Number(interview.overall_score) * 10) / 10).toFixed(1) : '—'}</span>
                          </div> 
                        </td>
                        {/* Decision Column */}
                        <td className="py-3 px-4 border-r border-gray-200">
                          <Select
                            value={localDecisions[interview.id] || interview.decision || ''}
                            onValueChange={(value) => handleDecisionChange(interview.id, value)}
                          >
                            <SelectTrigger className="w-full text-sm">
                              <SelectValue placeholder="Select" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="accept">Accept</SelectItem>
                              <SelectItem value="reject">Reject</SelectItem>
                            </SelectContent>
                          </Select>
                        </td>
                        {/* Comments Column */}
                        <td className="py-3 px-4 border-r border-gray-200">
                          <div className="relative">
                            <textarea
                              value={localComments[interview.id] || interview.hr_comments || ''}
                              onChange={(e) => handleCommentsChange(interview.id, e.target.value)}
                              placeholder="Enter your comments..."
                              className="w-full p-2 pr-8 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:border-gray-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                              rows={2}
                            />
                            <Dialog open={expandDialogStates[interview.id] || false} onOpenChange={(open) => setExpandDialogStates(prev => ({...prev, [interview.id]: open}))}>
                              <DialogTrigger asChild>
                                <button
                                  className="absolute top-2 right-2 p-1 transition-colors rounded text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                  title="Open in expanded view"
                                >
                                  <Maximize2 className="w-4 h-4" />
                                </button>
                              </DialogTrigger>
                              <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[80vh] overflow-hidden">
                                <DialogHeader>
                                  <DialogTitle className="text-lg sm:text-xl">Interview Comments - {interview.candidate_name}</DialogTitle>
                                  <DialogDescription className="text-sm sm:text-base">
                                    View and edit detailed comments for this candidate interview.
                                  </DialogDescription>
                                </DialogHeader>
                                <div className="overflow-y-auto max-h-[60vh]">
                                  <textarea
                                    value={localComments[interview.id] || interview.hr_comments || ''}
                                    onChange={(e) => handleCommentsChange(interview.id, e.target.value)}
                                    placeholder="Enter your comments..."
                                    className="w-full p-3 sm:p-4 border border-gray-300 rounded-md text-sm sm:text-base resize-none focus:outline-none focus:border-gray-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
                                    rows={15}
                                  />
                                </div>
                                <div className="flex justify-end gap-2 p-4 border-t">
                                  <Button
                                    variant="outline"
                                    onClick={() => setExpandDialogStates(prev => ({...prev, [interview.id]: false}))}
                                  >
                                    Close
                                  </Button>
                                  <Button
                                    onClick={() => {
                                      handleSave(interview.id);
                                      setExpandDialogStates(prev => ({...prev, [interview.id]: false}));
                                    }}
                                    disabled={saveStates[interview.id] === 'saving' || !hasUnsavedChanges(interview.id)}
                                    className={`
                                      transition-all duration-200
                                      ${saveStates[interview.id] === 'saved' 
                                        ? 'bg-green-500 text-white hover:bg-green-600' 
                                        : saveStates[interview.id] === 'saving'
                                        ? 'bg-yellow-500 text-white cursor-not-allowed' 
                                        : saveStates[interview.id] === 'error'
                                        ? 'bg-red-500 text-white hover:bg-red-600'
                                        : hasUnsavedChanges(interview.id)
                                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                                        : 'bg-gray-400 text-white cursor-not-allowed'
                                        }
                                    `}
                                  >
                                    {saveStates[interview.id] === 'saved' ? '✓ Saved' : 
                                     saveStates[interview.id] === 'saving' ? 'Saving...' :
                                     saveStates[interview.id] === 'error' ? '✗ Error' :
                                     hasUnsavedChanges(interview.id) ? 'Save' : '✓ Saved'}
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </td>
                        {/* Action Column */}
                        <td className="py-3 px-4">
                          <div className="flex flex-col gap-2">
                            {/* Save Button */}
                            <Button
                              size="sm"
                              onClick={() => handleSave(interview.id)}
                              disabled={saveStates[interview.id] === 'saving' || !hasUnsavedChanges(interview.id)}
                              className={`
                                text-xs px-3 py-1 h-auto transition-all duration-200 w-full
                                ${saveStates[interview.id] === 'saved' 
                                  ? 'bg-green-500 text-white hover:bg-green-600' 
                                  : saveStates[interview.id] === 'saving'
                                  ? 'bg-yellow-500 text-white cursor-not-allowed'
                                  : saveStates[interview.id] === 'error'
                                  ? 'bg-red-500 text-white hover:bg-red-600'
                                  : hasUnsavedChanges(interview.id)
                                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                                  : 'bg-gray-400 text-white cursor-not-allowed'
                                }
                              `}
                            >
                              {saveStates[interview.id] === 'saved' ? '✓ Saved' : 
                               saveStates[interview.id] === 'saving' ? 'Saving...' :
                               saveStates[interview.id] === 'error' ? '✗ Error' :
                               hasUnsavedChanges(interview.id) ? 'Save' : '✓ Saved'}
                            </Button>
                            
                            {/* Remind Button */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRemind(interview.id)}
                              disabled={reminderStates[interview.id] === 'sending' || interview.status !== 'active'}
                              className={`
                                text-xs px-3 py-1 h-auto transition-all duration-200 w-full
                                ${reminderStates[interview.id] === 'sent' 
                                  ? 'bg-green-100 text-green-700 border-green-300' 
                                  : reminderStates[interview.id] === 'sending'
                                  ? 'bg-yellow-100 text-yellow-700 border-yellow-300 cursor-not-allowed'
                                  : reminderStates[interview.id] === 'error'
                                  ? 'bg-red-100 text-red-700 border-red-300'
                                  : interview.status !== 'active'
                                  ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed'
                                  : 'hover:bg-gray-50'
                                }
                              `}
                            >
                              {reminderStates[interview.id] === 'sent' ? '✓ Sent' : 
                               reminderStates[interview.id] === 'sending' ? 'Sending...' :
                               reminderStates[interview.id] === 'error' ? '✗ Error' :
                               'Remind'}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Interview link modal - click Position to copy/open link */}
      <Dialog open={!!linkModalInterviewId} onOpenChange={(open) => !open && setLinkModalInterviewId(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Interview link</DialogTitle>
            <DialogDescription>
              {linkModalInterviewId && (() => {
                const inv = interviews.find(i => i.id === linkModalInterviewId);
                return inv ? `Share this link with the candidate for ${inv.position}` : 'Copy or open the interview link.';
              })()}
            </DialogDescription>
          </DialogHeader>
          {linkModalInterviewId && (() => {
            const link = `${window.location.origin}${import.meta.env.BASE_URL}interview/${linkModalInterviewId}`;
            const inv = interviews.find(i => i.id === linkModalInterviewId);
            return (
              <div className="space-y-4">
                <Input
                  readOnly
                  value={link}
                  className="font-mono text-sm"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(link);
                      toast.success('Interview link copied to clipboard!');
                    }}
                  >
                    Copy link
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => window.open(link, '_blank', 'noopener,noreferrer')}
                  >
                    Open in new tab
                  </Button>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
  } catch (error) {
    console.error('Error rendering InterviewDashboard:', error);
    return (
      <div className="p-6">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Error Loading Dashboard</h2>
        <p className="text-gray-600">There was an error loading the interview dashboard.</p>
        <p className="text-sm text-gray-500 mt-2">Check the console for more details.</p>
      </div>
    );
  }
};

export default InterviewDashboard;