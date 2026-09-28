// Router for Supabase's self-hosted Edge Runtime.
// The edge-runtime container is a single process; this file is its one entrypoint.
// It reads the function name out of the incoming path (/<name>/...) and hands the
// request off to that function's own index.ts as an isolated worker.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

console.log("main function router started");

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

  const servicePath = `/home/deno/functions/${serviceName}`;

  const envVarsObj = Deno.env.toObject();
  const envVars = Object.keys(envVarsObj).map((k) => [k, envVarsObj[k]]);

  try {
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath,
      memoryLimitMb: 150,
      // Under Railway's per_worker policy, this is the worker's total
      // cumulative lifetime across all requests it handles (workers get
      // pooled/reused by servicePath), not a per-request timeout. 5 minutes
      // was too short and caused "early termination" kills mid-request
      // during normal repeated use.
      workerTimeoutMs: 60 * 60 * 1000,
      noModuleCache: false,
      importMapPath: null,
      envVars,
    });
    return await worker.fetch(req);
  } catch (e) {
    return new Response(JSON.stringify({ error: e.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}, { port: 9000 });
