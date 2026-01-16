import { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, Plus, Trash2, Download, Save, Grid, Briefcase, AlertCircle } from 'lucide-react';
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
  const { currentJobDescription, currentEvaluationCriteria, setCurrentEvaluationCriteria } = useSession();
  const [criteriaData, setCriteriaData] = useState<CriteriaItem[]>([]);  // Start empty - will be populated when grid is selected
  
  const [savedGrids, setSavedGrids] = useState<SavedCriteriaGrid[]>([]);
  const [selectedGridId, setSelectedGridId] = useState<string>(() => sessionStorage.getItem('selectedCriteriaGridId') || '');
  const [selectedGrid, setSelectedGrid] = useState<SavedCriteriaGrid | null>(null);
  const [gridName, setGridName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [criteriaUploading, setCriteriaUploading] = useState(false);
  const [jobDescriptions, setJobDescriptions] = useState<any[]>([]);
  const [selectedJobDescriptionId, setSelectedJobDescriptionId] = useState<string>(() => {
    // Initialize from sessionStorage first
    const stored = sessionStorage.getItem('selectedJDId');
    if (stored) return stored;
    return '';
  });
  const criteriaFileInputRef = useRef<HTMLInputElement>(null);

  const totalPercentage = criteriaData.reduce((sum, item) => sum + item.weightage, 0);
  const isValidTotal = totalPercentage === 0 || totalPercentage === 100;

  // Load job descriptions and saved grids on component mount
  useEffect(() => {
    if (user?.id) {
      loadJobDescriptions();
      loadSavedGrids();
    }
  }, [user?.id]);

  // Sync selectedJobDescriptionId from SessionContext when it changes
  useEffect(() => {
    if (currentJobDescription) {
      // currentJobDescription can have either 'id' or 'jd_id' property
      const jdId = currentJobDescription.id || currentJobDescription.jd_id;
      if (jdId && jdId !== selectedJobDescriptionId) {
        console.log('🔄 EvaluationCriteriaSection: Syncing JD from SessionContext:', jdId);
        setSelectedJobDescriptionId(jdId);
        sessionStorage.setItem('selectedJDId', jdId);
      }
    }
  }, [currentJobDescription]);

  // Sync selectedGridId from SessionContext when it changes
  useEffect(() => {
    if (currentEvaluationCriteria && savedGrids.length > 0) {
      // Try to find matching grid by name
      const matchingGrid = savedGrids.find(grid => 
        grid.criteria_name === currentEvaluationCriteria.name
      );
      if (matchingGrid && matchingGrid.criteria_id !== selectedGridId) {
        console.log('🔄 EvaluationCriteriaSection: Syncing Criteria from SessionContext:', matchingGrid.criteria_id);
        setSelectedGridId(matchingGrid.criteria_id);
        sessionStorage.setItem('selectedCriteriaGridId', matchingGrid.criteria_id);
        // Also update the criteria data to match
        const criteriaItems = matchingGrid.grid.map((item: any, index: number) => ({
          id: (index + 1).toString(),
          parameter: item.parameter || '',
          weightage: item.weightage || 0,
          notes: item.calc_note || ''
        }));
        setCriteriaData(criteriaItems);
        setSelectedGrid(matchingGrid);
      }
    }
  }, [currentEvaluationCriteria, savedGrids, selectedGridId]);

  // Sync selected JD from sessionStorage and reload grids when JD changes (fallback)
  useEffect(() => {
    const checkSessionStorage = () => {
      const jd = sessionStorage.getItem('selectedJDId') || '';
      if (jd && jd !== selectedJobDescriptionId && !currentJobDescription) {
        setSelectedJobDescriptionId(jd);
      }
    };
    
    checkSessionStorage();
    const interval = setInterval(checkSessionStorage, 1000);
    return () => clearInterval(interval);
  }, [selectedJobDescriptionId, currentJobDescription]);

  // Reload saved grids when JD selection changes
  useEffect(() => {
    if (user?.id) {
      loadSavedGrids();
    }
  }, [selectedJobDescriptionId, user?.id]);


  // Load job descriptions
  const loadJobDescriptions = async () => {
    if (!user?.profile?.company_id) return;
    
    try {
      const { data, error } = await supabase
        .from('job_descriptions')
        .select('jd_id, title, jd_file, created_at, status')
        .eq('company_id', user.profile.company_id)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      setJobDescriptions(data || []);
    } catch (error) {
      console.error('Error loading job descriptions:', error);
    }
  };

  const loadSavedGrids = async () => {
    try {
      console.log('Loading saved grids for user:', user?.id);
      console.log('User profile:', user?.profile);
      console.log('Company ID:', user?.profile?.company_id);
      console.log('Selected JD ID:', selectedJobDescriptionId);
      
      let query = supabase
        .from('criteria')
        .select('criteria_id, criteria_name, grid, created_at, jd_id, company_id');

      // ✅ MODIFIED: Include company-specific OR global (company_id IS NULL)
      if (user?.profile?.company_id) {
        query = query.or(`company_id.eq.${user.profile.company_id},company_id.is.null`);
      } else {
        // If no company_id, show only global criteria
        query = query.is('company_id', null);
      }

      // Filter criteria based on selected JD
      if (selectedJobDescriptionId) {
        // Show criteria for this JD OR default criteria (jd_id is NULL)
        query = query.or(`jd_id.eq.${selectedJobDescriptionId},jd_id.is.null`);
        console.log('Filtering criteria for JD:', selectedJobDescriptionId);
      } else {
        // If no JD selected, show only default criteria
        query = query.is('jd_id', null);
        console.log('No JD selected, showing only default criteria');
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching grids:', error);
        throw error;
      }

      console.log('Fetched grids:', data);
      
      // Sort: Global criteria first, then company-specific, then by jd_id (default first)
      const sortedGrids = (data || []).sort((a, b) => {
        const aIsGlobal = !a.company_id;
        const bIsGlobal = !b.company_id;
        const aIsDefault = !a.jd_id;
        const bIsDefault = !b.jd_id;
        
        // Global criteria first
        if (aIsGlobal && !bIsGlobal) return -1;
        if (!aIsGlobal && bIsGlobal) return 1;
        
        // Then default criteria (jd_id is null)
        if (aIsDefault && !bIsDefault) return -1;
        if (!aIsDefault && bIsDefault) return 1;
        
        return 0;
      });
      
      setSavedGrids(sortedGrids);
      
      // ✅ FIX: Re-apply selection from sessionStorage after grids load
      // Always update criteria data to match selected grid (removed conditional check)
      const storedGridId = sessionStorage.getItem('selectedCriteriaGridId');
      if (storedGridId) {
        const matchingGrid = sortedGrids.find(g => g.criteria_id === storedGridId);
        if (matchingGrid) {
          // Grid exists, always update criteria data to match (ensures "Blank" shows [] and others show their data)
          console.log('🔄 Re-applying stored grid selection:', storedGridId, matchingGrid.criteria_name);
          setSelectedGridId(storedGridId);
          
          // Always update the criteria data to match selected grid
          const criteriaItems = (matchingGrid.grid || []).map((item: any, index: number) => ({
            id: (index + 1).toString(),
            parameter: item.parameter || '',
            weightage: item.weightage || 0,
            notes: item.calc_note || ''
          }));
          setCriteriaData(criteriaItems);  // This will be [] for "Blank", or actual items for other grids
          setSelectedGrid(matchingGrid);
          
          // Set in session context
          setCurrentEvaluationCriteria({
            name: matchingGrid.criteria_name,
            criteria: criteriaItems
          });
        } else {
          // Grid no longer exists, clear selection
          console.log('⚠️ Stored grid ID not found in loaded grids, clearing selection');
          setSelectedGridId('');
          setCriteriaData([]);  // Clear criteria data when grid not found
          sessionStorage.removeItem('selectedCriteriaGridId');
        }
      } else {
        // No stored selection, ensure criteria data is empty
        setCriteriaData([]);
      }
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
    const TEMPLATE_PATH = '/templates/evaluation-criteria-template.xlsx';

    const downloadTemplate = async () => {
      try {
        const response = await fetch(TEMPLATE_PATH);
        if (!response.ok) {
          throw new Error('Template file not found. Please ensure it exists in the public/templates directory.');
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'evaluation-criteria-template.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        toast({
          title: "Template Downloaded",
          description: "Preformatted evaluation criteria template has been downloaded.",
        });
      } catch (error: any) {
        console.error('Error downloading template:', error);
        toast({
          title: "Download Failed",
          description: error.message || 'Unable to download the template. Please try again.',
          variant: "destructive",
        });
      }
    };

    void downloadTemplate();
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

      // Get selected JD ID from sessionStorage
      const selectedJDId = sessionStorage.getItem('selectedJDId') || null;
      
      // If criteria name contains "default" (case-insensitive), set jd_id to null
      const isDefaultCriteria = gridName.toLowerCase().includes('default');
      const jdIdToSave = isDefaultCriteria ? null : (selectedJDId || null);

      const { data, error } = await supabase
        .from('criteria')
        .insert({
          criteria_name: gridName,
          grid,
          created_by: user.id,
          company_id: user.profile.company_id,
          jd_id: jdIdToSave, // Associate with selected JD (or null for default)
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
      
      // Automatically set in session context
      setCurrentEvaluationCriteria({
        name: selected.criteria_name,
        criteria: criteriaItems
      });
      
      toast({
        title: "Criteria Grid Selected",
        description: `"${selected.criteria_name}" set for current session`
      });
    }
  };

  const selectedJD = jobDescriptions.find(jd => jd.jd_id === selectedJobDescriptionId);

  return (
    <div className="p-6 space-y-6">
      {/* Show selected JD banner */}
      {selectedJD ? (
        <Card className="bg-blue-50 border-blue-200 animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Briefcase className="w-4 h-4 text-blue-600" />
              <span className="text-sm font-medium text-blue-800">
                Creating criteria for: <strong>{selectedJD.title}</strong>
              </span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              This criteria will be associated with the selected job description. To create a default criteria that works for all JDs, include "Default" in the name.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-yellow-50 border-yellow-200 animate-fade-in">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="text-sm font-medium text-yellow-800">
                No job description selected
              </span>
            </div>
            <p className="text-xs text-yellow-700 mt-1">
              Please select a job description in the Job Upload section first. Criteria saved without a JD selection will be treated as default (works for all JDs).
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-1 gap-6">
        {/* Evaluation Criteria - Now editable and with Select for Session button */}
        <Card className="animate-fade-in">
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Grid className="w-5 h-5 text-primary-600" />
                Evaluation Criteria
              </div>
              
            </CardTitle>
          <CardDescription>
            Configure the parameters and weights for the CV evaluation
          </CardDescription>
          
          </CardHeader>
          
          <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-primary-700">Select a saved grid:</span>
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
          </div>
            <div className="flex items-center gap-4 my-6 text-sm font-medium text-[#1e5da8]">
              <span className="flex-1 h-px bg-[#1e5da8]/30" />
              <span>OR Create a new criteria grid</span>
              <span className="flex-1 h-px bg-[#1e5da8]/30" />
            </div>
            <div className="overflow-x-auto border border-primary-100 rounded-lg">
              <table className="w-full table-auto">
                <thead className="bg-primary-50 text-left">
                  <tr className="text-xs font-semibold text-primary-800 uppercase tracking-wide">
                    <th className="px-4 py-3 w-[25%]">Parameters To Assess</th>
                    <th className="px-4 py-3 w-[20%]">Weightage</th>
                    <th className="px-4 py-3">How To Assess? (Prompt to AI)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-100 bg-white">
                  {criteriaData.map((criteria) => (
                    <tr key={criteria.id} className="align-top">
                      <td className="px-4 py-3">
                        <Input
                          value={criteria.parameter}
                          onChange={(e) => updateCriteria(criteria.id, 'parameter', e.target.value)}
                          className="font-medium text-sm bg-transparent border border-primary-100 focus:bg-white focus:border-primary-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            value={criteria.weightage}
                            onChange={(e) => updateCriteria(criteria.id, 'weightage', parseInt(e.target.value) || 0)}
                            className="w-20 h-9 text-sm text-center bg-primary-50 border border-primary-200"
                            min="0"
                            max="100"
                          />
                          <span className="text-xs font-semibold text-primary-800">%</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteCriteria(criteria.id)}
                            className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <Input
                          value={criteria.notes}
                          onChange={(e) => updateCriteria(criteria.id, 'notes', e.target.value)}
                          className="text-xs text-muted-foreground bg-transparent border border-primary-100 focus:bg-white focus:border-primary-300"
                          placeholder="Add description..."
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

            <div className="flex items-center gap-4 my-6 text-sm font-medium text-[#1e5da8]">
              <span className="flex-1 h-px bg-[#1e5da8]/30" />
              <span>OR Upload a new criteria grid in Excel format</span>
              <span className="flex-1 h-px bg-[#1e5da8]/30" />
            </div>

            <Button
                variant="default"
                size="sm"
                onClick={handleDownloadTemplate}
                className="flex items-center gap-1 text-xs bg-primary-600 hover:bg-primary-700 text-gray-200 hover:text-white"
              >
                <Download className="w-3 h-3" />
                Download Excel Template
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