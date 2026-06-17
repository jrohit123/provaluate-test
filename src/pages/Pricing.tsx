import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Check, Mail } from 'lucide-react';
import { API_CONFIG, buildApiUrl } from '@/constants/api';

interface Plan {
  plan_id: string;
  plan_name: string;
  plan_cost: number;
  max_cvs: number | null;
  max_users: number;
  active_jobs: number;
  status: string;
  plan_type?: 'cv' | 'interview' | 'combo';
  max_interviews?: number | null;
  duration?: number | string | null;
}

const Pricing = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [planTypeFilter, setPlanTypeFilter] = useState<'cv' | 'interview' | 'combo'>('combo');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.RECRUITER_PLANS));
        const data = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray(data?.plans)) {
          setPlans(data.plans);
        } else {
          toast({
            title: 'Error loading plans',
            description: data?.error || 'Failed to load pricing plans. Please refresh the page.',
            variant: 'destructive',
          });
        }
      } catch (error) {
        console.error('Error fetching plans:', error);
        toast({
          title: 'Error loading plans',
          description: 'Failed to load pricing plans. Please refresh the page.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };
    fetchPlans();
  }, [toast]);

  const handleSelectPlan = (plan: Plan) => {
    navigate('/login');
    toast({
      title: 'Ready to sign up?',
      description: `You selected ${plan.plan_name}. Please sign up to get started.`,
    });
  };

  const filteredPlans = plans.filter((p) => (p.plan_type || 'cv') === planTypeFilter);
  const freePlans = filteredPlans.filter((p) => Number(p.plan_cost) === 0);
  const paidPlans = filteredPlans.filter((p) => Number(p.plan_cost) > 0);
  const totalPlanCards = freePlans.length + paidPlans.length;
  const gridCols = Math.max(1, Math.min(totalPlanCards, 6));

  const renderFeatureList = (plan: Plan) => (
    <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 flex-1">
      {plan.max_cvs != null && (
        <li className="flex items-start space-x-2 sm:space-x-3">
          <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <span className="text-xs sm:text-sm text-gray-700">
            <strong>{plan.max_cvs === 0 ? 'Unlimited' : plan.max_cvs}</strong> CVs
          </span>
        </li>
      )}
      {plan.max_interviews != null && (
        <li className="flex items-start space-x-2 sm:space-x-3">
          <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
          <span className="text-xs sm:text-sm text-gray-700">
            <strong>{plan.max_interviews === 0 ? 'Unlimited' : plan.max_interviews}</strong> interviews
          </span>
        </li>
      )}
      <li className="flex items-start space-x-2 sm:space-x-3">
        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <span className="text-xs sm:text-sm text-gray-700">
          <strong>{plan.max_users}</strong> team member{plan.max_users > 1 ? 's' : ''}
        </span>
      </li>
      <li className="flex items-start space-x-2 sm:space-x-3">
        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <span className="text-xs sm:text-sm text-gray-700">
          <strong>{plan.active_jobs}</strong> active job descriptions
        </span>
      </li>
      <li className="flex items-start space-x-2 sm:space-x-3">
        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <span className="text-xs sm:text-sm text-gray-700">AI-powered resume screening</span>
      </li>
      <li className="flex items-start space-x-2 sm:space-x-3">
        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <span className="text-xs sm:text-sm text-gray-700">Custom evaluation criteria</span>
      </li>
      <li className="flex items-start space-x-2 sm:space-x-3">
        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
        <span className="text-xs sm:text-sm text-gray-700">Standard support</span>
      </li>
    </ul>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0d6ea3] mx-auto mb-4" />
          <p className="text-gray-600">Loading pricing plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-12 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <img src={`${import.meta.env.BASE_URL}Logo_Transparent_BG.png`} alt="ProValuate" className="h-12 sm:h-16 lg:h-20" />
            </div>
            <div className="flex items-center space-x-4">
              <Link to="/login" className="font-medium text-[#0d6ea3] hover:text-[#042C53] transition-colors">
                Home
              </Link>
            </div>
          </div>
        </div>
      </header>

      <section className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-12 py-8 sm:py-12 lg:py-16">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-gray-900 mb-3 sm:mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-6 sm:mb-8 px-1">
            Choose the perfect plan for your recruiting needs. One-time purchase — use until your quotas are exhausted.
          </p>

          <div className="flex items-center justify-center mb-6">
            <div className="min-w-max flex items-center justify-center gap-2 sm:space-x-2 bg-white rounded-full px-2 py-1 shadow-sm">
              {(['cv', 'interview', 'combo'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setPlanTypeFilter(type)}
                  className={`px-3 py-1 text-xs sm:text-sm rounded-full font-medium transition-colors ${
                    planTypeFilter === type
                      ? 'text-white shadow-[0_4px_14px_rgba(13,110,163,0.22)] [background:linear-gradient(135deg,#042C53,#0d6ea3)]'
                      : 'bg-transparent text-gray-700 hover:bg-[#0d6ea3]/10 hover:text-[#042C53]'
                  }`}
                >
                  {type === 'cv' ? 'CV Only' : type === 'interview' ? 'Interviews Only' : 'Combo'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <style>{`
          .pricing-grid { grid-template-columns: repeat(1, minmax(0, 1fr)); }
          @media (min-width: 768px) { .pricing-grid { grid-template-columns: repeat(2, minmax(220px, 1fr)); } }
          @media (min-width: 1024px) { .pricing-grid { grid-template-columns: repeat(${gridCols}, minmax(220px, 1fr)); } }
        `}</style>
        <div className="pricing-grid grid gap-4 sm:gap-6 mb-8 sm:mb-12">
          {freePlans.map((plan) => (
            <Card
              key={plan.plan_id}
              className="border-2 border-gray-200 hover:border-[#0d6ea3]/40 transition-all duration-300 flex flex-col min-w-0"
            >
              <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
                <CardTitle className="text-xl sm:text-2xl mb-1 sm:mb-2">{plan.plan_name.replace(/_/g, ' ')}</CardTitle>
                <CardDescription className="text-gray-600 text-sm">Perfect for getting used to the system</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="mb-4 sm:mb-6">
                  <div className="flex items-baseline flex-wrap gap-x-2">
                    <span className="text-3xl sm:text-4xl font-bold text-gray-900">₹0</span>
                    <span className="text-gray-600 ml-2">
                      {plan.duration === 0 || plan.duration == null || plan.duration === '0' ? 'Forever' : `/ ${plan.duration} days`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {plan.duration === 0 || plan.duration == null || plan.duration === '0' ? 'Free forever' : 'Free trial'}
                  </p>
                </div>
                {renderFeatureList(plan)}
                <Button
                  onClick={() => handleSelectPlan(plan)}
                  variant="outline"
                  className="w-full h-10 sm:h-11 text-sm sm:text-base border-[#0d6ea3]/40 text-[#0d6ea3] hover:bg-[#0d6ea3]/10 hover:text-[#042C53]"
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
          ))}

          {paidPlans.map((plan) => (
            <Card
              key={plan.plan_id}
              className="border-2 border-gray-200 hover:border-[#0d6ea3]/40 transition-all duration-300 flex flex-col min-w-0"
            >
              <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
                <CardTitle className="text-xl sm:text-2xl mb-1 sm:mb-2">{plan.plan_name}</CardTitle>
                <CardDescription className="text-gray-600 text-sm">One-time purchase</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="mb-4 sm:mb-6">
                  <div className="flex items-baseline flex-wrap gap-x-2">
                    <span className="text-3xl sm:text-4xl font-bold text-gray-900">₹{Number(plan.plan_cost)}</span>
                    <span className="text-gray-600">one-time</span>
                  </div>
                </div>
                {renderFeatureList(plan)}
                <Button
                  onClick={() => handleSelectPlan(plan)}
                  variant="outline"
                  className="w-full h-10 sm:h-11 text-sm sm:text-base border-[#0d6ea3]/40 text-[#0d6ea3] hover:bg-[#0d6ea3]/10 hover:text-[#042C53]"
                >
                  Get Started
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredPlans.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            <p>No plans available for this category. Try another plan type.</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-4 sm:px-6 py-6 sm:py-8">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">All plans include:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="flex items-start space-x-2 sm:space-x-3">
                <Check className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">AI-Powered Screening</h4>
                  <p className="text-xs sm:text-sm text-gray-600">Intelligent resume parsing and ranking</p>
                </div>
              </div>
              <div className="flex items-start space-x-2 sm:space-x-3">
                <Check className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Custom Criteria</h4>
                  <p className="text-xs sm:text-sm text-gray-600">Define your own evaluation parameters</p>
                </div>
              </div>
              <div className="flex items-start space-x-2 sm:space-x-3">
                <Check className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Secure & Compliant</h4>
                  <p className="text-xs sm:text-sm text-gray-600">Enterprise-grade security standards</p>
                </div>
              </div>
              <div className="flex items-start space-x-2 sm:space-x-3">
                <Check className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Team Collaboration</h4>
                  <p className="text-xs sm:text-sm text-gray-600">Invite your team and collaborate</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 sm:mt-16 text-center px-2">
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 sm:mb-8">Questions about pricing?</h3>
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              We&apos;re here to help! Our team is ready to answer any questions about our plans and features.
            </p>
            <a
              href="mailto:sales@aitamate.com?subject=ProValuate%20Pricing%20Inquiry"
              className="inline-flex items-center justify-center gap-2 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base shadow-[0_4px_18px_rgba(13,110,163,0.28)] hover:shadow-[0_6px_22px_rgba(13,110,163,0.34)] [background:linear-gradient(135deg,#042C53,#0d6ea3)] hover:[background:linear-gradient(135deg,#053565,#0c7eb8)]"
            >
              <Mail className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              <span>Contact Sales</span>
            </a>
          </div>
        </div>
      </section>

      <footer className="bg-white border-t mt-10 sm:mt-16">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-12 py-6 sm:py-8">
          <div className="text-center text-gray-600 text-sm sm:text-base">
            <p>© 2025 ProValuate. All rights reserved.</p>
            <p className="text-xs sm:text-sm mt-2 px-2">
              AI-powered resume evaluation and job matching platform for recruiters
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 mt-4 text-xs sm:text-sm">
              <Link to="/privacy" className="font-medium text-[#0d6ea3] hover:text-[#042C53]">Privacy Policy</Link>
              <span>|</span>
              <Link to="/terms" className="font-medium text-[#0d6ea3] hover:text-[#042C53]">Terms</Link>
              <span>|</span>
              <a href="mailto:sales@aitamate.com?subject=ProValuate%20Contact" className="font-medium text-[#0d6ea3] hover:text-[#042C53]">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;
