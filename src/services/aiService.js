// AI Service for dynamic question generation
export const aiService = {
  // Generate next question based on previous answers
  async generateNextQuestion(interviewData, previousAnswers, currentQuestionIndex) {
    const response = await fetch('/api/generate-question', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        interviewData,
        previousAnswers,
        currentQuestionIndex,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to generate question');
    }

    const data = await response.json();
    return data.question;
  },

  // Analyze answer and provide feedback
  async analyzeAnswer(answer, question, position) {
    const response = await fetch('/api/analyze-answer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        answer,
        question,
        position,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to analyze answer');
    }

    const data = await response.json();
    return {
      score: data.score,
      feedback: data.feedback,
    };
  }
};
