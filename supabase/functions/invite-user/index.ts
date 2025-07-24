// Supabase Edge Function: Invite User
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// Helper: Generate a secure random token
function generateToken() {
  return crypto.randomUUID();
}

// Placeholder for sending email
async function sendInvitationEmail(email: string, signupUrl: string) {
  // TODO: Integrate with your email provider (SendGrid, Resend, etc.)
  console.log(`Send invitation to ${email}: ${signupUrl}`);
  return true;
}

serve(async (req) => {
  // 1. Auth: Get JWT and user info
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(supabaseUrl, supabaseKey);

  const authHeader = req.headers.get("Authorization") || "";
  const jwt = authHeader.replace("Bearer ", "");
  if (!jwt) {
    return new Response(JSON.stringify({ success: false, error: "Missing auth token" }), { status: 401 });
  }

  // Get user info from JWT
  const { data: { user }, error: userError } = await client.auth.getUser(jwt);
  if (userError || !user) {
    return new Response(JSON.stringify({ success: false, error: "Invalid user" }), { status: 401 });
  }

  // 2. Parse input
  const { email, role } = await req.json();
  if (!email) {
    return new Response(JSON.stringify({ success: false, error: "Missing email" }), { status: 400 });
  }

  // 3. Get admin's user record (to get company_id and role)
  const { data: userRecord, error: userRecordError } = await client
    .from("users")
    .select("user_id, company_id, role")
    .eq("user_id", user.id)
    .single();
  if (userRecordError || !userRecord) {
    return new Response(JSON.stringify({ success: false, error: "User not found" }), { status: 403 });
  }
  if (userRecord.role !== "admin") {
    return new Response(JSON.stringify({ success: false, error: "Only admins can invite users" }), { status: 403 });
  }

  // 4. Check plan's max users and current user count
  // Get company info
  const { data: company, error: companyError } = await client
    .from("companies")
    .select("company_id, selected_plan")
    .eq("company_id", userRecord.company_id)
    .single();
  if (companyError || !company) {
    return new Response(JSON.stringify({ success: false, error: "Company not found" }), { status: 400 });
  }
  // Get plan info
  const { data: plan, error: planError } = await client
    .from("plans")
    .select("max_users")
    .eq("plan_name", company.selected_plan)
    .single();
  if (planError || !plan) {
    return new Response(JSON.stringify({ success: false, error: "Plan not found" }), { status: 400 });
  }
  // Count current users
  const { count: userCount, error: countError } = await client
    .from("users")
    .select("user_id", { count: "exact", head: true })
    .eq("company_id", company.company_id);
  if (countError) {
    return new Response(JSON.stringify({ success: false, error: "Failed to count users" }), { status: 400 });
  }
  if (userCount >= plan.max_users) {
    return new Response(JSON.stringify({ success: false, error: "User limit reached for your plan" }), { status: 403 });
  }

  // 5. Generate token and insert invitation
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days
  const { data: invitation, error: inviteError } = await client
    .from("user_invitations")
    .insert([
      {
        company_id: company.company_id,
        inviter_id: userRecord.user_id,
        email,
        role: role || null,
        token,
        status: "pending",
        expires_at: expiresAt,
      },
    ])
    .select()
    .single();
  if (inviteError || !invitation) {
    return new Response(JSON.stringify({ success: false, error: "Failed to create invitation" }), { status: 500 });
  }

  // 6. Send invitation email (placeholder)
  const signupUrl = `https://your-app.com/signup?token=${token}`;
  await sendInvitationEmail(email, signupUrl);

  // 7. Return success
  return new Response(JSON.stringify({ success: true, invitation }), {
    headers: { "Content-Type": "application/json" },
    status: 200,
  });
}); 