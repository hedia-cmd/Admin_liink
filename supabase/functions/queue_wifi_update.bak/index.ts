// supabase/functions/queue_wifi_update/index.ts
// Deno Edge Function
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function corsHeaders(origin: string | null) {
  // Si tu veux restreindre : remplace "*" par "http://localhost:3002" (ton admin)
  return {
    "Access-Control-Allow-Origin": origin ?? "*",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  };
}

serve(async (req) => {
  const origin = req.headers.get("origin");
  const CORS = corsHeaders(origin);

  // Préflight CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  // Healthcheck pratique: GET retourne 200 si la fonction tourne
  if (req.method === "GET") {
    return new Response("ok", { status: 200, headers: { ...CORS, "Content-Type": "text/plain" } });
  }

  try {
    const SB_URL = Deno.env.get("SB_URL");
    const SB_SERVICE_ROLE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY");
    if (!SB_URL || !SB_SERVICE_ROLE_KEY) {
      return new Response(JSON.stringify({ error: "Missing SB_URL or SB_SERVICE_ROLE_KEY" }), {
        status: 500, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SB_URL, SB_SERVICE_ROLE_KEY);

    const { device_id, ssid, pass, apply_at } = await req.json().catch(() => ({}));
    if (!device_id || !ssid || !pass) {
      return new Response(JSON.stringify({ error: "Missing device_id|ssid|pass" }), {
        status: 400, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // (optionnel) vérifier l'existence du device
    const { data: dev, error: devErr } = await supabase
      .from("devices").select("id").eq("id", device_id).maybeSingle();
    if (devErr || !dev) {
      return new Response(JSON.stringify({ error: "Unknown device_id" }), {
        status: 404, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const { data, error } = await supabase
      .from("device_commands")
      .insert({
        device_id,
        type: "wifi_update",
        payload: { ssid, pass, apply_at: apply_at ?? null },
        status: "pending",
        expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({ command_id: data.id }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
    });
  }
});
