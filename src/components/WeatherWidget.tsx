import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface WeatherData {
  today: {
    temp_f: number;
    condition: string;
    icon: string;
    high: number;
    low: number;
  };
  tomorrow: {
    high: number;
    low: number;
    condition: string;
    icon: string;
  };
  location: string;
}

interface WeatherWidgetProps {
  zipCode: string;
  className?: string;
}

export function WeatherWidget({ zipCode, className }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWeather();
    // Refresh weather every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [zipCode]);

  const fetchWeather = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('get-weather', {
        body: { zipCode }
      });

      if (error) throw error;
      setWeather(data);
      setError(null);
    } catch (err) {
      console.error('Weather fetch error:', err);
      setError('Unable to load weather');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className={`shadow-sm ${className || ''}`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Cloud className="h-5 w-5" />
            Weather
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24 w-full mb-4" />
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error || !weather) {
    return null; // Silently fail - weather is not critical
  }

  return (
    <Card className={`shadow-sm ${className || ''}`}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Cloud className="h-5 w-5 text-primary" />
          Weather
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Today's Weather */}
        <div className="p-4 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Today</p>
              <p className="text-4xl font-bold text-foreground mt-1">{weather.today.temp_f}°</p>
              <p className="text-sm text-muted-foreground mt-1">{weather.today.condition}</p>
              <p className="text-xs text-muted-foreground mt-1">
                H: {weather.today.high}° L: {weather.today.low}°
              </p>
            </div>
            <img 
              src={`https:${weather.today.icon}`} 
              alt={weather.today.condition}
              className="w-16 h-16"
            />
          </div>
        </div>

        {/* Tomorrow's Weather */}
        <div className="p-4 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">Tomorrow</p>
              <p className="text-sm text-muted-foreground mt-2">{weather.tomorrow.condition}</p>
              <p className="text-sm font-medium mt-1">
                H: {weather.tomorrow.high}° L: {weather.tomorrow.low}°
              </p>
            </div>
            <img 
              src={`https:${weather.tomorrow.icon}`} 
              alt={weather.tomorrow.condition}
              className="w-12 h-12"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
