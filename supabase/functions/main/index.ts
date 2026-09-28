// Router for Supabase's self-hosted Edge Runtime.
// The edge-runtime container is a single process; this file is its one entrypoint.
// It reads the function name out of the incoming path (/<name>/...) and calls
// that function's handler directly, in-process — NOT via EdgeRuntime.userWorkers
// (sandboxed isolates), whose outbound networking back through Envoy proved
// unreliable ("remote connection failure" on every REST/Auth call made from
// inside a spawned worker). This router's own context has been reliable
// throughout, so functions run as plain imported modules instead.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
// Static imports, not dynamic per-request import() — this sandbox doesn't
// permit dynamic runtime import() of arbitrary file paths (every attempt
// silently failed and fell through to a 404), but statically-declared
// imports resolve fine, the same way the router's own entrypoint loads.
import inviteUser from "../invite-user/index.ts";
import confirmPassword from "../confirm-password/index.ts";

console.log("main function router started");

type Handler = (req: Request) => Promise<Response>;
const handlers: Record<string, Handler> = {
  "invite-user": inviteUser,
  "confirm-password": confirmPassword,
};

// Port 9000 is explicit: Envoy's `functions` cluster is hard-configured to
// connect on 9000, but serve() defaults to 9999 when no port is given.
serve(async (req: Request) => {
  const url = new URL(req.url);
  const [, serviceName] = url.pathname.split("/");

  if (!serviceName) {
    return new Response(JSON.stringify({ error: "missing function name in request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const handler = handlers[serviceName];
  if (!handler) {
    return new Response(JSON.stringify({ error: `unknown function: ${serviceName}` }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    return await handler(req);
  } catch (e) {
    return new Response(JSON.stringify({ error: e.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}, { port: 9000 });
