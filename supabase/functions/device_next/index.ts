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

    const { device_id } = await req.json().catch(() => ({}));
    if (!device_id) {
      return new Response(JSON.stringify({ cmd: null }), {
        status: 200, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    // (optionnel) vérifier un token device ici via un header x-device-token

    const { data: cmds, error } = await db
      .from("device_commands")
      .select("id,type,payload,expires_at")
      .eq("device_id", device_id)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(1);

    if (error) throw error;

    if (!cmds || cmds.length === 0) {
      return new Response(JSON.stringify({ cmd: null }), {
        status: 200, headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const cmd = cmds[0];
    await db
      .from("device_commands")
      .update({ status: "delivered", delivered_at: new Date().toISOString() })
      .eq("id", cmd.id);

    return new Response(JSON.stringify({ cmd }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});
