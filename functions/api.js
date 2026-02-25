export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api" || url.pathname === "/") {
      try {
        // 🔒 SAFE: Now it pulls the token from the "env" object we set in the dashboard
        const token = env.AIRGRADIENT_TOKEN; 
        
        const response = await fetch(
          `https://api.airgradient.com/public/api/v1/locations/measures/current?token=${token}`
        );

        let data = await response.json();
        const item = Array.isArray(data) ? data[0] : data;

        // 🛡️ SECURITY: Only send necessary data to the dashboard
        const cleanData = {
          pm02_corrected: item.pm02_corrected,
          atmp_corrected: item.atmp_corrected,
          rhum_corrected: item.rhum_corrected,
          rco2_corrected: item.rco2_corrected,
          timestamp: item.timestamp
        };

        return new Response(JSON.stringify(cleanData), {
          headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
        });

      } catch (error) {
        return new Response(JSON.stringify({ error: "API connection failed" }), { 
          status: 500, 
          headers: { "Access-Control-Allow-Origin": "*" } 
        });
      }
    }
    return new Response("ELWOIC Worker is running safely! 🚀");
  }
};
