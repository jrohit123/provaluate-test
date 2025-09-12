// Supabase Edge Function: Invite User (Simplified)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

serve(async (req) => {
  try {
    // CORS handling
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        },
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
      }), { status: 500 });
    }
    
    const client = createClient(supabaseUrl, supabaseKey);

    // 2. Get auth token
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "");
    
    if (!jwt) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Missing auth token" 
      }), { status: 401 });
    }

    // 3. Verify user
    const { data: { user }, error: userError } = await client.auth.getUser(jwt);
    if (userError || !user) {
      console.error("User verification failed:", userError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid user" 
      }), { status: 401 });
    }

    // 4. Parse request body
    const body = await req.json();
    const { email, role } = body;
    
    if (!email) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Missing email" 
      }), { status: 400 });
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
      }), { status: 403 });
    }
    
    if (userRecord.role !== "admin" && userRecord.role !== "superadmin") {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Only admins can invite users" 
      }), { status: 403 });
    }

    // 6. Simple validation - just log the invitation for now
    console.log(`Admin ${user.email} wants to invite: ${email} with role: ${role || 'user'} to company: ${userRecord.company_id}`);
    
    // 7. Return success (simplified - just confirming the request is valid)
    return new Response(JSON.stringify({ 
      success: true, 
      message: `Invitation request processed for ${email}`,
      email: email,
      role: role || 'user'
    }), {
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
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
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });
  }
}); 