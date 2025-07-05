(function(global){
  const config = {
    url: 'https://rkdblbnmtzyrapfemswq.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZGJsYm5tdHp5cmFwZmVtc3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1ODQyNTgsImV4cCI6MjA2NjE2MDI1OH0.TY7Ml-S-knKMNQ-HKylGLbpXIu9wHqGAZDHHAq4rRJc'
  };
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = config;
  }
  global.SUPABASE_CONFIG = config;
})(typeof window !== 'undefined' ? window : global);
