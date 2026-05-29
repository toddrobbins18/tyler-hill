import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cloud } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
  compact?: boolean;
}

export function WeatherWidget({ zipCode, className, compact = false }: WeatherWidgetProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWeather();
    const interval = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [zipCode]);

  const fetchWeather = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke("get-weather", {
        body: { zipCode },
      });

      if (error) throw error;
      setWeather(data);
      setError(null);
    } catch (err) {
      console.error("Weather fetch error:", err);
      setError("Unable to load weather");
    } finally {
      setLoading(false);
    }
  };

  const headerClass = compact ? "p-4 pb-2" : undefined;
  const contentClass = compact ? "space-y-2 px-4 pb-4 pt-0" : "space-y-4";

  if (loading) {
    return (
      <Card className={cn("shadow-sm", className)}>
        <CardHeader className={headerClass}>
          <CardTitle className={cn("flex items-center gap-2", compact ? "text-base font-semibold" : "text-lg")}>
            <Cloud className="h-4 w-4" />
            Weather
          </CardTitle>
        </CardHeader>
        <CardContent className={contentClass}>
          <Skeleton className={cn("w-full", compact ? "h-16" : "mb-4 h-24")} />
          {!compact && <Skeleton className="h-20 w-full" />}
        </CardContent>
      </Card>
    );
  }

  if (error || !weather) {
    return null;
  }

  if (compact) {
    return (
      <Card className={cn("shadow-sm", className)}>
        <CardHeader className={headerClass}>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Cloud className="h-4 w-4 text-primary" />
            Weather
          </CardTitle>
        </CardHeader>
        <CardContent className={contentClass}>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
              <div className="mt-1 flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <p className="text-2xl font-bold leading-none">{weather.today.temp_f}°</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{weather.today.condition}</p>
                  <p className="text-[10px] text-muted-foreground">
                    H {weather.today.high}° · L {weather.today.low}°
                  </p>
                </div>
                <img src={`https:${weather.today.icon}`} alt={weather.today.condition} className="h-10 w-10 shrink-0" />
              </div>
            </div>
            <div className="rounded-lg border border-border bg-muted/50 p-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Tomorrow</p>
              <div className="mt-1 flex items-center justify-between gap-1">
                <div className="min-w-0">
                  <p className="truncate text-xs text-muted-foreground">{weather.tomorrow.condition}</p>
                  <p className="mt-1 text-xs font-medium">
                    H {weather.tomorrow.high}° · L {weather.tomorrow.low}°
                  </p>
                </div>
                <img src={`https:${weather.tomorrow.icon}`} alt={weather.tomorrow.condition} className="h-8 w-8 shrink-0" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn("shadow-sm", className)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Cloud className="h-5 w-5 text-primary" />
          Weather
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Today</p>
              <p className="mt-1 text-4xl font-bold text-foreground">{weather.today.temp_f}°</p>
              <p className="mt-1 text-sm text-muted-foreground">{weather.today.condition}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                H: {weather.today.high}° L: {weather.today.low}°
              </p>
            </div>
            <img src={`https:${weather.today.icon}`} alt={weather.today.condition} className="h-16 w-16" />
          </div>
        </div>
        <div className="rounded-lg border border-border bg-muted/50 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tomorrow</p>
              <p className="mt-2 text-sm text-muted-foreground">{weather.tomorrow.condition}</p>
              <p className="mt-1 text-sm font-medium">
                H: {weather.tomorrow.high}° L: {weather.tomorrow.low}°
              </p>
            </div>
            <img src={`https:${weather.tomorrow.icon}`} alt={weather.tomorrow.condition} className="h-12 w-12" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
