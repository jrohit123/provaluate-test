import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { X, Plus, ArrowLeft, Clock } from 'lucide-react';

const InterviewSetup = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    duration: '30',
    difficulty: 'medium',
    position: '',
    skills: [] as string[],
    customQuestions: [] as string[],
    personalizedQuestionsEnabled: false,
    personalizedQuestions: [] as Array<{question: string, timeLimit: number}>
  });

  const [newSkill, setNewSkill] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [newPersonalizedQuestion, setNewPersonalizedQuestion] = useState('');
  const [newPersonalizedTimeLimit, setNewPersonalizedTimeLimit] = useState('2');

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const addSkill = () => {
    if (newSkill.trim() && !formData.skills.includes(newSkill.trim())) {
      setFormData(prev => ({
        ...prev,
        skills: [...prev.skills, newSkill.trim()]
      }));
      setNewSkill('');
    }
  };

  const removeSkill = (skillToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      skills: prev.skills.filter(skill => skill !== skillToRemove)
    }));
  };

  const addQuestion = () => {
    if (newQuestion.trim() && !formData.customQuestions.includes(newQuestion.trim())) {
      setFormData(prev => ({
        ...prev,
        customQuestions: [...prev.customQuestions, newQuestion.trim()]
      }));
      setNewQuestion('');
    }
  };

  const removeQuestion = (questionToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      customQuestions: prev.customQuestions.filter(question => question !== questionToRemove)
    }));
  };

  const addPersonalizedQuestion = () => {
    if (newPersonalizedQuestion.trim() && formData.personalizedQuestions.length < 2) {
      const newQuestion = {
        question: newPersonalizedQuestion.trim(),
        timeLimit: parseInt(newPersonalizedTimeLimit)
      };
      
      setFormData(prev => {
        const updatedQuestions = [...prev.personalizedQuestions, newQuestion];
        const personalizedDuration = updatedQuestions.reduce((total, q) => total + q.timeLimit, 0);
        const newTotalDuration = parseInt(prev.duration) + personalizedDuration;
        
        return {
          ...prev,
          personalizedQuestions: updatedQuestions,
          duration: newTotalDuration.toString()
        };
      });
      
      setNewPersonalizedQuestion('');
      setNewPersonalizedTimeLimit('2');
    }
  };

  const removePersonalizedQuestion = (indexToRemove: number) => {
    setFormData(prev => {
      const updatedQuestions = prev.personalizedQuestions.filter((_, index) => index !== indexToRemove);
      const personalizedDuration = updatedQuestions.reduce((total, q) => total + q.timeLimit, 0);
      const newTotalDuration = parseInt(prev.duration) + personalizedDuration;
      
      return {
        ...prev,
        personalizedQuestions: updatedQuestions,
        duration: newTotalDuration.toString()
      };
    });
  };

  const calculateTotalDuration = () => {
    const baseDuration = parseInt(formData.duration);
    const personalizedDuration = formData.personalizedQuestionsEnabled 
      ? formData.personalizedQuestions.reduce((total, q) => total + q.timeLimit, 0)
      : 0;
    return baseDuration + personalizedDuration;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // Save interview configuration to backend
      const response = await fetch('https://devprovaluate_py.aitamate.com/api/save-interview-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          duration: parseInt(formData.duration),
          difficulty: formData.difficulty,
          position: formData.position,
          skills: formData.skills,
          custom_questions: formData.customQuestions,
          personalized_questions_enabled: formData.personalizedQuestionsEnabled,
          personalized_questions: formData.personalizedQuestions,
          total_duration: calculateTotalDuration()
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Interview configuration saved:', result);
        
        // Navigate to interview dashboard with success message
        navigate('/ai-interview/dashboard', { 
          state: { 
            message: 'Interview configuration saved successfully!',
            interviewId: result.interview_id 
          }
        });
      } else {
        console.error('Failed to save interview configuration');
        alert('Failed to save interview configuration. Please try again.');
      }
    } catch (error) {
      console.error('Error saving interview configuration:', error);
      alert('Error saving interview configuration. Please check your connection and try again.');
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="flex items-center gap-4 mb-8">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={() => navigate('/ai-interview/dashboard')}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Setup AI Interview</h1>
          <p className="text-gray-600 mt-2">Configure your AI interview competencies</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
            <CardDescription>Set up the basic details for your interview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Interview Title</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => handleInputChange('title', e.target.value)}
                  placeholder="e.g., Frontend Developer Interview"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="position">Position</Label>
                <Input
                  id="position"
                  value={formData.position}
                  onChange={(e) => handleInputChange('position', e.target.value)}
                  placeholder="e.g., Senior React Developer"
                  required
                />
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Describe the interview purpose and what you're looking for..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Interview Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Interview Configuration</CardTitle>
            <CardDescription>Set duration and difficulty level</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="duration">Duration (minutes)</Label>
                <Select value={formData.duration} onValueChange={(value) => handleInputChange('duration', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select duration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 minutes</SelectItem>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="90">90 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="difficulty">Difficulty Level</Label>
                <Select value={formData.difficulty} onValueChange={(value) => handleInputChange('difficulty', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select difficulty" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Skills Assessment */}
        <Card>
          <CardHeader>
            <CardTitle>Skills Assessment</CardTitle>
            <CardDescription>Specify the skills you want to evaluate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                placeholder="Add a skill (e.g., React, JavaScript, Problem Solving)"
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addSkill())}
              />
              <Button type="button" onClick={addSkill} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            
            {formData.skills.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.skills.map((skill, index) => (
                  <Badge key={index} variant="secondary" className="flex items-center gap-1">
                    {skill}
                    <X 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => removeSkill(skill)}
                    />
                  </Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Personalized Questions */}
        <Card>
          <CardHeader>
            <CardTitle>Personal Questions (Optional)</CardTitle>
            <CardDescription>Add 1-2 personal questions to ask before technical questions. These will be recorded but not scored.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="personalized-enabled"
                checked={formData.personalizedQuestionsEnabled}
                onCheckedChange={(checked) => {
                  handleInputChange('personalizedQuestionsEnabled', checked);
                  // Recalculate duration when enabling/disabling personalized questions
                  if (!checked) {
                    // When disabling, remove personalized questions duration
                    setFormData(prev => {
                      const baseDuration = parseInt(prev.duration) - prev.personalizedQuestions.reduce((total, q) => total + q.timeLimit, 0);
                      return {
                        ...prev,
                        duration: Math.max(15, baseDuration).toString(), // Minimum 15 minutes
                        personalizedQuestions: []
                      };
                    });
                  }
                }}
              />
              <Label htmlFor="personalized-enabled">Enable personal questions</Label>
            </div>
            
            {formData.personalizedQuestionsEnabled && (
              <>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Textarea
                        value={newPersonalizedQuestion}
                        onChange={(e) => setNewPersonalizedQuestion(e.target.value)}
                        placeholder="Enter a personal question (e.g., Tell me about yourself, Why do you want to work here?)"
                        rows={2}
                        onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addPersonalizedQuestion())}
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Select value={newPersonalizedTimeLimit} onValueChange={setNewPersonalizedTimeLimit}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 min</SelectItem>
                          <SelectItem value="2">2 min</SelectItem>
                          <SelectItem value="3">3 min</SelectItem>
                          <SelectItem value="4">4 min</SelectItem>
                          <SelectItem value="5">5 min</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button 
                        type="button" 
                        onClick={addPersonalizedQuestion} 
                        className="flex items-center gap-2"
                        disabled={formData.personalizedQuestions.length >= 2}
                      >
                        <Plus className="h-4 w-4" />
                        Add
                      </Button>
                    </div>
                  </div>
                  
                  {formData.personalizedQuestions.length > 0 && (
                    <div className="space-y-2">
                      {formData.personalizedQuestions.map((question, index) => (
                        <div key={index} className="flex items-center justify-between p-3 border rounded-lg bg-blue-50">
                          <div className="flex-1">
                            <p className="font-medium">{question.question}</p>
                            <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                              <Clock className="h-3 w-3" />
                              {question.timeLimit} minute{question.timeLimit !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={() => removePersonalizedQuestion(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  {formData.personalizedQuestions.length >= 2 && (
                    <p className="text-sm text-gray-600">Maximum 2 personal questions allowed</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Custom Questions */}
        <Card>
          <CardHeader>
            <CardTitle>Custom Questions (Optional)</CardTitle>
            <CardDescription>Add specific questions you want to ask</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Textarea
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="Enter a custom question..."
                rows={2}
                onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), addQuestion())}
              />
              <Button type="button" onClick={addQuestion} className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>
            
            {formData.customQuestions.length > 0 && (
              <div className="space-y-2">
                {formData.customQuestions.map((question, index) => (
                  <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                    <span className="flex-1">{question}</span>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => removeQuestion(question)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Duration Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Interview Duration Summary</CardTitle>
            <CardDescription>Total estimated duration for the interview</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Technical Questions:</span>
                <span>{formData.duration} minutes</span>
              </div>
              {formData.personalizedQuestionsEnabled && formData.personalizedQuestions.length > 0 && (
                <div className="flex justify-between">
                  <span>Personal Questions:</span>
                  <span>{formData.personalizedQuestions.reduce((total, q) => total + q.timeLimit, 0)} minutes</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t pt-2">
                <span>Total Duration:</span>
                <span>{calculateTotalDuration()} minutes</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-end gap-4">
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => navigate('/ai-interview/dashboard')}
          >
            Cancel
          </Button>
          <Button type="submit" className="px-8">
            Create Interview
          </Button>
        </div>
      </form>
    </div>
  );
};

export default InterviewSetup;
