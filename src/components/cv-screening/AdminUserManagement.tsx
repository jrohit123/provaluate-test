import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UsageTrackingService } from '@/services/usageTrackingService';

export default function AdminUserManagement() {
  // All hooks must be called unconditionally
  const { user } = useAuth();
  const { toast } = useToast();
  const [company, setCompany] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [plan, setPlan] = useState<any>(null);
  const [availablePlans, setAvailablePlans] = useState<any[]>([]);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [planChangeOpen, setPlanChangeOpen] = useState(false);
  const [selectedNewPlan, setSelectedNewPlan] = useState<string>('');
  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', email: '', role: 'user' });
  const [inviteError, setInviteError] = useState('');
  const [loading, setLoading] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>('');
  const [isVoicePreviewing, setIsVoicePreviewing] = useState(false);

  // Compute admin status after all hooks
  const isAdmin = user?.profile?.role === 'admin';
  const isSpeechSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  const getVoiceId = useCallback(
    (voice: SpeechSynthesisVoice) => `${voice.name || 'unknown'}::${voice.lang || 'unknown'}`,
    []
  );

  const voiceOptions = useMemo(
    () =>
      availableVoices.map((voice) => ({
        id: getVoiceId(voice),
        label: `${voice.name}${voice.lang ? ` (${voice.lang})` : ''}`,
      })),
    [availableVoices, getVoiceId]
  );
  const selectedVoiceLabel = useMemo(() => {
    if (!selectedVoiceId) {
      return 'Browser default voice';
    }
    const match = voiceOptions.find((voice) => voice.id === selectedVoiceId);
    return match ? match.label : 'Browser default voice';
  }, [voiceOptions, selectedVoiceId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      const storedVoiceId = window.localStorage.getItem('selectedAiVoiceId');
      if (storedVoiceId) {
        setSelectedVoiceId(storedVoiceId);
      }
    } catch (error) {
      console.warn('Unable to read stored AI voice:', error);
    }
  }, []);

  useEffect(() => {
    if (!isSpeechSupported) {
      setAvailableVoices([]);
      return;
    }

    const synth = window.speechSynthesis;

    const hydrateVoices = () => {
      const voices = synth.getVoices();
      if (!voices || voices.length === 0) {
        return;
      }
      const sortedVoices = voices.slice().sort((a, b) => a.name.localeCompare(b.name));
      setAvailableVoices(sortedVoices);

      setSelectedVoiceId((currentId) => {
        if (currentId && sortedVoices.some((voice) => getVoiceId(voice) === currentId)) {
          return currentId;
        }

        let storedId = '';
        try {
          storedId = window.localStorage.getItem('selectedAiVoiceId') || '';
        } catch (error) {
          console.warn('Unable to access stored AI voice:', error);
        }

        if (storedId && sortedVoices.some((voice) => getVoiceId(voice) === storedId)) {
          return storedId;
        }

        return sortedVoices.length > 0 ? getVoiceId(sortedVoices[0]) : currentId;
      });
    };

    hydrateVoices();

    let previousHandler: ((this: SpeechSynthesis, ev: Event) => any) | null = null;

    if (typeof synth.addEventListener === 'function') {
      synth.addEventListener('voiceschanged', hydrateVoices);
    } else {
      previousHandler = synth.onvoiceschanged;
      synth.onvoiceschanged = (event: Event) => {
        hydrateVoices();
        if (typeof previousHandler === 'function') {
          previousHandler.call(synth, event);
        }
      };
    }

    return () => {
      if (typeof synth.removeEventListener === 'function') {
        synth.removeEventListener('voiceschanged', hydrateVoices);
      } else {
        synth.onvoiceschanged = previousHandler;
      }
    };
  }, [getVoiceId, isSpeechSupported]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    try {
      if (selectedVoiceId) {
        window.localStorage.setItem('selectedAiVoiceId', selectedVoiceId);
      } else {
        window.localStorage.removeItem('selectedAiVoiceId');
      }
    } catch (error) {
      console.warn('Unable to persist AI voice selection:', error);
    }
  }, [selectedVoiceId]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'selectedAiVoiceId') {
        setSelectedVoiceId(event.newValue || '');
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  useEffect(() => {
    return () => {
      if (isSpeechSupported) {
        window.speechSynthesis.cancel();
      }
    };
  }, [isSpeechSupported]);

  const loadCompanyData = useCallback(async () => {
    if (!isAdmin || !user?.profile?.company_id) {
      return;
    }
    setLoading(true);
    try {
      const { data: companyData } = await supabase
        .from('companies')
        .select('*')
        .eq('company_id', user.profile.company_id)
        .single();
      setCompany(companyData);

      const { data: availablePlansData } = await supabase
        .from('plans')
        .select('*')
        .gt('plan_cost', 0)
        .eq('status', 'Active');
      setAvailablePlans(availablePlansData || []);
      console.log('Available plans:', availablePlansData);

      if (companyData?.selected_plan) {
        const { data: planData } = await supabase
          .from('plans')
          .select('*')
          .eq('plan_name', companyData.selected_plan)
          .single();
        console.log('Fetched plan:', planData);
        setPlan(planData);
      } else {
        setPlan(null);
      }

      const { data: usersData } = await supabase
        .from('users')
        .select('user_id, company_id, first_name, last_name, role, user_status, created_at')
        .eq('company_id', user.profile.company_id);
      setUsers(usersData || []);
    } finally {
      setLoading(false);
    }
  }, [isAdmin, user?.profile?.company_id]);

  useEffect(() => {
    loadCompanyData();
  }, [loadCompanyData]);

  const maxUsers = plan?.max_users ?? null;
  const slotsLeft = maxUsers !== null ? maxUsers - users.length : null;
  const handleVoiceChange = useCallback(
    (value: string) => {
      if (isSpeechSupported) {
        window.speechSynthesis.cancel();
      }
      setIsVoicePreviewing(false);
      setSelectedVoiceId(value);
    },
    [isSpeechSupported]
  );

  const handlePreviewVoice = useCallback(() => {
    if (!isSpeechSupported) {
      toast({
        title: 'Preview Unavailable',
        description: 'Your browser does not support speech synthesis, so the AI voice cannot be previewed here.',
        variant: 'destructive',
      });
      return;
    }

    const voice = availableVoices.find((item) => getVoiceId(item) === selectedVoiceId);
    if (!voice) {
      toast({
        title: 'Select a Voice',
        description: 'Please choose an AI voice before playing a preview.',
      });
      return;
    }

    try {
      const sampleText =
        'Hi there, this is the AI interviewer. This preview lets you hear how your candidates will experience the session.';
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(sampleText);
      utterance.voice = voice;
      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 0.85;
      utterance.onend = () => setIsVoicePreviewing(false);
      utterance.onerror = () => setIsVoicePreviewing(false);
      setIsVoicePreviewing(true);
      window.speechSynthesis.speak(utterance);
    } catch (error) {
      console.error('Error previewing AI voice:', error);
      setIsVoicePreviewing(false);
      toast({
        title: 'Preview Error',
        description: 'We could not play the preview. Please try refreshing the page and try again.',
        variant: 'destructive',
      });
    }
  }, [availableVoices, getVoiceId, isSpeechSupported, selectedVoiceId, toast]);

  const handleInviteChange = (e: any) => {
    setInviteForm({ ...inviteForm, [e.target.name]: e.target.value });
  };

  const handleInvite = async (e: any) => {
    e.preventDefault();
    setInviteError('');
    setInviteSuccess('');
    setLoading(true);
    if (!inviteForm.email) {
      setInviteError('Email is required.');
      setLoading(false);
      return;
    }
    
    // Validate email domain matches the logged-in user's domain
    if (user?.email && inviteForm.email) {
      const userDomain = user.email.split('@')[1]?.toLowerCase();
      const inviteDomain = inviteForm.email.split('@')[1]?.toLowerCase();
      
      if (!userDomain || !inviteDomain) {
        setInviteError('Invalid email format.');
        setLoading(false);
        return;
      }
      
      if (userDomain !== inviteDomain) {
        setInviteError(`Email domain must match your domain (@${userDomain}). Cannot invite users from different domains.`);
        setLoading(false);
        return;
      }
    }
    
    if (slotsLeft <= 0) {
      setInviteError('User limit reached for your plan.');
      setLoading(false);
      return;
    }
    // TEMPORARY SIMULATION - COMPLETELY BYPASS EDGE FUNCTION
    console.log(`🔄 SIMULATION: Inviting ${inviteForm.email} with role: ${inviteForm.role}`);
    
    // Simulate processing time
    setTimeout(() => {
      setInviteSuccess('✅ Invitation sent successfully! (Simulated)');
      setInviteForm({ firstName: '', lastName: '', email: '', role: 'user' });
      setInviteOpen(false);
      setLoading(false);
      
      toast({
        title: "Invitation Sent (Simulated)",
        description: `Simulated invitation for ${inviteForm.email}. Edge Function needs deployment for real functionality.`,
      });
    }, 1000);
    
    return; // Exit early to avoid any Edge Function calls
    
    /*
    // REAL EDGE FUNCTION CODE - UNCOMMENT AFTER DEPLOYMENT:
    try {
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { 
          email: inviteForm.email, 
          role: inviteForm.role 
        }
      });

      if (error) {
        console.error('Edge function error:', error);
        throw error;
      }

      if (data?.success) {
        setInviteSuccess('Invitation sent successfully!');
        setInviteForm({ firstName: '', lastName: '', email: '', role: 'user' });
        setInviteOpen(false);
        
        // Refresh users list
        const { data: usersData } = await supabase
          .from('users')
          .select('user_id, company_id, first_name, last_name, role, user_status, created_at')
          .eq('company_id', user.profile.company_id);
        setUsers(usersData || []);
        
        toast({
          title: "Invitation Sent",
          description: `Successfully invited ${inviteForm.email}`,
        });
      } else {
        setInviteError(data?.error || 'Failed to send invitation.');
      }
          } catch (err: any) {
        console.error('Invitation error:', err);
        setInviteError(err.message || 'An error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    */
  };

  const handlePlanChange = async () => {
    if (!selectedNewPlan || !company) {
      toast({
        title: "Error",
        description: "Please select a plan to change to.",
        variant: "destructive",
      });
      return;
    }

    setChangingPlan(true);
    try {
      const { error } = await supabase
        .from('companies')
        .update({ selected_plan: selectedNewPlan })
        .eq('company_id', company.company_id);

      if (error) throw error;

      // Update local state
      setCompany(prev => ({ ...prev, selected_plan: selectedNewPlan }));
      
      // Fetch updated plan data
      const selectedPlanData = availablePlans.find(p => p.plan_name === selectedNewPlan);
      setPlan(selectedPlanData);
      
      setPlanChangeOpen(false);
      setSelectedNewPlan('');
      
      toast({
        title: "Plan Updated",
        description: `Successfully updated to ${selectedNewPlan} plan.`,
      });
    } catch (error: any) {
      console.error('Error updating plan:', error);
      toast({
        title: "Error",
        description: "Failed to update plan. Please try again.",
        variant: "destructive",
      });
    } finally {
      setChangingPlan(false);
    }
  };

  const handleRecharge = () => {
    // Check if Razorpay is loaded
    if (typeof window !== 'undefined' && (window as any).Razorpay) {
      const options = {
        key: "rzp_live_RW2RTMgCZSp9mL", // Enter the Key ID generated from the Dashboard
        amount: "1000", // Amount is in currency subunits (₹10.00)
        currency: "INR",
        name: "aitamate", //your business name
        description: "Account Recharge",
        image: "https://example.com/your_logo",
        order_id: "order_RW2wU3QWuqsHxA", //This is a sample Order ID. Pass the `id` obtained in the response of Step 1
        handler: async function (response: any) {
          // Handle successful payment
          console.log('Payment successful:', response);
          
          try {
            // Record the payment in the database
            if (user?.profile?.company_id && plan) {
              const subscriptionStartDate = new Date();
              const subscriptionEndDate = new Date();
              subscriptionEndDate.setMonth(subscriptionEndDate.getMonth() + 1); // 1 month from now
              
              await UsageTrackingService.recordPayment({
                company_id: user.profile.company_id,
                plan_id: plan.plan_id,
                payment_amount: 10.00, // ₹10.00 (1000 paise)
                currency: 'INR',
                razorpay_order_id: "order_RW2wU3QWuqsHxA",
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                subscription_start_date: subscriptionStartDate.toISOString(),
                subscription_end_date: subscriptionEndDate.toISOString(),
                billing_cycle: 'monthly',
                metadata: {
                  payment_purpose: 'account_recharge',
                  user_id: user.id,
                  company_name: company?.company_name
                }
              });
              
              toast({
                title: "Payment Successful",
                description: `Payment recorded successfully. Your account has been recharged.`,
              });
              
              // Refresh company data to show updated subscription
              await loadCompanyData();
            } else {
              throw new Error('Missing company or plan information');
            }
          } catch (error) {
            console.error('Error recording payment:', error);
            toast({
              title: "Payment Recorded",
              description: `Payment successful but failed to update account. Please contact support.`,
              variant: "destructive",
            });
          }
        },
        prefill: {
          name: user?.profile?.first_name || user?.email?.split('@')[0] || "Customer",
          email: user?.email || "",
          contact: "" // Add phone number if available
        },
        notes: {
          company_id: company?.company_id || "",
          user_id: user?.id || "",
          purpose: "Account Recharge"
        },
        theme: {
          color: "#1A56DB" // Using your brand color
        }
      };
      
      const rzp1 = new (window as any).Razorpay(options);
      
      rzp1.on('payment.failed', function (response: any) {
        console.error('Payment failed:', response.error);
        toast({
          title: "Payment Failed",
          description: `Error: ${response.error.description}`,
          variant: "destructive",
        });
      });
      
      rzp1.open();
    } else {
      console.error('Razorpay not loaded');
      toast({
        title: "Payment Error",
        description: "Payment system not available. Please refresh the page and try again.",
        variant: "destructive",
      });
    }
  };

  // Only render UI if admin
  if (!isAdmin) return null;

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <div className="text-sm text-muted-foreground mt-1">
          {plan ? (
            <>
              Plan: <b>{plan.plan_name}</b> | Max Users: <b>{maxUsers}</b> | Slots Left: <b>{slotsLeft}</b>
            </>
          ) : (
            <span className="text-red-600">No plan information available for this company.</span>
          )}
        </div>
        {availablePlans.length === 0 && (
          <div className="text-yellow-600 text-xs mt-1">Warning: No active plans with cost greater than 0 found. Please check your plan configuration.</div>
        )}
      </CardHeader>
      <CardContent>
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50/60 p-4">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <h3 className="text-base font-semibold text-blue-900">AI Interview Voice</h3>
            <span className="text-xs font-medium uppercase tracking-wide text-blue-700">
              Current selection: {selectedVoiceLabel}
            </span>
          </div>
          <ul className="mt-3 space-y-2 list-disc pl-5 text-sm text-blue-900">
            <li>
              Selecting a voice here sets the narrator that candidates hear throughout every conversational interview. The
              choice applies to greetings, follow-up prompts, and wrap-up messages so the experience feels consistent and
              on-brand for your organization.
            </li>
            <li>
              Preview the audio before saving to ensure the tone matches your expectations. We store the selection
              immediately, reload it for future sessions, and fall back gracefully if a browser updates or removes a voice.
            </li>
          </ul>
          <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center">
            <Select
              value={selectedVoiceId}
              onValueChange={handleVoiceChange}
              disabled={!isSpeechSupported || voiceOptions.length === 0}
            >
              <SelectTrigger className="w-full md:w-72 bg-white">
                <SelectValue placeholder={isSpeechSupported ? 'Select an AI voice...' : 'Speech synthesis unavailable'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Browser default voice</SelectItem>
                {voiceOptions.map((voice) => (
                  <SelectItem key={voice.id} value={voice.id}>
                    {voice.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={handlePreviewVoice}
              disabled={
                !isSpeechSupported || voiceOptions.length === 0 || !selectedVoiceId || isVoicePreviewing
              }
            >
              {isVoicePreviewing ? 'Previewing...' : 'Preview Voice'}
            </Button>
          </div>
          {!isSpeechSupported && (
            <p className="mt-3 text-sm text-red-600">
              Speech synthesis is not available in this browser. Use a recent version of Chrome, Edge, or Safari to manage
              AI voice preferences.
            </p>
          )}
          {isSpeechSupported && voiceOptions.length === 0 && (
            <p className="mt-3 text-sm text-blue-700">
              Voices are still loading from the browser. If the list stays empty, click inside the page or refresh to reload
              the available options.
            </p>
          )}
        </div>

        <div className="flex justify-between items-center mb-4">
          <div className="font-semibold text-lg">Company Users</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleRecharge}>Recharge</Button>
            <Dialog open={planChangeOpen} onOpenChange={setPlanChangeOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">Change Plan</Button>
              </DialogTrigger>
              <DialogContent aria-describedby="plan-change-description">
                <DialogHeader>
                  <DialogTitle>Change Company Plan</DialogTitle>
                </DialogHeader>
                <div id="plan-change-description" className="sr-only">Dialog to change the company subscription plan</div>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Current Plan: <strong>{plan?.plan_name || 'None'}</strong>
                    </p>
                    <p className="text-sm text-muted-foreground mb-4">
                      Select a new plan from the available options below:
                    </p>
                  </div>
                  <Select value={selectedNewPlan} onValueChange={setSelectedNewPlan}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select new plan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availablePlans
                        .sort((a, b) => (a.plan_cost || 0) - (b.plan_cost || 0))
                        .map(availablePlan => (
                        <SelectItem key={availablePlan.plan_name} value={availablePlan.plan_name}>
                          <div className="flex flex-col">
                            <span className="font-medium">{availablePlan.plan_name}</span>
                            <span className="text-xs text-muted-foreground">
                              INR {availablePlan.plan_cost}/month • Max {availablePlan.max_users} users
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button 
                      onClick={handlePlanChange} 
                      disabled={!selectedNewPlan || changingPlan}
                      className="flex-1"
                    >
                      {changingPlan ? 'Updating...' : 'Update Plan'}
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        setPlanChangeOpen(false);
                        setSelectedNewPlan('');
                      }}
                      className="flex-1"
                      disabled={changingPlan}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button disabled={slotsLeft <= 0}>Invite User</Button>
              </DialogTrigger>
            <DialogContent aria-describedby="invite-user-description">
              <DialogHeader>
                <DialogTitle>Invite New User</DialogTitle>
              </DialogHeader>
              <div id="invite-user-description" className="sr-only">Dialog to invite a new user to the company</div>
              <form className="space-y-3" onSubmit={handleInvite}>
                <Input
                  name="email"
                  type="email"
                  placeholder={user?.email ? `Email (must be @${user.email.split('@')[1]})` : "Email"}
                  value={inviteForm.email}
                  onChange={handleInviteChange}
                  required
                  disabled={loading}
                />
                <Select value={inviteForm.role} onValueChange={val => setInviteForm(f => ({ ...f, role: val }))}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                {inviteError && <div className="text-red-600 text-sm">{inviteError}</div>}
                {inviteSuccess && <div className="text-green-600 text-sm">{inviteSuccess}</div>}
                <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Sending...' : 'Send Invite'}</Button>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm border">
            <thead>
              <tr className="bg-gray-100">
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-left">Email</th>
                <th className="p-2 text-left">Role</th>
                <th className="p-2 text-left">Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.user_id} className="border-t">
                  <td className="p-2">{u.first_name} {u.last_name}</td>
                  <td className="p-2 capitalize">{u.role}</td>
                  <td className="p-2 capitalize">{u.user_status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
} 