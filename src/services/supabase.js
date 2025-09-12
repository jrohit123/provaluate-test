import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Interview service functions
export const interviewService = {
  // Create a new interview
  async createInterview(interviewData) {
    const { data, error } = await supabase
      .from('interviews')
      .insert([interviewData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get interview by ID
  async getInterview(interviewId) {
    const { data, error } = await supabase
      .from('interviews')
      .select('*')
      .eq('id', interviewId)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Update interview
  async updateInterview(interviewId, updates) {
    const { data, error } = await supabase
      .from('interviews')
      .update(updates)
      .eq('id', interviewId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get questions for an interview
  async getQuestions(interviewId) {
    const { data, error } = await supabase
      .from('questions')
      .select('*')
      .eq('interview_id', interviewId)
      .order('question_order');
    
    if (error) throw error;
    return data;
  },

  // Create a new question
  async createQuestion(questionData) {
    const { data, error } = await supabase
      .from('questions')
      .insert([questionData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Get answers for an interview
  async getAnswers(interviewId) {
    const { data, error } = await supabase
      .from('answers')
      .select('*')
      .eq('interview_id', interviewId)
      .order('question_order');
    
    if (error) throw error;
    return data;
  },

  // Create a new answer
  async createAnswer(answerData) {
    const { data, error } = await supabase
      .from('answers')
      .insert([answerData])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Upload audio file to storage
  async uploadAudio(file, fileName) {
    const { data, error } = await supabase.storage
      .from('audio-files')
      .upload(fileName, file);
    
    if (error) throw error;
    return data;
  },

  // Get public URL for audio file
  getAudioUrl(fileName) {
    const { data } = supabase.storage
      .from('audio-files')
      .getPublicUrl(fileName);
    
    return data.publicUrl;
  }
};
