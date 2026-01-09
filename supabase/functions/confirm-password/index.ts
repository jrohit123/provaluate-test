// Supabase Edge Function: Confirm Password (for invited users and password reset)
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

// CORS headers helper
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Helper function to decode JWT and extract user ID and email
function getUserIdFromToken(token: string): { userId: string | null; email: string | null } {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { userId: null, email: null };
    
    // Decode the payload (second part)
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))
    );
    
    return {
      userId: payload.sub || payload.user_id || null,
      email: payload.email || payload.user_email || null
    };
  } catch (e) {
    console.error("Failed to decode JWT:", e);
    return { userId: null, email: null };
  }
}

serve(async (req) => {
  try {
    // CORS handling
    if (req.method === "OPTIONS") {
      return new Response(null, {
        status: 200,
        headers: corsHeaders,
      });
    }

    // 1. Initialize Supabase client with service role (admin access)
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
    
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // 2. Get the user's access token from the request
    const authHeader = req.headers.get("Authorization") || "";
    const userToken = authHeader.replace("Bearer ", "");
    
    if (!userToken) {
      console.error("❌ No token provided in Authorization header");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Missing authentication token. Please use the link from your email." 
      }), { 
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 3. Parse request body
    let body;
    try {
      body = await req.json();
    } catch (e) {
      console.error("❌ Failed to parse request body:", e);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid request body" 
      }), { 
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    const { password } = body;

    if (!password || password.length < 6) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Password must be at least 6 characters long" 
      }), { 
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 4. Extract user ID and email from JWT token directly (don't verify session)
    console.log("🔍 Extracting user ID and email from token...");
    const tokenData = getUserIdFromToken(userToken);
    const userId = tokenData.userId;
    const emailFromToken = tokenData.email;
    
    if (!userId) {
      console.error("❌ Failed to extract user ID from token");
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Invalid token format. Please request a new password reset link." 
      }), { 
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    console.log(`✅ Extracted from token - User ID: ${userId}, Email: ${emailFromToken || 'Not in token'}`);

    // 5. Get user info using admin API (bypasses session check)
    console.log(`🔍 Fetching user info via admin API...`);
    const { data: { user }, error: userError } = await client.auth.admin.getUserById(userId);
    
    if (userError || !user) {
      console.error("❌ Failed to get user:", userError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: userError?.message || "User not found. Please request a new password reset link." 
      }), { 
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    console.log(`✅ Found user: ${user.email} (${user.id})`);
    
    // ✅ CRITICAL SECURITY CHECK: Verify email matches if present in token
    if (emailFromToken && emailFromToken !== user.email) {
      console.error(`❌ SECURITY ALERT: Email mismatch detected!`);
      console.error(`   Token email: ${emailFromToken}`);
      console.error(`   Database email: ${user.email}`);
      console.error(`   User ID: ${user.id}`);
      console.error(`   This indicates token is for a different user!`);
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Security error: Token email (${emailFromToken}) does not match user email (${user.email}). Please use the correct invite/reset link.` 
      }), { 
        status: 403,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }
    
    if (!emailFromToken) {
      console.warn(`⚠️ Email not found in token payload. Continuing with user from database: ${user.email}`);
    } else {
      console.log(`✅ Email verification passed: ${emailFromToken} matches ${user.email}`);
    }
    
    console.log(`📧 Email confirmed before: ${user.email_confirmed_at ? 'Yes' : 'No'}`);

    // 6. Update user password using admin API and confirm email
    const now = new Date().toISOString();
    
    console.log(`🔐 Updating password for: ${user.email}...`);
    const { data: updateData, error: updateError } = await client.auth.admin.updateUserById(
      user.id,
      { 
        password: password,
        email_confirmed_at: now,
        confirmed_at: now,
      }
    );

    if (updateError || !updateData.user) {
      console.error("❌ Password update error:", updateError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: updateError?.message || "Failed to update password" 
      }), { 
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    console.log(`✅ Password update API call succeeded`);

    // 7. CRITICAL: Wait longer and verify password was actually saved
    // Wait longer to ensure DB commit completes
    console.log(`⏳ Waiting for database commit...`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    console.log(`🔍 Verifying password was saved correctly...`);
    const { data: { user: verifiedUser }, error: verifyError } = await client.auth.admin.getUserById(user.id);

    if (verifyError || !verifiedUser) {
      console.error("❌ Verification error:", verifyError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: "Password updated but verification failed. Please try logging in." 
      }), { 
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    console.log(`✅ User verified: ${verifiedUser.email}`);
    console.log(`✅ Email confirmed: ${verifiedUser.email_confirmed_at ? 'Yes' : 'No'}`);

    // 8. CRITICAL: Test password authentication to ensure it actually works
    console.log(`🔐 Testing password authentication for ${verifiedUser.email}...`);
    try {
      // Get anon key for testing (fallback to service role if not available)
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || supabaseKey;
      
      // Create a test client with anon key to simulate real login
      const testClient = createClient(supabaseUrl, anonKey);
      
      // Try to sign in with the password we just set
      const { data: testData, error: testError } = await testClient.auth.signInWithPassword({
        email: verifiedUser.email!,
        password: password,
      });
      
      if (testError) {
        console.error(`❌ PASSWORD TEST FAILED for ${verifiedUser.email}:`, testError);
        console.error(`❌ Error details:`, {
          message: testError.message,
          status: testError.status,
          name: testError.name,
        });
        
        return new Response(JSON.stringify({ 
          success: false, 
          error: `Password was set but authentication test failed. The password may not have been saved correctly. Error: ${testError.message}` 
        }), { 
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }
      
      if (testData.user && testData.session) {
        console.log(`✅ PASSWORD TEST PASSED - Password works for ${verifiedUser.email}`);
        // Sign out the test session
        await testClient.auth.signOut();
      } else {
        console.error(`❌ PASSWORD TEST FAILED - No user/session returned`);
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Password was set but authentication test returned no user data" 
        }), { 
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        });
      }
    } catch (testErr: any) {
      console.error(`❌ Password test exception:`, testErr);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `Password test failed with exception: ${testErr.message || 'Unknown error'}` 
      }), { 
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      });
    }

    // 9. Return success only after password test passes
    console.log(`✅ All checks passed - Password is ready for use`);
    return new Response(JSON.stringify({ 
      success: true, 
      message: "Password updated successfully and verified. You can now log in with your new password.",
      user: {
        id: verifiedUser.id,
        email: verifiedUser.email,
        email_confirmed_at: verifiedUser.email_confirmed_at,
        confirmed_at: verifiedUser.confirmed_at,
      },
      debug: {
        password_set: true,
        email_confirmed: !!verifiedUser.email_confirmed_at,
        password_tested: true,
      }
    }), {
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json",
      },
      status: 200,
    });
  } catch (error) {
    console.error("❌ Confirm password error:", error);
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
