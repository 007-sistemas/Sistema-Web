<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1NleTU16JPRLYploAZgKtT7vLn5yDpQ3q

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Backend (Neon on Vercel)

- Prerequisite: set `DATABASE_URL` in Vercel Project Settings → Environment Variables with your Neon Postgres connection string.
- Serverless API routes live under the `api/` folder and run on Vercel.

### Initialize Tables

- Deploy to Vercel, then run a POST request to `https://<your-deployment>/api/setup` to create tables.
- Locally (with Vercel), run `vercel dev` and hit `http://localhost:3000/api/setup` after ensuring `DATABASE_URL` is set.

### Example API Usage

- List cooperados: GET `/api/cooperados`
- Create cooperado: POST `/api/cooperados` with `{ name, cpf?, email?, phone? }`
- List biometrics: GET `/api/biometrics`
- Create biometric: POST `/api/biometrics` with `{ cooperado_id, template (bytea), device_id? }`

### Local Development

If you want to run Vercel functions locally, install Vercel CLI:

```bash
npm i -g vercel
vercel dev
```

Ensure `DATABASE_URL` is set in an `.env` file or your shell environment for local dev.
