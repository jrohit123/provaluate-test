// API Service for CV Screening functionality
// This service handles communication with the Python backend API

// Updated to fix TypeScript import errors
const API_BASE_URL = import.meta.env.VITE_PYTHON_URL;
//|| 'http://localhost:5003';

// Type definitions for API responses
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message: string;
}

// Upload result that matches what the component expects
interface UploadResult {
  status: string;
  file_url: string;
  filename: string;
  candidate_name: string;
  jd_id: string;
  criteria_id: string;
  resume_id: string;
  // Also support batch upload format
  uploaded_files?: Array<{
    filename: string;
    url: string;
    path: string;
    token_count?: number;
  }>;
  failed_files?: Array<{
    filename: string;
    error: string;
  }>;
}

interface AnalysisResult {
  analysis_id: string;
  results: Array<{
    filename: string;
    score: number;
    feedback: string;
    strengths: string[];
    weaknesses: string[];
  }>;
}

interface JobDescription {
  id: string;
  title: string;
  description: string;
  requirements: string;
  created_at: string;
}


export const apiService = {
  /**
   * Upload resumes to the backend for processing
   * @param formData - FormData containing files and metadata
   * @returns Promise with upload result containing success/failure information
   */
  async uploadResumes(formData: FormData): Promise<UploadResult> {
    try {
      const response = await fetch(`${API_BASE_URL}/cv/upload`, {
        method: 'POST',
        body: formData, // FormData will set Content-Type with boundary automatically
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Upload failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Upload failed`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Upload error:', error);
      throw error;
    }
  },

  /**
   * Analyze uploaded resumes against job description criteria
   * @param analysisData - Analysis parameters including resume URLs and criteria
   * @returns Promise with analysis result containing scores and feedback
   */
  async analyzeResumes(analysisData: {
    jd_id: string;
    criteria_id?: string;
    resume_urls: string[];
  }): Promise<ApiResponse<AnalysisResult>> {
    try {
      const response = await fetch(`${API_BASE_URL}/cv/analyze_resumes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(analysisData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Analysis failed' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Analysis failed`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result,
        message: 'Resume analysis completed successfully'
      };
    } catch (error) {
      console.error('Analysis error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze resumes',
        message: 'Analysis failed'
      };
    }
  },

  /**
   * Get job descriptions for the current user
   * @returns Promise with list of job descriptions
   */
  async getJobDescriptions(): Promise<ApiResponse<JobDescription[]>> {
    try {
      const response = await fetch(`${API_BASE_URL}/ai/api/job_descriptions`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch job descriptions' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch job descriptions`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result,
        message: 'Job descriptions fetched successfully'
      };
    } catch (error) {
      console.error('Job descriptions error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch job descriptions',
        message: 'Failed to fetch job descriptions'
      };
    }
  },

  /**
   * Get analysis results for a specific job description
   * @param jdId - Job description ID
   * @returns Promise with analysis results
   */
  async getAnalysisResults(jdId: string): Promise<ApiResponse<AnalysisResult>> {
    try {
      const response = await fetch(`${API_BASE_URL}/api/analysis_results/${jdId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to fetch analysis results' }));
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch analysis results`);
      }

      const result = await response.json();
      return {
        success: true,
        data: result,
        message: 'Analysis results fetched successfully'
      };
    } catch (error) {
      console.error('Analysis results error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch analysis results',
        message: 'Failed to fetch analysis results'
      };
    }
  },

};
