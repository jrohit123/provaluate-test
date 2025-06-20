
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, Grid, Save } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const JobUploadSection = () => {
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [criteriaData, setCriteriaData] = useState([
    { parameter: 'Technical Skills', weightage: 30, notes: 'Programming languages, frameworks' },
    { parameter: 'Experience Level', weightage: 25, notes: 'Years of relevant experience' },
    { parameter: 'Education', weightage: 15, notes: 'Degree relevance and institution' },
    { parameter: 'Soft Skills', weightage: 20, notes: 'Communication, leadership, teamwork' },
    { parameter: 'Certifications', weightage: 10, notes: 'Industry-relevant certifications' }
  ]);
  const { toast } = useToast();

  const handleJobDescriptionUpload = () => {
    toast({
      title: "Job Description Uploaded",
      description: "Your job description has been processed successfully.",
    });
  };

  const handleCriteriaUpload = () => {
    toast({
      title: "Criteria Grid Saved",
      description: "Your evaluation criteria has been saved and is ready to use.",
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-primary-800 mb-2">Job Description & Criteria Setup</h2>
        <p className="text-muted-foreground">Upload your job description and configure evaluation criteria</p>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Job Description Upload */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary-600" />
              Job Description
            </CardTitle>
            <CardDescription>
              Upload or paste your job description
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Input
                type="text"
                placeholder="Job Title (e.g., Senior Software Engineer)"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="mb-3"
              />
              <Textarea
                placeholder="Paste your job description here or upload a file..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="min-h-32 mb-3"
              />
            </div>
            
            <div className="border-2 border-dashed border-primary-200 rounded-lg p-6 text-center hover:border-primary-400 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-primary-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Drop PDF/DOC files here or click to browse
              </p>
            </div>
            
            <Button onClick={handleJobDescriptionUpload} className="w-full">
              Process Job Description
            </Button>
          </CardContent>
        </Card>

        {/* Criteria Grid */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Grid className="w-5 h-5 text-primary-600" />
              Evaluation Criteria
            </CardTitle>
            <CardDescription>
              Configure your evaluation parameters and weights
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              {criteriaData.map((criteria, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{criteria.parameter}</span>
                    <span className="bg-primary-100 text-primary-800 px-2 py-1 rounded text-xs font-medium">
                      {criteria.weightage}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{criteria.notes}</p>
                </div>
              ))}
            </div>
            
            <div className="border-2 border-dashed border-accent-200 rounded-lg p-4 text-center hover:border-accent-400 transition-colors cursor-pointer">
              <Upload className="w-6 h-6 text-accent-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Upload Excel/CSV criteria file
              </p>
            </div>
            
            <Button onClick={handleCriteriaUpload} className="w-full" variant="outline">
              <Save className="w-4 h-4 mr-2" />
              Save Criteria Template
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
