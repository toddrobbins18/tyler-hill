import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Audience = "parents" | "staff" | "both";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUser = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const {
      data: { user },
    } = await supabaseUser.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const companyId = String(body.company_id ?? "");
    const audience = (body.audience ?? "parents") as Audience;
    const title = String(body.title ?? "Camp notification").slice(0, 120);
    const messageBody = String(body.body ?? "").slice(0, 240);
    const data = body.data ?? {};

    if (!companyId) {
      return new Response(JSON.stringify({ error: "company_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const userIds = new Set<string>();

    if (audience === "parents" || audience === "both") {
      const { data: families } = await supabase
        .from("families")
        .select("user_id")
        .eq("company_id", companyId)
        .not("user_id", "is", null);
      for (const row of families ?? []) {
        if (row.user_id) userIds.add(row.user_id as string);
      }
    }

    if (audience === "staff" || audience === "both") {
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("company_id", companyId);
      for (const row of roles ?? []) {
        if (row.user_id) userIds.add(row.user_id as string);
      }
    }

    userIds.delete(user.id);

    if (userIds.size === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_recipients" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("expo_push_token")
      .in("id", [...userIds])
      .not("expo_push_token", "is", null);

    const tokens = [
      ...new Set(
        (profiles ?? [])
          .map((p) => p.expo_push_token as string | null)
          .filter((t): t is string => !!t && t.startsWith("ExponentPushToken")),
      ),
    ];

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: "no_tokens" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expoMessages = tokens.map((to) => ({
      to,
      title,
      body: messageBody,
      data,
      sound: "default" as const,
    }));

    const expoRes = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(expoMessages),
    });

    const expoJson = await expoRes.json().catch(() => ({}));

    return new Response(
      JSON.stringify({ sent: tokens.length, expo: expoJson }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[notify-company-expo-push]", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
