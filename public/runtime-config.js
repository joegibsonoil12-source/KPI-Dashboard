(function () {
  // Non-secret runtime config — safe to commit.
  // This lets the client bootstrap and show client-side errors while we finish
  // wiring the runtime config generator that will use secure env vars.
  // DO NOT put SUPABASE_SERVICE_ROLE_KEY or other secrets here.
  window.__ENV = {
    BILLBOARD_API_BASE: "https://kpi-dashboard-seven-eta.vercel.app"
    // BILLBOARD_TV_TOKEN: "" // optional - do NOT add secret tokens here
  };
})();
