import React, { useState } from 'react';
import { toast } from 'react-hot-toast';
import { Plus, X, Save, Trash2, FileText } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface StructuredQuestion {
  id: string;
  question: string;
  expectedAnswer: string;
  timeLimit: number; // in minutes
  difficulty: 'Easy' | 'Regular' | 'Expert';
  category: string;
  scoringCriteria: string[];
}

interface StructuredInterviewSetupProps {
  position: string;
  existingQuestions?: StructuredQuestion[];
  onSave: (questions: StructuredQuestion[], duration: number) => void;
}

const StructuredInterviewSetup: React.FC<StructuredInterviewSetupProps> = ({ 
  position, 
  existingQuestions = [],
  onSave 
}) => {
  const [questions, setQuestions] = useState<StructuredQuestion[]>(existingQuestions);
  const [isSaving, setIsSaving] = useState(false);

  const addQuestion = () => {
    const newQuestion: StructuredQuestion = {
      id: `q_${Date.now()}`,
      question: '',
      expectedAnswer: '',
      timeLimit: 3,
      difficulty: 'Regular',
      category: '',
      scoringCriteria: ['', '', '']
    };
    setQuestions(prev => [...prev, newQuestion]);
  };

  const updateQuestion = (id: string, field: keyof StructuredQuestion, value: string | number | string[]) => {
    setQuestions(prev => 
      prev.map(q => 
        q.id === id 
          ? { ...q, [field]: value }
          : q
      )
    );
  };

  const deleteQuestion = (id: string) => {
    setQuestions(prev => prev.filter(q => q.id !== id));
  };

  const addScoringCriteria = (questionId: string) => {
    setQuestions(prev => 
      prev.map(q => 
        q.id === questionId 
          ? { ...q, scoringCriteria: [...q.scoringCriteria, ''] }
          : q
      )
    );
  };

  const updateScoringCriteria = (questionId: string, index: number, value: string) => {
    setQuestions(prev => 
      prev.map(q => 
        q.id === questionId 
          ? { 
              ...q, 
              scoringCriteria: q.scoringCriteria.map((criteria, i) => 
                i === index ? value : criteria
              )
            }
          : q
      )
    );
  };

  const removeScoringCriteria = (questionId: string, index: number) => {
    setQuestions(prev => 
      prev.map(q => 
        q.id === questionId 
          ? { 
              ...q, 
              scoringCriteria: q.scoringCriteria.filter((_, i) => i !== index)
            }
          : q
      )
    );
  };

  const calculateTotalDuration = () => {
    return questions.reduce((total, q) => total + q.timeLimit, 0);
  };

  const handleSave = async () => {
    if (questions.length === 0) {
      toast.error('Please add at least one question');
      return;
    }

    // Validate all questions
    for (const q of questions) {
      if (!q.question.trim()) {
        toast.error('All questions must have content');
        return;
      }
      if (!q.category.trim()) {
        toast.error('All questions must have a category');
        return;
      }
    }

    setIsSaving(true);
    try {
      const totalDuration = calculateTotalDuration();
      await onSave(questions, totalDuration);
      toast.success('Structured interview questions saved successfully!');
    } catch (error) {
      toast.error('Failed to save structured interview questions');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Structured Interview Questions for {position}
          </h3>
          <p className="text-sm text-gray-600">
            Create custom questions and define expected answers for your interview
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={addQuestion}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Question
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving || questions.length === 0}
            className="flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Questions
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Interview Summary */}
      {questions.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-blue-50 rounded-lg p-3 border border-blue-200">
                <div className="text-blue-600 font-medium">Total Questions</div>
                <div className="text-2xl font-bold text-blue-800">{questions.length}</div>
                <div className="text-xs text-blue-600">Custom questions</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 border border-green-200">
                <div className="text-green-600 font-medium">Total Duration</div>
                <div className="text-2xl font-bold text-green-800">{calculateTotalDuration()} min</div>
                <div className="text-xs text-green-600">Sum of all time limits</div>
              </div>
              <div className="bg-purple-50 rounded-lg p-3 border border-purple-200">
                <div className="text-purple-600 font-medium">Categories</div>
                <div className="text-2xl font-bold text-purple-800">
                  {new Set(questions.map(q => q.category).filter(Boolean)).size}
                </div>
                <div className="text-xs text-purple-600">Unique categories</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Questions List */}
      {questions.length > 0 ? (
        <div className="space-y-4">
          {questions.map((question, index) => (
            <Card key={question.id} className="bg-gray-50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="text-lg font-semibold text-gray-900">
                      Question {index + 1}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteQuestion(question.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="space-y-4">
                  {/* Question Content */}
                  <div className="space-y-2">
                    <Label>Question *</Label>
                    <Textarea
                      value={question.question}
                      onChange={(e) => updateQuestion(question.id, 'question', e.target.value)}
                      placeholder="Enter your interview question here..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {/* Question Configuration */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Category *</Label>
                      <Input
                        value={question.category}
                        onChange={(e) => updateQuestion(question.id, 'category', e.target.value)}
                        placeholder="e.g., Technical, Behavioral, Problem-solving"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Time Limit (minutes)</Label>
                      <Input
                        type="number"
                        min="1"
                        max="10"
                        value={question.timeLimit}
                        onChange={(e) => updateQuestion(question.id, 'timeLimit', parseInt(e.target.value) || 3)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Difficulty Level</Label>
                      <Select
                        value={question.difficulty}
                        onValueChange={(value: 'Easy' | 'Regular' | 'Expert') => 
                          updateQuestion(question.id, 'difficulty', value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Easy">Easy</SelectItem>
                          <SelectItem value="Regular">Regular</SelectItem>
                          <SelectItem value="Expert">Expert</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Expected Answer */}
                  <div className="space-y-2">
                    <Label>Expected Answer / Key Points</Label>
                    <Textarea
                      value={question.expectedAnswer}
                      onChange={(e) => updateQuestion(question.id, 'expectedAnswer', e.target.value)}
                      placeholder="Describe the expected answer or key points to look for..."
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {/* Scoring Criteria */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Scoring Criteria</Label>
                      <Button
                        onClick={() => addScoringCriteria(question.id)}
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Plus className="w-4 h-4" />
                        Add Criteria
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {question.scoringCriteria.map((criteria, criteriaIndex) => (
                        <div key={criteriaIndex} className="flex items-center gap-2">
                          <Input
                            value={criteria}
                            onChange={(e) => updateScoringCriteria(question.id, criteriaIndex, e.target.value)}
                            placeholder={`Scoring criteria ${criteriaIndex + 1}`}
                            className="flex-1"
                          />
                          {question.scoringCriteria.length > 1 && (
                            <Button
                              onClick={() => removeScoringCriteria(question.id, criteriaIndex)}
                              variant="ghost"
                              size="sm"
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-12 pb-12">
            <div className="text-center">
              <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No questions added yet
              </h3>
              <p className="text-gray-500 mb-4">
                Start building your structured interview by adding custom questions
              </p>
              <Button
                onClick={addQuestion}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Your First Question
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default StructuredInterviewSetup;
