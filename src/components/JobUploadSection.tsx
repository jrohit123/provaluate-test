
import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, Grid, Save, Plus, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CriteriaItem {
  id: string;
  parameter: string;
  weightage: number;
  notes: string;
}

export const JobUploadSection = () => {
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [criteriaData, setCriteriaData] = useState<CriteriaItem[]>([
    { id: '1', parameter: 'Technical Skills', weightage: 30, notes: 'Programming languages, frameworks' },
    { id: '2', parameter: 'Experience Level', weightage: 25, notes: 'Years of relevant experience' },
    { id: '3', parameter: 'Education', weightage: 15, notes: 'Degree relevance and institution' },
    { id: '4', parameter: 'Soft Skills', weightage: 20, notes: 'Communication, leadership, teamwork' },
    { id: '5', parameter: 'Certifications', weightage: 10, notes: 'Industry-relevant certifications' }
  ]);
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const criteriaFileInputRef = useRef<HTMLInputElement>(null);

  const totalPercentage = criteriaData.reduce((sum, item) => sum + item.weightage, 0);
  const isValidTotal = totalPercentage === 0 || totalPercentage === 100;

  const handleJobDescriptionUpload = () => {
    toast({
      title: "Job Description Uploaded",
      description: "Your job description has been processed successfully.",
    });
  };

  const handleCriteriaUpload = () => {
    if (!isValidTotal) {
      toast({
        title: "Invalid Criteria Weightage",
        description: "Total percentage must be either 0% (no criteria) or 100%.",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Criteria Grid Saved",
      description: "Your evaluation criteria has been saved and is ready to use.",
    });
  };

  const handleJobDescriptionClick = () => {
    fileInputRef.current?.click();
  };

  const handleCriteriaClick = () => {
    criteriaFileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      console.log('Selected files:', files);
      // Handle file upload logic here
    }
  };

  const updateCriteria = (id: string, field: keyof CriteriaItem, value: string | number) => {
    setCriteriaData(prev => prev.map(item => 
      item.id === id ? { ...item, [field]: value } : item
    ));
  };

  const addCriteria = () => {
    const newCriteria: CriteriaItem = {
      id: Date.now().toString(),
      parameter: 'New Parameter',
      weightage: 0,
      notes: 'Add description here'
    };
    setCriteriaData(prev => [...prev, newCriteria]);
  };

  const deleteCriteria = (id: string) => {
    setCriteriaData(prev => prev.filter(item => item.id !== id));
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
            
            <div 
              className="border-2 border-dashed border-primary-200 rounded-lg p-6 text-center hover:border-primary-400 transition-colors cursor-pointer"
              onClick={handleJobDescriptionClick}
            >
              <Upload className="w-8 h-8 text-primary-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Drop PDF/DOC files here or click to browse
              </p>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />
            
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
              {criteriaData.map((criteria) => (
                <div key={criteria.id} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <Input
                      value={criteria.parameter}
                      onChange={(e) => updateCriteria(criteria.id, 'parameter', e.target.value)}
                      className="font-medium text-sm bg-transparent border-none p-0 h-auto focus:bg-white focus:border focus:px-2 focus:py-1"
                    />
                    <div className="flex items-center gap-2">
                      <div className="flex items-center">
                        <Input
                          type="number"
                          value={criteria.weightage}
                          onChange={(e) => updateCriteria(criteria.id, 'weightage', parseInt(e.target.value) || 0)}
                          className="w-16 h-8 text-xs text-center bg-primary-100 border-primary-200"
                          min="0"
                          max="100"
                        />
                        <span className="text-xs font-medium text-primary-800 ml-1">%</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteCriteria(criteria.id)}
                        className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <Input
                    value={criteria.notes}
                    onChange={(e) => updateCriteria(criteria.id, 'notes', e.target.value)}
                    className="text-xs text-muted-foreground bg-transparent border-none p-0 h-auto focus:bg-white focus:border focus:px-2 focus:py-1"
                    placeholder="Add description..."
                  />
                </div>
              ))}
            </div>

            <Button
              variant="outline"
              onClick={addCriteria}
              className="w-full border-dashed"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Parameter
            </Button>

            <div className="flex items-center justify-between p-3 bg-gray-100 rounded-lg">
              <span className="font-medium text-sm">Total Weightage:</span>
              <span className={`font-bold text-sm ${isValidTotal ? 'text-green-600' : 'text-red-600'}`}>
                {totalPercentage}%
                {isValidTotal && totalPercentage > 0 && <span className="ml-2 text-xs">✓ Ready</span>}
                {!isValidTotal && <span className="ml-2 text-xs">⚠ Must be 0% or 100%</span>}
              </span>
            </div>
            
            <div 
              className="border-2 border-dashed border-accent-200 rounded-lg p-4 text-center hover:border-accent-400 transition-colors cursor-pointer"
              onClick={handleCriteriaClick}
            >
              <Upload className="w-6 h-6 text-accent-500 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Upload Excel/CSV criteria file
              </p>
            </div>
            
            <input
              ref={criteriaFileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <Button 
              onClick={handleCriteriaUpload} 
              className="w-full" 
              variant="outline"
              disabled={!isValidTotal}
            >
              <Save className="w-4 h-4 mr-2" />
              Save Criteria Template
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
