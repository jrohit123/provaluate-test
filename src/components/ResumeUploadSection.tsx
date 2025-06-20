
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, User, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ResumeData {
  id: string;
  name: string;
  fileName: string;
  status: 'uploading' | 'processed' | 'error';
  summary: string;
  initialScore: number;
  uploadProgress: number;
}

export const ResumeUploadSection = () => {
  const [resumes, setResumes] = useState<ResumeData[]>([
    {
      id: '1',
      name: 'Sarah Johnson',
      fileName: 'sarah_johnson_resume.pdf',
      status: 'processed',
      summary: 'Senior Software Engineer with 8+ years experience in React, Node.js, and cloud architecture.',
      initialScore: 92,
      uploadProgress: 100
    },
    {
      id: '2',
      name: 'Michael Chen',
      fileName: 'michael_chen_cv.pdf',
      status: 'processed',
      summary: 'Full-stack developer with expertise in Python, Django, and machine learning applications.',
      initialScore: 87,
      uploadProgress: 100
    },
    {
      id: '3',
      name: 'Emily Rodriguez',
      fileName: 'emily_rodriguez.pdf',
      status: 'uploading',
      summary: '',
      initialScore: 0,
      uploadProgress: 65
    }
  ]);
  
  const { toast } = useToast();

  const handleFileUpload = () => {
    toast({
      title: "Resumes Uploaded",
      description: "Processing candidates and generating initial match scores...",
    });
    
    // Simulate processing
    setTimeout(() => {
      setResumes(prev => prev.map(resume => 
        resume.status === 'uploading' 
          ? { ...resume, status: 'processed', uploadProgress: 100, summary: 'Frontend Developer with 5 years experience in React and TypeScript.', initialScore: 79 }
          : resume
      ));
    }, 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-accent-600';
    if (score >= 75) return 'text-yellow-600';
    return 'text-red-500';
  };

  const getScoreBgColor = (score: number) => {
    if (score >= 90) return 'bg-accent-100';
    if (score >= 75) return 'bg-yellow-100';
    return 'bg-red-100';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary-800 mb-2">Resume Uploads</h2>
        <p className="text-muted-foreground">Upload multiple candidate resumes for evaluation</p>
      </div>

      {/* Upload Area */}
      <Card className="animate-fade-in">
        <CardContent className="p-6">
          <div className="border-2 border-dashed border-primary-200 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer">
            <Upload className="w-12 h-12 text-primary-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload Candidate Resumes</h3>
            <p className="text-muted-foreground mb-4">
              Drop multiple PDF/DOC files here or click to browse
            </p>
            <Button onClick={handleFileUpload} className="bg-primary-600 hover:bg-primary-700">
              Select Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resume List */}
      <div className="grid gap-4">
        <h3 className="text-lg font-semibold text-primary-800">
          Candidate Pool ({resumes.length})
        </h3>
        
        {resumes.map((resume) => (
          <Card key={resume.id} className="animate-fade-in hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="bg-primary-100 p-2 rounded-lg">
                    <User className="w-5 h-5 text-primary-600" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-primary-800">{resume.name}</h4>
                      {resume.status === 'processed' && (
                        <CheckCircle className="w-4 h-4 text-accent-500" />
                      )}
                    </div>
                    
                    <p className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      {resume.fileName}
                    </p>
                    
                    {resume.status === 'uploading' && (
                      <div className="space-y-2">
                        <Progress value={resume.uploadProgress} className="w-full" />
                        <p className="text-sm text-muted-foreground">
                          Processing... {resume.uploadProgress}%
                        </p>
                      </div>
                    )}
                    
                    {resume.status === 'processed' && (
                      <p className="text-sm text-gray-700">{resume.summary}</p>
                    )}
                  </div>
                </div>
                
                {resume.status === 'processed' && (
                  <div className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreBgColor(resume.initialScore)} ${getScoreColor(resume.initialScore)}`}>
                    {resume.initialScore}% Match
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
