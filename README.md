
# Ticketing App

This repository contains the web-based ticketing portal. The application allows users to submit, manage and resolve support tickets through a user-friendly interface.

## License

This project is licensed under the [MIT License](LICENSE).
=======
# Ticketing Portal

This repository contains a simple web‑based ticketing portal built on top of [Supabase](https://supabase.com/). Static HTML files live in the `public/` directory and Deno edge functions reside in `supabase/functions/`.

## Prerequisites

Before running the project you will need:

- A [Supabase](https://supabase.com/) account.
- The [Supabase CLI](https://supabase.com/docs/guides/cli) installed locally (requires Docker).
- [Deno](https://deno.com/runtime) for running and deploying edge functions.

## Local Development

1. **Start Supabase** – from the project root run:

   ```bash
   supabase start
   ```

   This launches the local Postgres instance, APIs and the edge-runtime defined in `supabase/config.toml`.

2. **Serve the static files** – in a separate terminal, start a simple HTTP server so you can load `index.html` and files in `public/`:

   ```bash
   npx serve .
   ```

   Any basic web server works (for example `python3 -m http.server`).

3. **Test edge functions locally** – you can run a function with live reload using:

   ```bash
   supabase functions serve telegram-notify
   ```

   Replace `telegram-notify` with the function you want to test.

## Deploying Edge Functions

To deploy a function to your Supabase project:

```bash
# Authenticate with Supabase
supabase login

# Link your local repository with a project
supabase link --project-ref <project-ref>

# Deploy the function
supabase functions deploy telegram-notify
```

Use the function name (`telegram-register`, `telegram-notify`, etc.) when deploying. Once deployed the function is available in your Supabase project's Edge Functions section.

