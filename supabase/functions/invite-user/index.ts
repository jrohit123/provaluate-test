// Supabase Edge Function: Invite User (Simplified)
// Imported and called directly by main/index.ts's router in-process (not run
// as a sandboxed EdgeRuntime.userWorkers instance) — that sandbox's outbound
// networking back through Envoy was unreliable; the router's own trusted
// context has been reliable throughout, so this exports a handler instead of
// calling serve() itself.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { PostgrestClient } from "https://esm.sh/@supabase/postgrest-js@1.9.2";
import { sendTemplatedEmail } from "../_shared/email.ts";

// CORS headers helper
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async function handler(req: Request): Promise<Response> {
  try {
    // CORS handling
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // 1. Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Missing environment variables");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Server configuration error" 
      }), { 
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }
    
    const client = createClient(supabaseUrl, supabaseKey);

    // Auth calls (getUser, admin.*) go through SUPABASE_URL/Envoy fine, but
    // REST (.from()) calls made from this container get "remote connection
    // failure" via Envoy specifically. SUPABASE_REST_URL, when set, points
    // straight at Postgrest's internal address, bypassing Envoy for these.
    const restUrl = Deno.env.get("SUPABASE_REST_URL");
    const rest = restUrl
      ? new PostgrestClient(restUrl, {
          headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
        })
      : client;

    // 2. Get auth token
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    
    if (!jwt) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Missing auth token" 
      }), { 
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 3. Verify user
    const { data: { user }, error: userError } = await client.auth.getUser(jwt);
    if (userError || !user) {
      console.error("User verification failed:", userError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid user" 
      }), { 
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 4. Parse request body
    const body = await req.json();
    const { email, first_name, last_name, role } = body;
    
    // Validate required fields
    if (!email) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Missing email" 
      }), { 
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }
    
    if (!first_name || !last_name) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "First name and last name are required" 
      }), { 
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 5. Get admin's user record (to verify permissions)
    const { data: userRecord, error: userRecordError } = await rest
      .from("users")
      .select("user_id, company_id, role")
      .eq("user_id", user.id)
      .single();
      
    if (userRecordError || !userRecord) {
      console.error("User record error:", userRecordError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "User not found in system" 
      }), { 
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }
    
    if (userRecord.role !== "admin" && userRecord.role !== "superadmin") {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Only admins can invite users" 
      }), { 
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 6. Check if user already exists in auth
    try {
      const { data: existingUser } = await client.auth.admin.getUserByEmail(email);
      if (existingUser?.user) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: "User with this email already exists" 
        }), { 
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }
    } catch (e) {
      // User doesn't exist, which is what we want - continue
      console.log(`User ${email} does not exist yet, proceeding with invitation`);
    }

    // 7. Generate the invite link via GoTrue's admin API (does NOT attempt
    // SMTP — Railway blocks outbound SMTP entirely, confirmed via nc timing
    // out on smtp-relay.brevo.com from inside this Railway network), then
    // send the actual email ourselves over HTTPS via Brevo.
    const siteUrl = Deno.env.get("SITE_URL") ?? "http://localhost:8080";
    const redirectTo = `${siteUrl}/reset-password`;
    console.log("DEBUG SITE_URL =", JSON.stringify(siteUrl));
    console.log("DEBUG redirectTo =", JSON.stringify(redirectTo));

    const { data: inviteData, error: inviteError } = await client.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: {
          first_name: first_name,
          last_name: last_name,
          company_id: userRecord.company_id,
          role: role || 'user',
        },
        redirectTo,
      },
    });

    if (inviteError || !inviteData?.user || !inviteData?.properties?.action_link) {
      console.error("Invite error:", inviteError);
      return new Response(JSON.stringify({
        success: false,
        error: inviteError?.message || "Failed to generate invitation link"
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    console.log(`✅ Invite link generated for ${email}, user ID: ${inviteData.user.id}`);

    // 7b. Send the actual email ourselves via Brevo (see _shared/email.ts).
    // Non-fatal: the account and link already exist even if this send fails.
    let emailSent = true;
    const templateUrl = Deno.env.get("MAILER_TEMPLATES_INVITE");
    try {
      if (!templateUrl) throw new Error("Missing MAILER_TEMPLATES_INVITE");
      await sendTemplatedEmail({
        templateUrl,
        toEmail: email,
        toName: `${first_name} ${last_name}`,
        subject: `You've been invited to ProValuate`,
        confirmationUrl: inviteData.properties.action_link,
        siteUrl,
      });
      console.log(`✅ Invite email sent to ${email} via Brevo`);
    } catch (emailErr) {
      emailSent = false;
      console.error("Invite email send failed:", emailErr);
    }

    // 8. Create user record in database
    const now = new Date().toISOString();
    const { error: userInsertError } = await rest
      .from("users")
      .insert({
        user_id: inviteData.user.id,
        company_id: userRecord.company_id,
        email: email,
        first_name: first_name,
        last_name: last_name,
        role: role || 'user',
        user_status: 'active',
        onboarding_complete: true, // Invited users skip onboarding
        created_at: now,
      });

    if (userInsertError) {
      console.error("User insert error:", userInsertError);
      // Auth user was created but DB insert failed - this is a problem
      // Optionally, you could delete the auth user here, but for now just return error
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Invitation sent but failed to create user record: ${userInsertError.message}. Please contact support.` 
      }), { 
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 9. Return success
    console.log(`✅ Admin ${user.email} successfully invited: ${email} (${first_name} ${last_name}) with role: ${role || 'user'} to company: ${userRecord.company_id}`);
    
    return new Response(JSON.stringify({
      success: true,
      message: emailSent
        ? `Invitation sent successfully to ${email}`
        : `User created, but the invitation email failed to send. Please share the invite link manually or retry.`,
      emailSent,
      email: email,
      first_name: first_name,
      last_name: last_name,
      role: role || 'user'
    }), {
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      status: 200,
    });

  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || "Internal server error"
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  }
}