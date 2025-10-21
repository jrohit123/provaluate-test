import React from 'react';
import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Users, ArrowRight, CheckCircle, Brain, Target, Zap } from 'lucide-react';

const ServicesSelection = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Choose Your Service
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Select the service that best fits your needs. Both services are powered by advanced AI technology.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* CV Screening Card */}
          <Card className="relative overflow-hidden border-2 hover:border-blue-500 transition-all duration-300 hover:shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-100 rounded-full -translate-y-16 translate-x-16"></div>
            <CardHeader className="relative">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <FileText className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-2xl text-gray-900">CV Screening</CardTitle>
              </div>
              <CardDescription className="text-lg text-gray-600">
                Intelligent resume screening and candidate matching powered by AI
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Automated Resume Analysis</h4>
                    <p className="text-sm text-gray-600">AI-powered extraction and analysis of candidate skills, experience, and qualifications</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Smart Job Matching</h4>
                    <p className="text-sm text-gray-600">Intelligent matching of candidates to job requirements with scoring algorithms</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Brain className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Comprehensive Reports</h4>
                    <p className="text-sm text-gray-600">Detailed assessment reports with insights and recommendations</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Bulk Processing</h4>
                    <p className="text-sm text-gray-600">Process multiple resumes simultaneously for efficient screening</p>
                  </div>
                </div>
              </div>
              
              <Link to="/cv-screening/job-upload">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 text-lg font-semibold">
                  Start CV Screening
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* AI Interview Card */}
          <Card className="relative overflow-hidden border-2 hover:border-purple-500 transition-all duration-300 hover:shadow-xl">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-100 rounded-full -translate-y-16 translate-x-16"></div>
            <CardHeader className="relative">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Users className="h-8 w-8 text-purple-600" />
                </div>
                <CardTitle className="text-2xl text-gray-900">AI Interview</CardTitle>
              </div>
              <CardDescription className="text-lg text-gray-600">
                Conduct intelligent interviews with AI-powered questioning and analysis
              </CardDescription>
            </CardHeader>
            <CardContent className="relative">
              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Real-time Speech Recognition</h4>
                    <p className="text-sm text-gray-600">Advanced speech-to-text with 99% accuracy across multiple languages</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Target className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Dynamic Question Generation</h4>
                    <p className="text-sm text-gray-600">AI generates contextual questions based on candidate responses</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Brain className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Intelligent Analysis</h4>
                    <p className="text-sm text-gray-600">Comprehensive evaluation of communication skills, technical knowledge, and cultural fit</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Zap className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-gray-900">Automated Scoring</h4>
                    <p className="text-sm text-gray-600">Instant scoring and detailed feedback for each interview session</p>
                  </div>
                </div>
              </div>
              
              <Link to="/ai-interview/dashboard">
                <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 text-lg font-semibold">
                  Start AI Interview
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>

        {/* Footer Info */}
        <div className="text-center mt-12">
          <p className="text-gray-500">
            Both services are integrated and can be used together for comprehensive candidate evaluation
          </p>
        </div>
      </div>
    </div>
  );
};

export default ServicesSelection;
