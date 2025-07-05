# Ticketing App

This project relies on Supabase for data storage and authentication. All credentials are defined in `public/js/config.js` and loaded by the frontend scripts.

```javascript
(function(global){
  const config = {
    url: '<YOUR_SUPABASE_URL>',
    anonKey: '<YOUR_SUPABASE_ANON_KEY>'
  };
  global.SUPABASE_CONFIG = config;
})(typeof window !== 'undefined' ? window : global);
```

Replace the placeholders with your own credentials. For improved security, generate this file at deploy time using environment variables:

```bash
cat > public/js/config.js <<EOF2
window.SUPABASE_CONFIG = {
  url: "$SUPABASE_URL",
  anonKey: "$SUPABASE_ANON_KEY"
};
EOF2
```

All application scripts read from `window.SUPABASE_CONFIG`, so updating this one file is enough to change your Supabase settings.
