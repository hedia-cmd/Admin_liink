import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Vary": "Origin",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method === "GET") return new Response("ok", { status: 200, headers: { ...CORS } });

  try {
    const SB_URL = Deno.env.get("SB_URL")!;
    const SB_SERVICE_ROLE_KEY = Deno.env.get("SB_SERVICE_ROLE_KEY")!;
    const db = createClient(SB_URL, SB_SERVICE_ROLE_KEY);

    const { command_id, status, error: errMsg } = await req.json().catch(() => ({}));
    if (typeof command_id === "undefined" || !["applied","failed"].includes(status)) {
      return new Response(JSON.stringify({ ok: false, error: "Bad payload" }), {
        status: 400, headers: { ...CORS, "Content-Type":"application/json" }
      });
    }

    await db.from("device_commands").update({
      status, ack_at: new Date().toISOString(), error: errMsg ?? null
    }).eq("id", command_id);

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...CORS, "Content-Type":"application/json" }
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500, headers: { ...CORS, "Content-Type":"application/json" }
    });
  }
});
