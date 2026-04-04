import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "../supabaseClient";

type Device = { id: string; name?: string | null };

type CmdRow = {
  id: number;
  status: "pending" | "delivered" | "applied" | "failed" | "expired";
  error?: string | null;
  delivered_at?: string | null;
  ack_at?: string | null;
};

export default function WifiUpdate() {
  const params = useParams(); // 👈 pour /devices/:id/wifi
  const [devices, setDevices] = useState<Device[]>([]);
  const [deviceId, setDeviceId] = useState<string>("");
  const [ssid, setSsid] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);

  const [cmdId, setCmdId] = useState<number | null>(null);
  const [cmd, setCmd] = useState<CmdRow | null>(null);
  const [fnOk, setFnOk] = useState<boolean | null>(null);     // 👈 état Edge Function reachable ?
  const [fnMsg, setFnMsg] = useState<string | null>(null);    // 👈 message explicite
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  const canSend = useMemo(
    () => !!deviceId && ssid.trim().length > 0 && pass.trim().length > 0 && !busy,
    [deviceId, ssid, pass, busy]
  );

  // 0) Préremplir l'id depuis l'URL /devices/:id/wifi
  useEffect(() => {
    if (params.id && !deviceId) setDeviceId(params.id);
  }, [params.id, deviceId]);

  // 1) Charger la liste des devices (si RLS bloque, on laissera la saisie manuelle)
  useEffect(() => {
    let abort = false;
    (async () => {
      const { data } = await supabase
        .from("devices")
        .select("id,name")
        .order("name", { ascending: true })
        .limit(200);
      if (abort) return;
      if (data && data.length) {
        setDevices(data as Device[]);
        if (!deviceId) setDeviceId((data[0] as any).id);
      }
    })();
    return () => {
      abort = true;
    };
  }, []);

  // 1bis) Health-check de l’Edge Function (déployée ? CORS ?)
  useEffect(() => {
    let alive = true;
    (async () => {
      // On appelle la fonction avec un payload volontairement invalide :
      // 200 = OK, 400 = OK (fonction joignable), 404 = non déployée,
      // fetch error = CORS / réseau.
      try {
        const { error } = await supabase.functions.invoke("queue_wifi_update", {
          body: { ping: true }, // provoquera 400 "Missing fields" si la func tourne (ce qui est OK)
        });
        if (!alive) return;

        // supabase-js v2 renvoie différents types d'erreurs : FunctionsHttpError, FunctionsFetchError, etc.
        const status =
          // @ts-ignore
          (error as any)?.context?.response?.status ??
          // @ts-ignore
          (error as any)?.status ??
          null;
        const name = (error as any)?.name ?? "";
        const msg = (error as any)?.message ?? "";

        if (!error) {
          setFnOk(true);
          setFnMsg(null);
        } else if (status === 400) {
          setFnOk(true);
          setFnMsg(null); // Fonction atteinte (payload invalide, c'est attendu)
        } else if (status === 404) {
          setFnOk(false);
          setFnMsg(
            "Edge Function 'queue_wifi_update' introuvable (404). Déploie-la : supabase functions deploy queue_wifi_update"
          );
        } else if (name === "FunctionsFetchError") {
          setFnOk(false);
          setFnMsg(
            "Impossible de joindre l’Edge Function (réseau/CORS). Vérifie les headers CORS dans la fonction."
          );
        } else {
          setFnOk(false);
          setFnMsg(`Erreur Edge Function: ${msg || "inconnue"}`);
        }
      } catch (e: any) {
        if (!alive) return;
        setFnOk(false);
        setFnMsg("Erreur réseau/CORS en appelant l’Edge Function.");
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // 2) Cleanup du channel realtime
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

  async function send() {
    try {
      setBusy(true);
      setCmd(null);
      setCmdId(null);

      const { data, error } = await supabase.functions.invoke("queue_wifi_update", {
        body: { device_id: deviceId, ssid, pass },
      });

      // Analyse d'erreur plus explicite pour aider au debug
      if (error) {
        const status =
          // @ts-ignore
          (error as any)?.context?.response?.status ??
          // @ts-ignore
          (error as any)?.status ??
          null;
        const name = (error as any)?.name ?? "";
        const msg = (error as any)?.message ?? "Erreur inconnue";
        if (status === 404) {
          throw new Error(
            "Edge Function 'queue_wifi_update' non trouvée (404). Déploie-la : supabase functions deploy queue_wifi_update"
          );
        }
        if (name === "FunctionsFetchError") {
          throw new Error(
            "Impossible de joindre l’Edge Function (CORS/réseau). Vérifie les en-têtes CORS dans la fonction."
          );
        }
        throw new Error(msg);
      }

      const id = (data as any)?.command_id as number;
      if (!id && id !== 0) {
        throw new Error("Réponse inattendue de l’Edge Function : pas de command_id.");
      }
      setCmdId(id);
      setPass(""); // effacer le champ mot de passe dans l'UI

      // Abonnement Realtime au suivi de statut
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      const ch = supabase
        .channel(`cmd:${id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "device_commands", filter: `id=eq.${id}` },
          (payload) => {
            const row = payload.new as any;
            setCmd({
              id: row.id,
              status: row.status,
              error: row.error,
              delivered_at: row.delivered_at,
              ack_at: row.ack_at,
            });
          }
        )
        .subscribe();
      channelRef.current = ch;

      // Lecture initiale pour afficher l'état tout de suite
      const { data: row } = await supabase
        .from("device_commands")
        .select("id,status,error,delivered_at,ack_at")
        .eq("id", id)
        .single();
      if (row) {
        setCmd({
          id: row.id as number,
          status: row.status as any,
          error: row.error as any,
          delivered_at: row.delivered_at as any,
          ack_at: row.ack_at as any,
        });
      }
    } catch (e: any) {
      alert("Erreur: " + (e?.message || e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ padding: 24, maxWidth: 560 }}>
      <h2 style={{ marginBottom: 16 }}>Changer le Wi-Fi d’un device</h2>

      {/* État de l’Edge Function */}
      {fnOk === false && (
        <div style={{ marginBottom: 12, padding: 12, background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 12, color: "#991B1B" }}>
          {fnMsg ?? "Edge Function indisponible."}
        </div>
      )}
      {fnOk === true && (
        <div style={{ marginBottom: 12, padding: 10, background: "#F0FDF4", border: "1px solid #86EFAC", borderRadius: 12, color: "#14532D" }}>
          Edge Function OK
        </div>
      )}

      {/* Sélecteur device */}
      {devices.length > 0 ? (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>Device</label>
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            style={{ width: "100%", padding: 8, borderRadius: 8 }}
          >
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name ? `${d.name} · ${d.id}` : d.id}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", marginBottom: 6 }}>
            Device ID (UUID) — (liste non accessible, entre l’ID à la main)
          </label>
          <input
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="c5003130-d88c-4bd9-9d88-3b54793c694b"
            style={{ width: "100%", padding: 8, borderRadius: 8 }}
          />
        </div>
      )}

      {/* Champs Wi-Fi */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ display: "block", marginBottom: 6 }}>SSID</label>
        <input
          value={ssid}
          onChange={(e) => setSsid(e.target.value)}
          placeholder="Nom du réseau Wi-Fi"
          style={{ width: "100%", padding: 8, borderRadius: 8 }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: "block", marginBottom: 6 }}>Mot de passe</label>
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder="••••••••"
          style={{ width: "100%", padding: 8, borderRadius: 8 }}
        />
      </div>

      <button
        onClick={send}
        disabled={!canSend || fnOk === false}
        style={{
          padding: "10px 16px",
          borderRadius: 999,
          background: canSend && fnOk !== false ? "#111827" : "#4b5563",
          color: "white",
          border: "none",
          cursor: canSend && fnOk !== false ? "pointer" : "not-allowed",
        }}
      >
        {busy ? "Envoi…" : "Envoyer au device"}
      </button>

      {/* Statut commande */}
      {cmdId && (
        <div style={{ marginTop: 20, padding: 12, border: "1px solid #E5E7EB", borderRadius: 12 }}>
          <div style={{ fontSize: 13, opacity: 0.8 }}>Commande #{cmdId}</div>
          <div style={{ marginTop: 6, fontWeight: 600 }}>
            Statut :{" "}
            <span style={{ textTransform: "uppercase" }}>{cmd?.status ?? "pending"}</span>
          </div>
          {cmd?.delivered_at && (
            <div style={{ marginTop: 4, fontSize: 13 }}>Livrée : {new Date(cmd.delivered_at).toLocaleString()}</div>
          )}
          {cmd?.ack_at && (
            <div style={{ marginTop: 4, fontSize: 13 }}>ACK : {new Date(cmd.ack_at).toLocaleString()}</div>
          )}
          {cmd?.error && (
            <div style={{ marginTop: 6, color: "#DC2626" }}>Erreur device : {cmd.error}</div>
          )}
          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
            (Le mot de passe est masqué en base après ACK)
          </div>
        </div>
      )}
    </div>
  );
}
