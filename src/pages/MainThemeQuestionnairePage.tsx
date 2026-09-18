import * as React from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
} from "@mui/material";
import { useNavigate, useParams } from "react-router-dom";

import {
  MainQuestionnaireOption,
  mainQuestionnaireOptionLabel,
  normalizeMainQuestionnaireOption,
} from "../mainThemeQuestionnaire";
import supabase from "../supabaseClient";

type ThemeRecord = {
  id: string;
  name: string;
  slug: string;
};

type ActiveMapping = {
  id: string;
  questionnaire_id: string;
  score_contract: string;
  activated_at: string;
};

export default function MainThemeQuestionnairePage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const [theme, setTheme] = React.useState<ThemeRecord | null>(null);
  const [activeMapping, setActiveMapping] =
    React.useState<ActiveMapping | null>(null);
  const [options, setOptions] = React.useState<MainQuestionnaireOption[]>([]);
  const [selectedId, setSelectedId] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    const [themeResult, mappingResult, optionsResult] = await Promise.all([
      supabase.from("themes").select("id,name,slug").eq("id", id).single(),
      supabase
        .from("main_theme_questionnaires")
        .select("id,questionnaire_id,score_contract,activated_at")
        .eq("theme_id", id)
        .is("deactivated_at", null)
        .maybeSingle(),
      supabase.rpc("list_main_questionnaire_options"),
    ]);

    const firstError =
      themeResult.error || mappingResult.error || optionsResult.error;
    if (firstError) {
      setError(firstError.message);
      setLoading(false);
      return;
    }

    const nextTheme = themeResult.data as ThemeRecord;
    const nextMapping = mappingResult.data as ActiveMapping | null;
    const nextOptions = ((optionsResult.data || []) as Record<string, unknown>[])
      .map(normalizeMainQuestionnaireOption);
    setTheme(nextTheme);
    setActiveMapping(nextMapping);
    setOptions(nextOptions);
    setSelectedId(nextMapping?.questionnaire_id || "");
    setLoading(false);
  }, [id]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const activeOption = options.find(
    (option) => option.questionnaire_id === activeMapping?.questionnaire_id,
  );
  const selectedOption = options.find(
    (option) => option.questionnaire_id === selectedId,
  );
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" padding={6}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box padding={3} maxWidth={960}>
      <Stack spacing={3}>
        <Box>
          <Button onClick={() => navigate("/themes")}>← Thématiques</Button>
          <Typography variant="h4" component="h1" marginTop={1}>
            Questionnaire du parcours principal
          </Typography>
          <Typography color="text.secondary">
            {theme?.name || "Thématique"} · {theme?.slug || id}
          </Typography>
        </Box>

        {error && (
          <Alert severity="error" action={<Button onClick={load}>Réessayer</Button>}>
            {error}
          </Alert>
        )}

        <Alert severity="warning">
          Un questionnaire déjà utilisé ne doit pas être édité. Ouvrez sa fiche pour créer
          une nouvelle version brouillon, la corriger puis l’activer.
        </Alert>

        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Questionnaire actif
            </Typography>
            {activeMapping && activeOption ? (
              <Stack spacing={1}>
                <Typography fontWeight={700}>{activeOption.title}</Typography>
                <Typography variant="body2">
                  UUID : <code>{activeOption.questionnaire_id}</code>
                </Typography>
                <Typography variant="body2">
                  Questions : {activeOption.question_count} · choix min/max : {" "}
                  {activeOption.min_choice_count ?? "—"}/
                  {activeOption.max_choice_count ?? "—"}
                </Typography>
                <Typography variant="body2">
                  Valeurs observées : [{activeOption.observed_values.join(", ")}]
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip
                    color={activeOption.is_compatible ? "success" : "error"}
                    label={
                      activeOption.is_compatible
                        ? "Compatible 7 × 5"
                        : "Incompatible"
                    }
                  />
                  <Chip label={activeMapping.score_contract} variant="outlined" />
                </Stack>
              </Stack>
            ) : (
              <Alert severity="error">Aucun questionnaire actif valide.</Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Stack spacing={2}>
              <Typography variant="h6">Changer le questionnaire actif</Typography>
              <FormControl fullWidth>
                <InputLabel id="main-questionnaire-select-label">
                  Questionnaire
                </InputLabel>
                <Select
                  labelId="main-questionnaire-select-label"
                  label="Questionnaire"
                  value={selectedId}
                  onChange={(event) => setSelectedId(String(event.target.value))}
                >
                  {options.map((option) => (
                    <MenuItem
                      key={option.questionnaire_id}
                      value={option.questionnaire_id}
                    >
                      {mainQuestionnaireOptionLabel(option)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {selectedOption && !selectedOption.is_compatible && (
                <Alert severity="error">
                  Ce questionnaire reste visible pour information, mais il ne
                  peut pas être activé car il ne respecte pas le contrat 7 × 5.
                </Alert>
              )}
              <Button
                variant="contained"
                disabled={!selectedOption}
                onClick={() => navigate(`/questionnaires/${selectedId}`)}
              >
                Ouvrir la version et sa validation
              </Button>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Box>
  );
}
