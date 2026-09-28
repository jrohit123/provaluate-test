# Pinned to v1.76.2 (matches Supabase's own official self-hosted docker-compose,
# and listens on port 9000 by default). Newer tags like v1.77.1 default to port
# 9999 instead, which breaks Envoy's routing here since its `functions` cluster
# is hard-configured to connect on port 9000.
FROM supabase/edge-runtime:v1.76.2

# Copies invite-user/, confirm-password/, and main/ (the router) into the
# runtime's functions directory. Railway builds this with build context set
# to supabase/functions, so paths below are relative to that folder.
COPY . /home/deno/functions

CMD ["start", "--main-service", "/home/deno/functions/main"]
