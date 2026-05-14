import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Check, Mail } from 'lucide-react';
import { API_CONFIG, buildApiUrl } from '@/constants/api';

interface CandidatePlan {
  id: string;
  plan_name: string;
  jd_count: number;
  cost: number;
  interview_count: number;
  is_free: boolean;
}

const CandidatePricing = () => {
  const [plans, setPlans] = useState<CandidatePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        setLoading(true);
        const res = await fetch(buildApiUrl(API_CONFIG.ENDPOINTS.CANDIDATE_PLANS));
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
        console.error('Error fetching candidate plans:', error);
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

  const handleGetStarted = (plan: CandidatePlan) => {
    navigate('/candidate-login');
    toast({
      title: 'Get started',
      description: `You selected ${plan.plan_name}. Sign in or create an account to continue.`,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sky-50 to-sky-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1a9fd6] mx-auto mb-4" />
          <p className="text-gray-600">Loading plans...</p>
        </div>
      </div>
    );
  }

  const gridCols = Math.max(1, Math.min(plans.length, 4));

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-sky-50 to-sky-100">
      {/* Header – match candidate login */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-wrap justify-between items-center gap-2">
            <Link to="/candidate-login" className="flex items-center space-x-2 min-h-[44px]">
              <img src={`${import.meta.env.BASE_URL}Logo_Transparent_BG.png`} alt="ProValuate" className="h-10 sm:h-16 lg:h-20 w-auto" />
            </Link>
            <div className="flex items-center gap-2 sm:gap-4">
              <Link to="/candidate-login" className="min-h-[44px] flex items-center px-3 py-2 text-sm sm:text-base font-semibold text-[#1a9fd6] hover:text-[#0a3a5a] transition-colors">
                Home
              </Link>
              <a href="mailto:sales@aitamate.com?&subject=Provaluate&body=Hi,%0D%0A%0D%0AI'm facing an issue with ProValuate.%0D%0A%0D%0APlease provide me with more information with the below...%0D%0A%0D%0ARegards," target="_top" className="min-h-[44px] min-w-[44px] flex items-center justify-center text-sky-600 hover:text-sky-800 transition-colors" aria-label="Contact support">
                <Mail className="h-6 w-6 sm:h-8 sm:w-8" />
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Pricing section */}
      <section className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-3 sm:mb-4">
            Candidate plans
          </h2>
          <p className="text-base sm:text-lg text-gray-600 max-w-2xl mx-auto px-1">
            Choose a plan that fits your interview and job description needs. One-time purchase.
          </p>
        </div>

        <style>{`
          .candidate-pricing-grid { grid-template-columns: repeat(1, minmax(0, 1fr)); }
          @media (min-width: 640px) { .candidate-pricing-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
          @media (min-width: 1024px) { .candidate-pricing-grid { grid-template-columns: repeat(${gridCols}, minmax(220px, 1fr)); } }
        `}</style>
        <div className="candidate-pricing-grid grid gap-4 sm:gap-6 mb-8 sm:mb-12">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className="border-2 border-gray-200 hover:border-[#1a9fd6]/40 transition-all duration-300 flex flex-col min-w-0"
            >
              <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
                <CardTitle className="text-xl sm:text-2xl mb-1 sm:mb-2">
                  {plan.plan_name.replace(/_/g, ' ')}
                </CardTitle>
                <CardDescription className="text-gray-600 text-sm">
                  {plan.is_free ? 'Get started at no cost' : 'One-time purchase'}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="mb-4 sm:mb-6">
                  <div className="flex items-baseline flex-wrap gap-x-2">
                    <span className="text-3xl sm:text-4xl font-bold text-gray-900">
                      {plan.is_free ? '₹0' : `₹${Number(plan.cost)}`}
                    </span>
                    {!plan.is_free && <span className="text-gray-600">one-time</span>}
                  </div>
                </div>
                <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 flex-1">
                  <li className="flex items-start space-x-2 sm:space-x-3">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-gray-700">
                      <strong>{plan.interview_count}</strong> interview{plan.interview_count !== 1 ? 's' : ''}
                    </span>
                  </li>
                  <li className="flex items-start space-x-2 sm:space-x-3">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-gray-700">
                      <strong>{plan.jd_count}</strong> job description{plan.jd_count !== 1 ? 's' : ''}
                    </span>
                  </li>
                  <li className="flex items-start space-x-2 sm:space-x-3">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-gray-700">AI-powered interview feedback</span>
                  </li>
                  <li className="flex items-start space-x-2 sm:space-x-3">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-gray-700">Profile & reports in one place</span>
                  </li>
                </ul>
                <Button
                  onClick={() => handleGetStarted(plan)}
                  variant="outline"
                  className="w-full h-10 sm:h-11 text-sm sm:text-base border-[#1a9fd6]/40 text-[#1a9fd6] hover:bg-[#1a9fd6]/10 hover:text-[#0a3a5a]"
                >
                  Get started
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        {plans.length === 0 && (
          <div className="text-center py-12 text-gray-600">
            <p>No plans available at the moment. Please try again later.</p>
            <Link to="/candidate-login" className="text-[#1a9fd6] hover:text-[#0a3a5a] underline mt-2 inline-block">Back to candidate login</Link>
          </div>
        )}

        {/* Footer CTA */}
        <div className="mt-10 sm:mt-16 text-center px-2">
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 sm:mb-8">
            Questions about plans?
          </h3>
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              We're here to help. Contact us for any questions about candidate plans.
            </p>
            <a
              href="mailto:sales@aitamate.com?subject=ProValuate%20Candidate%20Plans"
              className="inline-flex items-center justify-center gap-2 text-white px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg font-medium transition-colors text-sm sm:text-base shadow-[0_4px_18px_rgba(37,99,235,0.28)] hover:shadow-[0_6px_22px_rgba(37,99,235,0.34)] [background:linear-gradient(135deg,#1a9fd6,#2563eb)] hover:[background:linear-gradient(135deg,#1490c0,#1d4ed8)]"
            >
              <Mail className="h-4 w-4 sm:h-5 sm:w-5 shrink-0" />
              Contact support
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};

export default CandidatePricing;
