FROM supabase/edge-runtime:latest

# Copies invite-user/, confirm-password/, and main/ (the router) into the
# runtime's functions directory. Railway builds this with build context set
# to supabase/functions, so paths below are relative to that folder.
COPY . /home/deno/functions

CMD ["start", "--main-service", "/home/deno/functions/main"]
