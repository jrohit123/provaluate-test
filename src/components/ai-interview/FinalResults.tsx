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
  Sun,
  Moon,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';

const FinalResults = () => {
  const { interviewId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [reportData, setReportData] = useState(null);
  const [selectedParameter, setSelectedParameter] = useState(null);
  const [expandedQuestions, setExpandedQuestions] = useState(new Set());
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('finalResultsTheme');
    return saved ? saved === 'dark' : true; // Default to dark mode
  });

  // Theme toggle function
  const toggleTheme = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('finalResultsTheme', newTheme ? 'dark' : 'light');
  };

  // Audio and video playback functions

  const [playingVideo, setPlayingVideo] = useState(null);
  const [playingAudio, setPlayingAudio] = useState(null);

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
      const response = await fetch(`http://localhost:5003/api/get-final-results/${interviewId}`);
      
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
              parameter_name: answer.parameter_name
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
            const questionsResponse = await fetch(`http://localhost:5003/api/get-questions/${interviewId}`);
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
                    parameter_name: answer.parameter_name
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
                    parameter_name: answer.parameter_name
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
                parameter_name: answer.parameter_name
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
                   question_video_url: realVideoUrl
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
      toast.error(error instanceof Error ? error.message : 'Failed to load final results');
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
      reportContent += `ASSESSMENT DATE: ${new Date().toLocaleDateString()}\n`;
      reportContent += `REPORT GENERATED: ${new Date().toLocaleString()}\n\n`;
      
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
      
      toast.success('Comprehensive report downloaded successfully!');
    } catch (error) {
      console.error('Error downloading report:', error);
      toast.error('Failed to download report');
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
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 110, yPosition + 16);
      
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
      doc.text(`Report ID: ${interviewId} | ${new Date().toLocaleString()}`, 105, yPosition + 20, { align: 'center' });
      
      // Save the PDF
      const filename = `Interview_Report_${reportData.interview?.candidate_name || 'Candidate'}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
      toast.success('Professional PDF report downloaded successfully!');
    } catch (error) {
      console.error('Error downloading PDF:', error);
      toast.error('Failed to download PDF. Please try again.');
    }
  };

  // Download as Excel function using ExcelJS for full styling support
  const downloadExcel = async () => {
    if (!reportData) return;

    try {
      // Create workbook with ExcelJS
      const workbook = new ExcelJS.Workbook();
      
      // 1. OVERVIEW SHEET
      const overviewSheet = workbook.addWorksheet('Overview');
      
      
      // Add headers with styling
      const headerRow = overviewSheet.addRow(['FIELD', 'VALUES', 'STATUS']);
      headerRow.font = { bold: true, size: 12 };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      
      // Add data rows
      overviewSheet.addRow(['Candidate Name', reportData.interview?.candidate_name || 'N/A', 'Available']);
      overviewSheet.addRow(['Position Applied', reportData.interview?.position || 'N/A', 'Available']);
      
      // Use the same overall score that the UI displays
      const overallScore = reportData.interview?.overall_score;
      const displayScore = overallScore ? parseFloat(overallScore).toFixed(1) : 'N/A';
      
      overviewSheet.addRow(['Overall Score', displayScore, 'Available']);
      overviewSheet.addRow(['Total Questions', reportData.questions?.length || 0, 'Available']);
      // Remove Interview Type row - not needed
      overviewSheet.addRow(['Assessment Date', new Date().toLocaleDateString(), 'Available']);
      overviewSheet.addRow(['Report Generated', new Date().toLocaleTimeString(), 'Available']);
      overviewSheet.addRow(['Performance Level', getScoreLabel(reportData.interview?.overall_score || 0), 'Available']);
      overviewSheet.addRow(['Audio Files', reportData.answers?.filter(a => a.audio_url).length || 0, 'Available']);
      overviewSheet.addRow(['Video Files', reportData.answers?.filter(a => a.question_video_url).length || 0, 'Available']);
      
      // 2. PARAMETERS SHEET
      if (reportData.parameters && reportData.parameters.length > 0) {
        const parameterSheet = workbook.addWorksheet('Parameters');
        
        
        // Add headers with styling
        const paramHeaderRow = parameterSheet.addRow(['PARAMETER NAME', 'SCORE', 'QUESTIONS', 'WEIGHT', 'PERFORMANCE']);
        paramHeaderRow.font = { bold: true, size: 12 };
        paramHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Calculate actual question counts for each parameter
        const parameterQuestionCounts = {};
        if (reportData.questions) {
          reportData.questions.forEach(question => {
            const paramKey = question.parameter_key || question.parameter_name;
            if (paramKey) {
              parameterQuestionCounts[paramKey] = (parameterQuestionCounts[paramKey] || 0) + 1;
            }
          });
        }
        
        // Add data rows
        reportData.parameters.forEach((param) => {
          const paramName = param.name || param.parameter_name || 'Unknown Parameter';
          const score = param.score || param.averageScore || 'N/A';
          const paramKey = param.key || param.parameter_key || param.parameter_name;
          const questionCount = parameterQuestionCounts[paramKey] || 0;
          const weight = param.weight ? param.weight : 'N/A';
          
          let performance = 'Needs Improvement';
          if (score >= 8) performance = 'Excellent';
          else if (score >= 6) performance = 'Good';
          else if (score >= 4) performance = 'Fair';
          
          parameterSheet.addRow([paramName, score, questionCount, weight, performance]);
        });
      }
      
      // 3. QUESTIONS & ANSWERS SHEET
      if (reportData.questions && reportData.answers) {
        const qaSheet = workbook.addWorksheet('Questions & Answers');
        
        // Add headers with styling
        const qaHeaderRow = qaSheet.addRow(['Q', 'PARAMETER', 'QUESTION', 'ANSWER', 'SCORE', 'AI FEEDBACK']);
        qaHeaderRow.font = { bold: true, size: 12 };
        qaHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Add data rows - match questions with answers properly using question_order
        // Sort questions by question_order to ensure proper order
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
              const score = answer.score || 'N/A';
              const feedback = answer.feedback || 'No feedback available';
              
              qaSheet.addRow([questionOrder + 1, parameter, questionText, transcript, score, feedback]);
            } else {
              // Handle case where answer is missing but question exists
              qaSheet.addRow([questionOrder + 1, parameter, questionText, 'No answer recorded', 'N/A', 'No feedback available']);
            }
          }
        });
      }
      
      // 4. MEDIA FILES SHEET
      const mediaSheet = workbook.addWorksheet('Media Files');
      
      // Add headers with styling
      const mediaHeaderRow = mediaSheet.addRow(['MEDIA TYPE', 'QUESTION', 'PARAMETER', 'URL', 'STATUS', 'FILE TYPE']);
      mediaHeaderRow.font = { bold: true, size: 12 };
      mediaHeaderRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE0E0E0' }
      };
      
      // Add data rows - Group all audio files first, then all video files
      if (reportData.answers) {
        // Sort answers by question_order to ensure proper order
        const sortedAnswers = [...reportData.answers].sort((a, b) => (a.question_order || 0) - (b.question_order || 0));
        
        // First, add all audio files using question_order matching
        sortedAnswers.forEach((answer) => {
          const questionOrder = answer.question_order || 0;
          const question = reportData.questions?.find(q => (q.question_order || 0) === questionOrder);
          const parameter = question?.parameter_name || question?.parameter_key || 'N/A';
          
          // Only add if we have a valid parameter and audio URL
          if (answer.audio_url && parameter !== 'N/A') {
            mediaSheet.addRow(['Audio Recording', questionOrder + 1, parameter, answer.audio_url, 'Available', 'Audio']);
          }
        });
        
        // Then, add all video files using question_order matching
        sortedAnswers.forEach((answer) => {
          const questionOrder = answer.question_order || 0;
          const question = reportData.questions?.find(q => (q.question_order || 0) === questionOrder);
          const parameter = question?.parameter_name || question?.parameter_key || 'N/A';
          
          // Only add if we have a valid parameter and video URL
          if (answer.question_video_url && parameter !== 'N/A') {
            mediaSheet.addRow(['Question Video', questionOrder + 1, parameter, answer.question_video_url, 'Available', 'Video']);
          }
        });
      }
      
      // 5. SCORE ANALYSIS SHEET
      if (reportData.answers && reportData.answers.length > 0) {
        const analysisSheet = workbook.addWorksheet('Score Analysis');
        
        // Add headers with styling
        const analysisHeaderRow = analysisSheet.addRow(['Q', 'PARAMETER', 'SCORE', 'PERFORMANCE', 'NOTES']);
        analysisHeaderRow.font = { bold: true, size: 12 };
        analysisHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Use the same overall score that's displayed in the Overview sheet
        const overallScore = reportData.interview?.overall_score;
        const averageScore = overallScore ? parseFloat(overallScore) : 0;
        
        // Add data rows - only for valid questions using question_order matching
        // Sort answers by question_order to ensure proper order
        const sortedAnswers = [...reportData.answers].sort((a, b) => (a.question_order || 0) - (b.question_order || 0));
        
        sortedAnswers.forEach((answer) => {
          const questionOrder = answer.question_order || 0;
          const question = reportData.questions?.find(q => (q.question_order || 0) === questionOrder);
          const parameter = question?.parameter_name || question?.parameter_key || 'N/A';
          const score = answer.score || 0;
          
          // Only add if we have a valid parameter (not N/A)
          if (parameter !== 'N/A') {
            let performance = 'Needs Improvement';
            if (score >= 8) performance = 'Excellent';
            else if (score >= 6) performance = 'Good';
            else if (score >= 4) performance = 'Fair';
            
            const notes = score >= 8 ? 'Strong performance' : 
                         score >= 6 ? 'Good performance' : 
                         score >= 4 ? 'Room for improvement' : 'Needs significant improvement';
            
            analysisSheet.addRow([questionOrder + 1, parameter, score, performance, notes]);
          }
        });
        
        // Add summary row with consistent formatting
        const displayAverage = averageScore ? parseFloat(averageScore.toString()).toFixed(1) : 'N/A';
        analysisSheet.addRow(['', 'AVERAGE', displayAverage, '', '']);
      }
      
      // Auto-size columns for all sheets
      workbook.worksheets.forEach(worksheet => {
        worksheet.columns.forEach(column => {
          let maxLength = 0;
          column.eachCell({ includeEmpty: true }, (cell) => {
            const columnLength = cell.value ? cell.value.toString().length : 10;
            if (columnLength > maxLength) {
              maxLength = columnLength;
            }
          });
          column.width = Math.min(maxLength + 2, 50);
        });
      });
      
      // Save the Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Interview_Report_${reportData.interview?.candidate_name || 'Candidate'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Comprehensive Excel report downloaded successfully!');
    } catch (error) {
      console.error('Error downloading Excel:', error);
      toast.error('Failed to download Excel. Please try again.');
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
      toast.success('Report URL copied to clipboard');
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return isDarkMode ? 'text-green-400' : 'text-green-600';
    if (score >= 6) return isDarkMode ? 'text-yellow-400' : 'text-yellow-600';
    if (score >= 4) return isDarkMode ? 'text-orange-400' : 'text-red-400';
    return isDarkMode ? 'text-red-400' : 'text-red-400';
  };

  const getScoreLabel = (score) => {
    if (score >= 8) return 'Excellent';
    if (score >= 6) return 'Good';
    if (score >= 4) return 'Fair';
    return 'Needs Improvement';
  };

  const getScoreClass = (score) => {
    if (score >= 8) return isDarkMode ? 'bg-green-500' : 'bg-green-600';
    if (score >= 6) return isDarkMode ? 'bg-yellow-500' : 'bg-yellow-600';
    if (score >= 4) return isDarkMode ? 'bg-orange-500' : 'bg-red-400';
    return isDarkMode ? 'bg-red-500' : 'bg-red-500';
  };

  if (loading) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className={`mt-4 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>Loading final results...</p>
        </div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className={`min-h-screen flex items-center justify-center transition-colors duration-300 ${
        isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
      }`}>
        <div className="text-center">
          <XCircle className={`h-12 w-12 mx-auto mb-4 ${
            isDarkMode ? 'text-red-500' : 'text-red-400'
          }`} />
          <h2 className={`text-xl font-semibold mb-2 ${
            isDarkMode ? 'text-white' : 'text-gray-900'
          }`}>Results Not Found</h2>
          <p className={`mb-4 ${
            isDarkMode ? 'text-gray-300' : 'text-gray-600'
          }`}>The interview results could not be loaded.</p>
          <button
            onClick={() => navigate('/dashboard', { state: { activeSection: 'interview-dashboard' } })}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Go to Dashboard
          </button>
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
          logoImg.src = '/assets/Logo-transparent_bg.png';
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
      doc.text(`Interview Date: ${new Date(interview.created_at).toLocaleDateString()}`, 20, 73);

      // Add name image beside candidate info
      try {
        await new Promise<boolean>((resolve) => {
          const nameImg = new Image();
          nameImg.crossOrigin = 'anonymous';
          nameImg.onload = () => {
            try {
              // Position name image beside candidate info (on the right side of the page)
              const pageWidth = doc.internal.pageSize.getWidth();
              const nameWidth = 35;
              const nameHeight = 25;
              const nameX = pageWidth - nameWidth - 40; // Right side with 40pt margin (closer to left)
              const nameY = 38; // Align with candidate info
              
              doc.addImage(nameImg, 'JPEG', nameX, nameY, nameWidth, nameHeight);
              resolve(true);
            } catch (error) {
              console.log('Error adding name image to PDF:', error);
              resolve(false);
            }
          };
          nameImg.onerror = () => {
            console.log('Name image failed to load');
            resolve(false);
          };
          nameImg.src = '/assets/NAME.jpg';
        });
      } catch (error) {
        console.log('Name image not found, continuing without name image');
      }
      
      // Prepare table data
      const tableData: any[][] = [];
      
      // Debug logging
      console.log('🔍 PDF Generation Debug:');
      console.log('🔍 Parameters object:', parameters);
      console.log('🔍 Parameters keys:', Object.keys(parameters || {}));
      console.log('🔍 Interview data:', interview);
      console.log('🔍 Parameter scores:', interview.parameter_scores);
      
      // Check if we have parameters data (from our converted structure)
      if (parameters && Object.keys(parameters).length > 0) {
        // Iterate through each parameter
        Object.entries(parameters).forEach(([paramKey, paramData]: [string, any]) => {
          // Process each question and answer for this parameter
          if (paramData.questions && Array.isArray(paramData.questions)) {
            paramData.questions.forEach((questionData: any) => {
              // Format feedback with bullet points
              const formatFeedback = (feedback: string) => {
                if (!feedback) return 'No feedback available';
                
                // Split by periods and create bullet points
                const sentences = feedback.split('.').filter(sentence => sentence.trim().length > 0);
                return sentences.map(sentence => `• ${sentence.trim()}`).join('\n');
              };
              
              const rowData = [
                paramData.name || paramKey,
                questionData.question.question_text || 'N/A',
                questionData.answer.transcript || 'No answer provided',
                formatFeedback(questionData.answer.feedback),
                questionData.answer.score || 'N/A'
              ];
              console.log('🔍 Adding row to PDF table:', rowData);
              tableData.push(rowData);
            });
          }
        });
      }
      // Fallback: Check if we have parameter_scores data (from interview_parameter_scores table)
      else if (interview.parameter_scores) {
        // Parse parameter_scores JSON data
        const parameterScores = typeof interview.parameter_scores === 'string' 
          ? JSON.parse(interview.parameter_scores) 
          : interview.parameter_scores;
        
        // Iterate through each parameter
        Object.entries(parameterScores).forEach(([paramKey, paramData]: [string, any]) => {
          const individualScores = paramData.individual_question_scores || [];
          
          // Process each question and answer for this parameter
          individualScores.forEach((questionData: any) => {
            // Format feedback with bullet points
            const formatFeedback = (feedback: string) => {
              if (!feedback) return 'No feedback available';
              
              // Split by periods and create bullet points
              const sentences = feedback.split('.').filter(sentence => sentence.trim().length > 0);
              return sentences.map(sentence => `• ${sentence.trim()}`).join('\n');
            };
            
            tableData.push([
              paramData.parameter_name || paramKey,
              questionData.question_text || 'N/A',
              questionData.transcript || 'No answer provided',
              formatFeedback(questionData.feedback),
              questionData.score || 'N/A'
            ]);
          });
        });
      } else {
        // Fallback: Use questions and answers arrays directly from API (for terminated/incomplete interviews)
        if (reportData.questions && reportData.answers && reportData.questions.length > 0) {
          console.log('🔍 Using questions and answers arrays for PDF (terminated/incomplete interview)');
          
          // Sort by question_order to ensure proper ordering
          const sortedQuestions = [...reportData.questions].sort((a, b) => (a.question_order || 0) - (b.question_order || 0));
          const sortedAnswers = [...reportData.answers].sort((a, b) => (a.question_order || 0) - (b.question_order || 0));
          
          sortedQuestions.forEach((question: any) => {
            const answer = sortedAnswers.find((ans: any) => 
              (ans.question_order || 0) === (question.question_order || 0)
            );
            
            if (answer) {
              // Format feedback with bullet points
              const formatFeedback = (feedback: string) => {
                if (!feedback) return 'No feedback available';
                
                // Split by periods and create bullet points
                const sentences = feedback.split('.').filter(sentence => sentence.trim().length > 0);
                return sentences.map(sentence => `• ${sentence.trim()}`).join('\n');
              };
              
              tableData.push([
                question.parameter_name || question.parameter_key || 'General',
                question.question_text || `Question ${(question.question_order || 0) + 1}`,
                answer.transcript || 'No answer provided',
                formatFeedback(answer.feedback || 'Assessment pending'),
                answer.score || 'N/A'
              ]);
            }
          });
        } else {
          // Fallback to old data structure if parameter_scores doesn't exist
          Object.entries(parameters).forEach(([paramKey, paramData]: [string, any]) => {
            const questions = paramData.questions || [];
            const answers = paramData.answers || [];
            
            if (questions.length > 0) {
              questions.forEach((question: any, questionIndex: number) => {
                const answer = answers.find((ans: any) => 
                  ans.question_order === question.question_order || 
                  answers.indexOf(ans) === questionIndex
                ) || answers[questionIndex] || {};
                
                tableData.push([
                  paramData.name || paramKey,
                  question.question_text || 'N/A',
                  answer.transcript || 'No answer provided',
                  answer.feedback || 'No feedback available',
                  answer.score || answer.parameter_score || 'N/A'
                ]);
              });
            } else {
              const parameterAnswer = answers[0] || {};
              tableData.push([
                paramData.name || paramKey,
                'Parameter-based assessment',
                parameterAnswer.transcript || 'No answer provided',
                parameterAnswer.feedback || paramData.feedback || 'No feedback available',
                parameterAnswer.score || parameterAnswer.parameter_score || paramData.score || 'N/A'
              ]);
            }
          });
        }
      }
      
      // Add table with proper column widths
      autoTable(doc, {
        head: [['Parameter', 'Questions', 'Answers', 'AI Feedback', 'Scores']],
        body: tableData,
        startY: 85,
        styles: {
          fontSize: 7,
          cellPadding: 2,
          overflow: 'linebreak',
          halign: 'left'
        },
        headStyles: {
          fillColor: [59, 130, 246], // Blue color
          textColor: 255,
          fontStyle: 'bold',
          fontSize: 8
        },
        columnStyles: {
          0: { cellWidth: 30 }, // Parameter - larger
          1: { cellWidth: 40 }, // Questions - larger
          2: { cellWidth: 40 }, // Answers - larger
          3: { cellWidth: 40 }, // AI Feedback - larger
          4: { cellWidth: 18 }  // Scores - larger
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
        toast.success('PDF report downloaded successfully!');
      }, 500);
      
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('Failed to generate PDF report');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className={`min-h-screen w-full h-full transition-colors duration-300 ${
      isDarkMode 
        ? 'bg-gray-900 text-white' 
        : 'bg-gray-50 text-gray-900'
    }`}>
      {/* Header */}
      <div className={`w-full transition-colors duration-300 ${
        isDarkMode ? 'bg-gray-800' : 'bg-white border-b border-gray-200'
      }`}>
        <div className="py-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/dashboard', { state: { activeSection: 'interview-dashboard' } })}
                className={`flex items-center space-x-2 transition-colors ${
                  isDarkMode 
                    ? 'text-gray-300 hover:text-white' 
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <ArrowLeft className="h-5 w-5" />
                <span>Back to Dashboard</span>
              </button>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={toggleTheme}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                }`}
                title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {isDarkMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span>{isDarkMode ? 'Light' : 'Dark'}</span>
              </button>
              <button
                onClick={generatePDFReport}
                disabled={isGeneratingPDF}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'bg-red-600 hover:bg-red-700 text-white' 
                    : 'bg-red-50 hover:bg-red-100 text-red-700 border border-red-200'
                } ${isGeneratingPDF ? 'opacity-50 cursor-not-allowed' : ''}`}
                title="Download comprehensive PDF report with all questions, answers, scores, feedback, and media files"
              >
                {isGeneratingPDF ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating PDF...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    <span>Download PDF Report</span>
                  </>
                )}
              </button>

              <button
                onClick={downloadExcel}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200'
                }`}
                title="Download comprehensive Excel report with multiple sheets including overview, parameters, questions, answers, media files, and score analysis"
              >
                <FileSpreadsheet className="h-4 w-4" />
                <span>Excel Report</span>
              </button>
              <button
                onClick={shareReport}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 hover:bg-gray-600 text-white' 
                    : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border border-gray-200'
                }`}
              >
                <Share2 className="h-4 w-4" />
                <span>Share</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="py-8 px-4 w-full">
        {/* Interview Overview */}
        <div className={`rounded-lg p-6 mb-8 transition-colors duration-300 ${
          isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'
        }`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="text-center">
              <div className={`text-3xl font-bold ${
                isDarkMode ? 'text-blue-400' : 'text-blue-600'
              }`}>{interview?.overall_score?.toFixed(1) || 'N/A'}/10</div>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Overall Score</div>
              <div className={`text-xs mt-1 px-2 py-1 rounded-full text-white ${getScoreClass(interview?.overall_score || 0)}`}>
                {getScoreLabel(interview?.overall_score || 0)} Performance
              </div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${
                isDarkMode ? 'text-green-400' : 'text-green-600'
              }`}>{parameterCount}</div>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Parameters Assessed</div>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-bold ${
                isDarkMode ? 'text-yellow-400' : 'text-yellow-600'
              }`}>{interview?.total_questions || 0}</div>
              <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Total Questions</div>
            </div>
             <div className="text-center">
               <div className={`text-3xl font-bold ${
                 isDarkMode ? 'text-purple-400' : 'text-purple-600'
               }`}>
                 {interview.completed_at && interview.started_at 
                   ? `${Math.round((new Date(interview.completed_at).getTime() - new Date(interview.started_at).getTime()) / 60000)} min` 
                   : `${interview.duration_minutes || 30} min`
                 }
               </div>
               <div className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>Duration</div>
             </div>
          </div>
        </div>


        {/* Unified Assessment Dashboard */}
        {reportData?.questions && reportData.questions.length > 0 && (
          <div className={`rounded-lg p-6 transition-colors duration-300 ${
            isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'
          }`}>
            <h2 className={`text-2xl font-bold mb-8 flex items-center ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>
              <BarChart3 className="h-6 w-6 mr-3" />
              Assessment Dashboard
            </h2>
            
            {/* Parameter Navigation Tabs */}
            {(() => {
              // Safety check - ensure data exists
              if (!reportData.questions || !reportData.answers) {
                return (
                  <div className={`text-center py-12 ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
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
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {Object.entries(parameters).map(([paramKey, param]: [string, any]) => (
                      <button
                        key={paramKey}
                        onClick={() => setSelectedParameter(paramKey)}
                        className={`p-6 rounded-xl transition-all duration-200 text-left ${
                          selectedParameter === paramKey
                            ? isDarkMode 
                              ? 'bg-blue-600 text-white shadow-lg transform scale-105'
                              : 'bg-blue-50 text-blue-900 border-2 border-blue-200 shadow-lg transform scale-105'
                            : isDarkMode 
                              ? 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white hover:scale-102'
                              : 'bg-white text-gray-800 border border-gray-200 hover:bg-gray-50 hover:text-gray-900 hover:scale-102 shadow-sm hover:shadow-md'
                        }`}
                      >
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <h4 className="font-bold text-lg leading-tight">{param.name}</h4>
                            {param.isPersonal ? (
                              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                                selectedParameter === paramKey && !isDarkMode
                                  ? 'bg-blue-200 text-blue-800'
                                  : isDarkMode
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-blue-100 text-blue-700 border border-blue-200'
                              }`}>
                                Review Only
                              </div>
                            ) : (
                              <div className={`text-3xl font-bold ${
                                selectedParameter === paramKey 
                                  ? isDarkMode ? 'text-white' : 'text-blue-700'
                                  : getScoreColor(param.averageScore)
                              }`}>
                                {param.averageScore}/10
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-3">
                            <div className="flex justify-between text-lg font-medium opacity-90">
                              {param.isPersonal ? (
                                <span>No scoring applied</span>
                              ) : (
                                <span>Weight: {(() => {
                                  // Calculate weight based on question count relative to total (excluding personal questions)
                                  const technicalQuestions = Object.values(parameters).reduce((sum: number, p: any) => 
                                    p.isPersonal ? sum : sum + (p.questionCount as number), 0) as number;
                                  const weight = technicalQuestions > 0 ? Math.round(((param.questionCount as number) / technicalQuestions) * 100) : 0;
                                  return weight;
                                })()}%</span>
                              )}
                              <span>{param.questionCount} questions</span>
                            </div>
                            
                            {/* Performance Bar - Only for scored parameters */}
                            {!param.isPersonal ? (
                              <div className={`w-full rounded-full h-3 ${
                                isDarkMode ? 'bg-gray-600' : 'bg-gray-300'
                              }`}>
                                <div 
                                  className={`h-3 rounded-full transition-all duration-300 ${
                                    selectedParameter === paramKey 
                                      ? isDarkMode ? 'bg-white' : 'bg-blue-600'
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
                      <div className={`rounded-xl p-6 mb-6 transition-colors duration-300 ${
                        isDarkMode ? 'bg-gray-700' : 'bg-gray-50 border border-gray-200 shadow-sm'
                      }`}>
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className={`text-2xl font-bold ${
                              isDarkMode ? 'text-white' : 'text-gray-900'
                            }`}>
                              {parameters[selectedParameter].name}
                            </h3>
                            <p className={`text-lg mt-3 leading-relaxed ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-600'
                            }`}>
                              {parameters[selectedParameter].isPersonal 
                                ? 'These questions are for review only - no scoring applied'
                                : 'Detailed questions and feedback for this assessment area'
                              }
                            </p>
                          </div>
                          <div className="text-right">
                            {parameters[selectedParameter].isPersonal ? (
                              <div className="bg-blue-600 text-white px-4 py-2 rounded-full text-lg font-medium">
                                Review Only
                              </div>
                            ) : (
                              <div className={`text-4xl font-bold ${getScoreColor(parameters[selectedParameter].averageScore)}`}>
                                {parameters[selectedParameter].averageScore}/10
                              </div>
                            )}
                            <div className={`text-lg font-medium ${
                              isDarkMode ? 'text-gray-300' : 'text-gray-600'
                            }`}>
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
                            isDarkMode ? 'bg-gray-700' : 'bg-white border border-gray-200 shadow-sm'
                          }`}>
                            {/* Question Header - Always Visible */}
                            <div 
                              className={`p-6 cursor-pointer transition-colors ${
                                isDarkMode ? 'hover:bg-gray-600' : 'hover:bg-gray-50'
                              }`}
                              onClick={() => toggleQuestion(questionId)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                  <h4 className={`text-xl font-bold ${
                                    isDarkMode ? 'text-white' : 'text-gray-900'
                                  }`}>Question {index + 1}</h4>
                                  {parameters[selectedParameter].isPersonal ? (
                                    <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                                      Review Only
                                    </div>
                                  ) : (
                                    <div className={`text-2xl font-bold ${getScoreColor(answer.score)}`}>
                                      {answer.score}/10
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm ${
                                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                  }`}>
                                    {isExpanded ? 'Click to collapse' : 'Click to expand'}
                                  </span>
                                  {isExpanded ? (
                                    <ChevronUp className={`h-5 w-5 ${
                                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                    }`} />
                                  ) : (
                                    <ChevronDown className={`h-5 w-5 ${
                                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                    }`} />
                                  )}
                                </div>
                              </div>
                              
                              {/* Question Preview - Always Visible */}
                              <div className="mt-3">
                                <p className={`text-sm leading-relaxed ${
                                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                                }`}>
                                  {question.question_text.length > 100 
                                    ? `${question.question_text.substring(0, 100)}...` 
                                    : question.question_text
                                  }
                                </p>
                              </div>
                            </div>
                            
                            {/* Expandable Content */}
                            {isExpanded && (
                              <div className={`px-6 pb-6 border-t ${
                                isDarkMode ? 'border-gray-600' : 'border-gray-200'
                              }`}>
                                <div className="pt-6 space-y-6">
                                  {/* Full Question */}
                                  <div>
                                    <h5 className={`font-bold mb-3 text-lg ${
                                      isDarkMode ? 'text-white' : 'text-gray-900'
                                    }`}>Question:</h5>
                                    <p className={`text-lg leading-relaxed ${
                                      isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                    }`}>{question.question_text}</p>
                                  </div>

                                  {/* Answer */}
                                  <div>
                                    <h5 className={`font-bold mb-3 text-lg ${
                                      isDarkMode ? 'text-white' : 'text-gray-900'
                                    }`}>Answer:</h5>
                                    <p className={`text-lg leading-relaxed ${
                                      isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                    }`}>{answer.transcript || 'No transcript available'}</p>
                                  </div>

                                  {/* Audio/Video Buttons */}
                                  <div className="flex gap-4">
                                    {answer.audio_url && (
                                      <button
                                        onClick={() => playAudio(answer.audio_url)}
                                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                                      >
                                        <Download className="h-4 w-4" />
                                        Play Audio
                                      </button>
                                    )}
                                    
                                    {answer.question_video_url && (
                                      <button
                                        onClick={() => playVideo(answer.question_video_url)}
                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                                      >
                                        <Download className="h-4 w-4" />
                                        Play Video
                                      </button>
                                    )}
                                  </div>

                                  {/* AI Feedback - Only for scored parameters */}
                                  {!parameters[selectedParameter].isPersonal && (
                                    answer.feedback ? (
                                      <div>
                                        <h5 className={`font-bold mb-3 text-lg ${
                                          isDarkMode ? 'text-white' : 'text-gray-900'
                                        }`}>AI Feedback:</h5>
                                        <p className={`text-lg leading-relaxed ${
                                          isDarkMode ? 'text-gray-200' : 'text-gray-700'
                                        }`}>{answer.feedback}</p>
                                      </div>
                                    ) : (
                                      <div>
                                        <h5 className={`font-bold mb-3 text-lg ${
                                          isDarkMode ? 'text-white' : 'text-gray-900'
                                        }`}>AI Feedback:</h5>
                                        <p className={`italic text-lg ${
                                          isDarkMode ? 'text-gray-400' : 'text-gray-500'
                                        }`}>Feedback analysis pending - will be available soon</p>
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
                    <div className={`text-center py-16 ${
                      isDarkMode ? 'text-gray-400' : 'text-gray-500'
                    }`}>
                      <BarChart3 className="w-20 h-20 mx-auto mb-6 opacity-50" />
                      <p className="text-xl font-medium">Select a parameter above to view detailed questions and feedback</p>
                      <p className="text-lg mt-3 leading-relaxed">Each parameter card shows performance metrics and clicking reveals detailed questions, answers, audio, videos, and AI feedback</p>
                      </div>
                    )}
                  </div>
                );
            })()}
          </div>
        )}

                 

        {/* Complete Session Video */}
        {reportData.interview?.session_video_url && (
          <div className={`rounded-lg p-6 mb-6 transition-colors duration-300 ${
            isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200 shadow-sm'
          }`}>
            <h3 className={`text-xl font-semibold mb-4 ${
              isDarkMode ? 'text-white' : 'text-gray-900'
            }`}>Complete Session Video</h3>
            <div className={`rounded-lg p-4 transition-colors duration-300 ${
              isDarkMode ? 'bg-gray-700' : 'bg-gray-50 border border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className={`font-medium ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>🎥 Full Interview Session</h4>
                  <p className={`text-sm ${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    Complete video recording from start to finish
                  </p>
                  <p className={`text-sm ${
                    isDarkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Size: {reportData.interview.session_video_size ? `${(reportData.interview.session_video_size / 1024 / 1024).toFixed(1)} MB` : 'Unknown'} | Format: WebM
                  </p>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => playVideo(reportData.interview.session_video_url)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded transition-colors"
                  >
                    Play Full Video
                  </button>
                  <a
                    href={reportData.interview.session_video_url}
                    download
                    className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded transition-colors"
                  >
                    Download Video
                  </a>
                </div>
              </div>
              <div className={`rounded p-3 transition-colors duration-300 ${
                isDarkMode ? 'bg-gray-600' : 'bg-gray-100 border border-gray-300'
              }`}>
                <h5 className={`font-medium mb-2 ${
                  isDarkMode ? 'text-white' : 'text-gray-900'
                }`}>📹 This video contains the complete interview session including:</h5>
                <ul className={`text-sm space-y-1 ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                }`}>
                  <li>• Candidate's facial expressions and body language</li>
                  <li>• Complete audio from all questions</li>
                  <li>• Full session duration: {reportData.interview.duration_minutes || 30} minutes</li>
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
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden transition-colors duration-300 ${
            isDarkMode ? 'bg-gray-800' : 'bg-white shadow-xl'
          }`}>
            <div className="flex items-center justify-between p-4">
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>Question Video Player</h3>
              <button
                onClick={closeVideo}
                className={`transition-colors ${
                  isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-4">
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
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
          <div className={`rounded-lg max-w-2xl w-full max-h-[90vh] overflow-hidden transition-colors duration-300 ${
            isDarkMode ? 'bg-gray-800' : 'bg-white shadow-xl'
          }`}>
            <div className="flex items-center justify-between p-4">
              <h3 className={`text-lg font-semibold ${
                isDarkMode ? 'text-white' : 'text-gray-900'
              }`}>Question Audio Player</h3>
              <button
                onClick={closeAudio}
                className={`transition-colors ${
                  isDarkMode ? 'text-gray-400 hover:text-white' : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                <XCircle className="h-6 w-6" />
              </button>
            </div>
            <div className="p-6">
              <div className={`rounded-lg p-6 text-center transition-colors duration-300 ${
                isDarkMode ? 'bg-gray-700' : 'bg-gray-50 border border-gray-200'
              }`}>
                <div className="mb-6">
                  <div className="w-24 h-24 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Download className="h-12 w-12 text-white" />
                  </div>
                  <h4 className={`text-xl font-semibold mb-2 ${
                    isDarkMode ? 'text-white' : 'text-gray-900'
                  }`}>Audio Recording</h4>
                  <p className={`${
                    isDarkMode ? 'text-gray-300' : 'text-gray-600'
                  }`}>Question answer audio playback</p>
                </div>
                <audio
                  controls
                  autoPlay
                  className="w-full max-w-md mx-auto"
                  src={playingAudio}
                >
                  Your browser does not support the audio element.
                </audio>
                <div className={`mt-4 text-sm ${
                  isDarkMode ? 'text-gray-400' : 'text-gray-500'
                }`}>
                  Use the controls above to play, pause, and seek through the audio
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
