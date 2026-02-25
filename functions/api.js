export async function onRequest() {
  try {
    const response = await fetch(
      "https://api.airgradient.com/public/api/v1/locations/measures/current?token=1cbd5f6c-1a7d-4c95-8c5f-5431bb412a8d"
    );

    const data = await response.json();
    
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (error) {
    return new Response("Error fetching data", { status: 500 });
  }
}
