# Flipper Virtuel — Frontend

Application frontend du flipper virtuel, construite avec Vite + TypeScript.

Le projet livre les **3 écrans physiques de la borne** (playfield 3D, backglass HUD, DMD rétro) avec le parcours de jeu complet : splash → menu → identification → partie (solo/1v1) → pause → game over → leaderboard, plus les écrans annexes (cosmétiques, réglages). La partie tourne sur une state machine typée, synchronisée entre écrans via WebSocket.

---

## Assets 3D

Les modèles 3D (`.glb`, `.gltf`, `.fbx`, `.bin`) sont commités **directement dans
git** comme blobs normaux. Aucun outil à installer : un `git clone` / `git pull`
classique récupère les binaires tels quels.

> **Pourquoi pas Git LFS ?** On l'avait mis en place, mais LFS exige que *chaque*
> machine ait fait `git lfs install` avant le clone. La borne de déploiement
> n'avait pas LFS configuré : elle ne récupérait que le pointeur (~130 octets) au
> lieu du modèle, donc le binaire n'était jamais mis à jour côté borne. On stocke
> donc les modèles en brut, quitte à alourdir le repo.

---

## Démarrage rapide

### En local (Node)

```bash
# Installer les dépendances
npm install

# Développement
npm run dev

# Build production
npm run build

# Tests
npm test          # run unique
npm run test:watch

# Lint
npm run lint
npm run lint:fix

# Formatage
npm run format
npm run format:check
```

Par défaut `npm run dev` sert les 3 apps sur le même serveur Vite. Pour aller
directement sur le playfield sans dérouler tout le flow d'écrans (splash →
menu → identification), voir `docs/DEV_BOOT.md` (`?boot=playing`, `?sync=local`).

### En local (Docker, 3 services)

Le front est packagé en **trois images nginx indépendantes** — une par écran physique du flipper (playfield, backglass, dmd). Chaque image embarque le même bundle Vite mais sert une page HTML différente via une nginx conf dédiée (`nginx/<app>.conf`).

```bash
# Build + run des 3 services
docker compose up --build
```

| Service     | URL                     | Entrée                       |
| ----------- | ----------------------- | ---------------------------- |
| `playfield` | http://localhost:8081   | `apps/playfield/index.html`  |
| `backglass` | http://localhost:8082   | `apps/backglass/index.html`  |
| `dmd`       | http://localhost:8083   | `apps/dmd/index.html`        |

Sous le capot, chaque service construit la même image à partir du `Dockerfile` paramétré par l'argument `APP` (cf. `docker-compose.yml`).

---

## Structure du projet

```text
src/
├── config/             # Configuration applicative typée (env)
├── core/                # Noyau : state machine du jeu, store, EventBus
│   ├── gameMachine.ts / gameStore.ts   # State machine (splash → … → leaderboard)
│   ├── screenRouter/                   # Montage des écrans selon l'état courant
│   ├── keyboardDispatcher/             # Bindings clavier → intents de jeu
│   ├── devBoot.ts / devLocalSync.ts    # Raccourcis de dev (bypass flow, mode local)
├── engine/              # Orchestration rendu 3D (SceneManager, scène playfield)
├── physics/             # Adaptateurs physiques (Rapier + abstraction/placeholder)
├── services/            # Services techniques transverses
│   ├── matchSync/       # Synchronisation WebSocket temps réel (protocole, adapter)
│   ├── WebSocketService.ts, leaderboardStore.ts, playerSession.ts
│   └── gameAudio.ts, menuAudio.ts, apiError.ts
├── modules/             # Features métier (un dossier = un écran ou une feature)
│   ├── splash/ menu/ identification/ leaderboard/ cosmetics/ settings/
│   ├── countdown/ pause/ gameOver/ matchTimer/
│   ├── playfield/ ball/ flipper/ table/ slingshot/   # 3D / physique
│   ├── gameplay/ gameplayInput/ screenNav/           # orchestration & input
│   ├── backglass/ dmd/                               # écrans HUD & DMD
│   ├── controls/ ui/ debug/                          # UI transverse, overlays, debug
├── backglass/main.ts    # Point d'entrée de l'app backglass
├── dmd/main.ts          # Point d'entrée de l'app dmd
├── main.ts              # Point d'entrée de l'app playfield
└── style.css
```

---

## Principes d’architecture (cible pro)

- Un module = un dossier sous `src/modules/<feature>/`.
- Chaque module expose son API publique via `index.ts` (barrel export).
- Les imports inter-modules passent via aliases (`@modules/...`) et jamais via chemins relatifs profonds.
- La communication transverse passe par `core` (state machine + `EventBus`) ou `services` (WebSocket, audio, stockage), pas par couplage direct.
- Chaque app (`main.ts`, `backglass/main.ts`, `dmd/main.ts`) orchestre, les modules implémentent.

### Convention recommandée par module

```text
src/modules/<feature>/
├── <Feature>.ts        # Implémentation principale
├── <feature>.types.ts  # (optionnel) types du module
└── index.ts            # API publique du module
```

---

## Parcours de jeu (state machine)

Le jeu est piloté par une state machine typée (`src/core/gameMachine.ts` +
`gameStore.ts`), seule source de vérité pour l'écran actif et le contexte de
partie (mode, joueurs, score, balles restantes). Détail complet, diagramme et
API dans `docs/state-machine.md`.

| État             | Écran / module                          |
| ---------------- | ---------------------------------------- |
| `splash`         | `modules/splash`                          |
| `menu`           | `modules/menu`                            |
| `identification` | `modules/identification`                  |
| `playing`        | `modules/playfield` + `ball`/`flipper`/`table`/`slingshot` |
| `paused`         | `modules/pause`                           |
| `gameOver`       | `modules/gameOver`                        |
| `leaderboard`    | `modules/leaderboard`                     |
| `cosmetics`      | `modules/cosmetics`                       |
| `settings`       | `modules/settings`                        |

Le **playfield** reste sur la scène 3D (splash puis jeu) pendant toute la
navigation ; menu, identification, boutique, réglages et leaderboard s'affichent
sur le **backglass**. Le **DMD** affiche le score/vie en dot-matrix. Les trois
écrans sont synchronisés via `services/matchSync` (WebSocket).

---

## Environnement

Variables Vite (`VITE_*`) utilisées via `src/config/env.ts` :

| Variable            | Description | Fallback si absente |
| ------------------- | ----------- | -------------------- |
| `VITE_API_BASE_URL` | URL base API serveur | `/api` (same-origin) |
| `VITE_WS_URL`       | URL WebSocket serveur | `ws(s)://<origin>/ws` (same-origin) |
| `VITE_BORNE_ID`     | Identifiant du canal borne partagé par les 3 écrans, doit matcher le `BORNE_ID` backend | `flipper-cabinet-1` |
| `VITE_APP_TITLE`    | Titre application | `Flipper` |

En production, `VITE_API_BASE_URL` / `VITE_WS_URL` sont volontairement **non
définies** : le reverse-proxy nginx de chaque front route `/api` et `/ws` vers
le service `backend` en same-origin. En dev, c'est le proxy Vite qui joue ce
rôle (cf. `vite.config.ts`, cible configurable via `VITE_DEV_API_TARGET`).

Exemple :

```ts
import { env } from "@config/env";
console.log(env.wsUrl, env.isDev);
```

---

## Aliases de chemin

| Alias         | Répertoire |
| ------------- | ---------- |
| `@core/*`     | `src/core/*` |
| `@engine/*`   | `src/engine/*` |
| `@config/*`   | `src/config/*` |
| `@modules/*`  | `src/modules/*` |
| `@physics/*`  | `src/physics/*` |
| `@services/*` | `src/services/*` |
| `@utils/*`    | `src/utils/*` |

---

## Qualité de code

- TypeScript strict (`tsconfig.json`)
- ESLint flat config (`eslint.config.js`)
- Prettier (`format` / `format:check`)
- Tests unitaires Vitest (`*.test.ts` co-localisés avec le code testé — state machine, keyboard dispatcher, match sync, validation pseudo, etc.)

---

## Stack technique actuelle

| Technologie | Version (repo) | Rôle |
| ----------- | -------------- | ---- |
| Vite        | `^6.0.0`       | Bundler / dev server |
| TypeScript  | `~5.9.3`       | Typage statique |
| Three.js    | `^0.183.1`     | Rendu 3D |
| Rapier 3D   | `^0.19.3`      | Physique |
| GSAP        | `^3.14.2`      | Animations (UI, DMD) |
| Vitest      | `^4.1.7`       | Tests unitaires |
| ESLint      | `^9.37.0`      | Lint |
| Prettier    | `^3.6.2`       | Formatage |

---

## Documentation complémentaire

- `docs/state-machine.md` — state machine du jeu (diagramme, événements, contexte)
- `docs/match-sync-architecture.md` — synchronisation WebSocket entre écrans
- `docs/DEV_BOOT.md` — raccourcis de dev (`?boot=`, `?sync=local`)
- `docs/DESIGN.md` — principes de design UI/UX
- `docs/ONBOARDING-DESIGNERS.md` — onboarding pour les designers
- `docs/GIT-LFS.md` — historique du choix de stockage des assets 3D
- `docs/A_TRANSMETTRE_BACKEND_GAMEPLAY_WS.md` — contrat WebSocket à destination du backend

---

## CI/CD et déploiement

Le pipeline frontend est découpé en plusieurs workflows GitHub Actions complémentaires.

- Qualité PR:
  - `.github/workflows/front-pr-quality.yml` (format, lint, type-check, build)
  - `.github/workflows/front-pr-security.yml` (Gitleaks + Trivy fs)
  - `.github/workflows/terraform-pr-check.yml` (Terraform fmt/init/validate)
  - `.github/workflows/iac-pr-checkov.yml` (scan IaC Terraform + Kubernetes)
- Release main:
  - `.github/workflows/front-main-release.yml` (build image, scan Trivy, push GHCR)
  - `.github/workflows/terraform-main-plan.yml` (qualité Terraform + plan conditionnel)
- GitOps:
  - `.github/workflows/front-gitops-update-staging.yml` (mise à jour auto du tag staging)
  - `.github/workflows/front-gitops-promote-prod.yml` (promotion manuelle en prod)
  - `.github/workflows/update-center.yml` (avance le pointeur du submodule `front` dans `Flipper_Center`)

### Secret GitHub à prévoir

- `TF_FRONT_KUBECONFIG_B64` (optionnel mais recommandé): kubeconfig encodé en base64 pour activer le `terraform plan` dans le workflow main Terraform.
- `CENTER_TOKEN`: token utilisé par `update-center.yml` pour pousser sur `Flipper_Center`.

### Manifests de déploiement

- Kubernetes: `deploy/k8s/base` + `deploy/k8s/overlays/{staging,prod}`
- ArgoCD: `deploy/argocd/front-staging-application.yaml` et `deploy/argocd/front-prod-application.yaml`
- Terraform: `deploy/terraform/front`

En pratique, la chaîne est la suivante: merge sur `main` → image frontend publiée sur GHCR → tag staging mis à jour dans les manifests GitOps → ArgoCD synchronise l’environnement staging. La promotion production reste une action volontaire via workflow manuel.
