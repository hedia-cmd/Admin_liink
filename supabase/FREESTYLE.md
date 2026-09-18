# Programmation Freestyle V1

## Évolution locale du lifecycle (non déployée)

`20260918140000_questionnaire_editorial_guards.sql` étend le versioning aux
questionnaires éditoriaux sans thème, avec une catégorie valide et le même
contrat strict 7 × 5. Les RPC Main restent inchangés. Toute nouvelle programmation
exige désormais une version **active** et conforme ; les sept anciennes entrées
retired restent présentes jusqu’à leur remplacement explicite, à ordre constant.
Le seed V1 ci-dessous décrit l’installation initiale : ne pas le rejouer après
ce verrou avec ses anciennes références retired. Voir
[QUESTIONNAIRE_CORRECTIONS.md](QUESTIONNAIRE_CORRECTIONS.md) pour le workflow actuel.
Aucune migration, aucun seed ni aucune correction distante n’a été exécuté.

## Modèle indépendant

La migration locale `migrations/20260918120000_create_questionnaire_freestyle.sql`
crée `public.questionnaire_freestyle` :

- `questionnaire_id uuid PRIMARY KEY REFERENCES questionnaires(id) ON DELETE CASCADE` ;
- `sort_order integer NOT NULL DEFAULT 0` ;
- `created_at timestamptz NOT NULL DEFAULT now()`.

Une ligne signifie « ce questionnaire est actuellement programmé ». Aucun
contenu n'est copié. Retirer une ligne ne supprime ni ne modifie le questionnaire.
La suppression d'un questionnaire par un autre processus retire son entrée par
la clé étrangère. Un changement de version ne remplace pas automatiquement la
sélection : l'éditeur choisit explicitement le nouvel UUID si nécessaire.

L'ancienne migration Freestyle du 17 septembre, confirmée non déployée, a été
supprimée localement. Aucune migration géographique préexistante n'a été changée.
Aucune instruction ne modifie `public.questionnaire_version_write_guard()`.

## Admin

La rubrique **Freestyle** affiche la programmation triée par ordre croissant,
le titre et la catégorie d'origine en lecture seule. Elle permet de chercher un
questionnaire existant par titre, de l'ajouter, de changer son ordre et de le
retirer avec confirmation. L'UUID affiché dans le sélecteur distingue les titres
identiques et les différentes versions. Un doublon est refusé par la clé primaire
et signalé dans l'admin.

L'adaptateur `src/freestyleDataProvider.ts` traduit `questionnaire_id` en `id`
virtuel pour React Admin. Les créations ne transmettent que `questionnaire_id`
et `sort_order` ; les mises à jour seulement `sort_order`. Aucun appel de mutation
sur `questionnaires`, ses questions/choix/réponses, les catégories, les thèmes ou
le mapping principal n'est effectué par cette rubrique. Les formulaires généraux
des questionnaires ne contiennent plus de contrôle Freestyle.

## Seed V1

`seeds/freestyle_initial_selection.sql` réalise un upsert de sept UUID explicites :

| Ordre | Questionnaire |
| --- | --- |
| 10 | Godard |
| 20 | James Joyce |
| 30 | Haruki Murakami |
| 40 | Rimbaud |
| 50 | William Blake |
| 60 | Comment vois-tu demain ? |
| 70 | Dann fon mon kèr |

Il est idempotent, conserve `created_at` et ne modifie que la programmation.
Mister Freeze et les questionnaires Mood ne sont pas inclus. Sur la table neuve,
il crée exactement sept entrées. Sur une programmation déjà enrichie, il conserve
les autres entrées : il ne s'agit pas d'une remise à zéro. Un UUID absent de
`questionnaires` provoque l'échec atomique de l'insertion par la clé étrangère.
Le SELECT final permet une vérification en lecture seule.

## Sécurité et audit avant déploiement

Inspection locale : `src/authProvider.ts` appelle déjà `public.is_admin_user()`
à la connexion et lors du contrôle de session. Le dépôt ne contient pas sa
définition SQL ni les politiques existantes de `questionnaires`. La nouvelle
migration réutilise cette fonction, sans la créer ni la modifier et sans ajouter
un deuxième mécanisme d'administration. Elle échoue si cette dépendance manque.

La nouvelle table active RLS, retire les droits génériques PUBLIC/anon/authenticated,
puis accorde la lecture à `anon` et `authenticated`. Les écritures du rôle
`authenticated` exigent `is_admin_user() IS TRUE` dans les policies. Les droits
par colonne limitent les INSERT à l'UUID et à l'ordre et les UPDATE à l'ordre.
Les utilisateurs ordinaires ne peuvent ni ajouter, ni retirer, ni réordonner,
ni contourner les policies avec TRUNCATE. Le rôle serveur de confiance
`service_role` conserve un accès CRUD ; sa clé ne doit pas être utilisée par le
client. Les droits/policies des autres tables ne sont pas modifiés.

Avant tout déploiement futur :

1. Exécuter en lecture seule `checks/questionnaire_freestyle_access.sql` et
   vérifier la définition, le résultat booléen, les droits EXECUTE et la sécurité
   de `is_admin_user()` : identité issue de la session, droits/schéma maîtrisés si
   SECURITY DEFINER, résultat faux pour un utilisateur non administrateur.
2. Confirmer les rôles `anon`, `authenticated`, `service_role` et les droits
   d'accès au schéma public. Vérifier les politiques de lecture de questionnaires
   et catégories : l'accès à la sélection ne contourne pas leurs RLS.
3. Confirmer que les sept UUID désignent les versions effectivement souhaitées
   et lisibles par les utilisateurs de l'application. Les statuts et règles de
   disponibilité existants restent inchangés ; aucune activation n'est effectuée.
4. Valider sur un environnement dédié les accès avec un admin réel, un compte
   ordinaire et un client anonyme, puis le comportement de lecture PostgREST.
5. Déployer ultérieurement la nouvelle migration avant l'admin et le seed.
   Aucune migration ni seed distant n'a été exécuté pendant cette intervention.

## Lecture prévue pour liink (aucun Flutter modifié)

```sql
SELECT f.questionnaire_id, q.title, f.sort_order,
       q.category_id, c.label AS category_label
FROM public.questionnaire_freestyle AS f
JOIN public.questionnaires AS q ON q.id = f.questionnaire_id
LEFT JOIN public.categories AS c ON c.id = q.category_id
ORDER BY f.sort_order ASC, f.questionnaire_id ASC;
```

Lecture PostgREST/Supabase minimale, utilisant la nouvelle clé étrangère :

```js
supabase.from('questionnaire_freestyle')
  .select('questionnaire_id,sort_order,questionnaire:questionnaires!inner(title,category_id)')
  .order('sort_order', { ascending: true })
  .order('questionnaire_id', { ascending: true });
```

Le titre est dans `questionnaire.title` ; le client pourra aplatir cette structure.
La jointure interne écarte les questionnaires non lisibles selon leurs RLS. Aucune
vue SECURITY DEFINER n'est ajoutée. La catégorie est informative pour l'admin.

UX Flutter à conserver : une seule page, une programmation de 6 à 8 questionnaires
maximum, accès direct au questionnaire choisi, aucun menu catégorie, sous-menu ou
écran intermédiaire. La taille reste un choix éditorial, pas une contrainte SQL
empêchant de préparer/renouveler la programmation. « Surprends-moi » tire au hasard
parmi les mêmes entrées lisibles et démarre directement le questionnaire ; aucune
ligne dédiée n'est nécessaire. Si la sélection est vide, aucun tirage n'est possible.

## Tests locaux

- `CI=true npm test -- --watchAll=false --runInBand` : interface, adaptateur et
  régressions existantes. Ajout/retrait/réordonnancement ne ciblent que la table
  de programmation ; les champs étrangers sont exclus des mutations.
- `npm run test:freestyle:sql` : PostgreSQL en mémoire via PGlite, exécutant la
  vraie nouvelle migration et le vrai seed dans une base de test isolée. Contrôle
  des rôles, des RLS, de l'idempotence, des sept UUID/ordres, de l'exclusion de
  Mister Freeze/Mood et de l'absence d'écriture de questionnaire grâce à un trigger
  sentinelle de test. La fonction admin est un substitut de test : la définition
  distante réelle reste à vérifier. Aucun secret ni réseau Supabase utilisé.
- `npx tsc --noEmit`, `npm run build`, `git diff --check`.
