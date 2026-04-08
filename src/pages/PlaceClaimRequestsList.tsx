import { useState } from "react";
import {
  Datagrid,
  DateField,
  FunctionField,
  List,
  TextField,
  useNotify,
  useRefresh,
} from "react-admin";
import { Button } from "@mui/material";
import { supabase } from "../supabaseClient";

type PlaceClaimRequest = {
  id: string;
  place_id?: string | null;
  requester_user_id?: string | null;
  professional_email?: string | null;
  message?: string | null;
  created_at?: string | null;
};

type ActionKind = "approve" | "reject";

const ClaimActions = ({ record }: { record?: PlaceClaimRequest }) => {
  const notify = useNotify();
  const refresh = useRefresh();
  const [loadingAction, setLoadingAction] = useState<ActionKind | null>(null);

  if (!record) return null;

  const runAction = async (action: ActionKind) => {
    try {
      setLoadingAction(action);

      const rpcName =
        action === "approve" ? "approve_place_claim" : "reject_place_claim";

      const { error } = await supabase.rpc(rpcName, {
        p_claim_request_id: record.id,
      });

      if (error) throw error;

      notify(
        action === "approve" ? "Demande validée" : "Demande refusée",
        { type: "success" }
      );
      refresh();
    } catch (e: any) {
      notify(`Erreur: ${e?.message || "action impossible"}`, {
        type: "error",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div style={{ display: "flex", gap: 8 }}>
      <Button
        variant="contained"
        size="small"
        disabled={loadingAction !== null}
        onClick={() => runAction("approve")}
      >
        {loadingAction === "approve" ? "Validation..." : "Valider"}
      </Button>

      <Button
        variant="outlined"
        color="error"
        size="small"
        disabled={loadingAction !== null}
        onClick={() => runAction("reject")}
      >
        {loadingAction === "reject" ? "Refus..." : "Refuser"}
      </Button>
    </div>
  );
};

export default function PlaceClaimRequestsList() {
  return (
    <List filter={{ status: "pending" }} sort={{ field: "created_at", order: "DESC" }}>
      <Datagrid bulkActionButtons={false} rowClick={false}>
        <TextField source="place_id" label="Place ID" />
        <TextField source="requester_user_id" label="Requester User ID" />
        <TextField source="professional_email" label="Email pro" />
        <TextField source="message" label="Message" />
        <DateField source="created_at" label="Créée le" showTime />
        <FunctionField
          label="Actions"
          render={(record: PlaceClaimRequest) => <ClaimActions record={record} />}
        />
      </Datagrid>
    </List>
  );
}