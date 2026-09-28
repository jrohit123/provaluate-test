// Replaces the frontend's direct supabase.auth.resetPasswordForEmail() call,
// which hits GoTrue's built-in /auth/v1/recover endpoint and its blocked
// SMTP mailer (Railway blocks outbound SMTP — confirmed via nc timing out).
// This generates the recovery link via the admin API (no SMTP attempt) and
// sends the email ourselves over HTTPS via Brevo. See _shared/email.ts.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { sendTemplatedEmail } from "../_shared/email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export default async function handler(req: Request): Promise<Response> {
  try {
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 200, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!supabaseUrl || !supabaseKey) {
      return new Response(JSON.stringify({ success: false, error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const client = createClient(supabaseUrl, supabaseKey);

    const body = await req.json().catch(() => null);
    const email: string | undefined = body?.email;
    const redirectTo: string | undefined = body?.redirectTo;

    if (!email || !redirectTo) {
      return new Response(JSON.stringify({ success: false, error: "Missing email or redirectTo" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Always respond success regardless of whether the account exists, so
    // this endpoint doesn't leak which emails are registered.
    const { data, error } = await client.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo },
    });

    if (error || !data?.properties?.action_link) {
      console.log(`Recovery link generation failed for ${email} (likely no such account):`, error?.message);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const templateUrl = Deno.env.get("MAILER_TEMPLATES_RECOVERY");
    try {
      if (!templateUrl) throw new Error("Missing MAILER_TEMPLATES_RECOVERY");
      await sendTemplatedEmail({
        templateUrl,
        toEmail: email,
        subject: "Reset your ProValuate password",
        confirmationUrl: data.properties.action_link,
        siteUrl: Deno.env.get("SITE_URL") ?? "",
      });
      console.log(`✅ Recovery email sent to ${email} via Brevo`);
    } catch (emailErr) {
      console.error("Recovery email send failed:", emailErr);
      return new Response(JSON.stringify({ success: false, error: "Failed to send recovery email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("forgot-password error:", error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
