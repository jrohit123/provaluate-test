import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  X, Globe, Shield, Sparkles, Users, Award, Star, Settings, ArrowLeft,
  Search, Zap, GraduationCap, TrendingUp, CheckCircle, BarChart3, 
  FileText, MessageSquare, Database, Brain, Target, Clock, ArrowRight,
  Play, ChevronRight, ChevronLeft, ExternalLink
} from 'lucide-react';
import AitamateLogo from './AitamateLogo';

// Enhanced Image components with hover effects
const AICustomerSupportImage = () => (
         <div className="group relative overflow-hidden rounded-3xl bg-blue-50 p-8 transform transition-all duration-500 hover:scale-105 hover:shadow-2xl">
         <div className="absolute inset-0 bg-blue-100/20 group-hover:bg-blue-100/30 transition-all duration-500"></div>
    <div className="relative z-10 text-center">
      <div className="relative overflow-hidden rounded-2xl mb-6">
        <img 
          src="/assets/Gemini_Generated_Image_mecqa0mecqa0mecq.png" 
          alt="24/7 Conversational AI for Smarter Customer Support"
          className="w-full max-h-80 object-contain transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-blue-600 transition-colors duration-300">24/7 Conversational AI</h3>
      <p className="text-gray-600 mb-4 group-hover:text-gray-700 transition-colors duration-300">Intelligent customer support with real-time assistance</p>
      <div className="flex justify-center">
        <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors duration-300">
          <MessageSquare className="w-6 h-6 text-blue-600" />
        </div>
      </div>
    </div>
  </div>
);

 const ModernOfficeImage = () => (
   <div className="group relative overflow-hidden rounded-3xl bg-blue-50 p-8 transform transition-all duration-500 hover:scale-105 hover:shadow-2xl">
     <div className="absolute inset-0 bg-blue-100/20 group-hover:bg-blue-100/30 transition-all duration-500"></div>
    <div className="relative z-10 text-center">
      <div className="relative overflow-hidden rounded-2xl mb-6">
        <img 
          src="/assets/Gemini_Generated_Image_1bmqw21bmqw21bmq.png" 
          alt="Modern collaborative office workspace"
          className="w-full max-h-80 object-contain transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-green-600 transition-colors duration-300">Collaborative Workspace</h3>
      <p className="text-gray-600 mb-4 group-hover:text-gray-700 transition-colors duration-300">Modern office environment fostering innovation</p>
      <div className="flex justify-center">
        <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors duration-300">
          <Users className="w-6 h-6 text-green-600" />
        </div>
      </div>
    </div>
  </div>
);

 const AutomationEfficiencyImage = () => (
   <div className="group relative overflow-hidden rounded-3xl bg-blue-50 p-8 transform transition-all duration-500 hover:scale-105 hover:shadow-2xl">
     <div className="absolute inset-0 bg-blue-100/20 group-hover:bg-blue-100/30 transition-all duration-500"></div>
    <div className="relative z-10 text-center">
      <div className="relative overflow-hidden rounded-2xl mb-6">
        <img 
          src="/assets/Gemini_Generated_Image_bdwh3cbdwh3cbdwh.png" 
          alt="Automate repetitive tasks and maximize efficiency"
          className="w-full max-h-80 object-contain transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-orange-600 transition-colors duration-300">Automate & Maximize</h3>
      <p className="text-gray-600 mb-4 group-hover:text-gray-700 transition-colors duration-300">Streamline processes for maximum efficiency</p>
      <div className="flex justify-center">
        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center group-hover:bg-orange-200 transition-colors duration-300">
          <Zap className="w-6 h-6 text-orange-600" />
        </div>
      </div>
    </div>
  </div>
);

 const BusinessMeetingImage = () => (
   <div className="group relative overflow-hidden rounded-3xl bg-blue-50 p-8 transform transition-all duration-500 hover:scale-105 hover:shadow-2xl">
     <div className="absolute inset-0 bg-blue-100/20 group-hover:bg-blue-100/30 transition-all duration-500"></div>
    <div className="relative z-10 text-center">
      <div className="relative overflow-hidden rounded-2xl mb-6">
        <img 
          src="/assets/Gemini_Generated_Image_r6n186r6n186r6n1.png" 
          alt="Strategic business meeting with data visualization"
          className="w-full max-h-80 object-contain transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-3 group-hover:text-indigo-600 transition-colors duration-300">Strategic Collaboration</h3>
      <p className="text-gray-600 mb-4 group-hover:text-gray-700 transition-colors duration-300">Data-driven decision making in action</p>
      <div className="flex justify-center">
        <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center group-hover:bg-indigo-200 transition-colors duration-300">
          <BarChart3 className="w-6 h-6 text-indigo-600" />
        </div>
      </div>
    </div>
  </div>
);

// Animated Counter Component
const AnimatedCounter = ({ end, duration = 2000, suffix = "" }) => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let startTime = null;
    const animate = (currentTime) => {
      if (!startTime) startTime = currentTime;
      const progress = Math.min((currentTime - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [end, duration]);

  return <span>{count}{suffix}</span>;
};

// Floating Action Button
const FloatingActionButton = ({ onClick, children, className = "" }) => (
     <button
     onClick={onClick}
     className={`fixed bottom-8 right-8 w-16 h-16 bg-blue-600 text-white rounded-full shadow-2xl hover:shadow-3xl transform hover:scale-110 transition-all duration-300 z-50 flex items-center justify-center ${className}`}
   >
    {children}
  </button>
);

const WhyAitamatePage = () => {
  const navigate = useNavigate();
  const [activeSection, setActiveSection] = useState('mission');

  return (
         <div className="min-h-screen bg-blue-50">
      {/* Enhanced Header with Glassmorphism */}
      <div className="bg-white/80 backdrop-blur-xl border-b border-white/20 sticky top-0 z-50 shadow-lg">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="scale-150 transform hover:scale-160 transition-transform duration-300">
                <AitamateLogo size="xlarge" showTagline={false} />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <button 
                onClick={() => navigate('/')}
                className="bg-gradient-to-r from-gray-600 to-gray-700 text-white px-6 py-3 rounded-2xl hover:from-gray-700 hover:to-gray-800 hover:shadow-xl transition-all duration-300 flex items-center gap-3 group"
              >
                <ArrowLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform duration-300" />
                <span className="font-semibold">Back to Home</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16">
        {/* Hero Section with Parallax Effect */}
                 <div className="text-center mb-24 relative">
           <div className="absolute inset-0 bg-blue-100/20 rounded-3xl transform rotate-1"></div>
          <div className="relative z-10">
                         <div className="inline-flex items-center gap-3 bg-blue-100 px-6 py-3 rounded-full mb-8">
              <Sparkles className="w-5 h-5 text-blue-600" />
              <span className="text-blue-700 font-semibold">AI-Powered Innovation</span>
            </div>
                         <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-8 leading-tight">
               About <span className="text-blue-600 animate-pulse">Aitamate</span>
             </h1>
                         <p className="text-2xl text-gray-600 max-w-4xl mx-auto leading-relaxed mb-12">
               We're on a mission to democratize AI and make intelligent automation accessible to businesses of all sizes.
             </p>

          </div>
        </div>



                 {/* Impact Numbers Section */}
         <div className="bg-white rounded-3xl p-16 shadow-2xl border border-blue-200 mt-32">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-bold text-gray-900 mb-8">Our Impact</h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Numbers that reflect our commitment to transforming businesses with AI.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            {[
              { number: "25+", label: "Companies Served", color: "blue" },
              { number: "10,000+", label: "Professionals Trained", color: "green" },
              { number: "95%", label: "Client Satisfaction", color: "purple" },
              { number: "40%", label: "Avg. Efficiency Increase", color: "orange" }
            ].map((item, index) => (
              <div key={index} className="text-center group">
                <div className={`text-6xl font-bold text-${item.color}-600 mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <AnimatedCounter end={parseInt(item.number)} suffix={item.number.includes('%') ? '%' : item.number.includes('+') ? '+' : ''} />
                </div>
                <p className="text-xl text-gray-600 font-semibold">{item.label}</p>
              </div>
            ))}
          </div>
        </div>

                 {/* Call to Action */}
         <div className="text-center mt-32">
           <div className="bg-blue-600 rounded-3xl p-16 text-white">
            <h2 className="text-4xl font-bold mb-6">Ready to Transform Your Business?</h2>
            <p className="text-xl mb-8 opacity-90">Join hundreds of companies already leveraging AI to drive growth and efficiency.</p>
            
          </div>
        </div>

        {/* New Alternating Layout Section */}
        <div className="mt-32 space-y-32">
                     {/* First Alternating Section - AI-Powered Hiring */}
           <div className="bg-white rounded-3xl p-16 shadow-2xl border border-blue-200">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left Side - Text Content */}
              <div className="space-y-8">
                <div className="inline-flex items-center gap-3 bg-blue-100 px-6 py-3 rounded-full">
                  <Users className="w-5 h-5 text-blue-600" />
                  <span className="text-blue-700 font-semibold">AI-Powered Hiring</span>
                </div>
                                 <h2 className="text-4xl font-bold text-gray-900 leading-tight">
                   Your second step in better, faster hiring
                 </h2>
                <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
                                     <p>
                     Chat interviews progress seamlessly to video interviews in a chat-based environment, 
                     allowing candidates to record responses at their own pace. This innovative approach 
                     saves valuable time on scheduling and helps hiring managers focus on selecting the 
                     best candidates.
                   </p>
                   <p>
                     Our AI-driven platform streamlines the entire recruitment process, from initial 
                     screening to final selection, ensuring you find the perfect fit for your team 
                     while maintaining a positive candidate experience.
                   </p>
                </div>
                
              </div>

                             {/* Right Side - Video Player */}
               <div className="relative">
                 <div className="bg-gray-900 rounded-3xl p-8 shadow-2xl">
                   <div className="relative aspect-video bg-blue-600/20 rounded-2xl overflow-hidden">
                    <img 
                      src="/assets/Gemini_Generated_Image_mecqa0mecqa0mecq.png" 
                      alt="AI Customer Support Demo"
                      className="w-full h-full object-cover opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-20 h-20 bg-white/90 rounded-full flex items-center justify-center shadow-2xl hover:bg-white hover:scale-110 transition-all duration-300 cursor-pointer">
                        <Play className="w-8 h-8 text-gray-900 ml-1" />
                      </div>
                    </div>
                  </div>
                  
                </div>
              </div>
            </div>
          </div>

                     {/* Second Alternating Section - Candidate Experience */}
           <div className="bg-white rounded-3xl p-16 shadow-2xl border border-blue-200">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left Side - Image with Overlay */}
              <div className="relative">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                  <img 
                    src="/assets/Gemini_Generated_Image_1bmqw21bmqw21bmq.png" 
                    alt="Modern collaborative workspace"
                    className="w-full h-96 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  
                  
                </div>
              </div>

              {/* Right Side - Text Content */}
              <div className="space-y-8">
                <div className="inline-flex items-center gap-3 bg-green-100 px-6 py-3 rounded-full">
                  <Star className="w-5 h-5 text-green-600" />
                  <span className="text-green-700 font-semibold">Candidate Experience</span>
                </div>
                <h2 className="text-4xl font-bold text-gray-900 leading-tight">
                  An AI Interview that candidates consistently rate 9/10
                </h2>
                <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
                  <p>
                    Our interview experience was designed with critical decisions to avoid being 
                    exclusionary, leading to high satisfaction and completion rates. We understand 
                    that the candidate experience is just as important as the hiring outcome.
                  </p>
                  <p>
                    By creating an inclusive, accessible, and engaging interview process, we ensure 
                    that every candidate feels valued and has the opportunity to showcase their 
                    true potential, regardless of their background or circumstances.
                  </p>
                </div>
                
                {/* Rating Display */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <div className="text-3xl font-bold text-green-600">9/10</div>
                    <div className="text-sm text-gray-500">Average Rating</div>
                  </div>
                  <div className="flex gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-5 h-5 ${i < 4 ? 'text-yellow-400 fill-current' : 'text-gray-300'}`} />
                    ))}
                  </div>
                </div>

                
              </div>
            </div>
          </div>

                     {/* Third Alternating Section - Automation Efficiency */}
           <div className="bg-white rounded-3xl p-16 shadow-2xl border border-blue-200">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left Side - Text Content */}
              <div className="space-y-8">
                <div className="inline-flex items-center gap-3 bg-orange-100 px-6 py-3 rounded-full">
                  <Zap className="w-5 h-5 text-orange-600" />
                  <span className="text-orange-700 font-semibold">Process Automation</span>
                </div>
                <h2 className="text-4xl font-bold text-gray-900 leading-tight">
                  Streamline your workflow with intelligent automation
                </h2>
                <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
                  <p>
                    Our AI-powered automation solutions reduce manual processing time by 75% and 
                    improve accuracy by 90%. By automating repetitive tasks, your team can focus 
                    on what truly matters - strategic decision making and innovation.
                  </p>
                  <p>
                    From document processing to customer service, our intelligent automation 
                    adapts to your business needs, providing scalable solutions that grow with 
                    your organization.
                  </p>
                </div>
                
                {/* Stats Display */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="text-3xl font-bold text-orange-600 mb-2">75%</div>
                    <div className="text-sm text-gray-600">Time Reduction</div>
                  </div>
                  <div className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100">
                    <div className="text-3xl font-bold text-orange-600 mb-2">90%</div>
                    <div className="text-sm text-gray-600">Accuracy Improvement</div>
                  </div>
                </div>

                
              </div>

              {/* Right Side - Automation Image */}
              <div className="relative">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                  <img 
                    src="/assets/Gemini_Generated_Image_bdwh3cbdwh3cbdwh.png" 
                    alt="Automate repetitive tasks and maximize efficiency"
                    className="w-full h-96 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  
                  
                </div>
              </div>
            </div>
          </div>

                     {/* Fourth Alternating Section - Strategic Collaboration */}
           <div className="bg-white rounded-3xl p-16 shadow-2xl border border-blue-200">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              {/* Left Side - Business Meeting Image */}
              <div className="relative">
                <div className="relative rounded-3xl overflow-hidden shadow-2xl">
                  <img 
                    src="/assets/Gemini_Generated_Image_r6n186r6n186r6n1.png" 
                    alt="Strategic business meeting with data visualization"
                    className="w-full h-96 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
                  
                  {/* Overlay Data Points */}
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-4 shadow-lg">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <div className="text-lg font-bold text-indigo-600">95%</div>
                          <div className="text-xs text-gray-600">Success Rate</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-indigo-600">40%</div>
                          <div className="text-xs text-gray-600">Efficiency Gain</div>
                        </div>
                        <div>
                          <div className="text-lg font-bold text-indigo-600">10K+</div>
                          <div className="text-xs text-gray-600">Professionals</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Side - Text Content */}
              <div className="space-y-8">
                <div className="inline-flex items-center gap-3 bg-indigo-100 px-6 py-3 rounded-full">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  <span className="text-indigo-700 font-semibold">Strategic Collaboration</span>
                </div>
                <h2 className="text-4xl font-bold text-gray-900 leading-tight">
                  Data-driven decision making in action
                </h2>
                <div className="space-y-6 text-lg text-gray-600 leading-relaxed">
                  <p>
                    Transform your business meetings with AI-powered insights and real-time 
                    data visualization. Our platform enables teams to make informed decisions 
                    quickly and confidently, driving better outcomes across all levels.
                  </p>
                  <p>
                    From predictive analytics to automated reporting, we provide the tools 
                    you need to stay ahead of the competition and achieve your strategic goals 
                    with precision and clarity.
                  </p>
                </div>
                
                {/* Feature List */}
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">Real-time analytics dashboard</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">Predictive insights and trends</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700">Automated reporting systems</span>
                  </div>
                </div>

                
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
        <ChevronLeft className="w-6 h-6 transform rotate-90" />
      </FloatingActionButton>
    </div>
  );
};

export default WhyAitamatePage;
