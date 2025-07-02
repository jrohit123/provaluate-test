import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Upload, FileText, User, CheckCircle, Play } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MatchScorecardSection } from './MatchScorecardSection';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface ResumeData {
  id: string;
  name: string;
  fileName: string;
  status: 'uploading' | 'processed' | 'error';
  summary: string;
  initialScore: number;
  uploadProgress: number;
  fileUrl?: string;
}

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_FILE_TYPES = ['.pdf', '.doc', '.docx'];
const CV_WEBHOOK_URL = "https://n8n-6421994137235212.kloudbeansite.com/webhook-test/c32aade7-564b-4cc7-a832-b6b094418132";

export const ResumeUploadSection = () => {
  const [resumes, setResumes] = useState<ResumeData[]>([]);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [showScorecard, setShowScorecard] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

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

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return 'File size exceeds 3MB limit';
    }
    
    const extension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_FILE_TYPES.includes(extension)) {
      return 'Invalid file type. Please upload PDF, DOC, or DOCX files';
    }
    
    return null;
  };

  const handleFileUpload = async (files: FileList) => {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const error = validateFile(file);
      
      if (error) {
        toast({
          title: `Error with ${file.name}`,
          description: error,
          variant: "destructive",
        });
        continue;
      }

      const resumeId = Date.now().toString() + i;
      const newResume: ResumeData = {
        id: resumeId,
        name: file.name.split('.')[0],
        fileName: file.name,
        status: 'uploading',
        summary: '',
        initialScore: 0,
        uploadProgress: 0
      };

      setResumes(prev => [...prev, newResume]);

      try {
        // Upload to Supabase Storage
        const filePath = `cv-files/${Date.now()}_${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(filePath, file);

        // Update progress separately
        setResumes(prev => prev.map(resume => 
          resume.id === resumeId 
            ? { ...resume, uploadProgress: 100 }
            : resume
        ));

        if (uploadError) throw uploadError;

        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('resumes')
          .getPublicUrl(filePath);

        setResumes(prev => prev.map(resume => 
          resume.id === resumeId 
            ? { ...resume, fileUrl: publicUrlData.publicUrl }
            : resume
        ));

        toast({
          title: "Resume Uploaded",
          description: `${file.name} has been uploaded successfully.`,
        });
      } catch (error: any) {
        setResumes(prev => prev.map(resume => 
          resume.id === resumeId 
            ? { ...resume, status: 'error' }
            : resume
        ));

        toast({
          title: `Error uploading ${file.name}`,
          description: error.message || "An error occurred during upload.",
          variant: "destructive",
        });
      }
    }
  };

  const handleEvaluation = async () => {
    setIsEvaluating(true);
    try {
      const processedResumes = resumes.filter(r => r.status === 'processed');
      
      for (const resume of processedResumes) {
        const response = await fetch(CV_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            resume_url: resume.fileUrl,
            resume_id: resume.id
          }),
        });

        if (!response.ok) {
          throw new Error(`Failed to evaluate ${resume.fileName}`);
        }

        const result = await response.json();
        
        setResumes(prev => prev.map(r => 
          r.id === resume.id 
            ? { 
                ...r, 
                status: 'processed',
                summary: result.summary || r.summary,
                initialScore: result.score || r.initialScore
              }
            : r
        ));
      }

      toast({
        title: "Evaluation Complete",
        description: "All resumes have been evaluated.",
      });
    } catch (error: any) {
      toast({
        title: "Evaluation Failed",
        description: error.message || "There was an error during evaluation.",
        variant: "destructive",
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleCandidateClick = (candidateId: string) => {
    setSelectedCandidate(candidateId);
    setShowScorecard(true);
  };

  const hasProcessedResumes = resumes.some(resume => resume.status === 'processed');

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary-800 mb-2">Resume Uploads</h2>
        <p className="text-muted-foreground">Upload multiple candidate resumes for evaluation</p>
      </div>

      {/* Upload Area */}
      <Card className="animate-fade-in">
        <CardContent className="p-6">
          <div 
            className="border-2 border-dashed border-primary-200 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer"
            onClick={handleFileSelect}
            onDrop={(e) => {
              e.preventDefault();
              const files = e.dataTransfer.files;
              if (files && files.length > 0) {
                handleFileUpload(files);
              }
            }}
            onDragOver={(e) => e.preventDefault()}
          >
            <Upload className="w-12 h-12 text-primary-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Upload Candidate Resumes</h3>
            <p className="text-muted-foreground mb-4">
              Drop multiple PDF/DOC files here or click to browse
            </p>
            <Button className="bg-primary-600 hover:bg-primary-700">
              Select Files
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Provaluate Button */}
      {hasProcessedResumes && (
        <div className="flex justify-center">
          <Button
            onClick={handleEvaluation}
            disabled={isEvaluating}
            className="bg-accent-600 hover:bg-accent-700 text-white"
          >
            <Play className="w-4 h-4 mr-2" />
            {isEvaluating ? 'Evaluating...' : 'Provaluate'}
          </Button>
        </div>
      )}

      {/* Resume List */}
      <div className="grid gap-4">
        <h3 className="text-lg font-semibold text-primary-800">
          Candidate Pool ({resumes.length})
        </h3>
        
        {resumes.map((resume) => (
          <Card 
            key={resume.id} 
            className="animate-fade-in hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => resume.status === 'processed' && handleCandidateClick(resume.id)}
          >
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

      {/* Scorecard Dialog */}
      <Dialog open={showScorecard} onOpenChange={setShowScorecard}>
        <DialogContent className="max-w-4xl h-[80vh] overflow-y-auto">
          {selectedCandidate && (
            <MatchScorecardSection
              onCandidateSelect={() => {}}
              selectedCandidateId={selectedCandidate}
              onClose={() => setShowScorecard(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx"
        multiple
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
