import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Mail } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

interface Plan {
  plan_id: string;
  plan_name: string;
  plan_cost: number;
  max_cvs: number;
  max_users: number;
  active_jobs: number;
  status: string;
  currency?: string;
  duration?: number;
  max_token?: number;
  plan_type?: 'cv' | 'interview' | 'combo';
  max_interviews?: number | null;
}

const Pricing = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnnual, setIsAnnual] = useState(true);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('USD');
  const [exchangeRate, setExchangeRate] = useState(90); // Fallback rate
  const [loadingRate, setLoadingRate] = useState(false);
  const [planTypeFilter, setPlanTypeFilter] = useState<'cv' | 'interview' | 'combo'>('combo');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
    fetchExchangeRate();
  }, []);

  // Fetch real-time exchange rate from free API
  const fetchExchangeRate = async () => {
    setLoadingRate(true);
    try {
      const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (!response.ok) throw new Error('Failed to fetch exchange rate');
      
      const data = await response.json();
      const rate = data.rates?.INR;
      
      if (rate && typeof rate === 'number') {
        setExchangeRate(rate);
        console.log('Real-time exchange rate: 1 USD =', rate, 'INR');
      }
    } catch (error) {
      console.error('Error fetching exchange rate:', error);
      // Keep fallback rate of 90 if API fails
    } finally {
      setLoadingRate(false);
    }
  };

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('status', 'Active')
        .order('plan_cost', { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error: any) {
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

  const calculatePrice = (baseCost: number) => {
    let price = baseCost;
    
    // Apply annual discount if selected (12 months in a year)
    if (isAnnual) {
      price = baseCost * 12 * 0.85; // 15% discount on annual (12 months)
    }
    
    // Convert currency if needed
    if (currency === 'USD') {
      price = price / exchangeRate; // Convert INR to USD using real-time rate
    }
    
    // Round up the final price
    return Math.ceil(price);
  };

  const calculateMonthlyRate = (annualPrice: number) => {
    return (annualPrice / 12).toFixed(2);
  };

  const handleSelectPlan = (plan: Plan) => {
    navigate('/login');
    toast({
      title: 'Ready to sign up?',
      description: `You selected ${plan.plan_name}. Please sign up to get started.`,
    });
  };

  const freePlans = plans.filter((p) => Number(p.plan_cost) === 0);
  const paidPlans = plans.filter((p) => Number(p.plan_cost) > 0);
  const filteredPaidPlans = paidPlans.filter((p) => (p.plan_type || 'cv') === planTypeFilter);
  const totalPlanCards = freePlans.length + filteredPaidPlans.length;
  const gridCols = Math.max(1, Math.min(totalPlanCards, 6)); // spread plan cards; cap at 6

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0d6ea3] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pricing plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header Section */}
      <header className="bg-white shadow-sm border-b">
        <div className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-12 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <div>
                <img src={`${import.meta.env.BASE_URL}Logo_Transparent_BG.png`} alt="ProValuate" className="h-12 sm:h-16 lg:h-20" />
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href={import.meta.env.BASE_URL}
                className="font-medium text-[#0d6ea3] hover:text-[#042C53] transition-colors"
              >
                Home
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Pricing Header – use most of viewport width */}
      <section className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 xl:px-12 py-8 sm:py-12 lg:py-16">
        <div className="text-center mb-8 sm:mb-12">
          <h2 className="text-2xl sm:text-3xl md:text-5xl font-bold text-gray-900 mb-3 sm:mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto mb-6 sm:mb-8 px-1">
            Choose the perfect plan for your recruiting needs. All plans include access to our AI-powered resume screening and ranking engine.
          </p>

          {/* Billing & Currency Toggles – stack on small screens */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6 mb-6 flex-wrap">
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-2 sm:space-x-4">
              <span className={`text-sm font-medium ${!isAnnual ? 'text-gray-900' : 'text-gray-600'}`}>
                Monthly
              </span>
              <Switch
                checked={isAnnual}
                onCheckedChange={setIsAnnual}
                className="h-6 w-11 data-[state=checked]:bg-[#0d6ea3] data-[state=unchecked]:bg-[#dbeafe]"
              />
              <span className={`text-sm font-medium ${isAnnual ? 'text-gray-900' : 'text-gray-600'}`}>
                Annual
              </span>
            </div>

            {/* Plan Type Toggle – centered between billing and currency */}
            <div className="w-full sm:w-auto overflow-x-auto">
              <div className="min-w-max flex items-center justify-center gap-2 sm:space-x-2 bg-white rounded-full px-2 py-1 shadow-sm">
              <button
                type="button"
                onClick={() => setPlanTypeFilter('cv')}
                className={`px-3 py-1 text-xs sm:text-sm rounded-full font-medium transition-colors ${
                  planTypeFilter === 'cv'
                    ? 'text-white shadow-[0_4px_14px_rgba(13,110,163,0.22)] [background:linear-gradient(135deg,#042C53,#0d6ea3)]'
                    : 'bg-transparent text-gray-700 hover:bg-[#0d6ea3]/10 hover:text-[#042C53]'
                }`}
              >
                CV Only
              </button>
              <button
                type="button"
                onClick={() => setPlanTypeFilter('interview')}
                className={`px-3 py-1 text-xs sm:text-sm rounded-full font-medium transition-colors ${
                  planTypeFilter === 'interview'
                    ? 'text-white shadow-[0_4px_14px_rgba(13,110,163,0.22)] [background:linear-gradient(135deg,#042C53,#0d6ea3)]'
                    : 'bg-transparent text-gray-700 hover:bg-[#0d6ea3]/10 hover:text-[#042C53]'
                }`}
              >
                Interviews Only
              </button>
              <button
                type="button"
                onClick={() => setPlanTypeFilter('combo')}
                className={`px-3 py-1 text-xs sm:text-sm rounded-full font-medium transition-colors ${
                  planTypeFilter === 'combo'
                    ? 'text-white shadow-[0_4px_14px_rgba(13,110,163,0.22)] [background:linear-gradient(135deg,#042C53,#0d6ea3)]'
                    : 'bg-transparent text-gray-700 hover:bg-[#0d6ea3]/10 hover:text-[#042C53]'
                }`}
              >
                Combo
              </button>
              </div>
            </div>

            {/* Currency Toggle */}
            <div className="flex items-center justify-center gap-2 sm:space-x-4">
              <span className={`text-sm font-medium ${currency === 'INR' ? 'text-gray-900' : 'text-gray-600'}`}>
                INR
              </span>
              <Switch
                checked={currency === 'USD'}
                onCheckedChange={(checked) => setCurrency(checked ? 'USD' : 'INR')}
                className="h-6 w-11 data-[state=checked]:bg-[#0d6ea3] data-[state=unchecked]:bg-[#dbeafe]"
              />
              <span className={`text-sm font-medium ${currency === 'USD' ? 'text-gray-900' : 'text-gray-600'}`}>
                USD
              </span>
            </div>
          </div>
        </div>

        {/* Plans Grid – 1 col mobile, 2 md, dynamic lg; one-time card full width below */}
        <style>{`
          .pricing-grid { grid-template-columns: repeat(1, minmax(0, 1fr)); }
          @media (min-width: 768px) { .pricing-grid { grid-template-columns: repeat(2, minmax(220px, 1fr)); } }
          @media (min-width: 1024px) { .pricing-grid { grid-template-columns: repeat(${gridCols}, minmax(220px, 1fr)); } }
        `}</style>
        <div className="pricing-grid grid gap-4 sm:gap-6 mb-8 sm:mb-12">
          {/* Free plans from DB – only plans with status = Active and plan_cost = 0 */}
          {freePlans.map((plan) => (
            <Card
              key={plan.plan_id}
              className="border-2 border-gray-200 hover:border-[#0d6ea3]/40 transition-all duration-300 flex flex-col min-w-0"
            >
              <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
                <CardTitle className="text-xl sm:text-2xl mb-1 sm:mb-2">{plan.plan_name.replace(/_/g, ' ')}</CardTitle>
                <CardDescription className="text-gray-600 text-sm">
                  Perfect for getting used to the system
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col px-4 sm:px-6 pb-4 sm:pb-6">
                <div className="mb-4 sm:mb-6">
                  <div className="flex items-baseline flex-wrap gap-x-2">
                    <span className="text-3xl sm:text-4xl font-bold text-gray-900">₹0</span>
                    <span className="text-gray-600 ml-2">
                      {plan.duration === 0 || plan.duration == null ? 'Forever' : `/ ${plan.duration ?? 30} days`}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {plan.duration === 0 || plan.duration == null ? 'Free forever' : 'Free trial'}
                  </p>
                </div>
                <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 flex-1">
                  {plan.max_cvs != null && (
                    <li className="flex items-start space-x-2 sm:space-x-3">
                      <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-xs sm:text-sm text-gray-700"><strong>{plan.max_cvs}</strong> CVs</span>
                    </li>
                  )}
                  {plan.max_interviews != null && (
                    <li className="flex items-start space-x-2 sm:space-x-3">
                      <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-xs sm:text-sm text-gray-700"><strong>{plan.max_interviews}</strong> interviews</span>
                    </li>
                  )}
                  <li className="flex items-start space-x-2 sm:space-x-3">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-gray-700"><strong>{plan.max_users}</strong> team member{plan.max_users > 1 ? 's' : ''}</span>
                  </li>
                  <li className="flex items-start space-x-2 sm:space-x-3">
                    <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    <span className="text-xs sm:text-sm text-gray-700"><strong>{plan.active_jobs}</strong> active job descriptions</span>
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
          {filteredPaidPlans.map((plan) => {
              // Calculate prices using real-time exchange rate
              const monthlyBasePrice = currency === 'USD' ? Math.ceil(plan.plan_cost / exchangeRate) : plan.plan_cost;
              const annualBasePrice = plan.plan_cost * 12;
              const annualDiscountedPrice = isAnnual ? Math.ceil(annualBasePrice * 0.85 * (currency === 'USD' ? 1/exchangeRate : 1)) : 0;
              const monthlyPrice = monthlyBasePrice;
              const annualPrice = currency === 'USD' ? Math.ceil(annualBasePrice / exchangeRate) : annualBasePrice;
              const displayPrice = isAnnual ? annualDiscountedPrice : monthlyPrice;

              return (
                <Card
                  key={plan.plan_id}
                  className="border-2 border-gray-200 hover:border-[#0d6ea3]/40 transition-all duration-300 flex flex-col min-w-0"
                >
                  <CardHeader className="pb-3 sm:pb-4 px-4 sm:px-6">
                    <CardTitle className="text-xl sm:text-2xl mb-1 sm:mb-2">{plan.plan_name}</CardTitle>
                    <CardDescription className="text-gray-600 text-sm">
                      Perfect for getting used to the system
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col px-4 sm:px-6 pb-4 sm:pb-6">
                    {/* Pricing */}
                    <div className="mb-4 sm:mb-6">
                      <div className="flex items-baseline flex-wrap gap-x-2">
                        <span className="text-3xl sm:text-4xl font-bold text-gray-900">
                          {currency === 'USD' ? '$' : '₹'}{displayPrice}
                        </span>
                        <span className="text-gray-600 ml-2">
                          {isAnnual ? '/year' : '/month'}
                        </span>
                      </div>
                      {isAnnual && (
                        <p className="text-xs sm:text-sm text-green-600 font-medium mt-1 sm:mt-2">
                          {currency === 'USD' ? '$' : '₹'}{displayPrice}/year (Save 15%)
                        </p>
                      )}
                      {isAnnual && (
                        <p className="text-xs text-gray-500 mt-1">
                          Equivalent to {currency === 'USD' ? '$' : '₹'}{calculateMonthlyRate(displayPrice)}/month
                        </p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        {isAnnual ? 'Billed annually (12 months)' : 'Billed monthly (30-day cycles)'}
                      </p>
                    </div>

                    {/* Features List */}
                    <ul className="space-y-2 sm:space-y-3 mb-4 sm:mb-6 flex-1">
                      {plan.max_cvs != null && (
                        <li className="flex items-start space-x-2 sm:space-x-3">
                          <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-xs sm:text-sm text-gray-700">
                            <strong>{plan.max_cvs === 0 ? 'Unlimited' : isAnnual ? plan.max_cvs * 12 : plan.max_cvs}</strong> CVs {isAnnual ? 'per year' : 'per month'}
                          </span>
                        </li>
                      )}
                      {plan.max_interviews != null && (
                        <li className="flex items-start space-x-2 sm:space-x-3">
                          <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          <span className="text-xs sm:text-sm text-gray-700">
                            <strong>{plan.max_interviews === 0 ? 'Unlimited' : isAnnual ? plan.max_interviews * 12 : plan.max_interviews}</strong> interviews {isAnnual ? 'per year' : 'per month'}
                          </span>
                        </li>
                      )}
                      <li className="flex items-start space-x-2 sm:space-x-3">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-xs sm:text-sm text-gray-700">
                          <strong>{plan.max_users || 'Unlimited'}</strong> team members
                        </span>
                      </li>
                      <li className="flex items-start space-x-2 sm:space-x-3">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-xs sm:text-sm text-gray-700">
                          <strong>{plan.active_jobs || 'Unlimited'}</strong> active job descriptions
                        </span>
                      </li>
                      <li className="flex items-start space-x-2 sm:space-x-3">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-xs sm:text-sm text-gray-700">
                          AI-powered resume screening
                        </span>
                      </li>
                      <li className="flex items-start space-x-2 sm:space-x-3">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-xs sm:text-sm text-gray-700">
                          Custom evaluation criteria
                        </span>
                      </li>
                      <li className="flex items-start space-x-2 sm:space-x-3">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-xs sm:text-sm text-gray-700">
                          Standard support
                        </span>
                      </li>
                    </ul>

                    {/* CTA Button */}
                    <Button
                      onClick={() => handleSelectPlan(plan)}
                      variant="outline"
                      className="w-full h-10 sm:h-11 text-sm sm:text-base border-[#0d6ea3]/40 text-[#0d6ea3] hover:bg-[#0d6ea3]/10 hover:text-[#042C53]"
                    >
                      Get Started
                    </Button>
                  </CardContent>
                </Card>
              );
          })}

          {/* One-time plans – full width below plan cards so width follows grid */}
          <Card className="border-2 border-dashed border-emerald-500 flex flex-col min-w-0" style={{ gridColumn: '1 / -1' }}>
            <CardContent className="flex-1 flex flex-col items-center justify-center py-6 sm:py-8 px-4 text-center">
              <p className="text-base sm:text-lg font-semibold text-gray-900">One-time plans</p>
              <p className="text-xs sm:text-sm text-gray-600 mt-2 break-words">
                Contact <a href="mailto:sales@aitamate.com" className="font-medium text-[#0d6ea3] hover:text-[#042C53] underline">sales@aitamate.com</a> for more details.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Features Comparison */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-4 sm:px-6 py-6 sm:py-8">
            <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-4 sm:mb-6">All plans include:</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              <div className="flex items-start space-x-2 sm:space-x-3">
                <Check className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">AI-Powered Screening</h4>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Intelligent resume parsing and ranking
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-2 sm:space-x-3">
                <Check className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Custom Criteria</h4>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Define your own evaluation parameters
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-2 sm:space-x-3">
                <Check className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Secure & Compliant</h4>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Enterprise-grade security standards
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-2 sm:space-x-3">
                <Check className="h-5 w-5 sm:h-6 sm:w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h4 className="font-semibold text-gray-900 text-sm sm:text-base">Team Collaboration</h4>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Invite your team and collaborate
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-10 sm:mt-16 text-center px-2">
          <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-6 sm:mb-8">
            Questions about pricing?
          </h3>
          <div className="bg-white rounded-lg shadow-lg p-4 sm:p-6 md:p-8 max-w-2xl mx-auto">
            <p className="text-sm sm:text-base text-gray-600 mb-4">
              We're here to help! Our team is ready to answer any questions about our plans and features.
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

      {/* Footer */}
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