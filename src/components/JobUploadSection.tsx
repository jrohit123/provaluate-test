import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Upload, FileText, Grid, Save, Plus, Trash2, Download, Edit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { DatabaseService } from '@/integrations/supabase/db';
import * as XLSX from 'xlsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/use-auth';

interface CriteriaItem {
  id: string;
  parameter: string;
  weightage: number;
  notes: string;
}

interface ResolvedJD {
  preferred_city?: string;
  mandatory_city?: string;
  preferred_age?: string;
  mandatory_age?: string;
  preferred_gender?: string;
  mandatory_gender?: string;
  educational_qualification?: string;
  job_history?: string;
  technical_skills?: string;
  functional_skills?: string;
  soft_skills?: string;
}

interface SavedCriteriaGrid {
  id: string;
  name: string;
  criteria: CriteriaItem[];
}

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED_FILE_TYPES = ['.pdf', '.doc', '.docx'];
const JD_WEBHOOK_URL = "https://n8n-6421994137235212.kloudbeansite.com/webhook-test/61646fe6-09c4-4276-aeb0-3fd7bb6b367e";

export const JobUploadSection = () => {
  const { user } = useAuth();
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
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isJobFieldsDisabled, setIsJobFieldsDisabled] = useState(false);
  const [criteriaUploading, setCriteriaUploading] = useState(false);
  const [resolvedJD, setResolvedJD] = useState<ResolvedJD | null>(null);
  const [isEditingResolvedJD, setIsEditingResolvedJD] = useState(false);
  const [savedGrids, setSavedGrids] = useState<SavedCriteriaGrid[]>([]);
  const [selectedGridId, setSelectedGridId] = useState<string>('');
  const [gridName, setGridName] = useState('');
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'processing' | 'completed' | 'failed'>('idle');

  const totalPercentage = criteriaData.reduce((sum, item) => sum + item.weightage, 0);
  const isValidTotal = totalPercentage === 0 || totalPercentage === 100;

  useEffect(() => {
    if (user?.id) {
      loadSavedGrids();
    }
  }, [user]);

  const loadSavedGrids = async () => {
    if (!user?.id) return;

    try {
      console.log('Loading saved grids for user:', user.id);
      
      // Get all criteria grouped by criteria_name
      const { data: grids, error } = await supabase
        .from('criteria')
        .select('*')
        .eq('created_by', user.id)
        .eq('company_id', user.profile?.company_id)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching grids:', error);
        throw error;
      }

      console.log('Fetched grids:', grids);
      
      if (!grids || grids.length === 0) {
        console.log('No grids found');
        setSavedGrids([]);
        return;
      }

      // Group criteria by name
      const groupedGrids = grids.reduce((acc: { [key: string]: CriteriaItem[] }, curr) => {
        const key = curr.criteria_name;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push({
          id: curr.criteria_id,
          parameter: curr.parameter,
          weightage: curr.weightage,
          notes: curr.calc_note || ''
        });
        return acc;
      }, {});

      console.log('Grouped grids:', groupedGrids);

      // Convert to SavedCriteriaGrid format
      const formattedGrids: SavedCriteriaGrid[] = Object.entries(groupedGrids).map(([name, criteria]: [string, CriteriaItem[]]) => ({
        id: name, // Use the criteria_name as the grid ID for uniqueness
        name,
        criteria
      }));

      console.log('Formatted grids:', formattedGrids);
      setSavedGrids(formattedGrids);
    } catch (error) {
      console.error('Error loading saved grids:', error);
      toast({
        title: "Error Loading Grids",
        description: "Failed to load saved evaluation criteria.",
        variant: "destructive"
      });
    }
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

  const handleFileUpload = async (file: File) => {
    const error = validateFile(file);
    if (error) {
      toast({
        title: "File Error",
        description: error,
        variant: "destructive",
      });
      return;
    }

    setProcessingStatus('processing');
    try {
      // Upload to Supabase Storage
      const filePath = `jd-files/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('job-descriptions')
        .upload(filePath, file);
      
      if (uploadError) throw uploadError;

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from('job-descriptions')
        .getPublicUrl(filePath);

      // Call JD Processing Webhook
      const response = await fetch(JD_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_url: publicUrlData.publicUrl,
          title: jobTitle
        }),
      });

      if (!response.ok) throw new Error('Failed to process JD');

      const resolvedData = await response.json();
      setResolvedJD(resolvedData);
      setProcessingStatus('completed');

      toast({
        title: "Job Description Processed",
        description: "JD has been analyzed. Please review the extracted information.",
      });
    } catch (error: any) {
      setProcessingStatus('failed');
      toast({
        title: "Processing Failed",
        description: error.message || "An error occurred while processing the JD.",
        variant: "destructive",
      });
    }
  };

  const handleJobDescriptionUpload = () => {
    toast({
      title: "Job Description Uploaded",
      description: "Your job description has been processed successfully.",
    });
  };

  const handleCriteriaUpload = async () => {
    if (!isValidTotal) {
      toast({
        title: "Invalid Criteria Weightage",
        description: "Total percentage must be either 0% (no criteria) or 100%.",
        variant: "destructive",
      });
      return;
    }
    try {
      // Save each criteria item to the database
      await Promise.all(
        criteriaData.map(item =>
          DatabaseService.createCriteria({
            criteria_name: item.parameter,
            parameter: item.parameter,
            weightage: item.weightage,
            calc_note: item.notes,
            // Add other fields as needed (created_by, company_id, etc.)
          })
        )
      );
      toast({
        title: "Evaluation Criteria Saved",
        description: "Your evaluation criteria has been saved and is ready to use.",
      });
    } catch (err: any) {
      toast({
        title: "Error Saving Evaluation Criteria",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    }
  };

  // Drag and drop handlers for job description
  const handleJobDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setUploadedFile(file);
      setJobTitle('');
      setJobDescription('');
      setIsJobFieldsDisabled(true);
    }
  };
  const handleJobDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  const handleJobDescriptionClick = () => {
    fileInputRef.current?.click();
  };
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setUploadedFile(files[0]);
      setJobTitle('');
      setJobDescription('');
      setIsJobFieldsDisabled(true);
    }
  };

  // Drag and drop handlers for criteria
  const handleCriteriaDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await handleCriteriaFile(e.dataTransfer.files[0]);
    }
  };
  const handleCriteriaDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };
  const handleCriteriaClick = () => {
    criteriaFileInputRef.current?.click();
  };
  const handleCriteriaFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      await handleCriteriaFile(files[0]);
    }
  };
  const handleCriteriaFile = async (file: File) => {
    setCriteriaUploading(true);
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json: any[] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      // Expecting header row: [Parameter, Weightage, Notes]
      if (
        json.length < 2 ||
        !json[0] ||
        json[0][0]?.toString().toLowerCase().includes('parameter') === false
      ) {
        throw new Error('Excel sheet must have a header row: Parameter, Weightage, Notes');
      }
      const newCriteria: CriteriaItem[] = json.slice(1).map((row, idx) => ({
        id: Date.now().toString() + idx,
        parameter: row[0] || '',
        weightage: Number(row[1]) || 0,
        notes: row[2] || '',
      }));
      if (newCriteria.length === 0) throw new Error('No criteria found in Excel sheet.');
      setCriteriaData(newCriteria);
      toast({
        title: 'Criteria Grid Updated',
        description: 'Evaluation criteria loaded from Excel.',
      });
    } catch (err: any) {
      toast({
        title: 'Error Parsing Excel',
        description: err.message || 'Check the Excel sheet and re-upload.',
        variant: 'destructive',
      });
    } finally {
      setCriteriaUploading(false);
    }
  };

  const handleProcessJobDescription = async () => {
    if (!user) {
      toast({
        title: "Authentication Error",
        description: "Please sign in to process job descriptions.",
        variant: "destructive",
      });
      return;
    }

    try {
      let fileUrl = null;
      if (uploadedFile) {
        // Upload to Supabase Storage
        const filePath = `jd-files/${Date.now()}_${uploadedFile.name}`;
        const { data, error } = await supabase.storage
          .from('job-descriptions')
          .upload(filePath, uploadedFile);
        
        if (error) throw error;
        
        // Get public URL
        const { data: publicUrlData } = supabase.storage
          .from('job-descriptions')
          .getPublicUrl(filePath);
        fileUrl = publicUrlData.publicUrl;
      }

      // Save job description in DB with proper user context
      const { data: jdData, error: jdError } = await supabase
        .from('job_descriptions')
        .insert({
          title: jobTitle,
          description: jobDescription,
          jd_file: fileUrl,
          user_id: user.id,
          company_id: user.profile?.company_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (jdError) throw jdError;

      // If we have a file URL, process it through the webhook
      if (fileUrl) {
        const response = await fetch(JD_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            file_url: fileUrl,
            title: jobTitle,
            jd_id: jdData.jd_id // Pass the JD ID to link the resolved data
          }),
        });

        if (!response.ok) throw new Error('Failed to process JD file');

        const resolvedData = await response.json();
        setResolvedJD(resolvedData);
      }

      toast({
        title: "Job Description Processed",
        description: "Job description and file saved successfully.",
      });

      // Reset form
      setJobTitle('');
      setJobDescription('');
      setUploadedFile(null);
      setIsJobFieldsDisabled(false);
      setProcessingStatus('completed');
    } catch (err: any) {
      setProcessingStatus('failed');
      console.error('Error processing job description:', err);
      toast({
        title: "Error Processing Job Description",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
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

  const handleDownloadTemplate = () => {
    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Create sample data
    const sampleData = [
      ['Parameter', 'Weightage', 'Notes'],
      ['Technical Skills', 30, 'Programming languages, frameworks, tools'],
      ['Experience Level', 25, 'Years of relevant experience in similar roles'],
      ['Education', 15, 'Degree relevance and institution quality'],
      ['Soft Skills', 20, 'Communication, leadership, teamwork abilities'],
      ['Certifications', 10, 'Industry-relevant professional certifications']
    ];
    
    // Convert to worksheet
    const ws = XLSX.utils.aoa_to_sheet(sampleData);
    
    // Add worksheet to workbook
    XLSX.utils.book_append_sheet(wb, ws, 'Evaluation Criteria');
    
    // Generate and download file
    XLSX.writeFile(wb, 'evaluation-criteria-template.xlsx');
    
    toast({
      title: "Template Downloaded",
      description: "Sample evaluation criteria template has been downloaded.",
    });
  };

  const handleSaveCriteria = async () => {
    if (!gridName) {
      toast({
        title: "Name Required",
        description: "Please provide a name for this criteria grid.",
        variant: "destructive",
      });
      return;
    }

    if (!user) {
      toast({
        title: "Authentication Error",
        description: "Please sign in to save criteria grids.",
        variant: "destructive",
      });
      return;
    }

    if (!user.profile) {
      toast({
        title: "Profile Error",
        description: "Your user profile is not properly set up. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    // Validate UUID format
    const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_REGEX.test(user.id) || !UUID_REGEX.test(user.profile.company_id)) {
      toast({
        title: "Invalid ID Format",
        description: "User or company ID is not in the correct format. Please contact support.",
        variant: "destructive",
      });
      return;
    }

    try {
      console.log('Saving criteria with data:', {
        user_id: user.id,
        company_id: user.profile.company_id,
        gridName,
        criteriaData
      });

      // Insert the criteria
      const promises = criteriaData.map(item => 
        supabase
          .from('criteria')
          .insert({
            criteria_name: gridName,
            parameter: item.parameter,
            weightage: item.weightage,
            calc_note: item.notes,
            created_by: user.id,
            company_id: user.profile.company_id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
      );

      const results = await Promise.all(promises);
      
      // Check for any errors in the results
      const errors = results.filter(result => result.error).map(result => result.error);
      if (errors.length > 0) {
        console.error('Errors saving criteria:', errors);
        throw new Error(errors[0].message);
      }

      console.log('Save results:', results);

      toast({
        title: "Criteria Grid Saved",
        description: "Your evaluation criteria has been saved successfully.",
      });

      setGridName('');
      await loadSavedGrids();
    } catch (err: any) {
      console.error('Error saving grid:', err);
      toast({
        title: "Error Saving Grid",
        description: err.message || "An error occurred.",
        variant: "destructive",
      });
    }
  };

  const handleGridSelect = async (gridId: string) => {
    const selected = savedGrids.find(grid => grid.id === gridId);
    if (selected) {
      setCriteriaData(selected.criteria);
      setSelectedGridId(gridId);
    }
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
                disabled={isJobFieldsDisabled}
              />
              <Textarea
                placeholder="Paste your job description here or upload a file..."
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                className="min-h-32 mb-3"
                disabled={isJobFieldsDisabled}
              />
            </div>
            
            <div 
              className="border-2 border-dashed border-primary-200 rounded-lg p-6 text-center hover:border-primary-400 transition-colors cursor-pointer"
              onClick={handleJobDescriptionClick}
              onDrop={handleJobDrop}
              onDragOver={handleJobDragOver}
            >
              <Upload className="w-8 h-8 text-primary-400 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                Drop PDF/DOC files here or click to browse
              </p>
              {uploadedFile && (
                <div className="mt-2 text-xs text-primary-700">Selected file: {uploadedFile.name}</div>
              )}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.doc,.docx"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <Button onClick={handleProcessJobDescription} className="w-full">
              Process Job Description
            </Button>

            {resolvedJD && !isEditingResolvedJD && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold">Resolved Job Description</h4>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsEditingResolvedJD(true)}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                </div>
                
                <div className="space-y-2 text-sm">
                  {Object.entries(resolvedJD).map(([key, value]) => (
                    <div key={key} className="flex">
                      <span className="font-medium w-1/3 capitalize">
                        {key.replace(/_/g, ' ')}:
                      </span>
                      <span className="flex-1">{value || 'N/A'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {resolvedJD && isEditingResolvedJD && (
              <div className="mt-4 space-y-3">
                <h4 className="font-semibold">Edit Resolved Information</h4>
                {Object.entries(resolvedJD).map(([key, value]) => (
                  <div key={key} className="space-y-1">
                    <label className="text-sm font-medium capitalize">
                      {key.replace(/_/g, ' ')}
                    </label>
                    <Input
                      value={value || ''}
                      onChange={(e) => 
                        setResolvedJD(prev => ({
                          ...prev!,
                          [key]: e.target.value
                        }))
                      }
                    />
                  </div>
                ))}
                <Button
                  onClick={() => setIsEditingResolvedJD(false)}
                  className="w-full"
                >
                  Save Changes
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Criteria Grid */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Grid className="w-5 h-5 text-primary-600" />
                Evaluation Criteria
              </div>
              <Select value={selectedGridId} onValueChange={handleGridSelect}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Load saved grid..." />
                </SelectTrigger>
                <SelectContent>
                  {savedGrids.map(grid => (
                    <SelectItem key={grid.id} value={grid.id}>
                      {grid.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardTitle>
            <CardDescription className="flex items-center justify-between">
              <span>Configure your evaluation parameters and weights</span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1 text-xs"
              >
                <Download className="w-3 h-3" />
                Template
              </Button>
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
                {isValidTotal && totalPercentage > 0 && <span className="ml-2 text-xs">✓</span>}
                {!isValidTotal && <span className="ml-2 text-xs">⚠ Must be 0% or 100%</span>}
              </span>
            </div>
            
            <div 
              className="border-2 border-dashed border-accent-200 rounded-lg p-4 text-center hover:border-accent-400 transition-colors cursor-pointer"
              onClick={handleCriteriaClick}
              onDrop={handleCriteriaDrop}
              onDragOver={handleCriteriaDragOver}
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
              onChange={handleCriteriaFileChange}
              className="hidden"
            />
            
            <div className="flex gap-2">
              <Input
                placeholder="Grid Name"
                value={gridName}
                onChange={(e) => setGridName(e.target.value)}
                className="flex-1"
              />
              <Button 
                onClick={handleSaveCriteria} 
                className="whitespace-nowrap"
                disabled={!gridName || !isValidTotal}
              >
                <Save className="w-4 h-4 mr-2" />
                Save as New
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
