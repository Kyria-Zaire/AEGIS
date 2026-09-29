# Aegis Web

## GitHub App setup

Create a GitHub App using GitHub's [official registration guide](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app). Configure its webhook URL as `https://<host>/api/github/webhook`, set a strong webhook secret, and subscribe to:

- `Installation`
- `Installation repositories`
- `Pull request`
- `Push`

Grant read access to repository metadata and contents. Create a private key, store the PEM outside source control (locally, `apps/web/.secrets/` is ignored), and set its absolute path in `GITHUB_APP_PRIVATE_KEY_PATH`.

Required environment variables are `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY_PATH`, and `GITHUB_WEBHOOK_SECRET`. See the root `.env.example`.

OAuth user access, refresh, and ID tokens are deliberately discarded by the Auth.js adapter. Aegis accesses repositories only with short-lived GitHub App installation tokens.

## Local webhooks with smee

```sh
npx smee-client --url https://smee.io/YOUR_CHANNEL --target http://localhost:3000/api/github/webhook
```

Use the smee channel as the GitHub App webhook URL. Keep the same webhook secret locally and on GitHub.

To redeliver an existing GitHub App webhook with GitHub CLI, authenticate the request with an App JWT (not a user token):

```sh
GH_TOKEN="$APP_JWT" gh api --method POST /app/hook/deliveries/DELIVERY_ID/attempts
```

You can also use the GitHub App settings page's **Redeliver** action while smee is running.

## Security debt

- `TODO(debt, Sprint 5)`: encrypt Auth.js `session_token` values at rest.
- `TODO(debt)`: strengthen the code-level check that a `GithubInstallation.organizationId` belongs to the organization selected by the installing user. There is intentionally no direct database foreign key that can establish this GitHub identity relationship.
