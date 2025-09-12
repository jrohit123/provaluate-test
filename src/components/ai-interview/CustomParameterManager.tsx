import React, { useState, useEffect, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  Plus, Trash2, Edit, Save, 
  Target, Settings, Brain,
  CheckCircle, AlertCircle, Loader2, ArrowLeft, Play
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CustomParameter {
  name: string;
  description: string;
  weight: number;
  min_questions: number;
  max_questions: number;
  scoring_criteria: string[];
}

interface CustomParameters {
  [key: string]: CustomParameter;
}

interface EditingParameter extends CustomParameter {
  key: string;
}

const CustomParameterManager = ({ roleName: propRoleName, onParametersUpdated }: { roleName?: string; onParametersUpdated?: () => void } = {}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const roleName = propRoleName || location.state?.roleName || 'Software Engineer';
  
  const [customParameters, setCustomParameters] = useState<CustomParameters>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingParameter, setEditingParameter] = useState<EditingParameter | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [parametersSaved, setParametersSaved] = useState(false);
  const [newParameter, setNewParameter] = useState<CustomParameter>({
    name: '',
    description: '',
    weight: 25,
    min_questions: 2,
    max_questions: 5,
    scoring_criteria: ['', '', '', '']
  });
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [dynamicConfig, setDynamicConfig] = useState<any>(null);
  const [isGeneratingParameters, setIsGeneratingParameters] = useState(false);

  // Example parameters for different roles
  const getExampleParameters = (role) => {
    const examples = {
      'Software Engineer': [
        { 
          name: 'Advanced Technical Architecture', 
          description: 'This parameter evaluates the candidate\'s ability to design and implement complex software architectures. It assesses their understanding of system design principles, scalability considerations, and architectural patterns. The evaluation focuses on their experience with microservices, distributed systems, and cloud-native applications. Candidates should demonstrate proficiency in creating robust, maintainable, and scalable solutions that align with industry best practices and organizational needs.',
          weight: 30 
        },
        { 
          name: 'Problem-Solving Methodology', 
          description: 'This assessment focuses on the candidate\'s systematic approach to solving complex technical problems. It evaluates their ability to break down large problems into manageable components, analyze trade-offs, and implement optimal solutions. The parameter considers their debugging skills, analytical thinking, and ability to work through ambiguous requirements. Strong candidates should demonstrate logical reasoning, attention to detail, and persistence in finding solutions.',
          weight: 25 
        },
        { 
          name: 'Code Quality & Best Practices', 
          description: 'This parameter examines the candidate\'s commitment to writing clean, maintainable, and well-documented code. It assesses their understanding of coding standards, design patterns, and software engineering principles. The evaluation includes their approach to testing, code review processes, and documentation practices. Candidates should demonstrate awareness of performance optimization, security considerations, and industry-standard development methodologies.',
          weight: 25 
        },
        { 
          name: 'Technical Communication & Collaboration', 
          description: 'This assessment evaluates the candidate\'s ability to effectively communicate technical concepts to both technical and non-technical stakeholders. It considers their experience with cross-functional collaboration, knowledge sharing, and mentoring junior developers. The parameter examines their documentation skills, presentation abilities, and capacity to explain complex technical decisions in accessible terms.',
          weight: 20 
        }
      ],
      'Data Scientist': [
        { 
          name: 'Advanced Analytics & Statistical Modeling', 
          description: 'This parameter evaluates the candidate\'s expertise in statistical analysis, predictive modeling, and advanced analytics techniques. It assesses their proficiency in statistical software, experimental design, and hypothesis testing methodologies. The evaluation focuses on their ability to select appropriate statistical methods, interpret results accurately, and communicate findings effectively. Candidates should demonstrate deep understanding of probability theory, regression analysis, and statistical inference.',
          weight: 35 
        },
        { 
          name: 'Machine Learning & AI Implementation', 
          description: 'This assessment examines the candidate\'s practical experience with machine learning algorithms, model development, and AI system implementation. It evaluates their ability to preprocess data, select appropriate algorithms, tune hyperparameters, and validate model performance. The parameter considers their understanding of overfitting, bias-variance trade-offs, and model interpretability. Strong candidates should demonstrate experience with production ML systems and MLOps practices.',
          weight: 30 
        },
        { 
          name: 'Data Engineering & Infrastructure', 
          description: 'This parameter assesses the candidate\'s ability to work with large-scale data infrastructure and engineering pipelines. It evaluates their experience with data warehousing, ETL processes, and big data technologies. The assessment considers their understanding of data governance, quality assurance, and scalable data processing systems. Candidates should demonstrate proficiency in SQL, NoSQL databases, and cloud-based data platforms.',
          weight: 20 
        },
        { 
          name: 'Business Intelligence & Stakeholder Communication', 
          description: 'This assessment evaluates the candidate\'s ability to translate complex analytical findings into actionable business insights. It examines their experience with data visualization, dashboard creation, and stakeholder communication. The parameter considers their understanding of business metrics, KPIs, and how data analysis drives organizational decision-making. Candidates should demonstrate ability to present findings to executive audiences and guide strategic decisions.',
          weight: 15 
        }
      ],
      'Product Manager': [
        { 
          name: 'Strategic Product Vision & Roadmap Planning', 
          description: 'This parameter evaluates the candidate\'s ability to develop and articulate a compelling product vision that aligns with business objectives and market opportunities. It assesses their strategic thinking capabilities, market analysis skills, and ability to create comprehensive product roadmaps. The evaluation focuses on their understanding of product lifecycle management, competitive analysis, and long-term strategic planning. Candidates should demonstrate ability to balance short-term execution with long-term vision while considering technical constraints and business priorities.',
          weight: 35 
        },
        { 
          name: 'User Research & Market Analysis', 
          description: 'This assessment examines the candidate\'s expertise in conducting comprehensive user research and market analysis to inform product decisions. It evaluates their ability to design and execute research methodologies, analyze user behavior patterns, and translate insights into actionable product requirements. The parameter considers their experience with qualitative and quantitative research methods, user journey mapping, and competitive intelligence gathering. Strong candidates should demonstrate ability to synthesize complex information and communicate findings effectively to stakeholders.',
          weight: 25 
        },
        { 
          name: 'Cross-functional Leadership & Team Management', 
          description: 'This parameter assesses the candidate\'s ability to lead and coordinate cross-functional teams including engineering, design, marketing, and business stakeholders. It evaluates their project management skills, conflict resolution abilities, and capacity to motivate teams toward common goals. The assessment considers their experience with agile methodologies, stakeholder management, and team development. Candidates should demonstrate strong interpersonal skills, decision-making capabilities, and ability to navigate complex organizational dynamics.',
          weight: 25 
        },
        { 
          name: 'Data-driven Decision Making & Analytics', 
          description: 'This assessment evaluates the candidate\'s ability to leverage data and analytics to inform product decisions and measure success. It examines their understanding of key product metrics, A/B testing methodologies, and analytical tools. The parameter considers their experience with user analytics, business intelligence platforms, and performance measurement frameworks. Candidates should demonstrate ability to interpret complex data sets, identify actionable insights, and communicate findings to drive product strategy and optimization.',
          weight: 15 
        }
      ],
      'Sales Representative': [
        { 
          name: 'Advanced Sales Techniques & Prospecting', 
          description: 'This parameter evaluates the candidate\'s expertise in advanced sales methodologies, prospecting strategies, and deal qualification processes. It assesses their ability to identify and target high-value prospects, conduct effective discovery calls, and qualify leads based on BANT criteria. The evaluation focuses on their understanding of consultative selling approaches, objection handling techniques, and closing strategies. Candidates should demonstrate proficiency in using CRM systems, sales automation tools, and data-driven prospecting methods.',
          weight: 35 
        },
        { 
          name: 'Relationship Building & Client Management', 
          description: 'This assessment examines the candidate\'s ability to build and maintain long-term client relationships that drive repeat business and referrals. It evaluates their interpersonal skills, emotional intelligence, and capacity to understand client needs and pain points. The parameter considers their experience with account management, client retention strategies, and building trust through consistent communication and value delivery. Strong candidates should demonstrate ability to navigate complex client relationships and serve as trusted advisors.',
          weight: 25 
        },
        { 
          name: 'Product Knowledge & Value Proposition', 
          description: 'This parameter assesses the candidate\'s deep understanding of products, services, and competitive landscape. It evaluates their ability to articulate compelling value propositions, differentiate offerings from competitors, and align solutions with client business objectives. The assessment considers their knowledge of industry trends, market dynamics, and ability to position products effectively. Candidates should demonstrate ability to translate technical features into business benefits and ROI for clients.',
          weight: 20 
        },
        { 
          name: 'Negotiation & Deal Structuring', 
          description: 'This assessment evaluates the candidate\'s negotiation skills and ability to structure complex deals that maximize value for both the company and client. It examines their understanding of pricing strategies, contract terms, and ability to navigate multi-stakeholder decision processes. The parameter considers their experience with win-win negotiation techniques, risk assessment, and ability to handle objections professionally. Candidates should demonstrate ability to close deals while maintaining profitability and client satisfaction.',
          weight: 20 
        }
      ],
      'Marketing Manager': [
        { 
          name: 'Digital Marketing Strategy & Execution', 
          description: 'This parameter evaluates the candidate\'s expertise in developing and executing comprehensive digital marketing strategies across multiple channels. It assesses their understanding of SEO, SEM, social media marketing, email campaigns, and content marketing. The evaluation focuses on their ability to create integrated marketing campaigns, optimize for conversion, and leverage marketing automation tools. Candidates should demonstrate proficiency in digital analytics, A/B testing, and data-driven marketing optimization.',
          weight: 35 
        },
        { 
          name: 'Campaign Management & Performance Optimization', 
          description: 'This assessment examines the candidate\'s ability to plan, execute, and optimize marketing campaigns that drive measurable business results. It evaluates their project management skills, budget allocation strategies, and ability to coordinate cross-functional marketing teams. The parameter considers their experience with campaign tracking, performance analysis, and continuous optimization based on data insights. Strong candidates should demonstrate ability to manage multiple campaigns simultaneously while maintaining quality and meeting objectives.',
          weight: 30 
        },
        { 
          name: 'Analytics & ROI Measurement', 
          description: 'This parameter assesses the candidate\'s ability to measure and analyze marketing performance using advanced analytics tools and methodologies. It evaluates their understanding of key marketing metrics, attribution modeling, and ROI calculation methods. The assessment considers their experience with marketing analytics platforms, data visualization, and ability to translate complex data into actionable insights. Candidates should demonstrate ability to communicate marketing performance to stakeholders and make data-driven decisions.',
          weight: 20 
        },
        { 
          name: 'Creative Strategy & Brand Development', 
          description: 'This assessment evaluates the candidate\'s creative thinking abilities and capacity to develop compelling brand strategies and messaging. It examines their understanding of brand positioning, visual identity development, and creative campaign concepts. The parameter considers their experience with creative briefs, brand guidelines, and ability to work with creative teams and agencies. Candidates should demonstrate ability to balance creative innovation with strategic business objectives and brand consistency.',
          weight: 15 
        }
      ],
      'HR Manager': [
        { 
          name: 'Strategic Talent Acquisition & Recruitment', 
          description: 'This parameter evaluates the candidate\'s expertise in developing and executing comprehensive talent acquisition strategies that align with organizational goals. It assesses their ability to design recruitment processes, source top talent, and implement effective candidate evaluation methodologies. The evaluation focuses on their understanding of employer branding, diversity and inclusion initiatives, and ability to build talent pipelines. Candidates should demonstrate proficiency in using recruitment technologies, conducting behavioral interviews, and making data-driven hiring decisions.',
          weight: 30 
        },
        { 
          name: 'Employee Relations & Engagement', 
          description: 'This assessment examines the candidate\'s ability to foster positive employee relations and create engaging workplace environments that drive retention and productivity. It evaluates their conflict resolution skills, employee communication strategies, and capacity to build trust across all levels of the organization. The parameter considers their experience with employee engagement surveys, recognition programs, and developing initiatives that promote workplace satisfaction. Strong candidates should demonstrate ability to balance employee needs with organizational objectives.',
          weight: 25 
        },
        { 
          name: 'HR Policy Development & Compliance', 
          description: 'This parameter assesses the candidate\'s knowledge of employment law, HR best practices, and ability to develop and implement HR policies that ensure compliance and support organizational objectives. It evaluates their understanding of labor regulations, workplace safety requirements, and ability to navigate complex legal and ethical HR situations. The assessment considers their experience with policy development, training programs, and maintaining HR documentation. Candidates should demonstrate ability to stay current with changing regulations and implement compliant HR practices.',
          weight: 25 
        },
        { 
          name: 'Organizational Development & Training', 
          description: 'This assessment evaluates the candidate\'s ability to design and implement organizational development initiatives that enhance employee performance and organizational effectiveness. It examines their experience with training program development, performance management systems, and career development planning. The parameter considers their understanding of adult learning principles, training evaluation methods, and ability to align development programs with business goals. Candidates should demonstrate ability to create learning cultures that support continuous improvement and employee growth.',
          weight: 20 
        }
      ],
      'Customer Service Representative': [
        { 
          name: 'Advanced Communication & Problem Resolution', 
          description: 'This parameter evaluates the candidate\'s ability to communicate effectively with customers across various channels while resolving complex issues efficiently. It assesses their active listening skills, empathy, and capacity to understand customer needs and concerns. The evaluation focuses on their problem-solving approach, ability to handle difficult situations professionally, and capacity to turn negative experiences into positive outcomes. Candidates should demonstrate proficiency in using customer service tools, documenting interactions, and following up to ensure resolution.',
          weight: 40 
        },
        { 
          name: 'Product Knowledge & Technical Support', 
          description: 'This assessment examines the candidate\'s comprehensive understanding of products, services, and technical support procedures. It evaluates their ability to provide accurate information, troubleshoot technical issues, and guide customers through complex processes. The parameter considers their learning agility, ability to stay current with product updates, and capacity to explain technical concepts in accessible terms. Strong candidates should demonstrate ability to handle escalated technical issues and collaborate with technical teams when necessary.',
          weight: 35 
        },
        { 
          name: 'Customer Experience & Relationship Management', 
          description: 'This parameter assesses the candidate\'s ability to create exceptional customer experiences that build loyalty and drive customer satisfaction. It evaluates their understanding of customer journey mapping, service recovery strategies, and ability to anticipate customer needs. The assessment considers their experience with customer feedback systems, quality assurance processes, and ability to identify opportunities for service improvement. Candidates should demonstrate ability to balance efficiency with personalized service and maintain positive customer relationships.',
          weight: 25 
        }
      ],
      'Project Manager': [
        { 
          name: 'Strategic Project Planning & Execution', 
          description: 'This parameter evaluates the candidate\'s ability to develop comprehensive project plans and execute them successfully within scope, time, and budget constraints. It assesses their project management methodology knowledge, planning techniques, and ability to create realistic project schedules and resource allocations. The evaluation focuses on their experience with project management tools, risk assessment, and ability to adapt plans based on changing circumstances. Candidates should demonstrate proficiency in managing project lifecycles from initiation to closure.',
          weight: 30 
        },
        { 
          name: 'Team Leadership & Stakeholder Management', 
          description: 'This assessment examines the candidate\'s ability to lead project teams effectively and manage relationships with diverse stakeholders. It evaluates their leadership style, conflict resolution skills, and capacity to motivate team members toward common goals. The parameter considers their experience with stakeholder communication, expectation management, and ability to build consensus among competing interests. Strong candidates should demonstrate ability to create collaborative team environments and manage stakeholder relationships professionally.',
          weight: 25 
        },
        { 
          name: 'Risk Management & Problem Resolution', 
          description: 'This parameter assesses the candidate\'s ability to identify, assess, and mitigate project risks while resolving issues that arise during project execution. It evaluates their risk management methodologies, contingency planning skills, and ability to make decisions under pressure. The assessment considers their experience with issue tracking, escalation procedures, and ability to implement corrective actions. Candidates should demonstrate ability to anticipate potential problems and develop proactive solutions.',
          weight: 20 
        },
        { 
          name: 'Communication & Reporting', 
          description: 'This assessment evaluates the candidate\'s ability to communicate project status, progress, and issues effectively to various audiences including executives, team members, and clients. It examines their reporting skills, presentation abilities, and capacity to tailor communication to different stakeholder needs. The parameter considers their experience with project dashboards, status reports, and ability to facilitate effective project meetings. Candidates should demonstrate ability to provide clear, concise, and actionable project information.',
          weight: 15 
        },
        { 
          name: 'Budget Management & Financial Control', 
          description: 'This parameter assesses the candidate\'s ability to manage project budgets effectively and ensure financial control throughout project execution. It evaluates their budget planning skills, cost tracking methodologies, and ability to make financial decisions that optimize project value. The assessment considers their experience with financial reporting, variance analysis, and ability to communicate financial information to stakeholders. Candidates should demonstrate ability to balance project objectives with financial constraints.',
          weight: 10 
        }
      ],
      'Content Writer': [
        { 
          name: 'Advanced Writing & Content Creation', 
          description: 'This parameter evaluates the candidate\'s exceptional writing abilities and capacity to create compelling, engaging content across various formats and platforms. It assesses their mastery of grammar, style, tone, and ability to adapt writing for different audiences and purposes. The evaluation focuses on their storytelling capabilities, creative thinking, and ability to transform complex information into accessible, engaging content. Candidates should demonstrate proficiency in multiple content formats including articles, blogs, social media, and marketing copy.',
          weight: 50 
        },
        { 
          name: 'Research & Information Synthesis', 
          description: 'This assessment examines the candidate\'s ability to conduct thorough research, gather accurate information, and synthesize complex data into coherent, well-structured content. It evaluates their research methodologies, fact-checking skills, and ability to identify credible sources. The parameter considers their experience with primary and secondary research, interview techniques, and ability to extract key insights from large amounts of information. Strong candidates should demonstrate ability to present information accurately while maintaining reader engagement.',
          weight: 30 
        },
        { 
          name: 'SEO & Digital Content Strategy', 
          description: 'This parameter assesses the candidate\'s understanding of search engine optimization principles and ability to create content that performs well in digital environments. It evaluates their knowledge of SEO best practices, keyword research, and ability to optimize content for search engines while maintaining quality and readability. The assessment considers their experience with content strategy, audience targeting, and ability to create content that drives organic traffic and engagement. Candidates should demonstrate ability to balance SEO requirements with creative content goals.',
          weight: 20 
        }
      ]
    };
    return examples[role] || [
      { 
        name: 'Technical Skills', 
        description: 'This parameter evaluates the candidate\'s core technical abilities and domain-specific knowledge relevant to the role. It assesses their proficiency in required technologies, tools, and methodologies. The evaluation focuses on their practical experience, technical depth, and ability to apply knowledge in real-world scenarios. Candidates should demonstrate strong foundational skills and continuous learning capabilities.',
        weight: 40 
      },
      { 
        name: 'Problem Solving & Analytical Thinking', 
        description: 'This assessment examines the candidate\'s ability to analyze complex problems, identify root causes, and develop effective solutions. It evaluates their analytical thinking, logical reasoning, and systematic approach to problem-solving. The parameter considers their ability to break down complex issues, evaluate alternatives, and implement optimal solutions. Strong candidates should demonstrate creativity, persistence, and attention to detail in their problem-solving approach.',
        weight: 30 
      },
      { 
        name: 'Communication & Collaboration', 
        description: 'This parameter assesses the candidate\'s ability to communicate effectively with various stakeholders and collaborate within team environments. It evaluates their verbal and written communication skills, presentation abilities, and interpersonal effectiveness. The assessment considers their experience with cross-functional collaboration, conflict resolution, and knowledge sharing. Candidates should demonstrate ability to adapt communication style to different audiences and situations.',
        weight: 20 
      },
      { 
        name: 'Leadership & Initiative', 
        description: 'This assessment evaluates the candidate\'s leadership potential and ability to take initiative in driving projects and team success. It examines their experience with project management, team coordination, and decision-making responsibilities. The parameter considers their ability to motivate others, manage priorities, and demonstrate accountability. Candidates should show evidence of leadership experience and potential for growth in leadership roles.',
        weight: 10 
      }
    ];
  };

  const loadParameters = useCallback(async () => {
    setIsLoading(true);
    try {
      // Load custom parameters
      const customResponse = await fetch(`/api/custom-parameters/${encodeURIComponent(roleName)}`);
      const customData = await customResponse.json();

      setCustomParameters(customData.custom_parameters?.[0]?.custom_parameters || {});
    } catch (error) {
      console.error('Error loading parameters:', error);
      toast.error('Failed to load parameters');
    } finally {
      setIsLoading(false);
    }
  }, [roleName]);

  useEffect(() => {
    loadParameters();
  }, [loadParameters]);

  // Load dynamic configuration when parameters change
  useEffect(() => {
    const loadDynamicConfig = async () => {
      try {
        // Load both 15-minute and 30-minute configurations
        const [response15, response30] = await Promise.all([
          fetch(`/api/get-dynamic-config/${encodeURIComponent(roleName)}/15`),
          fetch(`/api/get-dynamic-config/${encodeURIComponent(roleName)}/30`)
        ]);
        
        if (response15.ok && response30.ok) {
          const data15 = await response15.json();
          const data30 = await response30.json();
          
          setDynamicConfig({
            config15: data15.config,
            config30: data30.config
          });
        }
      } catch (error) {
        console.error('Error loading dynamic config:', error);
      }
    };

    // Load config even when no custom parameters (to show fallback)
    loadDynamicConfig();
  }, [customParameters, roleName]);

  const calculateTotalWeight = () => {
    const customWeight = Object.values(customParameters).reduce((sum, param) => sum + (param.weight || 0), 0);
    return customWeight;
  };

  const validateParameters = () => {
    const totalWeight = calculateTotalWeight();
    if (totalWeight !== 100) {
      toast.error(`Total weight must equal 100%. Current total: ${totalWeight}%`);
      return false;
    }
    return true;
  };

  const handleSaveParameters = async () => {
    if (!validateParameters()) return;

    setIsSaving(true);
    try {
      const response = await fetch('/api/custom-parameters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role_name: roleName,
          custom_parameters: customParameters
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save custom parameters');
      }

      toast.success('Assessment parameters saved successfully!');
      setShowAddForm(false);
      setEditingParameter(null);
      onParametersUpdated?.();
      setParametersSaved(true);
      
    } catch (error) {
      console.error('Error saving parameters:', error);
      toast.error('Failed to save assessment parameters');
    } finally {
      setIsSaving(false);
    }
  };

  const generateDynamicParameters = async () => {
    setIsGeneratingParameters(true);
    try {
      // First get the interview count for this role
      const countResponse = await fetch(`/api/get-interview-count/${encodeURIComponent(roleName)}`);
      const countData = await countResponse.json();
      const interviewCount = countData.interview_count || 1;

      // Generate dynamic parameters
      const response = await fetch('/api/generate-dynamic-parameters', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role_name: roleName,
          interview_count: interviewCount
        })
      });

      if (response.ok) {
        const data = await response.json();
        setCustomParameters(data.parameters || {});
        setParametersSaved(false);
        const method = data.cached ? 'cached' : 'AI-generated';
        toast.success(`Generated ${method} parameters for ${roleName} (Interview #${interviewCount})`);
      } else {
        throw new Error('Failed to generate parameters');
      }
    } catch (error) {
      console.error('Error generating dynamic parameters:', error);
      toast.error('Failed to generate dynamic parameters');
    } finally {
      setIsGeneratingParameters(false);
    }
  };



  const handleAddParameter = () => {
    const paramKey = newParameter.name.toLowerCase().replace(/\s+/g, '_');
    
    if (customParameters[paramKey]) {
      toast.error('Parameter with this name already exists');
      return;
    }

    setCustomParameters(prev => ({
      ...prev,
      [paramKey]: {
        name: newParameter.name,
        description: newParameter.description,
        weight: newParameter.weight,
        min_questions: newParameter.min_questions,
        max_questions: newParameter.max_questions,
        scoring_criteria: newParameter.scoring_criteria.filter(c => c.trim())
      }
    }));

    setNewParameter({
      name: '',
      description: '',
      weight: 25,
      min_questions: 2,
      max_questions: 5,
      scoring_criteria: ['', '', '', '']
    });
    setShowAddForm(false);
  };

  const handleLoadExamples = () => {
    const examples = getExampleParameters(roleName);
    const newParams = {};
    
    examples.forEach((example, index) => {
      const paramKey = example.name.toLowerCase().replace(/\s+/g, '_');
      newParams[paramKey] = {
        name: example.name,
        description: example.description,
        weight: example.weight,
        min_questions: 2,
        max_questions: 5,
        scoring_criteria: [
          'Excellent understanding and application',
          'Good knowledge with room for improvement',
          'Basic understanding, needs development',
          'Limited knowledge, requires significant training'
        ]
      };
    });
    
    setCustomParameters(newParams);
    toast.success(`Loaded ${examples.length} example parameters for ${roleName}`);
  };

  const generateDescription = async (parameterName) => {
    if (!parameterName.trim()) return;
    
    setIsGeneratingDescription(true);
    try {
      const response = await fetch('/api/generate-parameter-description', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          parameter_name: parameterName,
          role_name: roleName
        })
      });

      if (response.ok) {
        const data = await response.json();
        setNewParameter(prev => ({
          ...prev,
          description: data.description
        }));
        toast.success('Description generated automatically!');
      } else {
        const errorData = await response.json();
        toast.error(`Failed to generate description: ${errorData.error}`);
      }
    } catch (error) {
      console.error('Error generating description:', error);
      toast.error('Failed to generate description. Please try again.');
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleDeleteParameter = (paramKey) => {
    setCustomParameters(prev => {
      const updated = { ...prev };
      delete updated[paramKey];
      return updated;
    });
  };

  const handleEditParameter = (paramKey: string) => {
    const param = customParameters[paramKey];
    setEditingParameter({
      key: paramKey,
      ...param
    });
  };

  const handleSaveEdit = () => {
    if (!editingParameter) return;

    setCustomParameters(prev => ({
      ...prev,
      [editingParameter.key]: {
        name: editingParameter.name,
        description: editingParameter.description,
        weight: editingParameter.weight,
        min_questions: editingParameter.min_questions,
        max_questions: editingParameter.max_questions,
        scoring_criteria: editingParameter.scoring_criteria.filter(c => c.trim())
      }
    }));

    setEditingParameter(null);
  };

  const handleBack = () => {
    navigate('/setup', {
      state: {
        roleName: roleName,
        candidateName: location.state?.candidateName || ''
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="animate-spin h-8 w-8 text-blue-500" />
        <span className="ml-2">Loading parameters...</span>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 animate-fade-in">
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBack}
            className="flex items-center text-gray-600 hover:text-gray-800 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Setup
          </button>
        </div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Assessment Framework Overview - {roleName}
        </h2>
                 <p className="text-gray-600">
           View and manage assessment frameworks for this role. Review existing parameters and their configurations.
         </p>
      </div>



      {/* Custom Parameters */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                     <h3 className="text-lg font-semibold text-gray-900 flex items-center">
             <Settings className="h-5 w-5 mr-2 text-green-500" />
             Assessment Parameters
             <span className="ml-2 text-sm font-normal text-gray-500">
               ({Object.keys(customParameters).length} parameter{Object.keys(customParameters).length !== 1 ? 's' : ''})
             </span>
           </h3>
          <div className="flex gap-2">
            <button
              onClick={generateDynamicParameters}
              disabled={isGeneratingParameters}
                              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isGeneratingParameters ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Brain className="h-4 w-4 mr-2" />
              )}
              {isGeneratingParameters ? 'Generating...' : 'Generate AI Parameters'}
            </button>
            <button
              onClick={handleLoadExamples}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Brain className="h-4 w-4 mr-2" />
              Load Examples
            </button>
            <button
              onClick={() => setShowAddForm(true)}
                              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Parameter
            </button>
          </div>
        </div>

                 {Object.keys(customParameters).length === 0 ? (
           <div className="text-center py-8 text-gray-500">
             <Brain className="h-12 w-12 mx-auto mb-4 text-gray-300" />
             <p>No assessment parameters defined yet.</p>
             <p className="text-sm">Create 1-10 parameters to customize the assessment for this role.</p>
             <p className="text-xs text-gray-400 mt-1">Tip: You can always add or remove parameters later.</p>
           </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(customParameters).map(([key, param]) => (
              <div key={key} className="bg-green-50 rounded-lg p-4 border border-green-200">
                <div className="flex justify-between items-start mb-2">
                  <h4 className="font-medium text-gray-900">{param.name}</h4>
                  <div className="flex items-center space-x-2">
                    <span className="bg-green-100 text-green-800 text-sm font-medium px-2 py-1 rounded">
                      {param.weight}%
                    </span>
                    <button
                      onClick={() => handleEditParameter(key)}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteParameter(key)}
                      className="text-red-400 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <p className="text-sm text-gray-600 mb-2">{param.description}</p>
                <div className="text-xs text-gray-500">
                  Questions: {param.min_questions}-{param.max_questions}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Weight Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="flex justify-between items-center">
                     <div>
             <h3 className="text-lg font-semibold text-gray-900">Weight Summary</h3>
             <p className="text-sm text-gray-600">
               Total weight: {calculateTotalWeight()}% • {Object.keys(customParameters).length} parameter{Object.keys(customParameters).length !== 1 ? 's' : ''}
             </p>
             <p className="text-xs text-gray-500 mt-1">
               {Object.keys(customParameters).length === 0 && "Create at least 1 parameter to start"}
               {Object.keys(customParameters).length === 1 && "You can add more parameters or keep it simple"}
               {Object.keys(customParameters).length > 1 && Object.keys(customParameters).length <= 5 && "Good balance of parameters"}
               {Object.keys(customParameters).length > 5 && "Consider if all parameters are necessary"}
             </p>
           </div>
          <div className="flex items-center space-x-4">
            {calculateTotalWeight() === 100 ? (
              <div className="flex items-center text-green-600">
                <CheckCircle className="h-5 w-5 mr-2" />
                <span className="font-medium">Perfect!</span>
              </div>
            ) : (
              <div className="flex items-center text-red-600">
                <AlertCircle className="h-5 w-5 mr-2" />
                <span className="font-medium">Must equal 100%</span>
              </div>
            )}
            <button
              onClick={handleSaveParameters}
              disabled={isSaving || calculateTotalWeight() !== 100}
              className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Save className="h-4 w-4 mr-2" />
              )}
              Save Parameters
            </button>
            {parametersSaved && (
              <button
                onClick={() => {
                  // Navigate directly to interview creation with role and parameters ready
                  navigate('/interview', {
                    state: {
                      roleName: roleName,
                      customParametersSaved: true,
                      skipSetup: true,
                      readyForInterview: true
                    }
                  });
                }}
                className="flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Play className="h-4 w-4 mr-2" />
                Start Interview
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Dynamic Configuration Preview */}
      {dynamicConfig && (
        <div className="bg-blue-50 rounded-lg border border-blue-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center">
            <Target className="h-5 w-5 mr-2" />
            Dynamic Question Distribution Preview
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 15-minute interview */}
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">15-minute Interview (5 questions)</h4>
              <div className="space-y-2">
                {dynamicConfig.config15?.parameters?.map((param, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-700">{param.name}</span>
                    <span className="font-medium text-blue-600">
                      {param.assigned_questions} question{param.assigned_questions !== 1 ? 's' : ''}
                    </span>
                  </div>
                )) || (
                  <div className="text-sm text-gray-500">Loading...</div>
                )}
              </div>
            </div>
            
            {/* 30-minute interview */}
            <div className="bg-white rounded-lg p-4 border border-blue-200">
              <h4 className="font-semibold text-blue-800 mb-2">30-minute Interview (10 questions)</h4>
              <div className="space-y-2">
                {dynamicConfig.config30?.parameters?.map((param, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-gray-700">{param.name}</span>
                    <span className="font-medium text-blue-600">
                      {param.assigned_questions} question{param.assigned_questions !== 1 ? 's' : ''}
                    </span>
                  </div>
                )) || (
                  <div className="text-sm text-gray-500">Loading...</div>
                )}
              </div>
            </div>
          </div>
          
          <div className="mt-4 text-xs text-blue-600">
            <p>💡 The system automatically distributes questions across your parameters based on interview duration.</p>
          </div>
        </div>
      )}

      {/* Add Parameter Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
                         <h3 className="text-lg font-semibold mb-4">Create Assessment Parameter</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parameter Name
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newParameter.name}
                    onChange={(e) => setNewParameter(prev => ({ ...prev, name: e.target.value }))}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter' && newParameter.name.trim() && !isGeneratingDescription) {
                        e.preventDefault();
                        generateDescription(newParameter.name);
                      }
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Confidence, Technical Skills, Communication"
                  />
                  <button
                    type="button"
                    onClick={() => generateDescription(newParameter.name)}
                    disabled={!newParameter.name.trim() || isGeneratingDescription}
                    className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center"
                    title="Generate description automatically"
                  >
                    {isGeneratingDescription ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Brain className="h-4 w-4" />
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Type a parameter name and click the brain icon to auto-generate a description
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                  {newParameter.description && (
                    <span className="ml-2 text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                      Auto-generated
                    </span>
                  )}
                </label>
                <textarea
                  value={newParameter.description}
                  onChange={(e) => setNewParameter(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe what this parameter measures... (Click the brain icon to auto-generate)"
                />
                {newParameter.description && (
                  <p className="text-xs text-gray-500 mt-1">
                    You can edit this description to better match your requirements
                  </p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weight (%)
                  </label>
                  <input
                    type="number"
                    value={newParameter.weight}
                    onChange={(e) => setNewParameter(prev => ({ ...prev, weight: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Questions
                  </label>
                  <input
                    type="number"
                    value={newParameter.min_questions}
                    onChange={(e) => setNewParameter(prev => ({ ...prev, min_questions: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Questions
                  </label>
                  <input
                    type="number"
                    value={newParameter.max_questions}
                    onChange={(e) => setNewParameter(prev => ({ ...prev, max_questions: parseInt(e.target.value) || 5 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scoring Criteria
                </label>
                {newParameter.scoring_criteria.map((criterion, index) => (
                  <input
                    key={index}
                    type="text"
                    value={criterion}
                    onChange={(e) => {
                      const updated = [...newParameter.scoring_criteria];
                      updated[index] = e.target.value;
                      setNewParameter(prev => ({ ...prev, scoring_criteria: updated }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                    placeholder={`Criterion ${index + 1}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
                             <button
                 onClick={handleAddParameter}
                 disabled={!newParameter.name.trim()}
                 className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
               >
                 Create Parameter
               </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Parameter Form */}
      {editingParameter && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Edit Parameter</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Parameter Name
                </label>
                <input
                  type="text"
                  value={editingParameter.name}
                  onChange={(e) => setEditingParameter(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editingParameter.description}
                  onChange={(e) => setEditingParameter(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Weight (%)
                  </label>
                  <input
                    type="number"
                    value={editingParameter.weight}
                    onChange={(e) => setEditingParameter(prev => ({ ...prev, weight: parseInt(e.target.value) || 0 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                    max="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Min Questions
                  </label>
                  <input
                    type="number"
                    value={editingParameter.min_questions}
                    onChange={(e) => setEditingParameter(prev => ({ ...prev, min_questions: parseInt(e.target.value) || 1 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Questions
                  </label>
                  <input
                    type="number"
                    value={editingParameter.max_questions}
                    onChange={(e) => setEditingParameter(prev => ({ ...prev, max_questions: parseInt(e.target.value) || 5 }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    min="1"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Scoring Criteria
                </label>
                {editingParameter.scoring_criteria.map((criterion, index) => (
                  <input
                    key={index}
                    type="text"
                    value={criterion}
                    onChange={(e) => {
                      const updated = [...editingParameter.scoring_criteria];
                      updated[index] = e.target.value;
                      setEditingParameter(prev => ({ ...prev, scoring_criteria: updated }));
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
                  />
                ))}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingParameter(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {parametersSaved && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-gray-900 mb-2">Parameters Saved!</h3>
            <p className="text-gray-600 mb-4">Your assessment parameters have been saved.</p>
            <button
                              onClick={() => {
                  setParametersSaved(false);
                  // Navigate back to setup with role and parameters ready
                  navigate('/setup', {
                    state: {
                      roleName: roleName,
                      candidateName: location.state?.candidateName || '',
                      customParametersSaved: true
                    }
                  });
                }}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Interview
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomParameterManager;
