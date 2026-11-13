# Multiplayer setup

The game signs players in with their Orbid Microsoft account (MSAL), lets them make a character once, and shows everyone who is online walking around the office in real time. Player positions and characters go through a free Firebase Realtime Database.

Two things need setting up once: an **app registration in Entra ID** (for the Microsoft login) and a **Firebase project** (for the live data). Then fill in [config.js](config.js). None of the values in `config.js` are secrets.

## 1. Entra ID app registration (Microsoft login)

1. Go to the [Azure portal](https://portal.azure.com) → **Microsoft Entra ID** → **App registrations** → **New registration**.
2. **Name:** `Office Game`.
3. **Supported account types:** *Accounts in this organizational directory only (Orbid only – Single tenant)*.
4. **Redirect URI:** platform **Single-page application (SPA)**, URI `https://jonasvanb.github.io/office-game/`.
5. Click **Register**.
6. In the new app → **Authentication** → under *Single-page application*, add a second redirect URI for testing: `http://localhost:8137/`. Save.
7. From the **Overview** page, copy:
   - **Application (client) ID** → `msal.clientId`
   - **Directory (tenant) ID** → `msal.tenantId`

No client secret and no API permissions are needed: the game only asks for `openid` and `profile` (your name and a stable account ID). If your account can't create app registrations, an Entra admin can do steps 1–7 for you.

## 2. Firebase project (live data)

1. Go to the [Firebase console](https://console.firebase.google.com) → **Add project** → name it `office-game`. Google Analytics is not needed.
2. **Build → Realtime Database → Create database.** Location: **Belgium (europe-west1)**. Start in **locked mode**.
3. Open the **Rules** tab, replace everything with the contents of [database.rules.json](database.rules.json) and click **Publish**.
4. Firebase **Authentication is not needed**: the Microsoft login happens in the game itself, and the rules only allow the `profiles` and `presence` data in the shape the game writes. So an existing project works too; its other data (Firestore, other paths) is not touched by these rules.
5. **Project settings (gear) → General → Your apps → Web (`</>`)** → register an app called `office-game` (no Firebase Hosting). Copy these values from the config it shows into `config.js` → `firebase`: `apiKey`, `authDomain`, `databaseURL`, `projectId`, `appId`.

   If `databaseURL` is missing from that config, copy it from the top of the Realtime Database page (it looks like `https://office-game-xxxx-default-rtdb.europe-west1.firebasedatabase.app`).

## 3. Fill in config.js

Send the values to Claude, or paste them into [config.js](config.js) yourself. Once both blocks are filled in, the start screen shows **Sign in with Microsoft**.

## How it works

- **Sign in:** Microsoft login in a popup (or a redirect if popups are blocked). The account's object ID (`oid`) identifies the player, so the same character comes back on every device.
- **Character:** the first time, the character creator opens. The name and look are saved in the database under `profiles/<oid>` (and on the device as a backup). **Edit character** on the start screen changes it.
- **Live:** while you play, your position is sent about 8 times a second when you move (and every 15 s when you stand still) to `presence/<key>`. Firebase removes you automatically when you close the page or lose the connection.
- **Cost:** Firebase's free plan allows 100 players online at once and 10 GB of data per month, far more than an office team uses.

## Limits of this setup

- Firebase can't check Microsoft login tokens itself. The database rules only check the shape of the data, so someone who knows the database address could write a fake player or change another player's saved character. That's acceptable for a colleague game; moving to a small Azure server that checks the Microsoft token would close this gap.
- The game itself (code and site) is public on GitHub Pages; only people with an Orbid account can sign in and play together.

## Testing without the setup

On `localhost`, while `config.js` is still empty (or with `?local` in the address), the game runs in **local test mode**: **Sign in (local test)** creates a test player per browser tab, and players in other tabs of the same browser see each other. Nothing leaves your computer.

Start the local server with the `office` entry in `.claude/launch.json` (`npx http-server -p 8137`), then open `http://localhost:8137/` in two tabs.
