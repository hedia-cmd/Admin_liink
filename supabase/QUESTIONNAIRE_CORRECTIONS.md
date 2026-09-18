# Correction éditoriale 7 × 5 — changements locaux uniquement

Aucune donnée distante modifiée. Aucune migration déployée. Ne pas utiliser
`db push` ou `--include-all` : les historiques local/distant sont désynchronisés.

## Workflow constaté

Le backend de référence est dans le dépôt voisin `liink`, migration
`20260811160000_thematic_questionnaire_versions.sql`.
- `questionnaire_version_write_guard` et `questionnaire_child_write_guard`
  interdisent l’édition d’une version active/retired (ou déjà utilisée).
- `create_questionnaire_draft(theme, category, title)` alloue la prochaine
  version par thématique. La catégorie doit appartenir à cette thématique.
- `activate_questionnaire_version(id)` n’accepte qu’un draft et vérifie
  `main_questionnaire_is_compatible`, qui appelle le contrôle strict
  `questionnaire_structure_is_7x5`. L’activation retire l’ancienne version active
  de cette thématique et met à jour son mapping principal.
- L’ancien `set_main_theme_questionnaire` n’est plus accessible à authenticated.
  Son bouton Admin ouvre désormais la fiche de version et sa validation.

## Extension éditoriale sans thématique

Le diagnostic de production fourni confirme des catégories éditoriales valides,
`theme_id = NULL`, `status = retired`, `content_version = 1` pour les sept entrées.
Ces associations sont correctes et aucune thématique ne doit être inventée.

Les RPC Main ci-dessus restent inchangés. Deux RPC dédiés sont ajoutés :
- `create_editorial_questionnaire_draft(category, title, source?)` : catégorie
  existante requise, thème toujours NULL, nouvelle famille en V1 ou prochaine
  version de la source. La duplication conserve les textes et anomalies.
- `activate_editorial_questionnaire_version(id)` : draft éditorial uniquement,
  catégorie valide et contrôle strict `questionnaire_structure_is_7x5` requis.
  Seule la version active de la même famille est retirée. Aucun mapping Main
  n’est créé/modifié. L’activation ne change pas la programmation Freestyle.

`deactivate_questionnaire_version` fonctionne déjà pour les deux types et reste
inchangé. Les transitions passent par les guards existants.

La colonne générique nullable `version_root_id` relie les nouvelles versions à
leur source racine. Les anciennes lignes ne sont pas mises à jour : leur UUID
sert de racine via `COALESCE(version_root_id, id)`. Deux index uniques garantissent
un numéro unique et au plus une version active par famille éditoriale. Les RPC
verrouillent la racine avant de numéroter/activer une version. Une catégorie
n’est jamais utilisée comme famille : Joyce et Murakami restent indépendants.
Ce champ n’exprime ni un type Freestyle ni une appartenance à une programmation.

## Admin

La fiche affiche le diagnostic complet, les questions, leurs réponses, leurs
valeurs et positions, avec les liens d’édition/ajout sur les brouillons.
Les doublons textuels exacts sont signalés, jamais supprimés automatiquement.
Les formulaires de choix exposent enfin `order_index`, distinct de `value`.
Les formulaires de versions retirées et de leurs enfants sont en lecture seule.
La création distingue explicitement « parcours principal » et « éditorial sans
thématique ». Ce choix de formulaire n’est pas persisté ; il sélectionne le RPC
adéquat. L’absence accidentelle de thème dans une création Main reste une erreur.

La prévalidation ne remplace pas la validation serveur. L’activation vérifie le
contrôle strict puis appelle le RPC de lifecycle qui revalide en transaction.
Le sélecteur Freestyle propose les versions actives conformes, jamais
les drafts modifiables. La liste signale les anciennes entrées non conformes.
Le remplacement demande une version active et conserve l’ordre actuel.

## Migration locale 20260918140000_questionnaire_editorial_guards.sql

Prérequis : table Freestyle et fonctions de versioning déjà présentes.
- Trigger `BEFORE INSERT OR UPDATE` : structure strictement 7 × 5 et statut
  active requis, y compris pour les écritures directes.
- `list_freestyle_questionnaire_options` : sélection conforme pour l’Admin.
- `replace_freestyle_questionnaire` : insertion de la nouvelle référence et
  retrait de l’ancienne dans une transaction, `sort_order` inchangé. Échec =
  ancienne programmation conservée. RLS et vérification Admin maintenues.
- `duplicate_questionnaire_draft` : sélectionne le RPC Main ou éditorial selon
  la source, puis copie les
  textes/métadonnées avec de nouveaux UUID, sans modifier la source. Les
  anomalies sont copiées pour correction explicite. Les guards restent actifs.

Les anciennes entrées retirées ou invalides ne sont pas modifiées par la migration. Elles
restent signalées ; une modification de leur ordre est refusée tant qu’elles
ne sont pas remplacées ou retirées. Aucun audit de masse ni nettoyage automatique.
Les fonctions de calcul, de persistance et le prédicat 7 × 5 restent inchangés.

## Actions éditoriales ultérieures

Après déploiement séparément autorisé de cette migration : ouvrir la source
retired V1 → créer un brouillon V2 → corriger → revalider → activer → Freestyle /
ancienne entrée → remplacer par la nouvelle version active, même `sort_order`.
Aucune activation, correction ou substitution distante n’a été effectuée ici.

- GODARD : conserver les textes ; sur le brouillon, mettre « Oui, mais pas dans
  le bon ordre. » à value=2 / order_index=3, et « Un faux raccord entre ton visage
  et ton vertige » à value=4 / order_index=5, après vérification des positions
  libres. Rédiger manuellement la cinquième réponse du café.
- JOYCE : rédiger la cinquième réponse de « Quand une pensée te traverse sans
  prévenir... », value=3 / order_index=4, après vérification.
- MURAKAMI : décider éditorialement laquelle des deux questions en position 2
  doit passer à 3. Examiner les deux réponses identiques du supermarché et
  supprimer uniquement le doublon confirmé, sur le brouillon.
- RIMBAUD : conserver tous les textes ; réattribuer explicitement les valeurs
  émotionnelles 0–4 et positions 1–5 de chaque question. Ne pas confondre l’ordre
  d’affichage avec le sens émotionnel de la valeur.

## Tests ciblés

`CI=true npm test -- --watchAll=false --runInBand --no-cache --runTestsByPath src/questionnaireStructure.test.ts src/questionnaireAdmin.test.ts src/resources/questionnaires/StructurePanel.test.tsx src/freestyleDataProvider.test.ts src/App.test.tsx src/mainThemeQuestionnaire.test.ts`

`node --test supabase/tests/editorial-guards.test.cjs`

`npx tsc --noEmit`

Le test SQL exécute les fonctions réelles du dépôt `liink` dans PGlite, en mémoire,
avec des fixtures et un prédicat d’identité Admin simulé. Il ne valide pas les
policies effectivement déployées. Le chemin SQL peut être fourni explicitement
via `HUEKIF_VERSIONING_SQL`. Aucun accès réseau ou secret de production nécessaire.
