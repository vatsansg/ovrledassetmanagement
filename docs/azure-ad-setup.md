# Azure AD App Registration — one-time setup

LED Asset Manager needs a single Azure AD App Registration in the
`worldtabletennis.com` tenant before Settings → SharePoint sign-in can work.
This is a **one-time** setup — the same registration is used by every
installation of the app on every laptop, for every event. It does **not**
need to be redone per event or per SharePoint folder: the app supports
signing in as a different operator and pointing at a different SharePoint
site/folder without touching this registration again (see "Why this
supports multiple laptops/events" below).

## Steps (Azure Portal, requires a Global Administrator or Application
Administrator role in the tenant)

1. Go to **Azure Active Directory → App registrations → New registration**.
2. Name: `LED Asset Manager` (or similar).
3. Supported account types: **Accounts in this organizational directory
   only** (single tenant — `worldtabletennis.com`).
4. Redirect URI: platform **Mobile and desktop applications**, URI
   `http://localhost` (the special loopback value — MSAL's interactive
   flow picks an ephemeral port automatically at sign-in time; you do not
   need to register a specific port).
5. Click **Register**. Copy the **Application (client) ID** and the
   **Directory (tenant) ID** from the Overview page — these are what get
   entered into the app's Settings page (`AzureAdClientId`,
   `AzureAdTenantId`). Neither value is a secret; this app never uses a
   client secret (it's a "public client" native app).
6. Go to **API permissions → Add a permission → Microsoft Graph →
   Delegated permissions**, and add:
   - `Sites.Read.All`
   - `Files.Read.All`
7. Click **Grant admin consent for worldtabletennis.com** so individual
   operators aren't prompted to consent themselves.

## Why this supports multiple laptops/events (dynamic by design)

- These are **delegated** permissions, not app-only/`Sites.Selected`
  permissions — access is scoped to whatever SharePoint sites the
  *signed-in operator's own account* can already see, not to a specific
  site baked into the registration. Pointing the app at a different
  event's SharePoint folder is just a Settings change (`SharePointSourceLocation`)
  followed by **Test Connection** — no Azure AD change needed.
- Each laptop signs in interactively **once** (a system-browser popup);
  the resulting token is cached on that laptop in an encrypted, per-Windows-user
  file (`%ProgramData%\...\msal-token-cache.json`, protected via Windows DPAPI).
  Subsequent app runs on that same laptop reuse the cached session silently —
  no repeated login — for as long as the cached refresh token stays valid
  (governed by the tenant's normal token-lifetime/conditional-access policy,
  not by anything this app controls). Signing out, or switching which M365
  account is running the app on a given laptop, is a deliberate action
  (Settings → SharePoint → Sign out → Sign in again).

## What this doesn't need

- No client secret (public client app — nothing sensitive to leak from the
  installed app).
- No per-event or per-site Azure AD changes.
- No `Sites.Selected` per-site admin consent flow.
