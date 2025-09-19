import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
  Minimize2
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
}

const InterviewDashboard: React.FC<InterviewDashboardProps> = ({ onSectionChange }) => {
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

  useEffect(() => {
    fetchInterviews();
  }, []);

  const fetchInterviews = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5003/api/get-all-interviews');
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
    if (minutes < 60) {
      return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
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
      const response = await fetch('http://localhost:5003/api/update-interview-decision', {
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

  const handleRemind = (interviewId: string) => {
    const interview = interviews.find(i => i.id === interviewId);
    if (!interview) return;

    // Create reminder email content
    const interviewLink = `${window.location.origin}/interview/${interviewId}`;
    const subject = `Reminder: Complete Your Interview - ${interview.position} Position`;
    const body = `Hello ${interview.candidate_name},\n\nThis is a friendly reminder that you have a pending interview for the ${interview.position} position.\n\nPlease complete your interview by clicking the link below:\n${interviewLink}\n\nIf you have already completed the interview, please ignore this reminder.\n\nBest regards,\nHR Team`;
    
    // Open Gmail compose with pre-filled content (same approach as HRInterviewCreator)
    const gmailLink = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(interview.candidate_email)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailLink, '_blank');
    
    // Update reminder state to show it was "sent" (opened in Gmail)
    setReminderStates(prev => ({...prev, [interviewId]: 'sent'}));
    
    // Auto-reset to idle after 3 seconds
    setTimeout(() => {
      setReminderStates(prev => ({...prev, [interviewId]: 'idle'}));
    }, 3000);
  };

  // Add error boundary for debugging
  if (!interviews) {
    return <div className="p-6">Loading...</div>;
  }

  try {
    return (
      <div className="p-6 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary-800 mb-2">Interview Sessions</h2>
        <p className="text-muted-foreground">Monitor and manage all interview sessions</p>
      </div>

      <div className="flex items-center justify-between mb-6">
        <div></div>
        <Button 
          onClick={() => onSectionChange?.('ai-interview')}
          className="bg-primary-600 hover:bg-primary-700 text-white"
        >
          Start New Interview
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total</p>
                <p className="text-2xl font-bold text-primary-800">{interviews.length}</p>
              </div>
              <Users className="w-8 h-8 text-primary-600" />
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

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search interviews..."
            value={searchTerm}
            onChange={(e) => {
              console.log('Search term changed:', e.target.value);
              setSearchTerm(e.target.value);
            }}
            className="pl-10"
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
      <Card className="animate-fade-in">
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
                className="mt-4 bg-primary-600 hover:bg-primary-700"
              >
                Start New Interview
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border border-gray-200">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200">Candidate</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200">Position</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200">Status</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200">Duration</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200">Created</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200">View Details</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200">Decision</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900 border-r border-gray-200">Comments</th>
                    <th className="text-center py-3 px-4 font-medium text-gray-900">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInterviews.map((interview) => (
                    <tr key={interview.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="py-3 px-4 border-r border-gray-200">
                        <div>
                          <div className="font-medium text-gray-900">{interview.candidate_name}</div>
                          <div className="text-sm text-gray-500">{interview.candidate_email}</div>
                        </div>
                      </td>
                      <td className="py-3 px-4 border-r border-gray-200">
                        <Badge variant="outline" className="text-xs">
                          {interview.position}
                        </Badge>
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
                              : formatDuration(interview.duration_minutes)
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
                        {interview.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(`/final-results/${interview.id}`, '_blank')}
                            title="View Final Results"
                          >
                            <BarChart3 className="w-4 h-4" />
                          </Button>
                        )}
                      </td>
                      {/* Decision Column */}
                      <td className="py-3 px-4 border-r border-gray-200">
                        <Select
                          value={localDecisions[interview.id] || interview.decision || ''}
                          onValueChange={(value) => handleDecisionChange(interview.id, value)}
                        >
                          <SelectTrigger className="w-full">
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
                            className="w-full p-2 pr-8 border border-gray-300 rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            rows={expandedComments[interview.id] ? 6 : 2}
                          />
                          {(localComments[interview.id] || interview.hr_comments || '') && (
                            <button
                              onClick={() => toggleCommentsExpanded(interview.id)}
                              className={`absolute top-2 right-2 p-1 transition-colors rounded ${
                                isLongText(localComments[interview.id] || interview.hr_comments || '') 
                                  ? 'text-blue-500 hover:text-blue-700 hover:bg-blue-50' 
                                  : 'text-gray-400 hover:text-gray-600'
                              }`}
                              title={expandedComments[interview.id] ? "Collapse editor" : "Expand editor"}
                            >
                              {expandedComments[interview.id] ? (
                                <Minimize2 className="w-4 h-4" />
                              ) : (
                                <Maximize2 className="w-4 h-4" />
                              )}
                            </button>
                          )}
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
                              text-xs px-3 py-1 h-auto transition-all duration-200
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
                              text-xs px-3 py-1 h-auto transition-all duration-200
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
          )}
        </CardContent>
      </Card>
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