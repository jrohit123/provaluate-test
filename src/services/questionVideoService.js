import { supabase } from './supabase';

// Question Video Service
export const questionVideoService = {
  /**
   * Upload individual question video
   * 
   * @param {Object} videoData - Video upload data
   * @param {string} videoData.interview_id - Interview UUID
   * @param {number} videoData.question_order - Question order (0-based)
   * @param {string} videoData.question_text - Question text
   * @param {string} videoData.video_data - Base64 encoded video data
   * @param {string} videoData.video_format - Video format (webm, mp4, etc.)
   * @param {string} videoData.video_quality - Video quality (low, medium, high)
   * @returns {Promise<Object>} Upload result with video URL and metadata
   */
  async uploadQuestionVideo(videoData) {
    try {
      const response = await fetch('/api/upload-question-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(videoData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Upload failed');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error uploading question video:', error);
      throw error;
    }
  },

  /**
   * Get all question videos for a specific interview
   * 
   * @param {string} interviewId - Interview UUID
   * @returns {Promise<Object>} Interview data with question videos
   */
  async getInterviewQuestionVideos(interviewId) {
    try {
      const response = await fetch(`/api/question-videos/${interviewId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch question videos');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching interview question videos:', error);
      throw error;
    }
  },

  /**
   * Get a specific question video with full details
   * 
   * @param {string} interviewId - Interview UUID
   * @param {number} questionOrder - Question order (0-based)
   * @returns {Promise<Object>} Question video with full details
   */
  async getQuestionVideo(interviewId, questionOrder) {
    try {
      const response = await fetch(`/api/question-video/${interviewId}/${questionOrder}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch question video');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching question video:', error);
      throw error;
    }
  },

  /**
   * Get question videos by parameter across all interviews
   * 
   * @param {string} parameterKey - Parameter key to filter by
   * @param {Object} options - Query options
   * @param {number} options.limit - Maximum number of results (default: 50)
   * @param {number} options.offset - Number of results to skip (default: 0)
   * @returns {Promise<Object>} Question videos for the parameter
   */
  async getQuestionVideosByParameter(parameterKey, options = {}) {
    try {
      const { limit = 50, offset = 0 } = options;
      const response = await fetch(`/api/question-videos/parameter/${parameterKey}?limit=${limit}&offset=${offset}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch question videos by parameter');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error fetching question videos by parameter:', error);
      throw error;
    }
  },

  /**
   * Get question videos using Supabase client (alternative method)
   * 
   * @param {string} interviewId - Interview UUID
   * @returns {Promise<Array>} Array of question video records
   */
  async getQuestionVideosFromSupabase(interviewId) {
    try {
      const { data, error } = await supabase
        .from('answers')
        .select('question_order, question_video_url, video_size, video_duration, video_format, video_quality, video_filename')
        .eq('interview_id', interviewId)
        .not('question_video_url', 'is', null)
        .order('question_order');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching question videos from Supabase:', error);
      throw error;
    }
  },

  /**
   * Get question videos with details from answers table
   * 
   * @param {string} interviewId - Interview UUID
   * @returns {Promise<Array>} Array of question videos with full details
   */
  async getQuestionVideosWithDetails(interviewId) {
    try {
      const { data, error } = await supabase
        .from('answers')
        .select('question_order, question_video_url, video_size, video_duration, video_format, video_quality, video_filename, transcript, score, feedback')
        .eq('interview_id', interviewId)
        .not('question_video_url', 'is', null)
        .order('question_order');

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching question videos with details:', error);
      throw error;
    }
  },

  /**
   * Delete a question video (clear video data from answer)
   * 
   * @param {string} answerId - Answer UUID
   * @returns {Promise<Object>} Deletion result
   */
  async deleteQuestionVideo(answerId) {
    try {
      const { error } = await supabase
        .from('answers')
        .update({
          question_video_url: null,
          video_size: null,
          video_duration: null,
          video_format: null,
          video_quality: null,
          video_filename: null
        })
        .eq('id', answerId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting question video:', error);
      throw error;
    }
  },

  /**
   * Get storage usage statistics for question videos
   * 
   * @param {string} interviewId - Interview UUID (optional, if not provided returns all)
   * @returns {Promise<Object>} Storage statistics
   */
  async getStorageStats(interviewId = null) {
    try {
      let query = supabase
        .from('answers')
        .select('video_size, created_at')
        .not('video_size', 'is', null);

      if (interviewId) {
        query = query.eq('interview_id', interviewId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const totalSize = data.reduce((sum, video) => sum + (video.video_size || 0), 0);
      const totalVideos = data.length;
      const totalSizeMB = totalSize / (1024 * 1024);

      return {
        totalVideos,
        totalSizeBytes: totalSize,
        totalSizeMB: Math.round(totalSizeMB * 100) / 100,
        averageSizeMB: totalVideos > 0 ? Math.round((totalSizeMB / totalVideos) * 100) / 100 : 0
      };
    } catch (error) {
      console.error('Error fetching storage stats:', error);
      throw error;
    }
  },

  /**
   * Convert video blob to base64 for upload
   * 
   * @param {Blob} videoBlob - Video blob to convert
   * @returns {Promise<string>} Base64 encoded video data
   */
  async blobToBase64(videoBlob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64Data = reader.result.split(',')[1]; // Remove data URL prefix
        resolve(base64Data);
      };
      reader.onerror = reject;
      reader.readAsDataURL(videoBlob);
    });
  },

  /**
   * Prepare video data for upload
   * 
   * @param {Blob} videoBlob - Video blob
   * @param {Object} metadata - Video metadata
   * @returns {Promise<Object>} Prepared upload data
   */
  async prepareVideoUpload(videoBlob, metadata) {
    const base64Data = await this.blobToBase64(videoBlob);
    
    return {
      interview_id: metadata.interviewId,
      question_order: metadata.questionOrder,
      question_text: metadata.questionText,
      video_data: base64Data,
      video_format: metadata.format || 'webm',
      video_quality: metadata.quality || 'medium'
    };
  },

  /**
   * Validate video file before upload
   * 
   * @param {Blob} videoBlob - Video blob to validate
   * @param {Object} options - Validation options
   * @returns {Object} Validation result
   */
  validateVideoFile(videoBlob, options = {}) {
    const {
      maxSizeMB = 100,
      allowedTypes = ['video/webm', 'video/mp4', 'video/quicktime'],
      maxDurationMinutes = 10
    } = options;

    const errors = [];
    const warnings = [];

    // Check file size
    const sizeMB = videoBlob.size / (1024 * 1024);
    if (sizeMB > maxSizeMB) {
      errors.push(`Video file too large (${sizeMB.toFixed(1)} MB). Maximum allowed: ${maxSizeMB} MB`);
    } else if (sizeMB > maxSizeMB * 0.8) {
      warnings.push(`Video file is large (${sizeMB.toFixed(1)} MB). Consider compressing.`);
    }

    // Check file type
    if (!allowedTypes.includes(videoBlob.type)) {
      errors.push(`Unsupported video format: ${videoBlob.type}. Allowed: ${allowedTypes.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      sizeMB: Math.round(sizeMB * 100) / 100,
      type: videoBlob.type
    };
  }
};

export default questionVideoService;
