import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
}

const Pricing = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAnnual, setIsAnnual] = useState(false);
  const [currency, setCurrency] = useState<'INR' | 'USD'>('INR');
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('plans')
        .select('*')
        .eq('status', 'Active')
        .gt('plan_cost', 0)
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
      price = price / 90; // Convert INR to USD (1 USD = 90 INR)
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pricing plans...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header Section */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div>
                <img src="/logo.png" alt="ProValuate" className="h-8 w-8" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900">ProValuate</h1>
            </div>
            <div className="flex items-center space-x-4">
              <a
                href="/"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                Home
              </a>
            </div>
          </div>
        </div>
      </header>

      {/* Pricing Header */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
            Choose the perfect plan for your recruiting needs. All plans include access to our AI-powered resume screening and ranking engine.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center space-x-4 mb-6">
            <span className={`text-sm font-medium ${!isAnnual ? 'text-gray-900' : 'text-gray-600'}`}>
              Monthly
            </span>
            <Switch
              checked={isAnnual}
              onCheckedChange={setIsAnnual}
              className="h-6 w-11"
            />
            <span className={`text-sm font-medium ${isAnnual ? 'text-gray-900' : 'text-gray-600'}`}>
              Annual
            </span>
            {isAnnual && (
              <Badge className="bg-green-100 text-green-800 ml-2 hover:bg-green-100">
                Save 15%
              </Badge>
            )}
          </div>

          {/* Currency Toggle */}
          <div className="flex items-center justify-center space-x-4">
            <span className={`text-sm font-medium ${currency === 'INR' ? 'text-gray-900' : 'text-gray-600'}`}>
              INR
            </span>
            <Switch
              checked={currency === 'USD'}
              onCheckedChange={(checked) => setCurrency(checked ? 'USD' : 'INR')}
              className="h-6 w-11"
            />
            <span className={`text-sm font-medium ${currency === 'USD' ? 'text-gray-900' : 'text-gray-600'}`}>
              USD
            </span>
            {/* <Badge className="bg-blue-100 text-blue-800 ml-2 hover:bg-blue-100">
              1 USD = 90 INR
            </Badge> */}
          </div>
        </div>

        {/* Plans Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {plans.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-600">No plans available at the moment.</p>
            </div>
          ) : (
            plans.map((plan) => {
              // Calculate prices
              const monthlyBasePrice = currency === 'USD' ? Math.ceil(plan.plan_cost / 90) : plan.plan_cost;
              const annualBasePrice = plan.plan_cost * 12;
              const annualDiscountedPrice = isAnnual ? Math.ceil(annualBasePrice * 0.85 * (currency === 'USD' ? 1/90 : 1)) : 0;
              const monthlyPrice = monthlyBasePrice;
              const annualPrice = currency === 'USD' ? Math.ceil(annualBasePrice / 90) : annualBasePrice;
              const displayPrice = isAnnual ? annualDiscountedPrice : monthlyPrice;

              return (
                <Card
                  key={plan.plan_id}
                  className={`border-2 transition-all duration-300 flex flex-col ${
                    plan.plan_name === 'Premium' || plan.plan_name === 'Standard'
                      ? 'border-indigo-600 shadow-xl scale-105'
                      : 'border-gray-200 hover:border-indigo-300'
                  }`}
                >
                  {plan.plan_name === 'Premium' || plan.plan_name === 'Standard' ? (
                    <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-indigo-600 hover:bg-indigo-700">
                      Most Popular
                    </Badge>
                  ) : null}

                  <CardHeader className="pb-4">
                    <CardTitle className="text-2xl mb-2">{plan.plan_name}</CardTitle>
                    <CardDescription className="text-gray-600">
                      Perfect for growing teams
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="flex-1 flex flex-col">
                    {/* Pricing */}
                    <div className="mb-6">
                      <div className="flex items-baseline">
                        <span className="text-4xl font-bold text-gray-900">
                          {currency === 'USD' ? '$' : '₹'}{displayPrice}
                        </span>
                        <span className="text-gray-600 ml-2">
                          {isAnnual ? '/year' : '/month'}
                        </span>
                      </div>
                      {isAnnual && (
                        <p className="text-sm text-green-600 font-medium mt-2">
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
                    <ul className="space-y-3 mb-6 flex-1">
                      <li className="flex items-start space-x-3">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">
                          <strong>{plan.max_cvs === 0 ? 'Unlimited' : plan.max_cvs}</strong> CVs per week
                        </span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">
                          <strong>{plan.max_users || 'Unlimited'}</strong> team members
                        </span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">
                          <strong>{plan.active_jobs || 'Unlimited'}</strong> active job descriptions
                        </span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">
                          AI-powered resume screening
                        </span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">
                          Custom evaluation criteria
                        </span>
                      </li>
                      <li className="flex items-start space-x-3">
                        <Check className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-gray-700">
                          Standard support
                        </span>
                      </li>
                    </ul>

                    {/* CTA Button */}
                    <Button
                      onClick={() => handleSelectPlan(plan)}
                      variant={
                        plan.plan_name === 'Premium' || plan.plan_name === 'Standard'
                          ? 'default'
                          : 'outline'
                      }
                      className={`w-full h-11 ${
                        plan.plan_name === 'Premium' || plan.plan_name === 'Standard'
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          : ''
                      }`}
                    >
                      Get Started
                    </Button>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Features Comparison */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-8">
            <h3 className="text-2xl font-bold text-gray-900 mb-6">All plans include:</h3>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="flex items-start space-x-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-gray-900">AI-Powered Screening</h4>
                  <p className="text-sm text-gray-600">
                    Intelligent resume parsing and ranking
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-gray-900">Custom Criteria</h4>
                  <p className="text-sm text-gray-600">
                    Define your own evaluation parameters
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-gray-900">Secure & Compliant</h4>
                  <p className="text-sm text-gray-600">
                    Enterprise-grade security standards
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-gray-900">Team Collaboration</h4>
                  <p className="text-sm text-gray-600">
                    Invite your team and collaborate
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl font-bold text-gray-900 mb-8">
            Questions about pricing?
          </h3>
          <div className="bg-white rounded-lg shadow-lg p-8 max-w-2xl mx-auto">
            <p className="text-gray-600 mb-4">
              We're here to help! Our team is ready to answer any questions about our plans and features.
            </p>
            <a
              href="mailto:rj@aitamate.com?subject=ProValuate%20Pricing%20Inquiry"
              className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              <Mail className="h-5 w-5" />
              <span>Contact Sales</span>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white border-t mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-600">
            <p>© 2024 ProValuate. All rights reserved.</p>
            <p className="text-sm mt-2">
              AI-powered resume evaluation and job matching platform for recruiters
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Pricing;