import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { zipCode } = await req.json();
    
    if (!zipCode) {
      return new Response(
        JSON.stringify({ error: 'Zip code is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const WEATHER_API_KEY = Deno.env.get('WEATHER_API_KEY');
    
    if (!WEATHER_API_KEY) {
      console.error('WEATHER_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Weather API not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Fetching weather for zip code: ${zipCode}`);
    
    const response = await fetch(
      `https://api.weatherapi.com/v1/forecast.json?key=${WEATHER_API_KEY}&q=${zipCode}&days=2&aqi=no`
    );

    if (!response.ok) {
      console.error(`Weather API error: ${response.status} ${response.statusText}`);
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Format the response
    const weatherData = {
      today: {
        temp_f: Math.round(data.current.temp_f),
        condition: data.current.condition.text,
        icon: data.current.condition.icon,
        high: Math.round(data.forecast.forecastday[0].day.maxtemp_f),
        low: Math.round(data.forecast.forecastday[0].day.mintemp_f),
      },
      tomorrow: {
        high: Math.round(data.forecast.forecastday[1].day.maxtemp_f),
        low: Math.round(data.forecast.forecastday[1].day.mintemp_f),
        condition: data.forecast.forecastday[1].day.condition.text,
        icon: data.forecast.forecastday[1].day.condition.icon,
      },
      location: data.location.name,
    };

    console.log(`Successfully fetched weather for ${weatherData.location}`);

    return new Response(
      JSON.stringify(weatherData),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Weather fetch error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
