(function () {
  // Non-secret runtime config — safe to commit.
  // This lets the client bootstrap and see real client-side errors while we finish
  // wiring the runtime generator. DO NOT put secrets here.
  window.__ENV = {
    BILLBOARD_API_BASE: "https://kpi-dashboard-seven-eta.vercel.app"
    // BILLBOARD_TV_TOKEN: "" // optional - do NOT add secret tokens here
  };
})();
