import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Plus, Trash2, Download, Save, Grid } from 'lucide-react';
import * as XLSX from 'xlsx';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { useSession } from '@/contexts/SessionContext';

interface CriteriaItem {
  id: string;
  parameter: string;
  weightage: number;
  notes: string;
}

interface SavedCriteriaGrid {
  criteria_id: string;
  criteria_name: string;
  grid: { parameter: string; weightage: number; calc_note: string }[];
  created_at: string;
}

export const EvaluationCriteriaSection = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { setCurrentEvaluationCriteria } = useSession();
  const [criteriaData, setCriteriaData] = useState<CriteriaItem[]>([
    { id: '1', parameter: 'Technical Skills', weightage: 30, notes: 'Check the relevant experience in the given programming languages, frameworks, tools' },
    { id: '2', parameter: 'Experience Level', weightage: 25, notes: 'Years of relevant experience' },
    { id: '3', parameter: 'Education', weightage: 15, notes: 'Degree relevance and institution' },
    { id: '4', parameter: 'Soft Skills', weightage: 20, notes: 'Communication, leadership, teamwork' },
    { id: '5', parameter: 'Stability', weightage: 10, notes: 'Calculate the Stability Score based on the average years spent in each of the previous companies.' }
  ]);
  
  const [savedGrids, setSavedGrids] = useState<SavedCriteriaGrid[]>([]);
  const [selectedGridId, setSelectedGridId] = useState<string>('');
  const [selectedGrid, setSelectedGrid] = useState<SavedCriteriaGrid | null>(null);
  const [gridName, setGridName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [criteriaUploading, setCriteriaUploading] = useState(false);
  const criteriaFileInputRef = useRef<HTMLInputElement>(null);

  const totalPercentage = criteriaData.reduce((sum, item) => sum + item.weightage, 0);
  const isValidTotal = totalPercentage === 0 || totalPercentage === 100;

  // Load saved grids on component mount
  useEffect(() => {
    if (user?.id) {
      loadSavedGrids();
    }
  }, [user?.id]);

  const loadSavedGrids = async () => {
    try {
      console.log('Loading saved grids for user:', user?.id);
      console.log('User profile:', user?.profile);
      console.log('Company ID:', user?.profile?.company_id);
      
      let query = supabase
        .from('criteria')
        .select('criteria_id, criteria_name, grid, created_at')
        .eq('created_by', user?.id)
        .order('created_at', { ascending: false });

      // Only filter by company_id if it exists
      if (user?.profile?.company_id) {
        query = query.eq('company_id', user.profile.company_id);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching grids:', error);
        throw error;
      }

      console.log('Fetched grids:', data);
      setSavedGrids(data || []);
    } catch (error) {
      console.error('Error loading saved grids:', error);
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
      ['Technical Skills', 30, 'Check the relevant experience in the given Programming languages, frameworks, tools'],
      ['Experience Level', 25, 'Years of relevant experience in similar roles'],
      ['Education', 15, 'Degree relevance and institution quality'],
      ['Soft Skills', 20, 'Communication, leadership, teamwork abilities'],
      ['Stability', 10, 'Calculate the Stability Score based on the average years spent in each of the previous companies.']
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

    setIsLoading(true);
    try {
      console.log('Saving criteria with data:', {
        user_id: user.id,
        company_id: user.profile.company_id,
        gridName,
        criteriaData
      });

      // Only save parameter, weightage, calc_note in the grid JSON
      const grid = criteriaData.map(item => ({
        parameter: item.parameter,
        weightage: item.weightage,
        calc_note: item.notes
      }));

      const { data, error } = await supabase
        .from('criteria')
        .insert({
          criteria_name: gridName,
          grid,
          created_by: user.id,
          company_id: user.profile.company_id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('criteria_id')
        .single();

      if (error) {
        console.error('Error saving criteria:', error);
        throw error;
      }
      console.log('Save result:', data);

      toast({
        title: "Criteria Grid Saved",
        description: "Your evaluation criteria has been saved successfully.",
      });

      // Set in session
      setCurrentEvaluationCriteria({
        name: gridName,
        criteria: criteriaData
      });

      setGridName('');
      await loadSavedGrids();
      // Store the new grid's criteria_id in sessionStorage
      if (data?.criteria_id) {
        setSelectedGridId(data.criteria_id);
        sessionStorage.setItem('selectedCriteriaGridId', data.criteria_id);
      }
    } catch (err: any) {
      console.error('Error saving criteria:', err);
      toast({
        title: "Error Saving Criteria",
        description: err.message || "An error occurred while saving the criteria.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGridSelect = async (gridId: string) => {
    setSelectedGridId(gridId);
    sessionStorage.setItem('selectedCriteriaGridId', gridId);
    const selected = savedGrids.find(grid => grid.criteria_id === gridId);
    if (selected) {
      // Convert grid data to match our interface
      const criteriaItems = selected.grid.map((item: any, index: number) => ({
        id: (index + 1).toString(),
        parameter: item.parameter || '',
        weightage: item.weightage || 0,
        notes: item.calc_note || ''
      }));
      setCriteriaData(criteriaItems);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-primary-800 mb-2">Evaluation Criteria</h2>
          <p className="text-muted-foreground">Manage your CV screening evaluation parameters</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-1 gap-6">
        {/* Evaluation Criteria - Now editable and with Select for Session button */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Grid className="w-5 h-5 text-primary-600" />
                Evaluation Criteria
              </div>
              <div className="flex items-center gap-2">
                <Select value={selectedGridId} onValueChange={handleGridSelect}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Load saved grid..." />
                  </SelectTrigger>
                <SelectContent>
                  {savedGrids.map(grid => (
                    <SelectItem key={grid.criteria_id} value={grid.criteria_id}>
                      {grid.criteria_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button 
                onClick={() => {
                  if (selectedGridId) {
                    const selectedGrid = savedGrids.find(grid => grid.criteria_id === selectedGridId);
                    if (selectedGrid) {
                      // Convert grid data to match our interface
                      const criteriaItems = selectedGrid.grid.map((item: any, index: number) => ({
                        id: (index + 1).toString(),
                        parameter: item.parameter || '',
                        weightage: item.weightage || 0,
                        notes: item.calc_note || ''
                      }));

                      setCurrentEvaluationCriteria({
                        name: selectedGrid.criteria_name,
                        criteria: criteriaItems
                      });
                      
                      toast({
                        title: "Success",
                        description: `"${selectedGrid.criteria_name}" set for current session`
                      });
                    }
                  } else {
                    toast({
                      title: "Error",
                      description: "Please select a criteria set",
                      variant: "destructive"
                    });
                  }
                }} 
                className="bg-gray-500 hover:bg-gray-600"
                disabled={!selectedGridId}
              >
                Select for Session
              </Button>
            </div>
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
                {isValidTotal && totalPercentage > 0 && <span className="ml-2 text-xs">✓</span>}
                {!isValidTotal && <span className="ml-2 text-xs">⚠ Must be 0% or 100%</span>}
              </span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadTemplate}
              className="flex items-center gap-1 text-xs mb-2"
            >
              <Download className="w-3 h-3" />
              Template
            </Button>

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
                disabled={!gridName || !isValidTotal || isLoading}
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