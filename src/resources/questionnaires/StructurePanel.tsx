import * as React from 'react';
import { Alert, Button, CircularProgress, Stack, Typography } from '@mui/material';
import { useGetOne, useNotify, useRecordContext, useRefresh } from 'react-admin';
import { Link, useNavigate } from 'react-router-dom';
import { activateQuestionnaire, deactivateQuestionnaire, duplicateQuestionnaire, readStructure } from '../../questionnaireAdmin';
import { EditorialQuestion, validateQuestionnaireStructure } from '../../questionnaireStructure';

// Child resources remain readable; only drafts expose their editing controls.
export function DraftOnly({ children }: { children: React.ReactNode }) {
  const record = useRecordContext<any>();
  const { data, isPending, error } = useGetOne('questionnaires', { id: record?.questionnaire_id }, { enabled: !!record?.questionnaire_id });
  if (isPending) return <CircularProgress />;
  if (error) return <Alert severity="error">Impossible de vérifier la version. Réessaie depuis le questionnaire.</Alert>;
  if (data?.status !== 'draft') return <Alert severity="info">Cette version est immuable. <Link to={`/questionnaires/${record?.questionnaire_id}`}>Créer un brouillon depuis le questionnaire</Link>.</Alert>;
  return <>{children}</>;
}

export function StructurePanel() {
  const record = useRecordContext<any>();
  const notify = useNotify();
  const refresh = useRefresh();
  const navigate = useNavigate();
  const [state, setState] = React.useState<{ questions: EditorialQuestion[]; valid: boolean } | null>(null);
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [revision, reload] = React.useReducer(n => n + 1, 0);
  React.useEffect(() => {
    let current = true;
    setState(null); setError('');
    readStructure(String(record.id)).then(value => { if (current) setState(value); })
      .catch(e => { if (current) setError(e.message); });
    return () => { current = false; };
  }, [record.id, revision]);
  const errors = state ? validateQuestionnaireStructure(state.questions) : [];
  const draft = record.status === 'draft';
  const editorial = record.theme_id == null;
  const lifecycleAvailable = !!record.category_id;
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    try { await action(); } catch (e) { notify((e as Error).message, { type: 'error' }); }
    finally { setBusy(false); }
  };
  return <Stack spacing={2} sx={{ p: 2 }}>
    <Typography variant="h6">Structure — {record.status} · version {record.content_version ?? '—'}</Typography>
    <Typography>{editorial ? 'Questionnaire éditorial — sans thématique de parcours' : 'Questionnaire du parcours principal'}</Typography>
    {!draft && <Alert severity="info">Version conservée dans l’historique. Créer une nouvelle version brouillon pour corriger son contenu.</Alert>}
    {!lifecycleAvailable && <Alert severity="warning">Une catégorie éditoriale valide est requise pour créer ou activer cette version.</Alert>}
    {error && <Alert severity="error">{error}</Alert>}
    {!state && !error && <CircularProgress />}
    {state && <Alert severity={state.valid && errors.length === 0 ? 'success' : 'error'}>
      {state.valid && errors.length === 0 ? 'Structure valide : 7 questions, 5 réponses par question, positions 1–7 / 1–5 et valeurs 0–4 uniques. Validation serveur réussie.' : 'Structure incomplète : publication et programmation refusées.'}
      {errors.map(message => <Typography key={message} variant="body2">{message}</Typography>)}
    </Alert>}
    <Stack direction="row" spacing={1}>
      <Button onClick={reload} disabled={busy}>Revalider</Button>
      {!draft && <Button disabled={busy || !lifecycleAvailable} onClick={() => run(async () => {
        const id = await duplicateQuestionnaire(String(record.id));
        navigate(`/questionnaires/${id}`);
      })}>Créer une nouvelle version brouillon</Button>}
      {draft && <Button disabled={busy || !lifecycleAvailable || !state?.valid || errors.length > 0} onClick={() => {
        if (!window.confirm(editorial
          ? 'Activer cette version éditoriale ? Elle remplacera la version active de ce questionnaire. La programmation Freestyle se remplace séparément.'
          : 'Activer cette version ? Le workflow existant remplacera la version active de sa thématique.')) return;
        void run(async () => { await activateQuestionnaire(String(record.id), editorial ? 'editorial' : 'main'); refresh(); reload(); });
      }}>Activer la version</Button>}
      {record.status === 'active' && <Button disabled={busy} onClick={() => {
        if (!window.confirm('Retirer cette version active ? Les références Freestyle existantes devront être remplacées ou retirées séparément.')) return;
        void run(async () => { await deactivateQuestionnaire(String(record.id)); refresh(); reload(); });
      }}>Retirer la version active</Button>}
    </Stack>
    {state?.questions.map((q, index) => <Stack key={q.id} spacing={1} sx={{ borderTop: '1px solid #ddd', pt: 2 }}>
      <Typography fontWeight="bold">Question {index + 1} — position {q.order_index ?? 'vide'} : {q.text}</Typography>
      {draft && <Link to={`/questions/${q.id}`}>Modifier le texte ou la position</Link>}
      {[...q.choices].sort((a, b) => (a.order_index ?? 999) - (b.order_index ?? 999) || a.id.localeCompare(b.id)).map(c =>
        <Typography key={c.id}>{c.text}{q.choices.filter(other => other.text === c.text).length > 1 && ' (doublon textuel exact à examiner)'} — valeur {c.value ?? 'vide'}, position {c.order_index ?? 'vide'} {draft && <Link to={`/choices/${c.id}`}>Modifier</Link>}</Typography>)}
      {draft && <Link to={`/choices/create?source=${encodeURIComponent(JSON.stringify({ questionnaire_id: record.id, question_id: q.id }))}`}>Ajouter une réponse</Link>}
    </Stack>)}
    {draft && <Link to={`/questions/create?source=${encodeURIComponent(JSON.stringify({ questionnaire_id: record.id }))}`}>Ajouter une question</Link>}
  </Stack>;
}
