# Pinned to v1.76.2 to match Supabase's own official self-hosted docker-compose.
FROM supabase/edge-runtime:v1.76.2

# Copies invite-user/, confirm-password/, and main/ (the router) into the
# runtime's functions directory. Railway builds this with build context set
# to supabase/functions, so paths below are relative to that folder.
COPY . /home/deno/functions

# --port 9000 is forced explicitly: Envoy's `functions` cluster is hard-configured
# to connect on port 9000, but this image's actual default (observed at runtime)
# doesn't reliably match that, so we don't rely on the default at all.
CMD ["start", "--main-service", "/home/deno/functions/main", "--port", "9000"]
