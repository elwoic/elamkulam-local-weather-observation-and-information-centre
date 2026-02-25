export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Only respond if the path is /api or the root /
    if (url.pathname === "/api" || url.pathname === "/") {
      try {
        // Use the token from environment variables or fallback to hardcoded
        const token = env.AIRGRADIENT_TOKEN || "1cbd5f6c-1a7d-4c95-8c5f-5431bb412a8d";
        
        const response = await fetch(
          `https://api.airgradient.com/public/api/v1/locations/measures/current?token=${token}`
        );

        let data = await response.json();

        // AIRGRADIENT FIX: If data is an array, send back just the first object
        if (Array.isArray(data)) {
          data = data[0];
        }

        return new Response(JSON.stringify(data), {
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" // This allows your HTML to read the data
          }
        });

      } catch (error) {
        // Return error in JSON format so the browser doesn't complain about CORS
        return new Response(JSON.stringify({ error: "API connection failed" }), { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*" 
          } 
        });
      }
    }

    return new Response("ELWOIC Worker is running! Visit /api for data.");
  }
};
