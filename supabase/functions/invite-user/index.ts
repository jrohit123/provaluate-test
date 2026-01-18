// Supabase Edge Function: Invite User (Simplified)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// CORS headers helper
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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
    const { data: userRecord, error: userRecordError } = await client
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

    // 7. Send invitation email via Supabase Auth
    const siteUrl = Deno.env.get("SITE_URL");
    
    const { data: inviteData, error: inviteError } = await client.auth.admin.inviteUserByEmail(email, {
      data: {
        first_name: first_name,
        last_name: last_name,
        company_id: userRecord.company_id,
        role: role || 'user',
      },
      redirectTo: `${siteUrl}/reset-password`,
    });

    if (inviteError || !inviteData?.user) {
      console.error("Invite error:", inviteError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: inviteError?.message || "Failed to send invitation email" 
      }), { 
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    console.log(`✅ Auth invitation sent for ${email}, user ID: ${inviteData.user.id}`);

    // 8. Create user record in database
    const now = new Date().toISOString();
    const { error: userInsertError } = await client
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
      message: `Invitation sent successfully to ${email}`,
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
}); 