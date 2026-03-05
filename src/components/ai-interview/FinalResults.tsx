import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Download, 
  Share2, 
  BarChart3, 
  Award,
  XCircle,
  FileText,
  ChevronDown,
  ChevronUp,
  Loader2,
  Menu,
  LayoutDashboard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { buildApiUrl, API_CONFIG } from '@/constants/api';

/** Format overall_score to 1 decimal with consistent rounding (7.25 → 7.3). */
function formatOverallScore(score: number | string | null | undefined): string {
  if (score == null || score === '') return 'N/A';
  const n = Number(score);
  if (Number.isNaN(n)) return 'N/A';
  return (Math.round(n * 10) / 10).toFixed(1);
}

/** Remove "Speech Analysis Report for [Name]" line from the start of the report (bold or plain). */
function stripSpeechReportTitleLine(raw: string): string {
  const trimmed = raw.trim();
  const withoutBold = trimmed.replace(/^\*\*Speech Analysis Report for [^*]+\*\*\s*\n?/i, '').trim();
  const withoutPlain = withoutBold.replace(/^Speech Analysis Report for [^\n]+\n?/i, '').trim();
  return withoutPlain;
}

/** Speech metric rating: within range (Good), slightly drifting (Average), or far from range (Needs Work). */
type SpeechMetricRating = 'Good' | 'Average' | 'Needs Work';

/** Get rating for a speech metric from its numeric value. Green = within range, Yellow = slightly drifting, Red = far. */
function getSpeechMetricRating(metricKey: string, value: number): SpeechMetricRating {
  switch (metricKey) {
    case 'overall_speech_quality':
      if (value >= 85 && value <= 100) return 'Good';
      if (value >= 70 && value < 85) return 'Average';
      return 'Needs Work';
    case 'speaking_pace_wpm':
      if (value >= 120 && value <= 160) return 'Good';
      if ((value >= 100 && value < 120) || (value > 160 && value <= 180)) return 'Average';
      return 'Needs Work';
    case 'filler_words':
      if (value <= 5) return 'Good';
      if (value <= 10) return 'Average';
      return 'Needs Work';
    case 'filler_density':
      if (value <= 5) return 'Good';
      if (value <= 15) return 'Average';
      return 'Needs Work';
    case 'pause_quality_score':
      if (value >= 80 && value <= 100) return 'Good';
      if (value >= 65 && value < 80) return 'Average';
      return 'Needs Work';
    case 'voice_confidence':
      if (value >= 80 && value <= 100) return 'Good';
      if (value >= 55 && value < 80) return 'Average';
      return 'Needs Work';
    case 'stress_score':
      if (value >= 0 && value <= 30) return 'Good';
      if (value <= 60) return 'Average';
      return 'Needs Work';
    default:
      return 'Average';
  }
}

/** Tailwind and RGB for speech rating (Good=green, Average=amber, Needs Work=red). */
const SPEECH_RATING_STYLES: Record<SpeechMetricRating, { bg: string; text: string; rgb: [number, number, number]; textRgb: [number, number, number] }> = {
  Good: { bg: 'bg-green-50', text: 'text-green-700', rgb: [220, 252, 231], textRgb: [21, 128, 61] },
  Average: { bg: 'bg-amber-50', text: 'text-amber-700', rgb: [254, 243, 199], textRgb: [180, 83, 9] },
  'Needs Work': { bg: 'bg-red-50', text: 'text-red-700', rgb: [254, 226, 226], textRgb: [185, 28, 28] },
};

/** Parse speech report into section/content rows for table display. Returns [] if no clear sections.
 *  Format A (primary): bold **Section** headers — required by the prompt.
 *  Format B (fallback): plain-text section headers on their own line — for older/inconsistent LLM output.
 */
function parseSpeechReportSections(reportText: string): { section: string; content: string }[] {
  const text = reportText.replace(/''/g, "'").trim();
  const sections: { section: string; content: string }[] = [];

  // Format A: bold **Section Name** headers
  const regexA = /\*\*([^*]+)\*\*\s*:?\s*([\s\S]*?)(?=\*\*[^*]+\*\*\s*:?\s*|$)/gi;
  let m;
  while ((m = regexA.exec(text)) !== null) {
    const section = m[1].trim();
    const content = m[2].trim();
    if (section && (content || /overall|where|what|comparison|progress/i.test(section))) {
      sections.push({ section, content: content || '—' });
    }
  }
  if (sections.length >= 2) return sections;

  // Format B fallback: plain-text known section/subsection headers on their own line (no bold)
  // Matches section names the prompt always uses, with or without trailing colon
  const KNOWN_HEADERS = [
    /^overall$/i,
    /^what the data tells you$/i,
    /^speaking pace$/i,
    /^filler words?\s*(\/)?\s*(filler density)?$/i,
    /^filler density$/i,
    /^voice confidence$/i,
    /^stress$/i,
    /^pause(\s*(and|&)\s*pacing)?(\s*score)?$/i,
    /^comparison with previous interviews?$/i,
    /^progress over your interviews?$/i,
    /^where you did well$/i,
  ];
  const isKnownHeader = (line: string) => {
    const t = line.trim().replace(/:$/, '').trim();
    return t.length > 0 && KNOWN_HEADERS.some((p) => p.test(t));
  };

  const lines = text.split('\n');
  let curSection = '';
  let curContent: string[] = [];
  const flush = () => {
    if (curSection) {
      sections.push({
        section: curSection,
        content: curContent.join(' ').replace(/\s+/g, ' ').trim() || '—',
      });
    }
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (isKnownHeader(trimmed)) {
      flush();
      curSection = trimmed.replace(/:$/, '').trim();
      curContent = [];
    } else if (curSection) {
      curContent.push(trimmed);
    }
  }
  flush();

  return sections;
}

/** Normalize action plan text: add line breaks before labels (used when falling back to plain text render). */
function normalizeActionPlanText(raw: string): string {
  let s = raw.replace(/''/g, "'");
  s = s.replace(/\s+\*\*Addresses:\*\*/g, '\n\n**Addresses:**');
  s = s.replace(/\s+\*\*Description:\*\*/g, '\n\n**Description:**');
  s = s.replace(/\s+\*\*Expected outcome:\*\*/g, '\n\n**Expected outcome:**');
  s = s.replace(/\n(\d\.\s+\*\*)/g, '\n\n$1');
  return s.trim();
}

/** Parsed single action plan item for table row. */
interface ActionPlanItem {
  srNo: number;
  actionName: string;
  addresses: string;
  description: string;
  expectedOutcome: string;
}

/**
 * Parse action plan text into structured items (Sr No, Action Name, Addresses, Description, Expected outcome).
 * Supports three formats:
 * - Format A: "1. Action name: Title" then **Addresses:**, **Description:**, **Expected outcome:**
 * - Format B: "1. **Title**" then same labels (current prompt output)
 * - Format C: "1. Title" (plain, no bold) then same labels (fallback for older/inconsistent LLM output)
 * Returns empty array only if no items could be extracted at all.
 */
function parseActionPlanItems(raw: string): ActionPlanItem[] {
  const text = raw.replace(/''/g, "'").trim();
  const items: ActionPlanItem[] = [];

  // Format A: "1. Action name: Pace Control Practice" then **Addresses:**, **Description:**, **Expected outcome:**
  const blocksA = text.split(/(?:^|\n)\s*(\d+)\.\s*Action name:\s*/i);
  if (blocksA.length > 1) {
    for (let idx = 1; idx + 1 < blocksA.length; idx += 2) {
      const srNo = parseInt(blocksA[idx], 10) || items.length + 1;
      const rest = (blocksA[idx + 1] ?? '').trim();
      const firstLine = rest.split(/\n/)[0] ?? '';
      const actionName = firstLine.replace(/\*\*Addresses:\*\*/i, '').trim();
      const block = rest.replace(/^[^\n]*\n?/, '').trim();
      const addresses = block.match(/\*\*Addresses:\*\*\s*([\s\S]*?)(?=\*\*Description:\*\*|\*\*Expected outcome:\*\*|\n\s*\d+\.\s*Action name:|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
      const description = block.match(/\*\*Description:\*\*\s*([\s\S]*?)(?=\*\*Expected outcome:\*\*|\n\s*\d+\.\s*Action name:|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
      const expectedOutcome = block.match(/\*\*Expected outcome:\*\*\s*([\s\S]*?)(?=\*\*Addresses:\*\*|\*\*Description:\*\*|\n\s*\d+\.\s*Action name:|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
      items.push({ srNo, actionName, addresses, description, expectedOutcome });
    }
    if (items.length > 0) return items;
  }

  // Format B: "1. **Action Name**" then **Addresses:**, **Description:**, **Expected outcome:**
  const blockRegex = /(\d+)\.\s*\*\*([^*]+)\*\*\s*([\s\S]*?)(?=\n\s*\d+\.\s*\*\*|$)/g;
  let m;
  while ((m = blockRegex.exec(text)) !== null) {
    const srNo = parseInt(m[1], 10);
    const actionName = m[2].trim();
    const block = m[3];
    const addresses = block.match(/\*\*Addresses:\*\*\s*([\s\S]*?)(?=\n\s*\*\*Description:\*\*|\*\*Expected outcome:\*\*|\n\s*\d+\.|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
    const description = block.match(/\*\*Description:\*\*\s*([\s\S]*?)(?=\*\*Expected outcome:\*\*|\n\s*\d+\.|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
    const expectedOutcome = block.match(/\*\*Expected outcome:\*\*\s*([\s\S]*?)(?=\*\*Addresses:\*\*|\*\*Description:\*\*|\n\s*\d+\.|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
    items.push({ srNo, actionName, addresses, description, expectedOutcome });
  }
  if (items.length > 0) return items;

  // Format C (fallback): "1. Plain Title" (no bold, no "Action name:" prefix) then **Addresses:**, **Description:**, **Expected outcome:**
  // Catches older/inconsistent LLM outputs so they also render as a table.
  const blocksC = text.split(/(?:^|\n)\s*(\d+)\.\s+(?!\*\*)(?!Action name:)/i);
  if (blocksC.length > 1) {
    for (let idx = 1; idx + 1 < blocksC.length; idx += 2) {
      const srNo = parseInt(blocksC[idx], 10) || items.length + 1;
      const rest = (blocksC[idx + 1] ?? '').trim();
      const firstLine = rest.split(/\n/)[0] ?? '';
      // Only treat as an item if the block actually contains at least one of the expected labels
      if (!/\*\*(Addresses|Description|Expected outcome):/i.test(rest)) continue;
      const actionName = firstLine.replace(/\*\*(Addresses|Description|Expected outcome):/i, '').trim();
      const block = rest.replace(/^[^\n]*\n?/, '').trim();
      const addresses = block.match(/\*\*Addresses:\*\*\s*([\s\S]*?)(?=\*\*Description:\*\*|\*\*Expected outcome:\*\*|\n\s*\d+\.\s|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
      const description = block.match(/\*\*Description:\*\*\s*([\s\S]*?)(?=\*\*Expected outcome:\*\*|\n\s*\d+\.\s|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
      const expectedOutcome = block.match(/\*\*Expected outcome:\*\*\s*([\s\S]*?)(?=\*\*Addresses:\*\*|\*\*Description:\*\*|\n\s*\d+\.\s|$)/i)?.[1]?.trim().replace(/\s+/g, ' ').trim() ?? '';
      items.push({ srNo, actionName, addresses, description, expectedOutcome });
    }
  }
  return items;
}

/** Format a date as "2nd Feb 2026", "4th Apr 2026" (ordinal day + short month + year). Returns 'N/A' if date is missing or invalid. */
function formatOrdinalDate(date: Date | string | null | undefined): string {
  if (date == null) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return 'N/A';
  const day = d.getDate();
  const suffix = (day % 10 === 1 && day !== 11) ? 'st'
    : (day % 10 === 2 && day !== 12) ? 'nd'
    : (day % 10 === 3 && day !== 13) ? 'rd' : 'th';
  const month = d.toLocaleDateString('en-GB', { month: 'short' });
  const year = d.getFullYear();
  return `${day}${suffix} ${month} ${year}`;
}

/**
 * Draw report/plan text with proper formatting: unescape '' to ', render **...** as bold.
 * Handles page breaks. doc is jsPDF instance.
 */
function drawFormattedReportText(
  doc: any,
  rawText: string,
  opts: { startX: number; startY: number; maxWidth: number; lineHeight: number; pageHeight: number; bottomMargin: number; fontSize: number }
): void {
  const unescaped = rawText.replace(/''/g, "'");
  const parts: { text: string; bold: boolean }[] = [];
  let remaining = unescaped;
  let bold = false;
  while (remaining.length > 0) {
    const idx = remaining.indexOf('**');
    if (idx === -1) {
      if (remaining) parts.push({ text: remaining, bold });
      break;
    }
    if (idx > 0) parts.push({ text: remaining.slice(0, idx), bold });
    bold = !bold;
    remaining = remaining.slice(idx + 2);
  }
  let y = opts.startY;
  const x = opts.startX;
  doc.setFontSize(opts.fontSize);
  for (const part of parts) {
    doc.setFont('helvetica', part.bold ? 'bold' : 'normal');
    const lines = doc.splitTextToSize(part.text, opts.maxWidth);
    for (const line of lines) {
      if (y > opts.pageHeight - opts.bottomMargin) {
        doc.addPage();
        y = 20;
      }
      doc.text(line, x, y);
      y += opts.lineHeight;
    }
  }
}

const FinalResults = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reportVariant = searchParams.get('variant') || 'candidate'; // 'recruiter' = report ends at speech scores
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [selectedParameter, setSelectedParameter] = useState(null);
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [playingVideo, setPlayingVideo] = useState(null);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [showingWrittenAnswer, setShowingWrittenAnswer] = useState(null);
  const [showSpeechDetailsCard, setShowSpeechDetailsCard] = useState(false);

  const playVideo = (videoUrl) => {
    if (videoUrl) {
      setPlayingVideo(videoUrl);
    }
  };

  const closeVideo = () => {
    setPlayingVideo(null);
  };

  const playAudio = (audioUrl) => {
    if (audioUrl) {
      setPlayingAudio(audioUrl);
    }
  };

  const closeAudio = () => {
    setPlayingAudio(null);
  };

  const showWrittenAnswer = (writtenAnswer) => {
    if (writtenAnswer) {
      setShowingWrittenAnswer(writtenAnswer);
    }
  };

  const closeWrittenAnswer = () => {
    setShowingWrittenAnswer(null);
  };

  // Toggle question expansion
  const toggleQuestion = (questionId) => {
    setExpandedQuestions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(questionId)) {
        newSet.delete(questionId);
      } else {
        newSet.add(questionId);
      }
      return newSet;
    });
  };

  const loadFinalResults = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.GET_FINAL_RESULTS}/${interviewId}`));
      
      if (response.ok) {
        const data = await response.json();
        console.log('📊 Final results data loaded:', data);
        console.log('📊 Interview data:', data.interview);
        console.log('📊 Interview type from API:', data.interview?.interview_type);
        console.log('📊 Parameters:', data.parameters?.length);
        console.log('📊 Raw answers from API:', data.answers?.length);
        
        // Try to get parameter scores data directly to extract real feedback
        let realFeedbackData = null;
        try {
          console.log('🔍 Attempting to fetch parameter scores data...');
          console.log('🔍 Data structure keys:', Object.keys(data));
          console.log('🔍 Custom parameters:', data.custom_parameters);
          console.log('🔍 Standard parameters:', data.standard_parameters);
          console.log('🔍 Parameters array:', data.parameters);
          
          // Check if parameters array contains the detailed data
          if (data.parameters && data.parameters.length > 0) {
            console.log('🔍 First parameter structure:', data.parameters[0]);
            if (data.parameters[0].questions && data.parameters[0].questions.length > 0) {
              console.log('🔍 First question structure:', data.parameters[0].questions[0]);
            }
          }
          
                  // Use the real data from the API response
        console.log('📊 Using real data from API response');
        console.log('📊 Answers with video URLs:', data.answers?.map(a => ({ 
          question_order: a.question_order, 
          video_url: a.question_video_url 
        })));
        
        // Log video URLs for debugging
        if (data.answers) {
          data.answers.forEach((answer, index) => {
            if (answer.question_video_url) {
              console.log(`🎥 Answer ${index + 1} (Q${answer.question_order + 1}) has video: ${answer.question_video_url}`);
            }
          });
        }
          
        } catch (paramError) {
          console.log('⚠️ Could not load parameter scores data:', paramError);
        }
        
        // Extract questions and answers from parameters with proper ordering
        const extractedQuestions = [];
        const extractedAnswers = [];
        let globalQuestionIndex = 0;
        
        // First, check if we have questions and answers arrays from the API
        if (data.questions && data.questions.length > 0 && data.answers && data.answers.length > 0) {
          console.log('✅ Using questions and answers arrays from API');
          console.log('📊 Number of questions from API:', data.questions.length);
          console.log('📊 Number of answers from API:', data.answers.length);
          
          // Use the questions array for question text and answers array for feedback
          data.questions.forEach((question, index) => {
            console.log(`🔍 Question ${index} data:`, question);
            console.log(`🔍 Question ${index} text:`, question.question_text);
            
            extractedQuestions.push({
              question_order: question.question_order,
              question_text: question.question_text,
              parameter_key: question.parameter_key,
              parameter_name: question.parameter_name
            });
          });
          
          data.answers.forEach((answer, index) => {
            console.log(`🔍 Answer ${index} data:`, answer);
            console.log(`🎥 Answer ${index} video URL:`, answer.question_video_url);
            
            extractedAnswers.push({
              question_order: answer.question_order,
              transcript: answer.transcript,
              audio_url: answer.audio_url,
              question_video_url: answer.question_video_url, // Preserve video URL
              score: answer.score,
              feedback: answer.feedback, // This is the REAL AI feedback
              parameter_key: answer.parameter_key,
              parameter_name: answer.parameter_name,
              written_answer: answer.written_answer,
              behavioral: answer.behavioral ?? answer.behavioral_metrics,
              behavioral_metrics: answer.behavioral_metrics ?? answer.behavioral
            });
          });
          
          console.log('🎯 Using real feedback from answers array');
          console.log('📊 Sample real feedback:', extractedAnswers[0]?.feedback?.substring(0, 100) + '...');
          console.log('🎥 Videos in extracted answers:', extractedAnswers.filter(a => a.question_video_url).length);
        } else if (data.answers && data.answers.length > 0) {
          // Fallback: if we only have answers array, try to extract question text from questions table
          console.log('⚠️ No questions array from API, trying to fetch from questions table...');
          
          // For structured interviews or when questions array is missing, fetch from questions table
          try {
            const questionsResponse = await fetch(buildApiUrl(`${API_CONFIG.ENDPOINTS.GET_QUESTIONS}/${interviewId}`));
            if (questionsResponse.ok) {
              const questionsData = await questionsResponse.json();
              if (questionsData.questions && Array.isArray(questionsData.questions) && questionsData.questions.length > 0) {
                console.log('✅ Fetched questions from questions table:', questionsData.questions.length);
                
                // Match questions with answers by question_order
                data.answers.forEach((answer) => {
                  const question = questionsData.questions.find((q: any) => 
                    (q.question_order || 0) === (answer.question_order || 0)
                  );
                  
                  // Use question_text from questions table (for structured interviews)
                  const questionText = question?.question_text || question?.question || answer.question_text || `Question ${(answer.question_order || 0) + 1}`;
                  
                  extractedQuestions.push({
                    question_order: answer.question_order,
                    question_text: questionText,
                    parameter_key: answer.parameter_key || question?.parameter_key,
                    parameter_name: answer.parameter_name || question?.category
                  });
                  
                  extractedAnswers.push({
                    question_order: answer.question_order,
                    transcript: answer.transcript,
                    audio_url: answer.audio_url,
                    question_video_url: answer.question_video_url,
                    score: answer.score,
                    feedback: answer.feedback,
                    parameter_key: answer.parameter_key,
                    parameter_name: answer.parameter_name,
                    written_answer: answer.written_answer,
                    behavioral: answer.behavioral ?? answer.behavioral_metrics,
                    behavioral_metrics: answer.behavioral_metrics ?? answer.behavioral
                  });
                });
              } else {
                // Fallback to answer data only
                console.log('⚠️ No questions found in questions table, using answer data');
                data.answers.forEach((answer, index) => {
                  const questionText = answer.question_text || `Question ${(answer.question_order || 0) + 1}`;
                  
                  extractedQuestions.push({
                    question_order: answer.question_order,
                    question_text: questionText,
                    parameter_key: answer.parameter_key,
                    parameter_name: answer.parameter_name
                  });
                  
                  extractedAnswers.push({
                    question_order: answer.question_order,
                    transcript: answer.transcript,
                    audio_url: answer.audio_url,
                    question_video_url: answer.question_video_url,
                    score: answer.score,
                    feedback: answer.feedback,
                    parameter_key: answer.parameter_key,
                    parameter_name: answer.parameter_name,
                    written_answer: answer.written_answer,
                    behavioral: answer.behavioral ?? answer.behavioral_metrics,
                    behavioral_metrics: answer.behavioral_metrics ?? answer.behavioral
                  });
                });
              }
            } else {
              throw new Error('Failed to fetch questions');
            }
          } catch (error) {
            console.error('Error fetching questions from API:', error);
            // Fallback: use answer data only
            data.answers.forEach((answer, index) => {
              const questionText = answer.question_text || `Question ${(answer.question_order || 0) + 1}`;
              
              extractedQuestions.push({
                question_order: answer.question_order,
                question_text: questionText,
                parameter_key: answer.parameter_key,
                parameter_name: answer.parameter_name
              });
              
              extractedAnswers.push({
                question_order: answer.question_order,
                transcript: answer.transcript,
                audio_url: answer.audio_url,
                question_video_url: answer.question_video_url,
                score: answer.score,
                feedback: answer.feedback,
                parameter_key: answer.parameter_key,
                parameter_name: answer.parameter_name,
                written_answer: answer.written_answer,
                behavioral: answer.behavioral ?? answer.behavioral_metrics,
                behavioral_metrics: answer.behavioral_metrics ?? answer.behavioral
              });
            });
          }
        } else {
          console.log('⚠️ No questions or answers arrays from API, extracting from parameters data...');
          
          if (data.parameters && data.parameters.length > 0) {
            console.log('🔍 Extracting from parameters data...');
            
            data.parameters.forEach((param, paramIndex) => {
              if (param.questions && Array.isArray(param.questions)) {
                param.questions.forEach((questionData, qIndex) => {
                  // Create question object with proper global ordering
                  extractedQuestions.push({
                    question_order: globalQuestionIndex,
                    question_text: questionData.text,
                    parameter_key: param.key,
                    parameter_name: param.name
                  });
                  
                  // Try to get real feedback from parameter scores data
                  let realFeedback = `Assessment for ${param.name}: ${param.reason}`;
                  if (realFeedbackData && realFeedbackData[param.key]) {
                    const individualScores = realFeedbackData[param.key].individual_question_scores;
                    if (individualScores && individualScores[qIndex]) {
                      realFeedback = individualScores[qIndex].feedback;
                      console.log(`🎯 Found real feedback for ${param.key} question ${qIndex}:`, realFeedback.substring(0, 100) + '...');
                    }
                  }
                  
                  // Create answer object with real data
                  extractedAnswers.push({
                    question_order: globalQuestionIndex,
                    transcript: questionData.answer,
                    audio_url: questionData.audio_url,
                    score: param.score,
                    feedback: realFeedback,
                    parameter_key: param.key,
                    parameter_name: param.name
                  });
                  
                  globalQuestionIndex++;
                });
              }
            });
          }
        }
        
        // Sort by question_order to ensure proper ordering
        extractedQuestions.sort((a, b) => a.question_order - b.question_order);
        extractedAnswers.sort((a, b) => a.question_order - b.question_order);
        
        // Convert parameters array to object structure for UI compatibility
        const parametersObject: Record<string, any> = {};

        // When we have questions+answers, build parameters from them so behavioral is guaranteed
        if (extractedQuestions.length > 0 && extractedAnswers.length > 0) {
          const byParam = new Map<string, { questions: any[]; answers: any[] }>();
          extractedQuestions.forEach((q, idx) => {
            const paramKey = q.parameter_key || q.parameter_name || 'general';
            if (!byParam.has(paramKey)) byParam.set(paramKey, { questions: [], answers: [] });
            const ans = extractedAnswers.find((a: any) => (a.question_order || 0) === (q.question_order ?? idx));
            byParam.get(paramKey)!.questions.push({ question: q, answer: ans || extractedAnswers[idx] });
          });
          const paramMeta = new Map<string, any>();
          (data.parameters || []).forEach((p: any) => { if (p.key) paramMeta.set(p.key, p); });
          byParam.forEach((val, paramKey) => {
            const meta = paramMeta.get(paramKey);
            parametersObject[paramKey] = {
              name: meta?.name || paramKey,
              score: meta?.score ?? 6,
              weight: meta?.weight ?? 100,
              questions: val.questions.map(({ question, answer }) => ({
                question: { question_text: question.question_text, question_order: question.question_order },
                answer: {
                  transcript: answer?.transcript,
                  score: answer?.score,
                  feedback: answer?.feedback,
                  audio_url: answer?.audio_url,
                  question_video_url: answer?.question_video_url,
                  written_answer: answer?.written_answer,
                  behavioral: answer?.behavioral ?? answer?.behavioral_metrics,
                  behavioral_metrics: answer?.behavioral_metrics ?? answer?.behavioral
                }
              })),
              isPersonal: (meta?.name || '').toLowerCase().includes('personal'),
              questionCount: val.questions.length,
              totalScore: (meta?.score ?? 6) * val.questions.length
            };
          });
        }

        // Fallback: build from data.parameters when questions/answers path didn't populate
         if (Object.keys(parametersObject).length === 0 && data.parameters && Array.isArray(data.parameters)) {
           data.parameters.forEach(param => {
             // Map questions to the format expected by the UI
             const mappedQuestions = (param.questions || []).map((questionData, index) => {
               // Match by 0-based question_order first (API uses 0-based), then 1-based
               const oneBasedOrder = index + 1;
               const correspondingAnswer =
                 data.answers?.find((a: any) => (a.parameter_key === param.key || a.parameter_name === param.name) && Number(a.question_order) === index) ||
                 data.answers?.find((a: any) => (a.parameter_key === param.key || a.parameter_name === param.name) && Number(a.question_order) === oneBasedOrder) ||
                 data.answers?.find((a: any) => a.parameter_key === param.key && Number(a.question_order) === index) ||
                 data.answers?.find((a: any) => Number(a.question_order) === index);

               // Seed values from available sources
               let realQuestionText = questionData.text;
               let realTranscript = correspondingAnswer?.transcript || questionData.answer;
               let realFeedback = correspondingAnswer?.feedback;
               let realScore = correspondingAnswer?.score;
               let realAudioUrl = correspondingAnswer?.audio_url || questionData.audio_url;
               let realVideoUrl = correspondingAnswer?.question_video_url;
               let realWrittenAnswer = correspondingAnswer?.written_answer;

               // Fallback to interview.parameter_scores.individual_question_scores matched by question_order
               if (data.interview?.parameter_scores) {
                 const parameterScores = typeof data.interview.parameter_scores === 'string'
                   ? JSON.parse(data.interview.parameter_scores)
                   : data.interview.parameter_scores;

                 const iqs = parameterScores?.[param.key]?.individual_question_scores;
                 if (Array.isArray(iqs) && iqs.length > 0) {
                   const iqsItem = iqs.find((q: any) => Number(q.question_order) === oneBasedOrder) || iqs[index];
                   if (iqsItem) {
                     // If no direct answer match, use IQS entirely
                     if (!correspondingAnswer) {
                       realQuestionText = iqsItem.question_text || realQuestionText;
                       realTranscript = iqsItem.transcript || realTranscript;
                       realFeedback = iqsItem.feedback || realFeedback;
                       realScore = iqsItem.score ?? realScore;
                       realAudioUrl = iqsItem.audio_url || realAudioUrl;
                     } else {
                       // Only fill missing fields
                       if (!realFeedback && iqsItem.feedback) realFeedback = iqsItem.feedback;
                       if (realScore == null && iqsItem.score != null) realScore = iqsItem.score;
                       if (!realQuestionText && iqsItem.question_text) realQuestionText = iqsItem.question_text;
                       if (!realTranscript && iqsItem.transcript) realTranscript = iqsItem.transcript;
                       if (!realAudioUrl && iqsItem.audio_url) realAudioUrl = iqsItem.audio_url;
                     }
                   }
                 }
               }

               // Final fallbacks
               if (realFeedback == null) realFeedback = `Assessment for ${param.name}: ${param.reason}`;
               if (realScore == null) realScore = param.score;

               // Use full answer when available (includes behavioral) - ensures speech analysis shows
               const fullAnswer = correspondingAnswer || data.answers?.find((a: any) =>
                 (a.parameter_key === param.key || a.parameter_name === param.name) &&
                 (Number(a.question_order) === index || Number(a.question_order) === oneBasedOrder)
               ) || data.answers?.find((a: any) => Number(a.question_order) === index);
               const behavioralData = fullAnswer?.behavioral ?? fullAnswer?.behavioral_metrics;

               return {
                 question: {
                   question_text: realQuestionText,
                   question_order: index
                 },
                 answer: {
                   transcript: realTranscript,
                   score: realScore,
                   feedback: realFeedback,
                   audio_url: realAudioUrl,
                   question_video_url: realVideoUrl,
                   written_answer: realWrittenAnswer,
                   behavioral: behavioralData,
                   behavioral_metrics: behavioralData
                 }
               };
             });
             
             parametersObject[param.key] = {
               name: param.name,
               score: param.score,
               weight: param.weight,
               questions: mappedQuestions,
               isPersonal: param.name?.toLowerCase().includes('personal') || false,
               questionCount: param.questions?.length || 0,
               totalScore: param.score * (param.questions?.length || 1)
             };
           });
         }
         
         // Add extracted data to the response
         const processedData = {
           ...data,
           questions: extractedQuestions,
           answers: extractedAnswers,
           parameters: parametersObject
         };
         
         console.log('📊 Extracted questions:', extractedQuestions.length);
         console.log('📊 Extracted answers:', extractedAnswers.length);
         console.log('📊 Sample answer feedback:', extractedAnswers[0]?.feedback?.substring(0, 100) + '...');
         console.log('📊 Parameters object:', parametersObject);
         console.log('📊 Parameters keys:', Object.keys(parametersObject));
         
         // Debug duration data
         console.log('🔍 Interview data:', data.interview);
         console.log('🔍 Duration minutes from API:', data.interview?.duration_minutes);
         console.log('🔍 Session duration from API:', data.interview?.session_duration);
         console.log('🔍 Started at:', data.interview?.started_at);
         console.log('🔍 Completed at:', data.interview?.completed_at);
         
         setReportData(processedData);
      } else {
        throw new Error('Failed to load final results');
      }
    } catch (error) {
      console.error('Error loading final results:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to load final results', { id: 'load-results-error' });
    } finally {
      setLoading(false);
    }
  }, [interviewId]);

  useEffect(() => {
    if (interviewId) {
      loadFinalResults();
    }
  }, [loadFinalResults, interviewId]);

  // Auto-select first parameter when questions are loaded
  useEffect(() => {
    if (reportData && reportData.questions && reportData.questions.length > 0 && !selectedParameter) {
      const firstParamKey = reportData.questions[0].parameter_key || reportData.questions[0].parameter_name;
      setSelectedParameter(firstParamKey);
    }
  }, [reportData, selectedParameter]);

  // Reset expanded questions when parameter changes
  useEffect(() => {
    setExpandedQuestions(new Set());
  }, [selectedParameter]);



  const downloadReport = () => {
    if (!reportData) return;

    try {
      // Create comprehensive report content
      let reportContent = `INTERVIEW ASSESSMENT REPORT\n`;
      reportContent += `================================\n\n`;
      
      // Interview details
      reportContent += `CANDIDATE: ${reportData.interview?.candidate_name || 'N/A'}\n`;
      reportContent += `POSITION: ${reportData.interview?.position || 'N/A'}\n`;
      // Remove Interview Type from text report - not needed
      reportContent += `OVERALL SCORE: ${formatOverallScore(reportData.interview?.overall_score)}/10\n`;
      reportContent += `TOTAL QUESTIONS: ${reportData.questions?.length || 0}\n`;
      reportContent += `ASSESSMENT DATE: ${formatOrdinalDate(reportData.interview?.created_at)}\n`;
      reportContent += `REPORT GENERATED: ${formatOrdinalDate(new Date())}\n\n`;
      
      // Parameter scores summary
      if (reportData.parameters && reportData.parameters.length > 0) {
        reportContent += `PARAMETER SCORES SUMMARY:\n`;
        reportContent += `========================\n`;
        reportData.parameters.forEach((param, index) => {
          reportContent += `${index + 1}. ${param.name || param.parameter_name || 'Unknown Parameter'}\n`;
          reportContent += `   Score: ${param.score || param.averageScore || 'N/A'}/10\n`;
          if (param.weight) reportContent += `   Weight: ${param.weight}%\n`;
          reportContent += `\n`;
        });
        reportContent += `\n`;
      }
      
      // Detailed assessment with all URLs
      reportContent += `DETAILED ASSESSMENT:\n`;
      reportContent += `===================\n\n`;
      
      if (reportData.questions && reportData.answers) {
        reportData.questions.forEach((question, index) => {
          const answer = reportData.answers.find(a => a.question_order === index);
          if (answer) {
            reportContent += `QUESTION ${index + 1}:\n`;
            reportContent += `==================\n`;
            reportContent += `Question Text: ${question.question_text}\n`;
            reportContent += `Parameter: ${question.parameter_name || question.parameter_key || 'N/A'}\n`;
            reportContent += `Question Order: ${question.question_order + 1}\n\n`;
            
            reportContent += `CANDIDATE'S ANSWER:\n`;
            reportContent += `Transcript: ${answer.transcript || 'No transcript available'}\n`;
            reportContent += `Score: ${answer.score}/10\n`;
            reportContent += `Parameter Score: ${answer.parameter_score || 'N/A'}/10\n\n`;
            
            reportContent += `AI FEEDBACK:\n`;
            reportContent += `${answer.feedback || 'No feedback available'}\n\n`;
            
            // Media URLs
            reportContent += `MEDIA FILES:\n`;
            if (answer.audio_url) {
              reportContent += `Audio Recording: ${answer.audio_url}\n`;
            } else {
              reportContent += `Audio Recording: Not available\n`;
            }
            
            if (answer.question_video_url) {
              reportContent += `Video Recording: ${answer.question_video_url}\n`;
            } else {
              reportContent += `Video Recording: Not available\n`;
            }
            
            reportContent += `\n`;
            reportContent += `----------------------------------------\n\n`;
          }
        });
      }
      
      // Footer
      reportContent += `\nREPORT FOOTER:\n`;
      reportContent += `==============\n`;
      reportContent += `This report contains the complete assessment details including:\n`;
      reportContent += `- All questions asked during the interview\n`;
      reportContent += `- Candidate's verbal responses (transcripts)\n`;
      reportContent += `- Individual question scores and parameter scores\n`;
      reportContent += `- AI-generated feedback for each answer\n`;
      reportContent += `- Direct links to audio and video recordings\n`;
      reportContent += `- Parameter-wise performance breakdown\n\n`;
      reportContent += `Generated by AI Interview System\n`;
      reportContent += `Report ID: ${interviewId}\n`;
      
      // Create and download file
      const blob = new Blob([reportContent], { type: 'text/plain' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Interview_Report_${reportData.interview?.candidate_name || 'Candidate'}_${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Comprehensive report downloaded successfully!', { id: 'report-download-success' });
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to download report', { id: 'report-download-error' });
    }
  };

  // Download as PDF function
  const downloadPDF = async () => {
    if (!reportData) return;

    try {
      // Dynamically import jsPDF to avoid bundle size issues
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF();
      
      // Set document properties
      doc.setProperties({
        title: `Interview Report - ${reportData.interview?.candidate_name || 'Candidate'}`,
        subject: 'Interview Assessment Report',
        author: 'AI Interview System',
        creator: 'AI Interview System'
      });

      // Professional header with background
      doc.setFillColor(41, 128, 185); // Blue background
      doc.rect(0, 0, 210, 30, 'F');
      
      // Title in white
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text('INTERVIEW ASSESSMENT REPORT', 105, 18, { align: 'center' });
      
      // Subtitle
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text('Professional Evaluation & Analysis', 105, 28, { align: 'center' });
      
      // Reset text color
      doc.setTextColor(0, 0, 0);
      
      let yPosition = 45;
      
      // Interview details section with box
      doc.setFillColor(236, 240, 241); // Light gray background
      doc.rect(10, yPosition - 5, 190, 35, 'F');
      doc.setDrawColor(189, 195, 199);
      doc.setLineWidth(0.5);
      doc.rect(10, yPosition - 5, 190, 35);
      
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('INTERVIEW DETAILS', 15, yPosition);
      yPosition += 12;
      
      // Two-column layout for details
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      
      // Left column
      doc.text(`Candidate: ${reportData.interview?.candidate_name || 'N/A'}`, 15, yPosition);
      doc.text(`Position: ${reportData.interview?.position || 'N/A'}`, 15, yPosition + 8);
      doc.text(`Interview Type: ${reportData.interview?.interview_type || 'N/A'}`, 15, yPosition + 16);
      
      // Right column
      doc.text(`Overall Score: ${formatOverallScore(reportData.interview?.overall_score)}/10`, 110, yPosition);
      doc.text(`Total Questions: ${reportData.questions?.length || 0}`, 110, yPosition + 8);
      doc.text(`Date: ${formatOrdinalDate(reportData.interview?.created_at)}`, 110, yPosition + 16);
      
      yPosition += 45;
      
      // Detailed assessment section
      if (reportData.questions && reportData.answers) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('DETAILED ASSESSMENT', 15, yPosition);
        yPosition += 15;
        
        reportData.questions.forEach((question, index) => {
          const answer = reportData.answers.find(a => a.question_order === index);
          if (answer) {
            // Check if we need a new page
            if (yPosition > 250) {
              doc.addPage();
              yPosition = 20;
            }
            
            // Question box
            doc.setFillColor(248, 249, 250);
            doc.rect(10, yPosition - 5, 190, 80, 'F');
            doc.setDrawColor(189, 195, 199);
            doc.rect(10, yPosition - 5, 190, 80);
            
            // Question header with icon
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(`Question ${index + 1}`, 15, yPosition);
            yPosition += 10;
            
            // Question text
            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            const questionText = doc.splitTextToSize(question.question_text, 180);
            questionText.forEach(line => {
              if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
              }
              doc.text(line, 15, yPosition);
              yPosition += 5;
            });
            yPosition += 8;
            
            // Answer section
            doc.setFont('helvetica', 'bold');
            doc.text('Answer:', 15, yPosition);
            yPosition += 6;
            doc.setFont('helvetica', 'normal');
            
            const transcript = answer.transcript || 'No transcript available';
            const transcriptLines = doc.splitTextToSize(transcript, 180);
            transcriptLines.forEach(line => {
              if (yPosition > 250) {
                doc.addPage();
                yPosition = 20;
              }
              doc.text(line, 15, yPosition);
              yPosition += 5;
            });
            yPosition += 8;
            
            // Score with color coding
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
            
            // Score background based on performance
            let scoreColor;
            if (answer.score >= 8) scoreColor = [46, 204, 113]; // Green
            else if (answer.score >= 6) scoreColor = [241, 196, 15]; // Yellow
            else scoreColor = [231, 76, 60]; // Red
            
            doc.setFillColor(scoreColor[0], scoreColor[1], scoreColor[2]);
            doc.rect(15, yPosition - 3, 40, 8, 'F');
            doc.setTextColor(255, 255, 255);
            doc.text(`Score: ${answer.score}/10`, 17, yPosition);
            doc.setTextColor(0, 0, 0);
            
            yPosition += 12;
            
            // AI Feedback
            if (answer.feedback) {
              doc.setFont('helvetica', 'bold');
              doc.text('AI Feedback:', 15, yPosition);
              yPosition += 6;
              doc.setFont('helvetica', 'normal');
              doc.setFontSize(10);
              
              const feedbackLines = doc.splitTextToSize(answer.feedback, 180);
              feedbackLines.forEach(line => {
                if (yPosition > 250) {
                  doc.addPage();
                  yPosition = 20;
                }
                doc.text(line, 15, yPosition);
                yPosition += 5;
              });
              yPosition += 8;
            }
            
            // Media files section
            doc.setFont('helvetica', 'bold');
            doc.text('Media Files:', 15, yPosition);
            yPosition += 6;
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(9);
            
            if (answer.audio_url) {
              doc.text('Audio:', 15, yPosition);
              doc.text(answer.audio_url, 25, yPosition);
              yPosition += 5;
            }
            
            if (answer.question_video_url) {
              doc.text('Video:', 15, yPosition);
              doc.text(answer.question_video_url, 25, yPosition);
              yPosition += 5;
            }
            
            yPosition += 15;
          }
        });
      }
      
      // Professional footer
      if (yPosition > 250) {
        doc.addPage();
        yPosition = 20;
      }
      
      // Footer box
      doc.setFillColor(52, 73, 94);
      doc.rect(0, yPosition, 210, 30, 'F');
      
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'italic');
      doc.text('Generated by AI Interview System', 105, yPosition + 10, { align: 'center' });
      doc.text(`Report ID: ${interviewId} | ${formatOrdinalDate(reportData.interview?.created_at)}`, 105, yPosition + 20, { align: 'center' });
      
      // Save the PDF
      const filename = `Interview_Report_${reportData.interview?.candidate_name || 'Candidate'}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
      toast.success('Professional PDF report downloaded successfully!', { id: 'pdf-download-success' });
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF. Please try again.', { id: 'pdf-download-error' });
    }
  };

  // Download as Excel function using ExcelJS for full styling support
  const downloadExcel = async () => {
    if (!reportData) return;

    try {
      // Import ExcelJS dynamically
      const ExcelJS = (await import('exceljs')).default;
      const workbook = new ExcelJS.Workbook();
      
      // ============================================
      // CREATE OVERVIEW SHEET
      // ============================================
      const overviewSheet = workbook.addWorksheet('Overview');
      
      // Define columns with proper widths
      overviewSheet.columns = [
        { header: 'FIELD', key: 'field', width: 25 },
        { header: 'VALUE', key: 'value', width: 40 }
      ];
      
      // Add data rows
      overviewSheet.addRow(['Candidate Name', reportData.interview?.candidate_name || 'N/A']);
      overviewSheet.addRow(['Position Applied', reportData.interview?.position || 'N/A']);
      overviewSheet.addRow(['Overall Score', formatOverallScore(reportData.interview?.overall_score)]);
      overviewSheet.addRow(['Total Questions', (reportData.questions?.length || 0).toString()]);
      overviewSheet.addRow(['Assessment Date', formatOrdinalDate(reportData.interview?.created_at)]);
      overviewSheet.addRow(['Report generated time', new Date().toLocaleTimeString()]);
      overviewSheet.addRow(['Performance Level', getScoreLabel(reportData.interview?.overall_score || 0)]);
      if (reportData.interview?.status === 'terminated' && reportData.interview?.termination_reason) {
        overviewSheet.addRow(['Termination Reason', reportData.interview.termination_reason]);
      }
      
      // Style header row
      const overviewHeaderRow = overviewSheet.getRow(1);
      overviewHeaderRow.height = 30;
      overviewHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
      overviewHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      overviewHeaderRow.eachCell((cell) => {
        if (cell.value && cell.value.toString().trim() !== '') {
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
          };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
        }
      });
      
      // Style data rows
      overviewSheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) {
          row.height = 25;
          row.eachCell({ includeEmpty: false }, (cell) => {
            if (cell.value && cell.value.toString().trim() !== '') {
              cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
              };
              cell.font = { size: 11 };
              
              // Alternate row colors
              if (rowNumber % 2 === 0) {
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFF2F2F2' }
                };
              }
              
              cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
            }
          });
        }
      });
      
      // ============================================
      // CREATE QUESTIONS & ANSWERS SHEET
      // ============================================
      if (reportData.questions && reportData.answers) {
        const qaSheet = workbook.addWorksheet('Questions & Answers');
        
        // Define columns with proper widths
        qaSheet.columns = [
          { header: 'Q NO', key: 'q', width: 8 },
          { header: 'PARAMETER', key: 'parameter', width: 25 },
          { header: 'QUESTION', key: 'question', width: 50 },
          { header: 'ANSWER', key: 'answer', width: 60 },
          { header: 'WRITTEN ANSWER', key: 'written_answer', width: 50 },
          { header: 'SCORE', key: 'score', width: 10 },
          { header: 'AI FEEDBACK', key: 'feedback', width: 80 }
        ];
        
        // Add data rows - match questions with answers properly using question_order
        const sortedQuestions = [...reportData.questions].sort((a, b) => (a.question_order || 0) - (b.question_order || 0));
        
        sortedQuestions.forEach((question) => {
          const questionOrder = question.question_order || 0;
          const answer = reportData.answers.find(a => (a.question_order || 0) === questionOrder);
          
          const questionText = question.question_text || question.question || 'N/A';
          const parameter = question.parameter_name || question.parameter_key || 'N/A';
          
          // Only add if we have a valid question (not N/A)
          if (questionText !== 'N/A' && parameter !== 'N/A') {
            if (answer) {
              const transcript = answer.transcript || answer.answer || 'No transcript available';
              const writtenAnswer = answer.written_answer || 'No written answer';
              const score = answer.score || 'N/A';
              const feedback = answer.feedback || 'No feedback available';
              
              qaSheet.addRow([questionOrder + 1, parameter, questionText, transcript, writtenAnswer, score, feedback]);
            } else {
              // Handle case where answer is missing but question exists
              qaSheet.addRow([questionOrder + 1, parameter, questionText, 'No answer recorded', 'No written answer', 'N/A', 'No feedback available']);
            }
          }
        });
        
        // Style header row
        const qaHeaderRow = qaSheet.getRow(1);
        qaHeaderRow.height = 30;
        qaHeaderRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
        qaHeaderRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
        qaHeaderRow.eachCell((cell) => {
          if (cell.value && cell.value.toString().trim() !== '') {
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FF4472C4' }
            };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF000000' } },
              left: { style: 'thin', color: { argb: 'FF000000' } },
              bottom: { style: 'thin', color: { argb: 'FF000000' } },
              right: { style: 'thin', color: { argb: 'FF000000' } }
            };
          }
        });
        
        // Style data rows with dynamic height calculation
        qaSheet.eachRow((row, rowNumber) => {
          if (rowNumber > 1) {
            // Calculate height based on content length
            const questionCell = row.getCell(3);
            const answerCell = row.getCell(4);
            const writtenAnswerCell = row.getCell(5);
            const feedbackCell = row.getCell(7);
            
            const questionText = questionCell.value?.toString() || '';
            const answerText = answerCell.value?.toString() || '';
            const writtenAnswerText = writtenAnswerCell.value?.toString() || '';
            const feedbackText = feedbackCell.value?.toString() || '';
            
            // Estimate lines needed (approximate characters per line)
            const questionLines = Math.ceil(questionText.length / 50);
            const answerLines = Math.ceil(answerText.length / 60);
            const writtenAnswerLines = Math.ceil(writtenAnswerText.length / 60);
            const feedbackLines = Math.ceil(feedbackText.length / 70);
            
            const maxLines = Math.max(questionLines, answerLines, writtenAnswerLines, feedbackLines);
            row.height = Math.max(100, maxLines * 15);
            
            // Apply styling to each cell
            row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
              if (cell.value && cell.value.toString().trim() !== '') {
                cell.border = {
                  top: { style: 'thin', color: { argb: 'FF000000' } },
                  left: { style: 'thin', color: { argb: 'FF000000' } },
                  bottom: { style: 'thin', color: { argb: 'FF000000' } },
                  right: { style: 'thin', color: { argb: 'FF000000' } }
                };
                cell.font = { size: 11 };
                
                // Alternate row colors
                if (rowNumber % 2 === 0) {
                  cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2F2F2' }
                  };
                }
                
                // Top align all columns for better readability with long text
                cell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
                
                // Center align Q and Score columns
                if (colNumber === 1 || colNumber === 6) {
                  cell.alignment = { vertical: 'top', horizontal: 'center', wrapText: true };
                }
              }
            });
          }
        });
      }

      // ============================================
      // CREATE SPEECH ANALYSIS SHEET (Overall Summary + Per-Question + Detailed Feedback + Action Plan)
      // ============================================
      const speechSheet = workbook.addWorksheet('Speech Analysis');
      const blueFill = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF1E5DA8' } };
      const thinBorder = {
        top: { style: 'thin' as const, color: { argb: 'FF000000' } },
        left: { style: 'thin' as const, color: { argb: 'FF000000' } },
        bottom: { style: 'thin' as const, color: { argb: 'FF000000' } },
        right: { style: 'thin' as const, color: { argb: 'FF000000' } }
      };
      let speechRow = 1;

      // --- Section 1: Overall Metrics Summary (same as PDF) ---
      const withBehavioral = (reportData.answers || []).filter((a: any) => {
        const b = a.behavioral ?? a.behavioral_metrics;
        return b && (typeof b.overall_speech_quality === 'number' || typeof b.speaking_pace_wpm === 'number' || typeof b.pause_quality_score === 'number');
      });
      const avg = (key: string, formatter: (v: number) => string) => {
        const vals = withBehavioral.map((a: any) => (a.behavioral ?? a.behavioral_metrics)?.[key]).filter((v: any) => typeof v === 'number');
        if (vals.length === 0) return null;
        const sum = vals.reduce((s: number, v: number) => s + v, 0);
        return formatter(sum / vals.length);
      };
      const avgNum = (key: string): number | null => {
        const vals = withBehavioral.map((a: any) => (a.behavioral ?? a.behavioral_metrics)?.[key]).filter((v: any) => typeof v === 'number');
        if (vals.length === 0) return null;
        return vals.reduce((s: number, v: number) => s + v, 0) / vals.length;
      };
      const idealRanges: { key: string; name: string; getCandidate: () => string | null; getNum: () => number | null; ideal: string }[] = [
        { key: 'overall_speech_quality', name: 'Overall Speech Quality', getCandidate: () => avg('overall_speech_quality', (v) => `${Math.round(v)}`), getNum: () => avgNum('overall_speech_quality'), ideal: '85-100' },
        { key: 'speaking_pace_wpm', name: 'Speaking Pace (WPM)', getCandidate: () => avg('speaking_pace_wpm', (v) => `${Math.round(v)} WPM`), getNum: () => avgNum('speaking_pace_wpm'), ideal: '120-160 WPM' },
        { key: 'filler_words', name: 'Filler Words', getCandidate: () => avg('filler_words', (v) => `${Math.round(v)}`), getNum: () => avgNum('filler_words'), ideal: '< 3-5 total' },
        { key: 'filler_density', name: 'Filler Density', getCandidate: () => avg('filler_density', (v) => `${Math.round(v)}%`), getNum: () => avgNum('filler_density'), ideal: '< 2-5%' },
        { key: 'pause_quality_score', name: 'Pause & Pacing', getCandidate: () => avg('pause_quality_score', (v) => `${Math.round(v)}`), getNum: () => avgNum('pause_quality_score'), ideal: '80-100' },
        { key: 'voice_confidence', name: 'Voice Confidence', getCandidate: () => avg('voice_confidence', (v) => `${Math.round(v)}`), getNum: () => avgNum('voice_confidence'), ideal: '80-100' },
        { key: 'stress_score', name: 'Stress Level', getCandidate: () => avg('stress_score', (v) => `${Math.round(v)}`), getNum: () => avgNum('stress_score'), ideal: '0-30' },
      ];
      const overallMetricsRows = idealRanges
        .map((r) => {
          const candidate = r.getCandidate();
          const numVal = r.getNum();
          if (candidate == null) return null;
          const rating = numVal != null ? getSpeechMetricRating(r.key, numVal) : 'Average';
          return { name: r.name, candidate, ideal: r.ideal, rating };
        })
        .filter((r): r is { name: string; candidate: string; ideal: string; rating: SpeechMetricRating } => r != null);

      const excelRatingFill = (rating: SpeechMetricRating) => {
        const argb = rating === 'Good' ? 'FFDCFCE7' : rating === 'Average' ? 'FFFEF3C7' : 'FFFEE2E2';
        return { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } };
      };
      speechSheet.getCell(speechRow, 1).value = 'Speech Analysis — Overall Metrics Summary';
      speechSheet.getCell(speechRow, 1).font = { bold: true, size: 12 };
      speechSheet.mergeCells(speechRow, 1, speechRow, 4);
      speechRow += 2;
      speechSheet.addRow(['Metric name', 'Candidate score', 'Rating', 'Ideal range']);
      speechSheet.getRow(speechSheet.rowCount).eachCell((cell) => {
        cell.fill = blueFill;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', wrapText: true };
      });
      overallMetricsRows.forEach((r) => {
        speechSheet.addRow([r.name, r.candidate, r.rating, r.ideal]);
        const rn = speechSheet.rowCount;
        speechSheet.getRow(rn).eachCell((cell, colNumber) => {
          cell.border = thinBorder;
          cell.font = { size: 10 };
          cell.alignment = { vertical: 'middle', wrapText: true };
          if (colNumber === 2 || colNumber === 3) cell.fill = excelRatingFill(r.rating);
        });
      });
      speechRow = speechSheet.rowCount + 2;

      // --- Section 2: Per-Question Speech Metrics ---
      speechSheet.getCell(speechRow, 1).value = 'Per-Question Speech Metrics';
      speechSheet.getCell(speechRow, 1).font = { bold: true, size: 12 };
      speechRow += 2;
      const perQHeaders = ['Q NO', 'PARAMETER', 'Overall speech quality', 'Speaking pace (WPM)', 'Speech ratio %', 'Word count', 'Filler words', 'Filler density %', 'Filler rate/min', 'Articulation score', 'Pause & pacing', 'Voice confidence', 'Voice modulation', 'Stress level', 'Calmness'];
      speechSheet.addRow(perQHeaders);
      speechSheet.getRow(speechSheet.rowCount).eachCell((cell) => {
        cell.fill = blueFill;
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        cell.border = thinBorder;
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      if (reportData.questions && reportData.answers) {
        const sortedQuestions = [...reportData.questions].sort((a, b) => (a.question_order || 0) - (b.question_order || 0));
        sortedQuestions.forEach((question) => {
          const questionOrder = question.question_order || 0;
          const answer = reportData.answers.find((a: any) => (a.question_order || 0) === questionOrder);
          const parameter = question.parameter_name || question.parameter_key || 'N/A';
          const b = answer?.behavioral ?? answer?.behavioral_metrics;
          const fmt = (v: number | null | undefined, suffix = '') => (v != null ? `${v}${suffix}` : '-');
          speechSheet.addRow([
            questionOrder + 1,
            parameter,
            b ? fmt(b.overall_speech_quality, '/100') : '-',
            b ? fmt(b.speaking_pace_wpm, ' WPM') : '-',
            b && b.speech_ratio != null ? fmt(b.speech_ratio) : '-',
            b ? fmt(b.word_count) : '-',
            b ? fmt(b.filler_words) : '-',
            b && b.filler_density != null ? fmt(b.filler_density) : '-',
            b && b.filler_rate_per_minute != null ? fmt(b.filler_rate_per_minute) : '-',
            b && b.articulation_score != null ? fmt(b.articulation_score, '/100') : '-',
            b && b.pause_quality_score != null ? fmt(b.pause_quality_score, '/100') : '-',
            b && b.voice_confidence != null ? fmt(b.voice_confidence, '/100') : '-',
            b && b.voice_modulation != null ? fmt(b.voice_modulation, '/100') : '-',
            b && b.stress_score != null ? fmt(b.stress_score, '/100') : '-',
            b && b.calmness_score != null ? fmt(b.calmness_score, '/100') : '-',
          ]);
          const rn = speechSheet.rowCount;
          speechSheet.getRow(rn).eachCell((cell, colNumber) => {
            cell.border = thinBorder;
            cell.font = { size: 10 };
            cell.alignment = { vertical: 'middle', horizontal: colNumber <= 2 ? 'left' : 'center', wrapText: true };
            if (rn % 2 === 0) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };
          });
        });
      }
      speechRow = speechSheet.rowCount + 2;

      // --- Section 3 & 4: Detailed Feedback + Action Plan (candidate report only; recruiter report ends at speech scores) ---
      if (reportVariant !== 'recruiter') {
      const speechReport = reportData?.interview?.speech_detailed_report;
      speechSheet.getCell(speechRow, 1).value = 'Detailed Feedback on Candidate Speech Abilities';
      speechSheet.getCell(speechRow, 1).font = { bold: true, size: 12 };
      speechRow += 2;
      if (speechReport && String(speechReport).trim()) {
        const reportText = stripSpeechReportTitleLine(String(speechReport).trim()).replace(/''/g, "'");
        const reportSections = parseSpeechReportSections(reportText);
        const tableSections = reportSections.filter(
          (s) => !/^What the Data Tells You$/i.test((s.section || '').trim())
        );
        if (tableSections.length >= 2) {
          speechSheet.addRow(tableSections.map((s) => s.section));
          speechSheet.getRow(speechSheet.rowCount).eachCell((cell) => {
            cell.fill = blueFill;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
            cell.border = thinBorder;
            cell.alignment = { vertical: 'middle', wrapText: true };
          });
          speechSheet.addRow(tableSections.map((s) => s.content || '—'));
          speechSheet.getRow(speechSheet.rowCount).eachCell((cell) => {
            cell.border = thinBorder;
            cell.font = { size: 10 };
            cell.alignment = { vertical: 'top', wrapText: true };
          });
          speechRow = speechSheet.rowCount + 1;
        } else {
          speechSheet.getCell(speechRow, 1).value = reportText;
          speechSheet.getCell(speechRow, 1).alignment = { vertical: 'top', wrapText: true };
          speechSheet.getCell(speechRow, 1).font = { size: 10 };
          speechSheet.mergeCells(speechRow, 1, speechRow, 5);
          speechSheet.getRow(speechRow).height = Math.min(400, Math.max(80, (reportText.match(/\n/g)?.length || 0) * 14 + 40));
          speechRow += 1;
        }
      } else {
        speechSheet.getCell(speechRow, 1).value = 'No detailed feedback available.';
        speechRow += 1;
      }
      speechRow += 2;

      const actionPlan = reportData?.interview?.personalised_action_plan;
      speechSheet.getCell(speechRow, 1).value = 'Your Personalised Action Plan';
      speechSheet.getCell(speechRow, 1).font = { bold: true, size: 12 };
      speechRow += 2;
      const planItems = actionPlan && String(actionPlan).trim() ? parseActionPlanItems(String(actionPlan).trim()) : [];
      if (planItems.length > 0) {
        speechSheet.addRow(['Action Name', 'Addresses', 'Description', 'Expected outcome']);
        speechSheet.getRow(speechSheet.rowCount).eachCell((cell) => {
          cell.fill = blueFill;
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          cell.border = thinBorder;
          cell.alignment = { vertical: 'middle', wrapText: true };
        });
        planItems.forEach((item) => {
          speechSheet.addRow([
            item.actionName || '—',
            item.addresses || '—',
            item.description || '—',
            item.expectedOutcome || '—',
          ]);
          speechSheet.getRow(speechSheet.rowCount).eachCell((cell) => {
            cell.border = thinBorder;
            cell.font = { size: 10 };
            cell.alignment = { vertical: 'middle', wrapText: true };
          });
        });
      } else if (actionPlan && String(actionPlan).trim()) {
        speechSheet.getCell(speechRow, 1).value = String(actionPlan).trim().replace(/''/g, "'");
        speechSheet.getCell(speechRow, 1).alignment = { vertical: 'top', wrapText: true };
        speechSheet.mergeCells(speechRow, 1, speechRow, 4);
      } else {
        speechSheet.getCell(speechRow, 1).value = 'No personalised action plan available.';
      }
      }

      // Column widths for Speech sheet (cols 1–5 for summary/feedback/plan; 1–15 for per-question table)
      const colWidths = [22, 28, 45, 18, 40, 18, 18, 14, 12, 14, 14, 16, 14, 16, 14];
      colWidths.forEach((w, i) => {
        const col = i + 1;
        if (speechSheet.getColumn(col)) speechSheet.getColumn(col).width = w;
      });
      speechSheet.views = [{ state: 'frozen', ySplit: 1 }];

      // Freeze header rows for all sheets
      overviewSheet.views = [{ state: 'frozen', ySplit: 1 }];
      if (workbook.getWorksheet('Questions & Answers')) {
        workbook.getWorksheet('Questions & Answers').views = [{ 
          state: 'frozen', 
          ySplit: 1,
          zoomScale: 73 // Set zoom to 73%
        }];
      }
      
      // Generate filename
      const currentDate = new Date().toISOString().split('T')[0];
      const candidateName = (reportData.interview?.candidate_name || 'Candidate').replace(/[^a-zA-Z0-9]/g, '_');
      const filename = `Interview_Report_${candidateName}_${currentDate}.xlsx`;
      
      // Generate and download file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Professional Excel report downloaded successfully!', { id: 'excel-download-success' });
    } catch (error) {
      console.error('Error downloading Excel:', error);
      toast.error('Failed to download Excel. Please try again.', { id: 'excel-download-error' });
    }
  };

  const shareReport = () => {
    const url = window.location.href;
    if (navigator.share) {
      navigator.share({
        title: `Final Results - ${reportData?.interview?.candidate_name || 'Interview'}`,
        text: `View the final assessment results for ${reportData?.interview?.candidate_name || 'Interview'}`,
        url: url
      });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Report URL copied to clipboard', { id: 'url-copied' });
    }
  };

  const isCandidateReport = reportVariant === 'candidate';
  const getScoreColor = (score) => isCandidateReport ? 'text-sky-600' : 'text-[#1e5da8]';

  const getScoreLabel = (score) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Needs Improvement';
  };

  const getScoreClass = (score) => isCandidateReport ? 'bg-sky-600' : 'bg-[#1e5da8]';
  const accentHex = isCandidateReport ? '#0284c7' : '#1e5da8'; // sky-600 vs blue
  const headerBg = isCandidateReport ? 'bg-sky-700 border-sky-800' : 'bg-[#1e5da8] border-[#1e5da8]/80';
  const btnPrimary = isCandidateReport ? 'bg-sky-600 hover:bg-sky-700' : 'bg-[#1e5da8] hover:bg-[#1e5da8]/90';
  const btnOutline = isCandidateReport ? 'bg-white text-sky-600 hover:bg-gray-50' : 'bg-white text-[#1e5da8] hover:bg-gray-50';
  const loadingBorder = isCandidateReport ? 'border-sky-600' : 'border-[#1e5da8]';
  const paramSelected = isCandidateReport ? 'bg-sky-50 text-sky-900 border-2 border-sky-200' : 'bg-blue-50 text-blue-900 border-2 border-blue-200';
  const paramBadge = isCandidateReport ? 'bg-sky-100 text-sky-600 border border-sky-200' : 'bg-sky-100 text-[#1e5da8] border border-sky-200';
  const paramBadgeSelected = isCandidateReport ? 'bg-sky-200/50 text-sky-700' : 'bg-[#1e5da8]/20 text-[#1e5da8]';
  const cardHover = isCandidateReport ? 'hover:border-sky-500/50' : 'hover:border-[#1e5da8]/50';
  const expandBtn = isCandidateReport ? 'text-sky-600' : 'text-[#1e5da8]';
  const tableHeaderBg = isCandidateReport ? 'bg-sky-700' : 'bg-[#1e5da8]';
  const iconBg = isCandidateReport ? 'bg-sky-600' : 'bg-[#1e5da8]';
  const barSelected = isCandidateReport ? 'bg-sky-600' : 'bg-[#1e5da8]';
  const accentText = isCandidateReport ? 'text-sky-600' : 'text-[#1e5da8]';

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">
        {/* Light bar with logo - commented to avoid flash when navigating to Results */}
        {/* <header className="flex-shrink-0 bg-sky-100 border-b border-sky-200">
          <div className="w-full pl-0 pr-2 sm:pr-6 py-2 sm:py-3 lg:py-4">
            <img
              src="/Logo_Transparent_BG.png"
              alt="ProValuate"
              className="h-8 sm:h-10 lg:h-12 w-auto object-contain"
            />
          </div>
        </header> */}
        <div className="flex-1 flex items-center justify-center p-3 sm:p-6">
          <div className="text-center">
            <div className={`animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 ${loadingBorder} mx-auto mb-3 sm:mb-4`} />
            <p className="text-sm sm:text-lg text-gray-600">Loading final results...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">
        {/* Light bar with logo - commented to avoid flash when navigating to Results */}
        {/* <header className="flex-shrink-0 bg-sky-100 border-b border-sky-200">
          <div className="w-full pl-0 pr-2 sm:pr-6 py-2 sm:py-3 lg:py-4">
            <img
              src="/Logo_Transparent_BG.png"
              alt="ProValuate"
              className="h-8 sm:h-10 lg:h-12 w-auto object-contain"
            />
          </div>
        </header> */}
        <div className="flex-1 flex items-center justify-center px-3 sm:px-6 py-4 sm:py-6">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 max-w-md w-full text-center mx-2 sm:mx-0">
            <XCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-3 sm:mb-4 flex-shrink-0" />
            <h2 className="text-lg sm:text-2xl font-bold text-gray-800 mb-2 break-words">Results Not Found</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 break-words">The interview results could not be loaded.</p>
            <button
              onClick={() => navigate(reportVariant === 'recruiter' ? '/dashboard?section=interview-dashboard' : '/candidate-dashboard/interviews')}
              className={`min-h-[44px] px-4 sm:px-6 py-3 rounded-lg ${btnPrimary} text-white text-sm sm:text-base font-medium transition-colors touch-manipulation w-full sm:w-auto`}
            >
              {reportVariant === 'recruiter' ? 'Go to Dashboard' : 'Go to My Interviews'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const { interview, parameters } = reportData;
  
  // Normalize parameter count for both array and object structures
  const parameterCount = Array.isArray(parameters)
    ? parameters.length
    : parameters
      ? Object.keys(parameters).length
      : 0;

  // PDF Generation Function
  const generatePDFReport = async () => {
    if (isGeneratingPDF) return; // Prevent multiple clicks
    
    setIsGeneratingPDF(true);
    try {
      // Import jsPDF dynamically
      const { jsPDF } = await import('jspdf');
      const { autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF();
      
      // Add logo (same as login page: Logo_Transparent_BG.png, height ~48px = 12.7mm)
      let logoAdded = false;
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          logoImg.onload = () => {
            try {
              const heightMm = 12.7;
              const aspect = logoImg.naturalWidth / logoImg.naturalHeight;
              const widthMm = heightMm * aspect;
              doc.addImage(logoImg, 'PNG', 5, 5, widthMm, heightMm);
              logoAdded = true;
            } catch (error) {
              console.log('Error adding logo to PDF:', error);
            }
            resolve();
          };
          logoImg.onerror = () => {
            console.log('Logo image failed to load');
            resolve();
          };
          logoImg.src = '/Logo_Transparent_BG.png';
        });
      } catch (error) {
        console.log('Logo not found, continuing without logo');
      }

      const pageWidth = doc.internal.pageSize.getWidth();
      const blueRgb: [number, number, number] = [30, 93, 168]; // #1e5da8
      const tableBorder = { lineColor: [0, 0, 0] as [number, number, number], lineWidth: 0.15 };

      // Main header title – more space below logo, centered, blue
      doc.setTextColor(...blueRgb);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text('INTERVIEW ANALYSIS REPORT', pageWidth / 2, 40, { align: 'center' });

      // Two lines below header – bold and italic, no space between
      doc.setFont('helvetica', 'bolditalic');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      doc.text('Parameter-Based Interview Analytics', pageWidth / 2, 48, { align: 'center' });
      doc.text('Combining AI Evaluation with Advanced Insights', pageWidth / 2, 52, { align: 'center' });
      doc.setFont('helvetica', 'normal');

      // Resolve candidate photo URL (server → localStorage → sessionStorage)
      let candidatePhotoDataUrl: string | null = null;
      const storageKey = `candidate_photo_${interviewId}`;
      try {
        const photoUrl = buildApiUrl(`${API_CONFIG.ENDPOINTS.GET_CANDIDATE_PHOTO}/${interviewId}`);
        const photoResponse = await fetch(photoUrl, { method: 'GET', headers: { 'Content-Type': 'application/json' } });
        if (photoResponse.ok) {
          const photoData = await photoResponse.json();
          if (photoData.photo && photoData.photo.startsWith('data:image/')) candidatePhotoDataUrl = photoData.photo;
        }
      } catch (_) {}
      if (!candidatePhotoDataUrl) {
        try {
          const local = localStorage.getItem(storageKey);
          const ts = localStorage.getItem(`${storageKey}_timestamp`);
          if (local && (!ts || Date.now() - parseInt(ts) < 7 * 24 * 60 * 60 * 1000)) candidatePhotoDataUrl = local;
        } catch (_) {}
      }
      if (!candidatePhotoDataUrl) {
        try {
          const s = sessionStorage.getItem(storageKey);
          if (s) candidatePhotoDataUrl = s;
        } catch (_) {}
      }
      const isValidPhoto = (s: string | null) => !!s && s.startsWith('data:image/') && s.length >= 100;
      const photoSrc = (candidatePhotoDataUrl && isValidPhoto(candidatePhotoDataUrl)) ? candidatePhotoDataUrl : '/assets/NAME.jpg';

      // Draw candidate photo centered below subtitle (larger size)
      const photoY = 58;
      const photoSize = 52;
      const photoX = (pageWidth - photoSize) / 2;
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const t = setTimeout(() => resolve(), 5000);
        img.onload = () => {
          clearTimeout(t);
          try {
            const imgFmt = photoSrc.startsWith('data:image/png') ? 'PNG' : 'JPEG';
            doc.addImage(img, imgFmt, photoX, photoY, photoSize, photoSize);
          } catch (_) {}
          resolve();
        };
        img.onerror = () => resolve();
        img.src = photoSrc;
      });

      // Candidate details table (below photo) – centered, more spacing
      const candidateTableStartY = photoY + photoSize + 18;
      const candidateRows: [string, string][] = [
        ['Candidate', interview.candidate_name || 'N/A'],
        ['Email', interview.candidate_email || 'N/A'],
        ['Position', interview.position || 'N/A'],
        ['Overall Score', `${formatOverallScore(interview.overall_score)}/10`],
        ['Interview Date', formatOrdinalDate(interview.created_at)],
      ];
      if (interview.status === 'terminated' && interview.termination_reason) {
        candidateRows.push(['Termination Reason', interview.termination_reason]);
      }
      const fieldColWidth = 42;
      const valueColWidth = 78;
      const tableTotalWidth = fieldColWidth + valueColWidth;
      const tableMargin = (pageWidth - tableTotalWidth) / 2;
      autoTable(doc, {
        head: [['Field', 'Value']],
        body: candidateRows,
        startY: candidateTableStartY,
        tableWidth: tableTotalWidth,
        styles: { fontSize: 9, cellPadding: 3, ...tableBorder },
        headStyles: { fillColor: blueRgb, textColor: 255, fontStyle: 'bold', fontSize: 9, ...tableBorder },
        columnStyles: { 0: { cellWidth: fieldColWidth }, 1: { cellWidth: valueColWidth } },
        margin: { left: tableMargin, right: tableMargin }
      });
      const leftMargin = 15;
      let execSummaryY = (doc as any).lastAutoTable?.finalY ?? candidateTableStartY + 20;
      execSummaryY += 18;

      // Executive Summary – title centered, all caps, bold; one paragraph left aligned
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(...blueRgb);
      doc.text('EXECUTIVE SUMMARY', pageWidth / 2, execSummaryY, { align: 'center' });
      execSummaryY += 10;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const execCandidateName = interview.candidate_name || 'the candidate';
      const execRole = interview.position || 'the applied role';
      const summaryParagraph = `This report is an overview of ${execCandidateName}, who has completed the interview for the role of ${execRole}. The following pages provide insight into the candidate's answers for various questions across parameters. This is followed by a Detailed Speech Analysis section, which presents a detailed plan and personalised feedback on the candidate's speech and delivery.`;
      const maxLineWidth = pageWidth - leftMargin * 2;
      const summarySegments = doc.splitTextToSize(summaryParagraph, maxLineWidth);
      summarySegments.forEach((seg: string) => {
        doc.text(seg, leftMargin, execSummaryY);
        execSummaryY += 6;
      });

      // Prepare question data first (needed for total page count)
      const questionRows: { question: any; answer: any; parameter: string; feedback: string }[] = [];
      console.log('🔍 PDF Generation Debug - Enhanced Version:');
      console.log('🔍 Parameters object:', parameters);
      console.log('🔍 Parameters keys:', Object.keys(parameters || {}));
      console.log('🔍 Interview data:', interview);
      console.log('🔍 Parameter scores:', interview.parameter_scores);
      console.log('🔍 Report data answers:', reportData.answers?.length);
      console.log('🔍 Report data questions:', reportData.questions?.length);
      
      // Debug feedback availability in different data structures
      if (reportData.answers && reportData.answers.length > 0) {
        console.log('🔍 Sample feedback from answers array:');
        reportData.answers.forEach((answer, index) => {
          console.log(`  Answer ${index}: feedback="${answer.feedback?.substring(0, 100) || 'No feedback'}..."`);
        });
      }
      
      if (interview.parameter_scores) {
        const parameterScores = typeof interview.parameter_scores === 'string' 
          ? JSON.parse(interview.parameter_scores) 
          : interview.parameter_scores;
        console.log('🔍 Parameter scores structure:');
        Object.entries(parameterScores).forEach(([paramKey, paramData]: [string, any]) => {
          console.log(`  ${paramKey}: ${paramData.individual_question_scores?.length || 0} individual scores`);
          if (paramData.individual_question_scores) {
            paramData.individual_question_scores.forEach((qs: any, idx: number) => {
              console.log(`    Q${idx}: feedback="${qs.feedback?.substring(0, 100) || 'No feedback'}..."`);
            });
          }
        });
      }
      
      // Use the same logic as Excel export to avoid duplicates
      if (reportData.questions && reportData.answers && reportData.questions.length > 0) {
        console.log('🔍 Using questions and answers arrays for PDF (primary path - same as Excel)');
        
        // Sort questions by question_order to ensure proper ordering (same as Excel)
        const sortedQuestions = [...reportData.questions].sort((a, b) => (a.question_order || 0) - (b.question_order || 0));
        
        sortedQuestions.forEach((question: any) => {
          const questionOrder = question.question_order || 0;
          const answer = reportData.answers.find((ans: any) => (ans.question_order || 0) === questionOrder);
          
          const questionText = question.question_text || question.question || 'N/A';
          const parameter = question.parameter_name || question.parameter_key || 'N/A';
          
          // Include all questions (including terminated/partial interviews with 1+ answers)
          if (questionText && questionText !== 'N/A') {
            if (answer) {
              // Enhanced feedback extraction with multiple fallbacks
              const getFeedback = (question: any, answer: any) => {
                // Try multiple possible locations for feedback
                let feedback = null;
                
                // Method 1: Direct feedback from answer
                if (answer.feedback) {
                  feedback = answer.feedback;
                }
                
                // Method 2: Feedback from parameter scores data
                if (!feedback && interview.parameter_scores) {
                  const parameterScores = typeof interview.parameter_scores === 'string' 
                    ? JSON.parse(interview.parameter_scores) 
                    : interview.parameter_scores;
                  
                  const paramKey = question.parameter_key || question.parameter_name;
                  if (paramKey && parameterScores[paramKey]) {
                    const paramScoreData = parameterScores[paramKey];
                    if (paramScoreData.individual_question_scores) {
                      const questionScore = paramScoreData.individual_question_scores.find((qs: any) => 
                        qs.question_text === question.question_text ||
                        qs.question_order === question.question_order
                      );
                      if (questionScore && questionScore.feedback) {
                        feedback = questionScore.feedback;
                      }
                    }
                  }
                }
                
                // Method 3: Construct meaningful feedback if nothing found
                if (!feedback) {
                  const score = answer.score || 'N/A';
                  const paramName = question.parameter_name || question.parameter_key || 'General';
                  feedback = `Assessment for ${paramName}: Performance evaluated with score ${score}/10. ${score >= 7 ? 'Good performance demonstrated.' : score >= 5 ? 'Satisfactory performance with room for improvement.' : 'Performance needs significant improvement.'}`;
                }
                
                return feedback;
              };
              
              const formatFeedback = (feedback: string) => {
                if (!feedback || feedback === 'No feedback available') return 'No feedback available';
                
                // Clean up the feedback text but preserve the complete content
                let cleanedFeedback = feedback.trim();
                
                // Only remove obvious formatting issues, don't filter content
                cleanedFeedback = cleanedFeedback.replace(/^•\s*/gm, '').replace(/^\d+\.\s*/gm, '');
                
                // If the feedback already contains bullet points, keep them structured
                if (cleanedFeedback.includes('•') || cleanedFeedback.match(/^\d+\./gm)) {
                  return cleanedFeedback;
                }
                
                // For regular paragraph-style feedback, just return it as-is with proper spacing
                // Don't split into bullets - preserve the original detailed feedback
                return cleanedFeedback;
              };
              
              const feedback = getFeedback(question, answer);
              const formattedFeedback = formatFeedback(feedback);
              questionRows.push({
                question: { ...question, questionText },
                answer,
                parameter,
                feedback: formattedFeedback
              });
            } else {
              questionRows.push({
                question: { ...question, questionText },
                answer: null,
                parameter,
                feedback: 'No feedback available'
              });
            }
          }
        });
      } else if (reportData.parameters && reportData.parameters.length > 0) {
        // Fallback for terminated interviews: build question rows from parameters.questions
        console.log('🔍 Using parameters.questions for PDF (terminated/partial interview fallback)');
        let globalIdx = 0;
        const answersList = reportData.answers || [];
        reportData.parameters.forEach((param: any) => {
          const paramQuestions = param.questions || [];
          paramQuestions.forEach((qData: any, qIdx: number) => {
            const questionText = qData.text || qData.question_text || `Question ${globalIdx + 1}`;
            const parameter = param.name || param.parameter_name || param.key || 'General';
            const matchedAnswer = answersList.find((a: any) =>
              (a.parameter_key === param.key || a.parameter_name === param.name) &&
              ((a.question_order || 0) === globalIdx || (a.question_order || 0) === qIdx)
            ) || answersList.find((a: any) => (a.question_order || 0) === globalIdx);
            const answer = matchedAnswer || {
              transcript: qData.answer || qData.transcript || '',
              score: param.score ?? qData.score ?? 'N/A',
              feedback: param.reason || 'Partial assessment',
              written_answer: qData.written_answer,
              behavioral: null,
              question_order: globalIdx
            };
            questionRows.push({
              question: { question_order: globalIdx, question_text: questionText, questionText, parameter_key: param.key, parameter_name: parameter },
              answer,
              parameter,
              feedback: answer.feedback || 'No feedback available'
            });
            globalIdx++;
          });
        });
      }

      const questionPageCount = questionRows.length; // One page per question (speech analysis moved to overall table)
      const totalPageCount = 3 + questionPageCount; // 1=cover, 2=score summary, then 1 per question, then optional speech/feedback/plan, disclaimer

      type ParamMetrics = {
        overall_quality: number[]; wpm: number[]; filler: number[]; pause_quality: number[];
        voice_confidence: number[]; stress: number[];
      };
      const paramBehavioralMap: Record<string, ParamMetrics> = {};
      const initParam = (): ParamMetrics => ({
        overall_quality: [], wpm: [], filler: [], pause_quality: [],
        voice_confidence: [], stress: []
      });
      questionRows.forEach((row: any) => {
        const p = row.parameter;
        if (!paramBehavioralMap[p]) paramBehavioralMap[p] = initParam();
        const b = row.answer?.behavioral || row.answer?.behavioral_metrics;
        if (b) {
          if (typeof b.overall_speech_quality === 'number') paramBehavioralMap[p].overall_quality.push(b.overall_speech_quality);
          if (typeof b.speaking_pace_wpm === 'number') paramBehavioralMap[p].wpm.push(b.speaking_pace_wpm);
          if (typeof b.filler_words === 'number') paramBehavioralMap[p].filler.push(b.filler_words);
          if (typeof b.pause_quality_score === 'number') paramBehavioralMap[p].pause_quality.push(b.pause_quality_score);
          if (typeof b.voice_confidence === 'number') paramBehavioralMap[p].voice_confidence.push(b.voice_confidence);
          if (typeof b.stress_score === 'number') paramBehavioralMap[p].stress.push(b.stress_score);
        }
      });

      const hasBehavioralData = Object.keys(paramBehavioralMap).some(p => {
        const d = paramBehavioralMap[p];
        return d.overall_quality.length > 0 || d.wpm.length > 0 || d.filler.length > 0 ||
          d.pause_quality.length > 0 || d.voice_confidence.length > 0 || d.stress.length > 0;
      });

      // Page 1: no footer drawn here (final pass draws all footers once)

      // Pages 2+: One question per page with table (Score Summary by Parameter removed)
      const totalQuestions = questionRows.length;
      const qFooterY = doc.internal.pageSize.height - 8;
      let currentPageNum = 2;
      questionRows.forEach((row, idx) => {
        doc.addPage();
        const qNum = idx + 1;
        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.text(`Parameter: ${row.parameter}`, 15, 20);
        doc.text(`Question ${qNum} of ${totalQuestions}`, 150, 20);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);

        const transcript = row.answer ? (row.answer.transcript || row.answer.answer || 'No transcript available') : 'No answer recorded';
        const writtenAnswerRaw = row.answer?.written_answer?.trim();
        const requiresWritten = row.question?.requires_written_answer === true;
        const hasWrittenAnswer = !!writtenAnswerRaw;
        const writtenTableLabel = hasWrittenAnswer
          ? 'See written answer below'
          : requiresWritten
            ? 'No written answer'
            : 'This was not a written question';
        const score = row.answer != null ? (row.answer.score ?? 'N/A') : 'N/A';

        const mainData: [string, string][] = [
          ['Question', row.question.questionText || 'N/A'],
          ['Answer', transcript],
          ['Written', writtenTableLabel],
          ['AI Feedback', row.feedback || 'No feedback available'],
          ['AI Score', String(score)],
        ];

        autoTable(doc, {
          head: [['Metric', 'Value']],
          body: mainData,
          startY: 28,
          styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', ...tableBorder },
          headStyles: { fillColor: [68, 114, 196], textColor: 255, fontStyle: 'bold', fontSize: 9, ...tableBorder },
          columnStyles: { 0: { cellWidth: 40 }, 1: { cellWidth: 140 } },
          margin: { left: 15, right: 15, bottom: 24 }
        });

        const tableEndY = (doc as any).lastAutoTable?.finalY || 50;
        let yPos = tableEndY + 10;

        // Written answer block: line-by-line, monospace, preserves code/SQL formatting
        if (hasWrittenAnswer && writtenAnswerRaw) {
          const pageHeight = doc.internal.pageSize.height;
          const bottomMargin = 28; // Reserve space so content never overlaps footer
          const leftMargin = 15;
          const maxWidth = pageWidth - leftMargin * 2;
          const lineHeight = 4.5;
          const writtenLabelY = yPos;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.setTextColor(30, 93, 168);
          doc.text('Written answer', leftMargin, writtenLabelY);
          yPos += 7;
          doc.setFont('courier', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(0, 0, 0);
          const lines = writtenAnswerRaw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const segments = doc.splitTextToSize(line, maxWidth);
            for (let s = 0; s < segments.length; s++) {
              if (yPos > pageHeight - bottomMargin) {
                doc.addPage();
                currentPageNum++;
                yPos = 20;
                doc.setFont('courier', 'normal');
                doc.setFontSize(8);
                doc.text('(written answer continued)', leftMargin, yPos);
                yPos += lineHeight;
              }
              doc.text(segments[s], leftMargin, yPos);
              yPos += lineHeight;
            }
          }
          yPos += 8;
        }

        // Next question starts on a fresh page only when there is a next question (avoids blank page after last question)
        if (hasWrittenAnswer && writtenAnswerRaw && idx < totalQuestions - 1) {
          doc.addPage();
          currentPageNum++;
        }
        currentPageNum++;
      });

      // Page after all questions: Speech Analysis — Overall Metrics Summary (Metric | Candidate score | Rating | Ideal range)
      if (hasBehavioralData) {
        const withBehavioral = (reportData?.answers ?? []).filter((a: any) => {
          const b = a.behavioral ?? a.behavioral_metrics;
          return b && (typeof b.overall_speech_quality === 'number' || typeof b.speaking_pace_wpm === 'number' || typeof b.pause_quality_score === 'number');
        });
        const avg = (key: string, formatter: (v: number) => string) => {
          const vals = withBehavioral.map((a: any) => (a.behavioral ?? a.behavioral_metrics)?.[key]).filter((v: any) => typeof v === 'number');
          if (vals.length === 0) return null;
          const sum = vals.reduce((s: number, v: number) => s + v, 0);
          return formatter(sum / vals.length);
        };
        const avgNum = (key: string): number | null => {
          const vals = withBehavioral.map((a: any) => (a.behavioral ?? a.behavioral_metrics)?.[key]).filter((v: any) => typeof v === 'number');
          if (vals.length === 0) return null;
          return vals.reduce((s: number, v: number) => s + v, 0) / vals.length;
        };
        const idealRanges: { key: string; name: string; getCandidate: () => string | null; getNum: () => number | null; ideal: string }[] = [
          { key: 'overall_speech_quality', name: 'Overall Speech Quality', getCandidate: () => avg('overall_speech_quality', (v) => `${Math.round(v)}`), getNum: () => avgNum('overall_speech_quality'), ideal: '85-100' },
          { key: 'speaking_pace_wpm', name: 'Speaking Pace (WPM)', getCandidate: () => avg('speaking_pace_wpm', (v) => `${Math.round(v)} WPM`), getNum: () => avgNum('speaking_pace_wpm'), ideal: '120-160 WPM' },
          { key: 'filler_words', name: 'Filler Words', getCandidate: () => avg('filler_words', (v) => `${Math.round(v)}`), getNum: () => avgNum('filler_words'), ideal: '< 3-5 total' },
          { key: 'filler_density', name: 'Filler Density', getCandidate: () => avg('filler_density', (v) => `${Math.round(v)}%`), getNum: () => avgNum('filler_density'), ideal: '< 2-5%' },
          { key: 'pause_quality_score', name: 'Pause & Pacing', getCandidate: () => avg('pause_quality_score', (v) => `${Math.round(v)}`), getNum: () => avgNum('pause_quality_score'), ideal: '80-100' },
          { key: 'voice_confidence', name: 'Voice Confidence', getCandidate: () => avg('voice_confidence', (v) => `${Math.round(v)}`), getNum: () => avgNum('voice_confidence'), ideal: '80-100' },
          { key: 'stress_score', name: 'Stress Level', getCandidate: () => avg('stress_score', (v) => `${Math.round(v)}`), getNum: () => avgNum('stress_score'), ideal: '0-30' },
        ];
        const overallMetricsRows = idealRanges
          .map((r) => {
            const candidate = r.getCandidate();
            const numVal = r.getNum();
            if (candidate == null) return null;
            const rating = numVal != null ? getSpeechMetricRating(r.key, numVal) : 'Average';
            return { name: r.name, candidate, ideal: r.ideal, rating };
          })
          .filter((r): r is { name: string; candidate: string; ideal: string; rating: SpeechMetricRating } => r != null);
        if (overallMetricsRows.length > 0) {
          const speechMargin = 8;
          const speechContentWidth = pageWidth - speechMargin * 2;
          doc.addPage();
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.text('Speech Analysis — Overall Metrics Summary', speechMargin, 20);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(60, 60, 60);
          doc.text('The table below shows the candidate\'s overall average for each speech metric across the entire interview, compared against professionally accepted benchmark ranges.', speechMargin, 28, { maxWidth: speechContentWidth });
          doc.setTextColor(0, 0, 0);
          const overallTableBody = overallMetricsRows.map((r) => {
            const style = SPEECH_RATING_STYLES[r.rating];
            return [
              r.name,
              { content: r.candidate, styles: { fillColor: style.rgb, textColor: style.textRgb } },
              { content: r.rating, styles: { fillColor: style.rgb, textColor: style.textRgb } },
              r.ideal,
            ];
          });
          const summaryCol0 = speechContentWidth * 0.28;
          const summaryCol1 = speechContentWidth * 0.24;
          const summaryCol2 = speechContentWidth * 0.24;
          const summaryCol3 = speechContentWidth * 0.24;
          autoTable(doc, {
            head: [['Metric name', 'Candidate score', 'Rating', 'Ideal range']],
            body: overallTableBody,
            startY: 38,
            styles: { fontSize: 9, cellPadding: 3, ...tableBorder },
            headStyles: { fillColor: [30, 93, 168], textColor: 255, fontStyle: 'bold', fontSize: 9, ...tableBorder },
            columnStyles: { 0: { cellWidth: summaryCol0 }, 1: { cellWidth: summaryCol1 }, 2: { cellWidth: summaryCol2 }, 3: { cellWidth: summaryCol3 } },
            margin: { left: speechMargin, right: speechMargin },
            tableWidth: speechContentWidth,
          });
          const summaryTableEndY = (doc as any).lastAutoTable?.finalY ?? 100;
          const defStartY = summaryTableEndY + 14;
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(10);
          doc.text('Metric definitions', speechMargin, defStartY - 6);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          const metricDefinitions: [string, string][] = [
            ['Overall speech quality', 'A composite score (0–100) derived from clarity, fluency, and delivery quality of the spoken response.'],
            ['Speaking pace (WPM)', 'Words per minute calculated from the transcript and audio duration; reflects whether the candidate speaks at a clear, steady rate.'],
            ['Filler words', 'Count of filler or hesitation words (e.g. um, uh, like) detected in the transcript during the response.'],
            ['Filler density', 'Percentage of total words that are filler words; indicates how much the response is diluted by hesitations.'],
            ['Pause & pacing', 'Score (0–100) reflecting use of pauses and rhythm: appropriate pausing vs. rushed or disjointed delivery.'],
            ['Voice confidence', 'Score (0–100) based on vocal features (tone, steadiness, projection) indicating how confident the speaker sounds.'],
            ['Stress level', 'Score (0–100) indicating perceived stress or anxiety in the voice, inferred from acoustic and prosodic analysis.'],
          ];
          const defCol0 = speechContentWidth * 0.22;
          const defCol1 = speechContentWidth * 0.78;
          autoTable(doc, {
            head: [['Metric', 'Definition']],
            body: metricDefinitions,
            startY: defStartY,
            styles: { fontSize: 9, cellPadding: 3, overflow: 'linebreak', ...tableBorder },
            headStyles: { fillColor: [30, 93, 168], textColor: 255, fontStyle: 'bold', fontSize: 9, ...tableBorder },
            columnStyles: { 0: { cellWidth: defCol0 }, 1: { cellWidth: defCol1 } },
            margin: { left: speechMargin, right: speechMargin },
            tableWidth: speechContentWidth,
          });
        }
      }

      // Page: Detailed feedback on candidate speech abilities (candidate report only; recruiter report ends at speech scores)
      if (reportVariant !== 'recruiter') {
      const speechReport = reportData?.interview?.speech_detailed_report;
      if (speechReport && String(speechReport).trim()) {
        const speechMargin = 8;
        const speechContentWidth = pageWidth - speechMargin * 2;
        doc.addPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(30, 93, 168);
        doc.text('DETAILED FEEDBACK ON CANDIDATE SPEECH ABILITIES', speechMargin, 20);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        const reportBody = stripSpeechReportTitleLine(String(speechReport).trim());
        const reportSections = parseSpeechReportSections(reportBody);
        // Exclude "What the Data Tells You" — it's a parent heading with no body, so it shows as an empty column
        const tableSections = reportSections.filter(
          (s) => !/^What the Data Tells You$/i.test((s.section || '').trim())
        );
        if (tableSections.length >= 2) {
          const colCount = tableSections.length;
          const colWidth = speechContentWidth / colCount;
          const headerRow = tableSections.map((s) => s.section);
          const contentRow = tableSections.map((s) => s.content);
          const columnStyles: Record<number, { cellWidth: number }> = {};
          for (let i = 0; i < colCount; i++) columnStyles[i] = { cellWidth: colWidth };
          autoTable(doc, {
            head: [headerRow],
            body: [contentRow],
            startY: 28,
            styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak', ...tableBorder },
            headStyles: { fillColor: [30, 93, 168], textColor: 255, fontStyle: 'bold', fontSize: 9, ...tableBorder },
            columnStyles,
            margin: { left: speechMargin, right: speechMargin },
            tableWidth: speechContentWidth,
          });
        } else {
          drawFormattedReportText(doc, reportBody, {
            startX: speechMargin,
            startY: 28,
            maxWidth: speechContentWidth,
            lineHeight: 5,
            pageHeight: doc.internal.pageSize.height,
            bottomMargin: 28,
            fontSize: 9,
          });
        }
      }

      // Page: Your Personalised Action Plan — one column per attribute (no Sr No)
      const actionPlan = reportData?.interview?.personalised_action_plan;
      if (actionPlan && String(actionPlan).trim()) {
        const speechMargin = 8;
        const speechContentWidth = pageWidth - speechMargin * 2;
        doc.addPage();
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(30, 93, 168);
        doc.text('YOUR PERSONALISED ACTION PLAN', speechMargin, 20);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        const planRaw = String(actionPlan).trim();
        const planItems = parseActionPlanItems(planRaw);
        if (planItems.length > 0) {
          const tableTotalWidth = speechContentWidth;
          const colWidths = [
            tableTotalWidth * 0.18,  // Action Name
            tableTotalWidth * 0.24,  // Addresses
            tableTotalWidth * 0.32,  // Description
            tableTotalWidth * 0.26,  // Expected outcome
          ];
          const tableBody = planItems.map((item) => [
            item.actionName || '—',
            item.addresses || '—',
            item.description || '—',
            item.expectedOutcome || '—',
          ]);
          autoTable(doc, {
            head: [['Action Name', 'Addresses', 'Description', 'Expected outcome']],
            body: tableBody,
            startY: 28,
            styles: { fontSize: 9, cellPadding: 4, overflow: 'linebreak', ...tableBorder },
            headStyles: { fillColor: [30, 93, 168], textColor: 255, fontStyle: 'bold', fontSize: 9, ...tableBorder },
            columnStyles: {
              0: { cellWidth: colWidths[0] },
              1: { cellWidth: colWidths[1] },
              2: { cellWidth: colWidths[2] },
              3: { cellWidth: colWidths[3] },
            },
            margin: { left: speechMargin, right: speechMargin },
            tableWidth: tableTotalWidth,
          });
        } else {
          const planBody = normalizeActionPlanText(planRaw);
          drawFormattedReportText(doc, planBody, {
            startX: speechMargin,
            startY: 28,
            maxWidth: speechContentWidth,
            lineHeight: 5.5,
            pageHeight: doc.internal.pageSize.height,
            bottomMargin: 28,
            fontSize: 9,
          });
        }
      }
      }

      // Add closing/disclaimer page
      doc.addPage();
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(11);
      doc.setTextColor(30, 30, 30);
      const disclaimerLines = [
        'This report combines AI content evaluation with advanced speech analysis.',
        'Metrics are calculated using speech analysis and machine learning.',
        'This report was created by the smart assessment system ProValuate.'
      ];
      const lineHeight = 8;
      const pageHeightForDisclaimer = doc.internal.pageSize.height;
      let disclaimerY = pageHeightForDisclaimer / 2 - (disclaimerLines.length * lineHeight) / 2;
      disclaimerLines.forEach((line) => {
        doc.text(line, pageWidth / 2, disclaimerY, { align: 'center' });
        disclaimerY += lineHeight;
      });
      // Single final pass: redraw footer on every page with consistent font (helvetica 8pt) and correct "Page X of Y"
      const totalPages = doc.internal.getNumberOfPages();
      const footerYUniform = doc.internal.pageSize.height - 8;
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(0, 0, 0);
        doc.text('ProValuate', pageWidth / 2, footerYUniform, { align: 'center' });
        doc.text(`Page ${p} of ${totalPages}`, pageWidth - 15, footerYUniform, { align: 'right' });
      }

      // Save the PDF with proper filename
      const candidateName = interview.candidate_name.replace(/[^a-zA-Z0-9]/g, '_');
      const fileName = `Interview_Report_${candidateName}_${new Date().toISOString().split('T')[0]}.pdf`;
      
      // Generate and download the PDF
      doc.save(fileName);
      
      // Show success message after a small delay to ensure download started
      setTimeout(() => {
        toast.success('PDF report downloaded successfully!', { id: 'pdf-generate-success' });
      }, 500);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF report', { id: 'pdf-generate-error' });
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col overflow-x-hidden bg-white text-gray-900">
      {/* Header - dark blue bar with title and Menu */}
      <header className={`flex-shrink-0 border-b min-h-[72px] sm:min-h-[80px] flex items-center ${headerBg}`}>
        <div className="w-full pl-4 sm:pl-6 pr-4 sm:pr-6 py-4 sm:py-5 flex items-center justify-between gap-4">
          {/* Left: Title and subtitle */}
          <div className="flex flex-col min-w-0">
            <h1 className="text-base sm:text-lg lg:text-xl font-bold text-white truncate">
              Parameter-Based Assessment Analysis
            </h1>
            <p className="text-xs sm:text-sm text-white/90 mt-0.5">
              AI Evaluation and Communication Insights
            </p>
          </div>
          {/* Right: Menu - aligned to end, vertically centered */}
          <div className="flex items-center flex-shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className={`inline-flex items-center gap-2 min-h-[44px] px-4 sm:px-6 py-2 sm:py-2.5 rounded-full text-sm sm:text-base font-medium transition-colors touch-manipulation ${btnOutline} flex-shrink-0`}
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5 sm:h-5 sm:w-5 flex-shrink-0" />
                  <span>Menu</span>
                  <ChevronDown className="h-4 w-4 flex-shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => navigate(reportVariant === 'recruiter' ? '/dashboard?section=interview-dashboard' : '/candidate-dashboard/interviews')}>
                  <LayoutDashboard className="mr-2 h-4 w-4 flex-shrink-0" />
                  {reportVariant === 'recruiter' ? 'Back to Dashboard' : 'Back to My Interviews'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={generatePDFReport}
                  disabled={isGeneratingPDF}
                  className={isGeneratingPDF ? 'opacity-50 cursor-not-allowed' : ''}
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin flex-shrink-0" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4 flex-shrink-0" />
                  )}
                  Download PDF Report
                </DropdownMenuItem>
                <DropdownMenuItem onClick={shareReport}>
                  <Share2 className="mr-2 h-4 w-4 flex-shrink-0" />
                  Share
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content - full width as old setup */}
      <div className="flex-1 w-full min-w-0 py-4 sm:py-8 px-4 sm:px-6 pb-8 sm:pb-12 overflow-x-hidden">
        {/* Interview Overview - Two Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-10">
          {/* Card 1: Overall Score - Circular Diagram */}
          <div className="rounded-lg p-4 sm:p-6 bg-white border border-gray-200 shadow-sm flex flex-col items-center justify-center">
            <div className="relative w-40 h-40 sm:w-48 sm:h-48 flex-shrink-0">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="42" fill="none" stroke="#e5e7eb" strokeWidth="10" />
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke={accentHex}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={`${(Math.min(10, Math.max(0, Number(interview?.overall_score) || 0)) / 10) * 263} 263`}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-2xl sm:text-3xl font-bold ${accentText}`}>
                  {interview?.overall_score != null ? `${formatOverallScore(interview.overall_score)}/10` : 'N/A'}
                </span>
                <span className="text-xs sm:text-sm text-gray-600 mt-1">Overall Score</span>
              </div>
            </div>
            <div className={`text-xs sm:text-sm mt-2 px-3 py-1 rounded-full text-white ${getScoreClass(interview?.overall_score || 0)}`}>
              {getScoreLabel(interview?.overall_score || 0)}
            </div>
          </div>

          {/* Card 2: Interview Summary */}
          <div className="rounded-lg p-4 sm:p-6 bg-white border border-gray-200 shadow-sm">
            <h2 className="text-lg sm:text-xl font-bold mb-4 flex items-center text-gray-900">
              <BarChart3 className={`h-5 w-5 sm:h-6 sm:w-6 mr-2 ${accentText} flex-shrink-0`} />
              Interview Summary
            </h2>
            <div className="space-y-3 sm:space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm sm:text-base text-gray-600">Candidate:</span>
                <span className="text-sm sm:text-base font-semibold text-gray-900">{interview?.candidate_name ?? 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm sm:text-base text-gray-600">Role:</span>
                <span className="text-sm sm:text-base font-semibold text-gray-900">{interview?.position ?? 'N/A'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm sm:text-base text-gray-600">Date:</span>
                <span className="text-sm sm:text-base font-semibold text-gray-900">
                  {formatOrdinalDate(interview?.completed_at || interview?.created_at)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm sm:text-base text-gray-600">Duration:</span>
                <span className="text-sm sm:text-base font-semibold text-gray-900">
                  {interview?.completed_at && interview?.started_at
                    ? `${Math.round((new Date(interview.completed_at).getTime() - new Date(interview.started_at).getTime()) / 60000)} minutes`
                    : `${Math.round(Number(interview?.duration_minutes) || 30)} minutes`
                  }
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm sm:text-base text-gray-600">Parameters Evaluated:</span>
                <span className="text-sm sm:text-base font-semibold text-gray-900">{parameterCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm sm:text-base text-gray-600">Total Questions:</span>
                <span className="text-sm sm:text-base font-semibold text-gray-900">{interview?.total_questions ?? 0}</span>
              </div>

              {/* Speech details: single row with clickable text that opens the card */}
              {reportData?.answers?.some((a) => {
                const b = a.behavioral ?? a.behavioral_metrics;
                return b && (typeof b.overall_speech_quality === 'number' || typeof b.speaking_pace_wpm === 'number' || typeof b.pause_quality_score === 'number');
              }) && (
                <div className="flex justify-between items-center">
                  <span className="text-sm sm:text-base text-gray-600">Speech details:</span>
                  <button
                    type="button"
                    onClick={() => setShowSpeechDetailsCard(true)}
                    className={`text-sm sm:text-base font-bold ${accentText} hover:underline focus:outline-none focus:ring-2 focus:ring-offset-1 rounded px-2 py-1 ${isCandidateReport ? 'focus:ring-sky-600' : 'focus:ring-[#1e5da8]'}`}
                  >
                    Click here for speech details
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Speech details card (dialog) */}
        <Dialog open={showSpeechDetailsCard} onOpenChange={setShowSpeechDetailsCard}>
          <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] overflow-y-auto p-6 sm:p-8">
            <DialogHeader>
              <DialogTitle className="text-xl sm:text-2xl">Speech details</DialogTitle>
            </DialogHeader>
            <p className="text-base sm:text-lg text-gray-600 mb-6">
              For further details and detailed analysis, please download the PDF.
            </p>
            {reportData?.answers && (() => {
              const answers = reportData.answers;
              const withBehavioral = answers.filter((a) => {
                const b = a.behavioral ?? a.behavioral_metrics;
                return b && (typeof b.overall_speech_quality === 'number' || typeof b.speaking_pace_wpm === 'number' || typeof b.pause_quality_score === 'number');
              });
              if (withBehavioral.length === 0) return null;

              const avg = (key: string, formatter: (v: number) => string = (v) => String(v)) => {
                const vals = withBehavioral.map((a) => (a.behavioral ?? a.behavioral_metrics)?.[key]).filter((v): v is number => typeof v === 'number');
                if (vals.length === 0) return null;
                const sum = vals.reduce((s, v) => s + v, 0);
                return formatter(sum / vals.length);
              };
              const avgNum = (key: string): number | null => {
                const vals = withBehavioral.map((a) => (a.behavioral ?? a.behavioral_metrics)?.[key]).filter((v): v is number => typeof v === 'number');
                if (vals.length === 0) return null;
                return vals.reduce((s, v) => s + v, 0) / vals.length;
              };
              const metricConfig = [
                { key: 'overall_speech_quality', name: 'Overall speech quality', getCandidate: () => avg('overall_speech_quality', (v) => `${Math.round(v)}/100`), ideal: '85-100' },
                { key: 'speaking_pace_wpm', name: 'Speaking pace (WPM)', getCandidate: () => avg('speaking_pace_wpm', (v) => `${Math.round(v)} WPM`), ideal: '120-160' },
                { key: 'filler_words', name: 'Filler words', getCandidate: () => avg('filler_words', (v) => `${Math.round(v)}`), ideal: '< 3-5 total' },
                { key: 'filler_density', name: 'Filler density', getCandidate: () => avg('filler_density', (v) => `${Math.round(v)}%`), ideal: '< 2-5%' },
                { key: 'pause_quality_score', name: 'Pause & pacing', getCandidate: () => avg('pause_quality_score', (v) => `${Math.round(v)}/100`), ideal: '80-100' },
                { key: 'voice_confidence', name: 'Voice confidence', getCandidate: () => avg('voice_confidence', (v) => `${Math.round(v)}/100`), ideal: '80-100' },
                { key: 'stress_score', name: 'Stress level', getCandidate: () => avg('stress_score', (v) => `${Math.round(v)}/100`), ideal: '0-30' },
              ];
              const metrics = metricConfig
                .map((m) => {
                  const candidate = m.getCandidate();
                  const numVal = avgNum(m.key);
                  if (candidate == null) return null;
                  const rating = numVal != null ? getSpeechMetricRating(m.key, numVal) : 'Average';
                  return { name: m.name, candidate, ideal: m.ideal, rating, numVal };
                })
                .filter((m): m is NonNullable<typeof m> => m != null);

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-base sm:text-lg border border-gray-200 rounded-lg overflow-hidden">
                    <thead>
                      <tr className={`${tableHeaderBg} text-white`}>
                        <th className="text-left py-3 px-4 font-semibold text-base sm:text-lg">Metric</th>
                        <th className="text-left py-3 px-4 font-semibold text-base sm:text-lg">Candidate Average</th>
                        <th className="text-left py-3 px-4 font-semibold text-base sm:text-lg">Rating</th>
                        <th className="text-left py-3 px-4 font-semibold text-base sm:text-lg">Ideal Range</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.map((m, i) => {
                        const style = SPEECH_RATING_STYLES[m.rating];
                        return (
                          <tr key={m.name} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                            <td className="py-3 px-4 text-gray-700">{m.name}</td>
                            <td className={`py-3 px-4 font-medium ${style.bg} ${style.text}`}>{m.candidate}</td>
                            <td className={`py-3 px-4 font-medium ${style.bg} ${style.text}`}>{m.rating}</td>
                            <td className="py-3 px-4 text-gray-600">{m.ideal}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>

        {/* Parameter selection and questions */}
        {reportData?.questions && reportData.questions.length > 0 && (
          <div className="rounded-lg p-3 sm:p-6 bg-white border border-gray-200 shadow-sm mt-2 sm:mt-4">
            {/* Parameter cards */}
            {(() => {
              // Safety check - ensure data exists
              if (!reportData.questions || !reportData.answers) {
                return (
                  <div className={`text-center py-12 ${
                    'text-gray-500'
                  }`}>
                    <Award className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">Loading assessment data...</p>
                    </div>
                );
              }

              // Get unique parameters and their questions
              const parameters = {};
              reportData.questions.forEach(question => {
                const paramKey = question.parameter_key || question.parameter_name;
                if (!parameters[paramKey]) {
                  parameters[paramKey] = {
                    name: question.parameter_name,
                    key: paramKey,
                    questions: [],
                    totalScore: 0,
                    questionCount: 0
                  };
                }
                const answer = reportData.answers?.find(a => a.question_order === question.question_order);
                if (answer) {
                  parameters[paramKey].questions.push({ question, answer });
                  parameters[paramKey].totalScore += answer.score || 0;
                  parameters[paramKey].questionCount += 1;
                }
              });

              // Add Personal Questions as a parameter if they exist
              if (reportData.personalized_answers && reportData.personalized_answers.length > 0) {
                parameters['personal-questions'] = {
                  name: 'Personal Questions',
                  key: 'personal-questions',
                  questions: reportData.personalized_answers.map((answer, index) => ({
                    question: { question_text: answer.question_text, question_order: `personal-${index}` },
                    answer: { ...answer, score: null } // No scoring for personal questions
                  })),
                  totalScore: 0,
                  questionCount: reportData.personalized_answers.length,
                  averageScore: null, // No scoring for personal questions
                  isPersonal: true
                };
              }

              // Calculate average scores for each parameter (except personal questions)
              Object.values(parameters).forEach((param: any) => {
                if (!param.isPersonal) {
                  param.averageScore = param.questionCount > 0 ? Math.round((param.totalScore / param.questionCount) * 10) / 10 : 0;
                }
              });

              // Check if we have any parameters with questions
              if (Object.keys(parameters).length === 0) {
                return (
                  <div className={`text-center py-12 ${
                    'text-gray-500'
                  }`}>
                    <Award className="w-16 h-16 mx-auto mb-4 opacity-50" />
                    <p className="text-lg">No assessment data available</p>
                    <p className="text-sm">Assessment questions and answers are still being processed</p>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {/* Enhanced Parameter Tabs with Performance Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-8">
                    {Object.entries(parameters).map(([paramKey, param]: [string, any]) => (
                      <button
                        key={paramKey}
                        onClick={() => { setSelectedParameter(paramKey); setExpandedQuestions(new Set()); }}
                        className={`p-3 sm:p-6 rounded-xl transition-all duration-200 text-left min-w-0 ${
                          selectedParameter === paramKey
                            ? `${paramSelected} shadow-lg transform scale-105`
                            : 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:scale-102 shadow-sm hover:shadow-md'
                        }`}
                      >
                          <div className="space-y-3 sm:space-y-4">
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <h4 className="font-bold text-sm sm:text-lg leading-tight break-words">{param.name}</h4>
                            {param.isPersonal ? (
                              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                                selectedParameter === paramKey
                                  ? paramBadgeSelected
                                  : paramBadge
                              }`}>
                                Review Only
                              </div>
                            ) : (
                              <div className={`text-2xl sm:text-3xl font-bold ${
                                selectedParameter === paramKey 
                                  ? accentText
                                  : getScoreColor(param.averageScore)
                              }`}>
                                {param.averageScore}/10
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2 sm:space-y-3">
                            <div className="flex justify-between text-sm sm:text-lg font-medium opacity-90">
                              {param.isPersonal ? (
                                <span>No scoring applied</span>
                              ) : (
                                <span>Weight: {(() => {
                                  // Calculate weight based on question count relative to total (excluding personal questions)
                                  const functionalQuestions = Object.values(parameters).reduce((sum: number, p: any) => 
                                    p.isPersonal ? sum : sum + (p.questionCount as number), 0) as number;
                                  const weight = functionalQuestions > 0 ? Math.round(((param.questionCount as number) / functionalQuestions) * 100) : 0;
                                  return weight;
                                })()}%</span>
                              )}
                              <span>{param.questionCount} questions</span>
                            </div>
                            
                            {/* Performance Bar - Only for scored parameters */}
                            {!param.isPersonal ? (
                              <div className={`w-full rounded-full h-3 ${
                                'bg-gray-300'
                              }`}>
                                <div 
                                  className={`h-3 rounded-full transition-all duration-300 ${
selectedParameter === paramKey 
                                  ? barSelected
                                  : getScoreClass(param.averageScore)
                                  }`}
                                  style={{ width: `${param.averageScore * 10}%` }}
                                ></div>
                              </div>
                            ) : (
                              /* Placeholder space for Personal Questions to maintain uniform card height */
                              <div className="w-full h-3"></div>
                            )}
                  </div>
                </div>
                      </button>
              ))}
            </div>

                  {/* Questions for Selected Parameter */}
                  {selectedParameter && parameters[selectedParameter] && (
            <div className="space-y-6 mt-6">
                      {/* Question cards - vertical list with Expand */}
                      <div className="space-y-4 sm:space-y-5">
                        {parameters[selectedParameter].questions.map(({ question, answer }: { question: any; answer: any }, idx: number) => {
                          const expandKey = `${selectedParameter}-${idx}`;
                          const isExpanded = expandedQuestions.has(expandKey);
                          return (
                            <div
                              key={idx}
                              className={`rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden ${cardHover} transition-colors cursor-pointer`}
                              onClick={() => toggleQuestion(expandKey)}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleQuestion(expandKey); } }}
                            >
                              <div className="flex items-start justify-between gap-5 p-6 sm:p-8 min-h-[140px] sm:min-h-[160px]">
                                <div className="min-w-0 flex-1 text-left">
                                  <div className="flex items-center gap-3 mb-3">
                                    <span className="font-bold text-base sm:text-lg text-gray-900">Question {idx + 1}</span>
                                    {!parameters[selectedParameter].isPersonal && answer?.score != null && (
                                      <span className={`text-xl sm:text-2xl font-bold ${getScoreColor(answer.score)}`}>{answer.score}/10</span>
                                    )}
                                  </div>
                                  <p className="text-base sm:text-lg text-gray-600 line-clamp-3">{question?.question_text || 'No question text'}</p>
                                </div>
                                <div className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2.5 text-base font-medium ${expandBtn} rounded-lg`}>
                                  {isExpanded ? 'Collapse' : 'Expand'}
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </div>
                              </div>
                              {isExpanded && (
                                <div className="px-5 sm:px-8 pb-5 sm:pb-8 pt-0 border-t border-gray-100 space-y-5 sm:space-y-6" onClick={(e) => e.stopPropagation()}>
                                  <div>
                                    <h5 className="font-bold mb-2 text-base sm:text-lg text-gray-900">Answer:</h5>
                                    <p className="text-base sm:text-lg text-gray-700 break-words">{answer.transcript || 'No transcript available'}</p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {answer.audio_url && (
                                      <button onClick={() => playAudio(answer.audio_url)} className={`inline-flex items-center gap-2 px-4 py-2 ${btnPrimary} text-white rounded-lg text-sm`}>
                                        <Download className="h-4 w-4" /> Play Audio
                                      </button>
                                    )}
                                    {answer.question_video_url && (
                                      <button onClick={() => playVideo(answer.question_video_url)} className={`inline-flex items-center gap-2 px-4 py-2 ${btnPrimary} text-white rounded-lg text-sm`}>
                                        <Download className="h-4 w-4" /> Play Video
                                      </button>
                                    )}
                                    {answer.written_answer && (
                                      <button onClick={() => showWrittenAnswer(answer.written_answer)} className={`inline-flex items-center gap-2 px-4 py-2 ${btnPrimary} text-white rounded-lg text-sm`}>
                                        <FileText className="h-4 w-4" /> Show Written Answer
                                      </button>
                                    )}
                                  </div>
                                  {!parameters[selectedParameter].isPersonal && (
                                    <div>
                                      <h5 className="font-bold mb-2 text-base sm:text-lg text-gray-900">AI Feedback:</h5>
                                      <p className="text-base sm:text-lg text-gray-700 break-words">{answer.feedback || 'Feedback analysis pending - will be available soon'}</p>
                                    </div>
                                  )}
                                  {(answer.behavioral || answer.behavioral_metrics) && (
                                    <div className="p-5 bg-sky-100 rounded-lg border border-sky-200">
                                      <h5 className="font-bold mb-3 text-base sm:text-lg text-gray-900">Speech Analysis</h5>
                                      {(() => {
                                        const b = answer.behavioral || answer.behavioral_metrics;
                                        return (
                                          <>
                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm sm:text-base">
                                              <div><span className="text-gray-600">Overall speech quality</span><span className="font-semibold block">{b.overall_speech_quality != null ? `${b.overall_speech_quality}/100` : '-'}</span></div>
                                              <div><span className="text-gray-600">Speaking pace</span><span className="font-semibold block">{b.speaking_pace_wpm ?? '-'} WPM</span></div>
                                              <div><span className="text-gray-600">Filler words</span><span className="font-semibold block">{b.filler_words ?? '-'}{b.filler_density != null ? ` (${b.filler_density}%)` : ''}{b.filler_examples?.length ? ` (${b.filler_examples.join(', ')})` : ''}</span></div>
                                              <div><span className="text-gray-600">Pause & pacing</span><span className="font-semibold block">{b.pause_quality_score != null ? `${b.pause_quality_score}/100` : '-'}</span></div>
                                              <div><span className="text-gray-600">Voice confidence</span><span className="font-semibold block">{b.voice_confidence != null ? `${b.voice_confidence}/100` : '-'}</span></div>
                                              <div><span className="text-gray-600">Stress level</span><span className="font-semibold block">{b.stress_score != null ? `${b.stress_score}/100` : '-'}</span></div>
                                            </div>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* No Parameter Selected Message */}
                  {!selectedParameter && (
                    <div className="text-center py-8 sm:py-16 text-gray-500 px-2">
                      <p className="text-base sm:text-xl font-medium break-words">Select a parameter to view its questions</p>
                      <p className="text-sm sm:text-lg mt-2 sm:mt-3 leading-relaxed break-words">Click a parameter card above, then expand a question to see full details</p>
                    </div>
                  )}
                  </div>
                );
            })()}
          </div>
        )}

                 

        {/* Complete Session Video */}
        {reportData.interview?.session_video_url && (
          <div className="rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 transition-colors duration-300 bg-white border border-gray-200 shadow-sm">
            <h3 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 text-gray-900">Complete Session Video</h3>
            <div className="rounded-lg p-3 sm:p-4 transition-colors duration-300 bg-gray-50 border border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
                <div className="min-w-0">
                  <h4 className="font-medium text-gray-900">🎥 Full Interview Session</h4>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Complete video recording from start to finish
                  </p>
                  <p className="text-xs sm:text-sm text-gray-500 break-words">
                    Size: {reportData.interview.session_video_size ? `${(reportData.interview.session_video_size / 1024 / 1024).toFixed(1)} MB` : 'Unknown'} | Format: WebM
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:flex-shrink-0">
                  <button
                    onClick={() => playVideo(reportData.interview.session_video_url)}
                    className={`min-h-[44px] px-4 py-2 rounded-lg ${btnPrimary} text-white text-sm sm:text-base font-medium transition-colors touch-manipulation flex-1 sm:flex-none`}
                  >
                    Play Full Video
                  </button>
                  <a
                    href={reportData.interview.session_video_url}
                    download
                    className="inline-flex items-center justify-center min-h-[44px] px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm sm:text-base font-medium transition-colors touch-manipulation flex-1 sm:flex-none"
                  >
                    Download Video
                  </a>
                </div>
              </div>
              <div className="rounded p-3 transition-colors duration-300 bg-gray-100 border border-gray-300">
                <h5 className={`font-medium mb-2 ${
                  'text-gray-900'
                }`}>📹 This video contains the complete interview session including:</h5>
                <ul className={`text-sm space-y-1 ${
                  'text-gray-600'
                }`}>
                  <li>• Candidate's facial expressions and body language</li>
                  <li>• Complete audio from all questions</li>
                  <li>• Full session duration: {Math.round(Number(reportData.interview.duration_minutes) || 30)} minutes</li>
                  <li>• Professional assessment context</li>
                  {reportData.answers && reportData.answers.some(answer => answer.question_video_url) && (
                    <li>• Individual question videos are also available above for easier review</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Video Modal */}
      {playingVideo && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden transition-colors duration-300 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between gap-2 p-3 sm:p-4 flex-shrink-0 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Question Video Player</h3>
              <button
                onClick={closeVideo}
                className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors text-gray-500 hover:text-gray-900 touch-manipulation"
                aria-label="Close video"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-2 sm:p-4 min-h-0 flex-1 overflow-auto">
              <video
                controls
                autoPlay
                muted
                className="w-full h-auto max-h-[70vh] rounded-lg"
                src={playingVideo}
              >
                Your browser does not support the video element.
              </video>
            </div>
          </div>
        </div>
      )}

      {/* Audio Modal */}
      {playingAudio && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden transition-colors duration-300 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between gap-2 p-3 sm:p-4 flex-shrink-0 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Question Audio Player</h3>
              <button
                onClick={closeAudio}
                className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors text-gray-500 hover:text-gray-900 touch-manipulation"
                aria-label="Close audio"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-3 sm:p-6 overflow-auto min-h-0">
              <div className="rounded-lg p-4 sm:p-6 text-center transition-colors duration-300 bg-gray-50 border border-gray-200">
                <div className="mb-4 sm:mb-6">
                  <div className={`w-16 h-16 sm:w-24 sm:h-24 ${iconBg} rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4`}>
                    <Download className="h-8 w-8 sm:h-12 sm:w-12 text-white" />
                  </div>
                  <h4 className="text-lg sm:text-xl font-semibold mb-2 text-gray-900">Audio Recording</h4>
                  <p className="text-sm sm:text-base text-gray-600">Question answer audio playback</p>
                </div>
                <audio
                  controls
                  autoPlay
                  className="w-full max-w-md mx-auto"
                  src={playingAudio}
                >
                  Your browser does not support the audio element.
                </audio>
                <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-500">
                  Use the controls above to play, pause, and seek through the audio
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Written Answer Modal */}
      {showingWrittenAnswer && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-2 sm:p-4">
          <div className="rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden transition-colors duration-300 bg-white shadow-xl flex flex-col">
            <div className="flex items-center justify-between gap-2 p-3 sm:p-4 flex-shrink-0 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">Written Answer</h3>
              <button
                onClick={closeWrittenAnswer}
                className="flex-shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg transition-colors text-gray-500 hover:text-gray-900 touch-manipulation"
                aria-label="Close written answer"
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-3 sm:p-6 overflow-auto min-h-0 flex-1">
              <div className="rounded-lg p-4 sm:p-6 transition-colors duration-300 bg-white border border-gray-200">
                <textarea
                  value={showingWrittenAnswer}
                  readOnly
                  className="w-full h-64 sm:h-96 p-3 sm:p-4 text-sm sm:text-base text-gray-800 bg-white rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="No written answer available..."
                />
                <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-500 text-center">
                  This is the exact written answer submitted by the candidate during the interview
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default FinalResults;
