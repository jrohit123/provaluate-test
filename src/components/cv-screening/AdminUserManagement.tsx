import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { UsageTrackingService } from '@/services/usageTrackingService';
import { startRecruiterPlanCheckout } from '@/utils/recruiterPayment';
import { ReceiptText, Eye, Download, Loader2 } from 'lucide-react';
import {
  RecruiterPaymentReceipt,
  downloadRecruiterReceiptPdf,
  formatReceiptCurrency,
  formatReceiptDate,
  getReceiptReference,
  type RecruiterReceiptPurchase,
} from '@/components/cv-screening/RecruiterPaymentReceipt';

interface AdminUserManagementProps {
  onSectionReady?: () => void;
}

export default function AdminUserManagement({ onSectionReady }: AdminUserManagementProps) {
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
  const [selectedNewPlanType, setSelectedNewPlanType] = useState('');
  const [selectedNewTier, setSelectedNewTier] = useState('');
  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', email: '', role: 'user' });
  const [inviteError, setInviteError] = useState('');
  const [loading, setLoading] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [receiptsLoading, setReceiptsLoading] = useState(true);
  const [receiptError, setReceiptError] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<RecruiterReceiptPurchase[]>([]);
  const [selectedReceipt, setSelectedReceipt] = useState<RecruiterReceiptPurchase | null>(null);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);
  // Compute admin status after all hooks
  const isAdmin = user?.profile?.role === 'admin';

  // Load company data function (reusable)
  const loadCompanyData = async () => {
    if (!isAdmin || !user?.profile?.company_id) return;
    
    try {
    setLoading(true);
        // Fetch company info
        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('company_id', user.profile.company_id)
          .single();
        setCompany(companyData);
      
        // Fetch available plans for plan changes (plan_cost > 0 and status = 'Active')
        const { data: availablePlansData } = await supabase
          .from('plans')
          .select('*')
          .gt('plan_cost', 0)
          .eq('status', 'Active');
        setAvailablePlans(availablePlansData || []);
        console.log('Available plans:', availablePlansData);
      
        // Fetch plan info
        if (companyData?.selected_plan) {
          const { data: planData } = await supabase
            .from('plans')
            .select('*')
            .eq('plan_name', companyData.selected_plan)
            .eq('plan_type', companyData.plan_type || 'combo')
            .single();
          console.log('Fetched plan:', planData);
          setPlan(planData);
        } else {
          setPlan(null);
        }
      
        // Fetch users in company
        const { data: usersData } = await supabase
          .from('users')
          .select('user_id, company_id, first_name, last_name, email, role, user_status, created_at')
          .eq('company_id', user.profile.company_id);
        setUsers(usersData || []);
    } catch (error) {
      console.error('Error loading company data:', error);
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    if (!isAdmin) return; // Only fetch if admin
    loadCompanyData();
  }, [user?.profile?.company_id, isAdmin]);

  useEffect(() => {
    if (!isAdmin || loading) return;
    const t = setTimeout(() => onSectionReady?.(), 400);
    return () => clearTimeout(t);
  }, [isAdmin, loading, onSectionReady]);

  const loadReceipts = async () => {
    if (!isAdmin || !user?.profile?.company_id) {
      setPurchases([]);
      setReceiptsLoading(false);
      return;
    }
    setReceiptsLoading(true);
    setReceiptError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('recruiter_plan_purchases')
        .select('id, company_id, plan_id, plan_name, gross_amount, credits_used, amount_paid, payment_status, razorpay_order_id, razorpay_payment_id, payment_date, purchased_at, metadata')
        .eq('company_id', user.profile.company_id)
        .eq('payment_status', 'completed')
        .order('payment_date', { ascending: false, nullsFirst: false });
      if (fetchError) {
        setReceiptError(fetchError.message);
        setPurchases([]);
      } else {
        setPurchases((data || []) as RecruiterReceiptPurchase[]);
      }
    } catch (e) {
      setReceiptError(e instanceof Error ? e.message : 'Failed to load payment receipts.');
      setPurchases([]);
    } finally {
      setReceiptsLoading(false);
    }
  };

  useEffect(() => {
    loadReceipts();
  }, [user?.profile?.company_id, isAdmin]);

  const openReceipt = (purchase: RecruiterReceiptPurchase) => {
    setSelectedReceipt(purchase);
    setReceiptOpen(true);
  };

  const handleDownloadReceipt = async (purchase: RecruiterReceiptPurchase) => {
    setDownloadingReceiptId(purchase.id);
    try {
      const billingContactName = `${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim() || user?.email?.split('@')[0] || 'Admin';
      const billingContactEmail = user?.email || '';
      await downloadRecruiterReceiptPdf({
        companyName: company?.company_name || 'Company',
        billingContactName,
        billingContactEmail,
        subscriptionStart: company?.subscription_start || null,
        subscriptionEnd: company?.subscription_end || null,
        purchase,
      });
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const maxUsers = plan?.max_users ?? null;
  const slotsLeft = maxUsers !== null ? maxUsers - users.length : null;

  const paidAvailablePlans = availablePlans.filter((p: any) => Number(p.plan_cost) > 0);

  const newPlanAvailableTypes: string[] = Array.from(
    new Set(paidAvailablePlans.map((p: any) => p.plan_type))
  );

  const newPlanAvailableTiers: string[] = selectedNewPlanType
    ? Array.from(
        new Set(
          paidAvailablePlans
            .filter((p: any) => p.plan_type === selectedNewPlanType)
            .map((p: any) => p.plan_name)
        )
      )
    : [];

  const selectedNewPlanObj = selectedNewPlan
    ? availablePlans.find((p: any) => p.plan_id === selectedNewPlan) ?? null
    : null;

  const planTypeLabel = (pt: string) =>
    pt === 'cv' ? 'CV Only' : pt === 'interview' ? 'Interviews Only' : 'Combo';

  useEffect(() => {
    if (selectedNewPlanType && selectedNewTier) {
      const match = paidAvailablePlans.find(
        (p: any) => p.plan_type === selectedNewPlanType && p.plan_name === selectedNewTier
      );
      setSelectedNewPlan(match ? match.plan_id : '');
    } else {
      setSelectedNewPlan('');
    }
  }, [selectedNewPlanType, selectedNewTier, availablePlans]);
  
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
    
    if (!inviteForm.firstName || !inviteForm.lastName) {
      setInviteError('First name and last name are required.');
      setLoading(false);
      return;
    }
    
    if (slotsLeft <= 0) {
      setInviteError('User limit reached for your plan.');
      setLoading(false);
      return;
    }
    
    // REAL EDGE FUNCTION CODE:
    try {
      console.log('Inviting user:', { email: inviteForm.email, firstName: inviteForm.firstName, lastName: inviteForm.lastName, role: inviteForm.role });
      
      const { data, error } = await supabase.functions.invoke('invite-user', {
        body: { 
          email: inviteForm.email,
          first_name: inviteForm.firstName,
          last_name: inviteForm.lastName,
          role: inviteForm.role 
        }
      });

      console.log('Edge function response:', { data, error });

      if (error) {
        console.error('Edge function error:', error);
        const errorMessage = error.message || 'Failed to send invitation. Please check if the edge function is deployed.';
        setInviteError(errorMessage);
        toast({
          title: "Invitation Failed",
          description: errorMessage,
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      if (data?.success) {
        setInviteSuccess('Invitation sent successfully!');
        setInviteForm({ firstName: '', lastName: '', email: '', role: 'user' });
        setInviteOpen(false);
        
        // Refresh users list
        const { data: usersData } = await supabase
          .from('users')
          .select('user_id, company_id, first_name, last_name, email, role, user_status, onboarding_complete, created_at')
          .eq('company_id', user.profile.company_id)
          .order('role', { ascending: true })
          .order('first_name', { ascending: true })
          .order('last_name', { ascending: true });
        setUsers(usersData || []);
        
        toast({
          title: "Invitation Sent",
          description: `Successfully invited ${inviteForm.email}`,
        });
      } else {
        const errorMsg = data?.error || 'Failed to send invitation.';
        setInviteError(errorMsg);
        toast({
          title: "Invitation Failed",
          description: errorMsg,
          variant: "destructive",
        });
      }
    } catch (err: any) {
      console.error('Invitation error:', err);
      const errorMessage = err.message || 'An error occurred. Please try again.';
      setInviteError(errorMessage);
      toast({
        title: "Invitation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const checkoutPrefill = () => ({
    name: `${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim() || user?.email?.split('@')[0] || 'Customer',
    email: user?.email || '',
  });

  const handlePlanChange = async () => {
    if (!selectedNewPlan || !company) {
      toast({
        title: 'Error',
        description: 'Please select a plan to change to.',
        variant: 'destructive',
      });
      return;
    }

    const selectedPlanData = availablePlans.find((p) => p.plan_id === selectedNewPlan);
    if (!selectedPlanData) {
      toast({ title: 'Error', description: 'Selected plan not found.', variant: 'destructive' });
      return;
    }

    setChangingPlan(true);
    setPlanChangeOpen(false); // Close Radix Dialog first to remove pointer-events:none from body

    // Wait for Radix to finish exit animation and remove scroll-lock
    await new Promise(r => setTimeout(r, 150));

    await startRecruiterPlanCheckout({
      companyId: company.company_id,
      planId: selectedPlanData.plan_id,
      planName: selectedPlanData.plan_name,
      prefill: checkoutPrefill(),
      onSuccess: async () => {
        await loadCompanyData();
        toast({
          title: 'Plan updated',
          description: `${selectedPlanData.plan_name} is now active. Quotas have been reset.`,
        });
        setPlanChangeOpen(false);
        setSelectedNewPlan('');
        setChangingPlan(false);
      },
      onError: (message) => {
        toast({ title: 'Payment error', description: message, variant: 'destructive' });
        setChangingPlan(false);
      },
      onDismiss: () => setChangingPlan(false),
    });
  };

  // Only render UI if admin
  if (!isAdmin) return null;

  return (
    <>
      <Card className="mb-8" data-tour="settings-user-management">
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">User Management</CardTitle>
          <div className="text-xs sm:text-sm text-muted-foreground mt-1">
            {plan ? (
              <>
                Plan:{' '}
                <b>
                  {plan.plan_name}
                  {plan.plan_type && (
                    <>
                      {' '}
                      (
                      {plan.plan_type === 'cv'
                        ? 'CV Only'
                        : plan.plan_type === 'interview'
                        ? 'Interviews Only'
                        : 'Combo'}
                      )
                    </>
                  )}
                </b>{' '}
                | Max Users: <b>{maxUsers}</b> | Slots Left: <b>{slotsLeft}</b>
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
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
            <div className="font-semibold text-base sm:text-lg">Company Users</div>
            <div className="flex flex-wrap gap-2 w-full sm:w-auto">
              {/* Change Billing Date - hidden for now
              <Dialog open={cycleDateOpen} onOpenChange={setCycleDateOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" disabled>
                    Change Cycle Date
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Change Billing Cycle Date</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">
                        Current billing date: <strong>{company?.subscription_end ? new Date(company.subscription_end).toLocaleDateString() : 'N/A'}</strong>
                      </p>
                      {plan && company && (plan.max_cvs ?? 0) > 0 && (
                        <p className="text-sm text-muted-foreground mb-2">
                          Unused CVs: <strong>{plan.max_cvs - (company.cv_processed_count || 0)}</strong> / {plan.max_cvs}
                        </p>
                      )}
                      {plan && company && (plan.max_interviews ?? 0) > 0 && (
                        <p className="text-sm text-muted-foreground mb-2">
                          Interviews used: <strong>{company.interview_count ?? 0}</strong> / {plan.max_interviews ?? 0}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground mb-4">
                        Select a day (1-31) for your new billing cycle date. The date must be between today and your current billing end date. You can only prepone the date, not postpone it.
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Select Day (1-31)
                      </label>
                      <Input
                        type="number"
                        min="1"
                        max="31"
                        value={newCycleDay}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 1;
                          setNewCycleDay(Math.max(1, Math.min(31, value)));
                        }}
                        placeholder="Day (1-31)"
                      />
                    </div>
                    {newCycleDay && company?.subscription_end && (
                      <div className="p-3 bg-muted rounded-md">
                        <p className="text-xs text-muted-foreground mb-1">
                          Calculated new date:
                        </p>
                        <p className="text-sm font-medium">
                          {(() => {
                            const today = new Date();
                            const targetDay = Math.min(newCycleDay, 28);
                            let calculatedDate = new Date(today.getFullYear(), today.getMonth(), targetDay);
                            
                            const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                            if (calculatedDate < todayStart) {
                              if (today.getMonth() === 11) {
                                calculatedDate = new Date(today.getFullYear() + 1, 0, targetDay);
                              } else {
                                calculatedDate = new Date(today.getFullYear(), today.getMonth() + 1, targetDay);
                              }
                            }
                            
                            const currentBillingEnd = new Date(company.subscription_end);
                            const isValid = calculatedDate >= todayStart && calculatedDate <= currentBillingEnd;
                            
                            return (
                              <span className={isValid ? "text-green-600" : "text-red-600"}>
                                {calculatedDate.toLocaleDateString()}
                                {!isValid && (
                                  <span className="ml-2 text-xs">
                                    ({calculatedDate < todayStart ? 'Before today' : 'After billing end'})
                                  </span>
                                )}
                              </span>
                            );
                          })()}
                        </p>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Button 
                        onClick={handleChangeCycleDate} 
                        disabled={!newCycleDay || loading}
                        className="flex-1"
                      >
                        {loading ? 'Updating...' : 'Update Date'}
                      </Button>
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setCycleDateOpen(false);
                          setNewCycleDay(1);
                        }}
                        className="flex-1"
                        disabled={loading}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              */}
              <Dialog open={planChangeOpen} onOpenChange={(open) => {
                setPlanChangeOpen(open);
                if (!open) {
                  setSelectedNewPlan('');
                  setSelectedNewPlanType('');
                  setSelectedNewTier('');
                }
              }}>
                <DialogTrigger asChild>
                  <Button variant="outline">Recharge Balance</Button>
                </DialogTrigger>
                <DialogContent aria-describedby="recharge-description">
                  <DialogHeader>
                    <DialogTitle>Recharge Balance</DialogTitle>
                  </DialogHeader>
                  <div id="recharge-description" className="sr-only">
                    Dialog to recharge or change your company plan
                  </div>
                  <div className="space-y-4">

                    {/* Current plan info */}
                    {plan && (
                      <p className="text-sm text-muted-foreground">
                        Your last purchase was{' '}
                        <strong>
                          {plan.plan_name} — {planTypeLabel(plan.plan_type || 'combo')}
                        </strong>
                      </p>
                    )}

                    {/* Dropdown label */}
                    <p className="text-sm text-muted-foreground font-medium">
                      Select Plan to Purchase
                    </p>

                    {/* Dropdown 1: Plan Type */}
                    <Select
                      value={selectedNewPlanType}
                      onValueChange={(val) => {
                        setSelectedNewPlanType(val);
                        setSelectedNewTier('');
                        setSelectedNewPlan('');
                      }}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select plan type..." />
                      </SelectTrigger>
                      <SelectContent>
                        {newPlanAvailableTypes.map((pt) => (
                          <SelectItem key={pt} value={pt}>
                            {planTypeLabel(pt)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Dropdown 2: Tier */}
                    {selectedNewPlanType && (
                      <Select value={selectedNewTier} onValueChange={setSelectedNewTier}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select tier..." />
                        </SelectTrigger>
                        <SelectContent>
                          {newPlanAvailableTiers.map((tier) => (
                            <SelectItem key={tier} value={tier}>
                              {tier}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Read-only plan details */}
                    {selectedNewPlanObj && (
                      <div className="border rounded-lg overflow-hidden">
                        <div className="bg-gray-100 px-4 py-2.5 font-semibold text-gray-800 text-sm">
                          ₹{selectedNewPlanObj.plan_cost} for {selectedNewPlanObj.max_cvs ?? 0} CVs and {selectedNewPlanObj.max_interviews ?? 0} IVs
                        </div>
                        <div className="bg-gray-50 px-4 py-2 text-xs text-gray-500 italic border-t border-gray-200">
                          Valid for 365 days from date of purchase
                        </div>
                        <div className="bg-gray-50 px-4 pb-2 text-xs text-gray-400">
                          Max Users: {selectedNewPlanObj.max_users} · Active JDs:{' '}
                          {selectedNewPlanObj.active_jobs === 0 ? 'Unlimited' : selectedNewPlanObj.active_jobs}
                        </div>
                      </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-2">
                      <Button
                        onClick={handlePlanChange}
                        disabled={!selectedNewPlan || changingPlan}
                        className="flex-1"
                      >
                        {changingPlan ? 'Processing...' : 'Pay & Recharge'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setPlanChangeOpen(false);
                          setSelectedNewPlan('');
                          setSelectedNewPlanType('');
                          setSelectedNewTier('');
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
                  <Button className="bg-[#094D7B] hover:bg-[#073d63]" disabled={slotsLeft <= 0}>Invite User</Button>
                </DialogTrigger>
                <DialogContent aria-describedby="invite-user-description">
                  <DialogHeader>
                    <DialogTitle>Invite New User</DialogTitle>
                  </DialogHeader>
                  <div id="invite-user-description" className="sr-only">Dialog to invite a new user to the company</div>
                  <form className="space-y-3" onSubmit={handleInvite}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        name="firstName"
                        type="text"
                        placeholder="First Name"
                        value={inviteForm.firstName}
                        onChange={handleInviteChange}
                        required
                        disabled={loading}
                      />
                      <Input
                        name="lastName"
                        type="text"
                        placeholder="Last Name"
                        value={inviteForm.lastName}
                        onChange={handleInviteChange}
                        required
                        disabled={loading}
                      />
                    </div>
                    <Input
                      name="email"
                      type="email"
                      placeholder={user?.email ? `Email (must be @${user.email.split('@')[1]})` : 'Email'}
                      value={inviteForm.email}
                      onChange={handleInviteChange}
                      required
                      disabled={loading}
                    />
                    <Select value={inviteForm.role} onValueChange={(val) => setInviteForm((f) => ({ ...f, role: val }))}>
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
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? 'Sending...' : 'Send Invite'}
                    </Button>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="overflow-x-auto relative">
            <table className="min-w-full text-xs sm:text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="p-2 sm:p-3 text-left text-xs sm:text-sm">Name</th>
                  <th className="p-2 sm:p-3 text-left text-xs sm:text-sm">Email</th>
                  <th className="p-2 sm:p-3 text-left text-xs sm:text-sm">Role</th>
                  <th className="p-2 sm:p-3 text-left text-xs sm:text-sm">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-muted-foreground text-xs sm:text-sm">
                      No users found in your company.
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.user_id} className="border-t">
                      <td className="p-2 sm:p-3 text-xs sm:text-sm">
                        {u.first_name || ''} {u.last_name || ''}
                      </td>
                      <td className="p-2 sm:p-3 text-xs sm:text-sm break-words">{u.email || 'N/A'}</td>
                      <td className="p-2 sm:p-3 text-xs sm:text-sm capitalize">{u.role || 'N/A'}</td>
                      <td className="p-2 sm:p-3 text-xs sm:text-sm capitalize">{u.user_status || 'N/A'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ReceiptText className="h-4 w-4" />
            Payment receipts
          </CardTitle>
          <p className="text-sm text-gray-600">
            View or download receipts for completed plan purchases.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {receiptError && (
            <div className="rounded-md bg-red-50 border border-red-200 text-red-700 px-4 py-2 text-sm">
              {receiptError}
            </div>
          )}
          {receiptsLoading ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-sky-600" />
            </div>
          ) : purchases.length === 0 ? (
            <p className="text-sm text-gray-500">No completed plan purchases found yet.</p>
          ) : (
            <div className="space-y-3">
              {purchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-4 shadow-sm"
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-slate-900">
                        {purchase.plan_name || 'Selected Plan'}
                      </div>
                      <div className="mt-1 text-sm text-slate-600 space-y-1">
                        <p>Receipt Reference: {getReceiptReference(purchase)}</p>
                        <p>Date Paid: {formatReceiptDate(purchase.payment_date || purchase.purchased_at)}</p>
                        <p>Total Paid: {formatReceiptCurrency(purchase.amount_paid)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" onClick={() => openReceipt(purchase)}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      <Button
                        type="button"
                        className="bg-[#094D7B] hover:bg-[#073d63]"
                        disabled={downloadingReceiptId === purchase.id}
                        onClick={() => handleDownloadReceipt(purchase)}
                      >
                        {downloadingReceiptId === purchase.id ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Download PDF
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          {selectedReceipt && (
            <RecruiterPaymentReceipt
              companyName={company?.company_name || 'Company'}
              billingContactName={`${user?.profile?.first_name || ''} ${user?.profile?.last_name || ''}`.trim() || user?.email?.split('@')[0] || 'Admin'}
              billingContactEmail={user?.email || ''}
              subscriptionStart={company?.subscription_start || null}
              subscriptionEnd={company?.subscription_end || null}
              purchase={selectedReceipt}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
