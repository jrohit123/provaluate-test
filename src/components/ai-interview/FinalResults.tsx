import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft,
  Download, 
  Share2, 
  BarChart3, 
  Award,
  XCircle,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  ChevronUp,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { buildApiUrl, API_CONFIG } from '@/constants/api';

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

const FinalResults = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [selectedParameter, setSelectedParameter] = useState(null);
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const [playingVideo, setPlayingVideo] = useState(null);
  const [playingAudio, setPlayingAudio] = useState(null);
  const [showingWrittenAnswer, setShowingWrittenAnswer] = useState(null);

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
              written_answer: answer.written_answer // Add written answer
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
                    written_answer: answer.written_answer
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
                    written_answer: answer.written_answer
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
                written_answer: answer.written_answer
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
         const parametersObject = {};
         if (data.parameters && Array.isArray(data.parameters)) {
           data.parameters.forEach(param => {
             // Map questions to the format expected by the UI
             const mappedQuestions = (param.questions || []).map((questionData, index) => {
               // Prefer exact 1-based match; fallback to 0-based
               const oneBasedOrder = index + 1;
               const correspondingAnswer =
                 data.answers?.find(a => a.parameter_key === param.key && Number(a.question_order) === oneBasedOrder) ||
                 data.answers?.find(a => a.parameter_key === param.key && Number(a.question_order) === index);

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
                   written_answer: realWrittenAnswer
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
      reportContent += `OVERALL SCORE: ${reportData.interview?.overall_score || 'N/A'}/10\n`;
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
      doc.text(`Overall Score: ${reportData.interview?.overall_score || 'N/A'}/10`, 110, yPosition);
      doc.text(`Total Questions: ${reportData.questions?.length || 0}`, 110, yPosition + 8);
      doc.text(`Date: ${formatOrdinalDate(reportData.interview?.created_at)}`, 110, yPosition + 16);
      
      yPosition += 45;
      
      // Parameter scores section with professional table
      if (reportData.parameters && reportData.parameters.length > 0) {
        doc.setFontSize(16);
        doc.setFont('helvetica', 'bold');
        doc.text('PARAMETER PERFORMANCE', 15, yPosition);
        yPosition += 15;
        
        // Create professional table
        const tableData = [['Parameter', 'Score', 'Weight', 'Performance']];
        reportData.parameters.forEach((param, index) => {
          const paramName = param.name || param.parameter_name || `Parameter ${index + 1}`;
          const score = param.score || param.averageScore || 'N/A';
          const weight = param.weight ? `${param.weight}%` : 'N/A';
          
          // Performance indicator
          let performance = 'Needs Improvement';
          if (score >= 8) performance = 'Excellent';
          else if (score >= 6) performance = 'Good';
          else if (score >= 4) performance = 'Fair';
          
          tableData.push([paramName, score.toString(), weight, performance]);
        });
        
        // Professional table with borders and styling
        let tableY = yPosition;
        const colWidths = [70, 25, 25, 50];
        const startX = 15;
        
        tableData.forEach((row, rowIndex) => {
          if (tableY > 250) {
            doc.addPage();
            tableY = 20;
          }
          
          let currentX = startX;
          
          // Draw cell borders
          doc.setDrawColor(189, 195, 199);
          doc.setLineWidth(0.2);
          
          row.forEach((cell, colIndex) => {
            // Cell background for header
            if (rowIndex === 0) {
              doc.setFillColor(52, 73, 94); // Dark blue
              doc.rect(currentX, tableY - 5, colWidths[colIndex], 8, 'F');
              doc.setTextColor(255, 255, 255);
            } else {
              doc.setFillColor(236, 240, 241); // Light gray
              doc.rect(currentX, tableY - 5, colWidths[colIndex], 8, 'F');
              doc.setTextColor(0, 0, 0);
            }
            
            // Cell border
            doc.rect(currentX, tableY - 5, colWidths[colIndex], 8);
            
            // Text
            doc.setFont('helvetica', rowIndex === 0 ? 'bold' : 'normal');
            doc.setFontSize(10);
            
            // Center align score and weight
            if (colIndex === 1 || colIndex === 2) {
              doc.text(cell, currentX + colWidths[colIndex]/2, tableY, { align: 'center' });
            } else {
              doc.text(cell, currentX + 3, tableY);
            }
            
            currentX += colWidths[colIndex];
          });
          
          tableY += 8;
        });
        
        yPosition = tableY + 15;
      }
      
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
      overviewSheet.addRow(['Overall Score', (parseFloat(reportData.interview?.overall_score) || 0).toString()]);
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

  const getScoreColor = (score) => 'text-[#1e5da8]';

  const getScoreLabel = (score) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Needs Improvement';
  };

  const getScoreClass = (score) => 'bg-[#1e5da8]';

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">
        <header className="flex-shrink-0 bg-sky-100 border-b border-sky-200">
          <div className="w-full pl-0 pr-2 sm:pr-6 py-2 sm:py-3 lg:py-4">
            <img
              src="/Logo_Transparent_BG.png"
              alt="ProValuate"
              className="h-8 sm:h-10 lg:h-12 w-auto object-contain"
            />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center p-3 sm:p-6">
          <div className="text-center">
            <div className="animate-spin rounded-full h-10 w-10 sm:h-12 sm:w-12 border-b-2 border-[#1e5da8] mx-auto mb-3 sm:mb-4" />
            <p className="text-sm sm:text-lg text-gray-600">Loading final results...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="min-h-screen bg-white flex flex-col overflow-x-hidden">
        <header className="flex-shrink-0 bg-sky-100 border-b border-sky-200">
          <div className="w-full pl-0 pr-2 sm:pr-6 py-2 sm:py-3 lg:py-4">
            <img
              src="/Logo_Transparent_BG.png"
              alt="ProValuate"
              className="h-8 sm:h-10 lg:h-12 w-auto object-contain"
            />
          </div>
        </header>
        <div className="flex-1 flex items-center justify-center px-3 sm:px-6 py-4 sm:py-6">
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-8 max-w-md w-full text-center mx-2 sm:mx-0">
            <XCircle className="w-12 h-12 sm:w-16 sm:h-16 text-red-500 mx-auto mb-3 sm:mb-4 flex-shrink-0" />
            <h2 className="text-lg sm:text-2xl font-bold text-gray-800 mb-2 break-words">Results Not Found</h2>
            <p className="text-sm sm:text-base text-gray-600 mb-4 sm:mb-6 break-words">The interview results could not be loaded.</p>
            <button
              onClick={() => navigate('/dashboard', { state: { activeSection: 'interview-dashboard' } })}
              className="min-h-[44px] px-4 sm:px-6 py-3 rounded-lg bg-[#1e5da8] text-white text-sm sm:text-base font-medium hover:bg-[#1e5da8]/90 transition-colors touch-manipulation w-full sm:w-auto"
            >
              Go to Dashboard
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
      
      // Add logo (if available) - using async/await approach
      let logoAdded = false;
      try {
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        
        // Wait for image to load
        await new Promise((resolve, reject) => {
          logoImg.onload = () => {
            try {
              doc.addImage(logoImg, 'PNG', 20, 10, 30, 15);
              logoAdded = true;
              resolve(true);
            } catch (error) {
              console.log('Error adding logo to PDF:', error);
              resolve(false);
            }
          };
          logoImg.onerror = () => {
            console.log('Logo image failed to load');
            resolve(false);
          };
          logoImg.src = '/Logo_Transparent_BG.png';
        });
      } catch (error) {
        console.log('Logo not found, continuing without logo');
      }

      // Add candidate info with reduced spacing
      doc.setFontSize(11);
      doc.text(`Candidate: ${interview.candidate_name}`, 20, 45);
      doc.text(`Email: ${interview.candidate_email || 'N/A'}`, 20, 52);
      doc.text(`Position: ${interview.position}`, 20, 59);
      doc.text(`Overall Score: ${interview.overall_score || 'N/A'}`, 20, 66);
      doc.text(`Interview Date: ${formatOrdinalDate(interview.created_at)}`, 20, 73);
      
      // Add termination reason only if interview is terminated (below interview date, not in table)
      let tableStartY = 85; // Default table start position
      if (interview.status === 'terminated' && interview.termination_reason) {
        doc.text(`Termination Reason: ${interview.termination_reason}`, 20, 80);
        tableStartY = 92; // Adjust table start position when termination reason is displayed
      }

      // Add candidate photo with multiple fallback mechanisms (server-first approach)
      try {
        const storageKey = `candidate_photo_${interviewId}`;
        let candidatePhotoDataUrl: string | null = null;
        let photoSource = 'none';
        
        // ✅ Strategy 1: Fetch from server first (cross-browser compatible)
        try {
          const photoUrl = buildApiUrl(`${API_CONFIG.ENDPOINTS.GET_CANDIDATE_PHOTO}/${interviewId}`);
          const photoResponse = await fetch(photoUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          if (photoResponse.ok) {
            const photoData = await photoResponse.json();
            if (photoData.photo && photoData.photo.startsWith('data:image/')) {
              candidatePhotoDataUrl = photoData.photo;
              photoSource = 'server';
              console.log('✅ Found candidate photo on server');
            }
          } else if (photoResponse.status !== 404) {
            console.warn('⚠️ Server photo fetch failed, trying local storage');
          }
        } catch (serverError) {
          console.warn('⚠️ Server photo fetch error, trying local storage:', serverError);
        }
        
        // ✅ Strategy 2: Fallback to localStorage (browser-specific)
        if (!candidatePhotoDataUrl) {
          try {
            const localPhoto = localStorage.getItem(storageKey);
            const localTimestamp = localStorage.getItem(`${storageKey}_timestamp`);
            
            if (localPhoto) {
              // Check if photo is not too old (optional: 7 days max)
              const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
              const photoAge = localTimestamp ? Date.now() - parseInt(localTimestamp) : 0;
              
              if (photoAge < maxAge) {
                candidatePhotoDataUrl = localPhoto;
                photoSource = 'localStorage';
                console.log('✅ Found candidate photo in localStorage');
              } else {
                console.log('⚠️ Photo in localStorage is too old');
              }
            }
          } catch (localStorageError) {
            console.log('⚠️ localStorage access failed, trying sessionStorage');
          }
        }
        
        // ✅ Strategy 3: Fallback to sessionStorage (browser-specific)
        if (!candidatePhotoDataUrl) {
          try {
            const sessionPhoto = sessionStorage.getItem(storageKey);
            if (sessionPhoto) {
              candidatePhotoDataUrl = sessionPhoto;
              photoSource = 'sessionStorage';
              console.log('✅ Found candidate photo in sessionStorage');
            }
          } catch (sessionStorageError) {
            console.log('⚠️ sessionStorage access failed');
          }
        }
        
        // Strategy 3: Validate photo data before using
        const isValidPhoto = (photoData: string | null): boolean => {
          if (!photoData) return false;
          // Check if it's a valid data URL
          if (!photoData.startsWith('data:image/')) return false;
          // Check minimum length (base64 encoded image should be at least 100 chars)
          if (photoData.length < 100) return false;
          return true;
        };
        
        if (candidatePhotoDataUrl && isValidPhoto(candidatePhotoDataUrl)) {
          // Use captured candidate photo
          await new Promise<boolean>((resolve) => {
            const candidateImg = new Image();
            candidateImg.crossOrigin = 'anonymous';
            
            // Set timeout for image loading (5 seconds max)
            const loadTimeout = setTimeout(() => {
              console.log('⚠️ Photo loading timeout, using fallback');
              resolve(false);
            }, 5000);
            
            candidateImg.onload = () => {
              clearTimeout(loadTimeout);
              try {
                // Position candidate photo beside candidate info
                const pageWidth = doc.internal.pageSize.getWidth();
                const photoWidth = 35;
                const photoHeight = 35;
                const photoX = pageWidth - photoWidth - 40;
                const photoY = 38;
                
                doc.addImage(candidateImg, 'JPEG', photoX, photoY, photoWidth, photoHeight);
                console.log(`✅ Candidate photo added to PDF (from ${photoSource})`);
                resolve(true);
              } catch (error) {
                console.error('❌ Error adding candidate photo to PDF:', error);
                resolve(false);
              }
            };
            
            candidateImg.onerror = (error) => {
              clearTimeout(loadTimeout);
              console.error('❌ Candidate photo failed to load:', error);
              console.log('⚠️ Falling back to hardcoded image');
              resolve(false);
            };
            
            candidateImg.src = candidatePhotoDataUrl;
          });
        } else {
          // Fallback to hardcoded image if no valid photo available
          console.log('⚠️ No valid candidate photo found, using fallback image');
          console.log(`🔍 Checked: localStorage=${!!localStorage.getItem(storageKey)}, sessionStorage=${!!sessionStorage.getItem(storageKey)}`);
          
        await new Promise<boolean>((resolve) => {
          const nameImg = new Image();
          nameImg.crossOrigin = 'anonymous';
            
          nameImg.onload = () => {
            try {
              const pageWidth = doc.internal.pageSize.getWidth();
              const nameWidth = 35;
              const nameHeight = 25;
                const nameX = pageWidth - nameWidth - 40;
                const nameY = 38;
              
              doc.addImage(nameImg, 'JPEG', nameX, nameY, nameWidth, nameHeight);
              resolve(true);
            } catch (error) {
                console.log('Error adding fallback image to PDF:', error);
              resolve(false);
            }
          };
            
          nameImg.onerror = () => {
              console.log('Fallback image failed to load');
            resolve(false);
          };
            
          nameImg.src = '/assets/NAME.jpg';
        });
        }
      } catch (error) {
        console.error('❌ Error processing candidate photo:', error);
        console.log('⚠️ Continuing without photo');
      }
      
      // Prepare table data
      const tableData: any[][] = [];
      
      // Debug logging - Enhanced to track feedback data
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
          
          // Only add if we have a valid question (not N/A) - same logic as Excel
          if (questionText !== 'N/A' && parameter !== 'N/A') {
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
              console.log(`🔍 Feedback for question ${questionOrder}:`, feedback?.substring(0, 100) + '...');
              console.log(`🔍 Formatted feedback for question ${questionOrder}:`, formattedFeedback?.substring(0, 200) + '...');
              
              tableData.push([
                parameter,
                questionText,
                answer.transcript || answer.answer || 'No transcript available',
                answer.written_answer || 'No written answer',
                formattedFeedback,
                answer.score || 'N/A'
              ]);
            } else {
              // Handle case where answer is missing but question exists (same as Excel)
              tableData.push([
                parameter,
                questionText,
                'No answer recorded',
                'No written answer',
                'No feedback available',
                'N/A'
              ]);
            }
          }
        });
      }
      
      // Add table with proper column widths
      autoTable(doc, {
        head: [['Parameter', 'Questions', 'Answers', 'Written Answer', 'AI Feedback', 'Scores']],
        body: tableData,
        startY: tableStartY, // Use calculated startY (85 normally, 92 if termination reason shown)
        styles: {
          fontSize: 7,
          cellPadding: 2,
          overflow: 'linebreak',
          halign: 'left',
          lineColor: [0, 0, 0], // Black borders
          lineWidth: 0.1
        },
        headStyles: {
          fillColor: [68, 114, 196], // Same blue as Excel (FF4472C4)
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8,
          lineColor: [0, 0, 0], // Black borders
          lineWidth: 0.2 // Thicker borders for header
        },
        columnStyles: {
          0: { cellWidth: 25 }, // Parameter - slightly smaller
          1: { cellWidth: 35 }, // Questions - slightly smaller  
          2: { cellWidth: 35 }, // Answers - slightly smaller
          3: { cellWidth: 35 }, // Written Answer - new column
          4: { cellWidth: 35 }, // AI Feedback - slightly smaller
          5: { cellWidth: 15 }  // Scores - slightly smaller
        },
        margin: { left: 15, right: 15 },
        pageBreak: 'auto',
        rowPageBreak: 'avoid',
        didDrawPage: function (data: any) {
          // Add page numbers
          const pageCount = (doc as any).internal.getNumberOfPages();
          doc.setFontSize(8);
          doc.text(`Page ${data.pageNumber} of ${pageCount}`, 
            data.settings.margin.left, 
            (doc as any).internal.pageSize.height - 10);
        }
      });
      
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
      {/* Header - same as CandidateInterview/CandidateCompletion: sky-100 + ProValuate logo */}
      <header className="flex-shrink-0 bg-sky-100 border-b border-sky-200">
        <div className="w-full pl-0 pr-2 sm:pr-6 py-2 sm:py-3 lg:py-4 flex items-center justify-between gap-2 sm:gap-3 flex-wrap">
          <img
            src="/Logo_Transparent_BG.png"
            alt="ProValuate"
            className="h-8 sm:h-10 lg:h-12 w-auto object-contain flex-shrink-0 order-first max-h-10 sm:max-h-none"
          />
          <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-3 ml-auto min-w-0">
            <button
              onClick={generatePDFReport}
              disabled={isGeneratingPDF}
              className={`inline-flex items-center gap-1 sm:gap-2 min-h-[44px] px-2 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-base font-medium transition-colors touch-manipulation bg-[#1e5da8] text-white hover:bg-[#1e5da8]/90 flex-shrink-0 ${isGeneratingPDF ? 'opacity-50 cursor-not-allowed' : ''}`}
              title="Download comprehensive PDF report with all questions, answers, scores, feedback, and media files"
            >
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin flex-shrink-0" />
                  <span className="hidden sm:inline">Generating PDF...</span>
                  <span className="sm:hidden">PDF...</span>
                </>
              ) : (
                <>
                  <FileText className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="hidden sm:inline">Download PDF Report</span>
                  <span className="sm:hidden">PDF</span>
                </>
              )}
            </button>
            <button
              onClick={downloadExcel}
              className="inline-flex items-center gap-1 sm:gap-2 min-h-[44px] px-2 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-base font-medium transition-colors touch-manipulation bg-[#1e5da8] text-white hover:bg-[#1e5da8]/90 flex-shrink-0"
              title="Download comprehensive Excel report"
            >
              <FileSpreadsheet className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Excel Report</span>
              <span className="sm:hidden">Excel</span>
            </button>
            <button
              onClick={shareReport}
              className="inline-flex items-center gap-1 sm:gap-2 min-h-[44px] px-2 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-base font-medium transition-colors touch-manipulation bg-[#1e5da8] text-white hover:bg-[#1e5da8]/90 flex-shrink-0"
            >
              <Share2 className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Share</span>
            </button>
            <button
              onClick={() => navigate('/dashboard', { state: { activeSection: 'interview-dashboard' } })}
              className="inline-flex items-center gap-1 sm:gap-2 min-h-[44px] px-2 sm:px-5 py-2 sm:py-2.5 rounded-lg text-xs sm:text-base font-medium transition-colors touch-manipulation bg-[#1e5da8] text-white hover:bg-[#1e5da8]/90 flex-shrink-0"
              aria-label="Back to Dashboard"
            >
              <ArrowLeft className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
              <span className="hidden sm:inline">Back to Dashboard</span>
              <span className="sm:hidden">Back</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content - full width as old setup */}
      <div className="flex-1 w-full min-w-0 py-4 sm:py-8 px-3 sm:px-4 overflow-x-hidden">
        {/* Interview Overview */}
        <div className="rounded-lg p-3 sm:p-6 mb-4 sm:mb-8 bg-white border border-gray-200 shadow-sm">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6">
            <div className="text-center min-w-0">
              <div className="text-xl sm:text-3xl font-bold text-[#1e5da8] break-words">{interview?.overall_score?.toFixed(1) || 'N/A'}/10</div>
              <div className="text-xs sm:text-sm text-gray-600">Overall Score</div>
              <div className={`text-xs mt-1 px-2 py-1 rounded-full text-white ${getScoreClass(interview?.overall_score || 0)}`}>
                {getScoreLabel(interview?.overall_score || 0)}
              </div>
            </div>
            <div className="text-center min-w-0">
              <div className="text-xl sm:text-3xl font-bold text-[#1e5da8]">{parameterCount}</div>
              <div className="text-xs sm:text-sm text-gray-600">Parameters</div>
            </div>
            <div className="text-center min-w-0">
              <div className="text-xl sm:text-3xl font-bold text-[#1e5da8]">{interview?.total_questions || 0}</div>
              <div className="text-xs sm:text-sm text-gray-600">Questions</div>
            </div>
             <div className="text-center min-w-0">
               <div className="text-xl sm:text-3xl font-bold text-[#1e5da8]">
                 {interview.completed_at && interview.started_at 
                   ? `${Math.round((new Date(interview.completed_at).getTime() - new Date(interview.started_at).getTime()) / 60000)} min` 
                   : `${Math.round(Number(interview.duration_minutes) || 30)} min`
                 }
               </div>
               <div className="text-xs sm:text-sm text-gray-600">Duration</div>
             </div>
          </div>
        </div>


        {/* Unified Assessment Dashboard */}
        {reportData?.questions && reportData.questions.length > 0 && (
          <div className="rounded-lg p-3 sm:p-6 bg-white border border-gray-200 shadow-sm">
            <h2 className="text-lg sm:text-2xl font-bold mb-4 sm:mb-8 flex items-center break-words text-gray-900">
              <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 mr-2 sm:mr-3 flex-shrink-0" />
              Assessment Dashboard
            </h2>
            
            {/* Parameter Navigation Tabs */}
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
                        onClick={() => setSelectedParameter(paramKey)}
                        className={`p-3 sm:p-6 rounded-xl transition-all duration-200 text-left min-w-0 ${
                          selectedParameter === paramKey
                            ? 'bg-blue-50 text-blue-900 border-2 border-blue-200 shadow-lg transform scale-105'
                            : 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:scale-102 shadow-sm hover:shadow-md'
                        }`}
                      >
                          <div className="space-y-3 sm:space-y-4">
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <h4 className="font-bold text-sm sm:text-lg leading-tight break-words">{param.name}</h4>
                            {param.isPersonal ? (
                              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                                selectedParameter === paramKey
                                  ? 'bg-[#1e5da8]/20 text-[#1e5da8]'
                                  : 'bg-sky-100 text-[#1e5da8] border border-sky-200'
                              }`}>
                                Review Only
                              </div>
                            ) : (
                              <div className={`text-2xl sm:text-3xl font-bold ${
                                selectedParameter === paramKey 
                                  ? 'text-[#1e5da8]'
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
                                      ? 'bg-[#1e5da8]'
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
            <div className="space-y-6">
                      <div className="rounded-xl p-3 sm:p-6 mb-4 sm:mb-6 transition-colors duration-300 bg-gray-50 border border-gray-200 shadow-sm">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 min-w-0">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg sm:text-2xl font-bold text-gray-900 break-words">
                              {parameters[selectedParameter].name}
                            </h3>
                            <p className="text-xs sm:text-lg mt-2 sm:mt-3 leading-relaxed text-gray-600 break-words">
                              {parameters[selectedParameter].isPersonal 
                                ? 'These questions are for review only - no scoring applied'
                                : 'Detailed questions and feedback for this assessment area'
                              }
                            </p>
                          </div>
                          <div className="text-left sm:text-right flex-shrink-0 min-w-0">
                            {parameters[selectedParameter].isPersonal ? (
                              <div className="bg-[#1e5da8] text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-lg font-medium">
                                Review Only
                              </div>
                            ) : (
                              <div className={`text-2xl sm:text-4xl font-bold ${getScoreColor(parameters[selectedParameter].averageScore)}`}>
                                {parameters[selectedParameter].averageScore}/10
                              </div>
                            )}
                            <div className="text-xs sm:text-lg font-medium text-gray-600">
                              {parameters[selectedParameter].questionCount} questions
                            </div>
                          </div>
                        </div>
                      </div>

                      {parameters[selectedParameter].questions.map(({ question, answer }, index) => {
                        const questionId = `${selectedParameter}-${index}`;
                        const isExpanded = expandedQuestions.has(questionId);
                        
                        return (
                          <div key={index} className={`rounded-xl overflow-hidden transition-colors duration-300 ${
                            'bg-white border border-gray-200 shadow-sm'
                          }`}>
                            {/* Question Header - Always Visible */}
                            <div 
                              className="p-3 sm:p-6 cursor-pointer transition-colors hover:bg-gray-50 touch-manipulation"
                              onClick={() => toggleQuestion(questionId)}
                            >
                              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0 min-w-0">
                                <div className="flex items-center gap-2 sm:gap-4 min-w-0 flex-wrap">
                                  <h4 className="text-sm sm:text-xl font-bold text-gray-900">Question {index + 1}</h4>
                                  {parameters[selectedParameter].isPersonal ? (
                                    <div className="bg-[#1e5da8] text-white px-3 py-1 rounded-full text-sm font-medium">
                                      Review Only
                                    </div>
                                  ) : (
                                    <div className={`text-xl sm:text-2xl font-bold ${getScoreColor(answer.score)}`}>
                                      {answer.score}/10
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs sm:text-sm ${
                                    'text-gray-500'
                                  }`}>
                                    {isExpanded ? 'Collapse' : 'Expand'}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className={`h-5 w-5 ${
                                      'text-gray-500'
                                    }`} />
                                  ) : (
                                    <ChevronDown className={`h-5 w-5 ${
                                      'text-gray-500'
                                    }`} />
                                  )}
                                </div>
                              </div>
                              
                              {/* Question Preview - Always Visible */}
                              <div className="mt-3 min-w-0">
                                <p className="text-xs sm:text-sm leading-relaxed text-gray-600 break-words">
                                  {question.question_text.length > 100 
                                    ? `${question.question_text.substring(0, 100)}...` 
                                    : question.question_text
                                  }
                                </p>
                              </div>
                            </div>
                            
                            {/* Expandable Content */}
                            {isExpanded && (
                              <div className="px-3 sm:px-6 pb-3 sm:pb-6 border-t border-gray-200">
                                <div className="pt-3 sm:pt-6 space-y-3 sm:space-y-6">
                                  {/* Full Question */}
                                  <div className="min-w-0">
                                    <h5 className="font-bold mb-2 sm:mb-3 text-base sm:text-lg text-gray-900">Question:</h5>
                                    <p className="text-sm sm:text-lg leading-relaxed text-gray-700 break-words">{question.question_text}</p>
                                  </div>

                                  {/* Answer */}
                                  <div className="min-w-0">
                                    <h5 className="font-bold mb-2 sm:mb-3 text-base sm:text-lg text-gray-900">Answer:</h5>
                                    <p className="text-sm sm:text-lg leading-relaxed text-gray-700 break-words">{answer.transcript || 'No transcript available'}</p>
                                  </div>

                                  {/* Audio/Video Buttons */}
                                  <div className="flex flex-wrap gap-2 sm:gap-4">
                                    {answer.audio_url && (
                                      <button
                                        onClick={() => playAudio(answer.audio_url)}
                                        className="flex items-center justify-center gap-2 min-h-[44px] px-4 py-2 bg-[#1e5da8] hover:bg-[#1e5da8]/90 text-white rounded-lg transition-colors text-sm sm:text-base touch-manipulation"
                                      >
                                        <Download className="h-4 w-4" />
                                        Play Audio
                                      </button>
                                    )}
                                    
                                    {answer.question_video_url && (
                                      <button
                                        onClick={() => playVideo(answer.question_video_url)}
                                        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 sm:px-5 py-2.5 rounded-lg text-sm sm:text-base font-medium transition-colors touch-manipulation bg-[#1e5da8] text-white hover:bg-[#1e5da8]/90"
                                      >
                                        <Download className="h-4 w-4 flex-shrink-0" />
                                        Play Video
                                      </button>
                                    )}

                                    {answer.written_answer && (
                                      <button
                                        onClick={() => showWrittenAnswer(answer.written_answer)}
                                        className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 sm:px-5 py-2.5 rounded-lg text-sm sm:text-base font-medium transition-colors touch-manipulation bg-[#1e5da8] hover:bg-[#1e5da8]/90 text-white"
                                      >
                                        <FileText className="h-4 w-4 flex-shrink-0" />
                                        Show Written Answer
                                      </button>
                                    )}
                                  </div>

                                  {/* AI Feedback - Only for scored parameters */}
                                  {!parameters[selectedParameter].isPersonal && (
                                    answer.feedback ? (
                                      <div className="min-w-0">
                                        <h5 className="font-bold mb-2 sm:mb-3 text-base sm:text-lg text-gray-900">AI Feedback:</h5>
                                        <p className="text-sm sm:text-lg leading-relaxed text-gray-700 break-words">{answer.feedback}</p>
                                      </div>
                                    ) : (
                                      <div className="min-w-0">
                                        <h5 className="font-bold mb-2 sm:mb-3 text-base sm:text-lg text-gray-900">AI Feedback:</h5>
                                        <p className="italic text-sm sm:text-lg text-gray-500 break-words">Feedback analysis pending - will be available soon</p>
                                      </div>
                                    )
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* No Parameter Selected Message */}
                  {!selectedParameter && (
                    <div className="text-center py-8 sm:py-16 text-gray-500 px-2">
                      <BarChart3 className="w-16 h-16 sm:w-20 sm:h-20 mx-auto mb-4 sm:mb-6 opacity-50" />
                      <p className="text-base sm:text-xl font-medium break-words">Select a parameter above to view detailed questions and feedback</p>
                      <p className="text-sm sm:text-lg mt-2 sm:mt-3 leading-relaxed break-words">Each parameter card shows performance metrics and clicking reveals detailed questions, answers, audio, videos, and AI feedback</p>
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
                    className="min-h-[44px] px-4 py-2 rounded-lg bg-[#1e5da8] hover:bg-[#1e5da8]/90 text-white text-sm sm:text-base font-medium transition-colors touch-manipulation flex-1 sm:flex-none"
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
                  <div className="w-16 h-16 sm:w-24 sm:h-24 bg-[#1e5da8] rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
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
