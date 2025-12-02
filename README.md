# InsureVis Admin Portal

The InsureVis Admin Portal provides a secure entry point for partner organisations (car companies and insurance carriers) while giving administrators a dedicated workflow for provisioning new accounts.

## Highlights

- **Centralised login** powered by Supabase authentication with role-aware redirects to the correct workspace.
- **Hidden admin sign-up** page at `/admin-signup/` for provisioning new partner or admin accounts (not linked from the UI).
- **Dedicated partner dashboards** for car companies and insurance companies under `/car-company/` and `/insurance-company/`.
- **Server-side API gateway** (`server.js`) for handling secure integrations and file operations.

## Getting Started

1. **Install dependencies**
  ```powershell
  npm install
  ```
2. **Configure Supabase**
  - Confirm the Supabase URL and anon key in `public/login.js`, `public/admin-signup.js`, and `supabase_config.js`.
  - Ensure portal roles (`car_company`, `insurance_company`, `admin`) exist in user metadata or supporting tables.
3. **Run the server locally**
  ```powershell
  npm run dev
  ```
  The app serves static assets from `public/` and exposes API routes from `server.js`.

## Key Pages

- `/` – Partner login screen with role-based redirection.
- `/admin-signup/` – Unlisted administrative sign-up form. Share the URL only with trusted personnel.
- `/car-company/` – Car company workspace (accessible after login when the user role resolves to `car_company`).
- `/insurance-company/` – Insurance carrier workspace (accessible after login when role resolves to `insurance_company`).

### Admin Sign-up Flow

1. Navigate directly to `https://<your-domain>/admin-signup/`.
2. Enter the email, password, and desired portal role.
3. The form provisions a new Supabase user and stores the selected role in the user metadata so the login page can route correctly.
4. Newly created users receive an email confirmation (if enabled in Supabase) before they can sign in.

## Project Structure

```
web_portal/
├── public/
│   ├── index.html                 # Login interface
│   ├── login.js                   # Supabase login / role router
│   ├── styles.css                 # Shared auth styling
│   ├── admin-signup/
│   │   └── index.html             # Hidden admin sign-up page
│   ├── admin-signup.js            # Admin sign-up logic
│   ├── car-company/
│   │   ├── index.html             # Car company workspace shell
│   │   ├── app.js                 # Car company portal logic
│   │   └── styles.css             # Car company styling
│   └── insurance-company/
│       ├── index.html             # Insurance company workspace shell
│       ├── app.js                 # Insurance company portal logic
│       └── styles.css             # Insurance company styling
├── server.js                      # Express server & API gateway
├── supabase_config.js             # Supabase client configuration for server-side use
├── generate_test_data.js          # Utility for creating sample data
├── package.json                   # Project metadata and scripts
└── README.md                      # Project documentation (this file)
```

## Scripts

- `npm start` – Run the production server.
- `npm run dev` – Start the development server with nodemon.
- `npm run test:server` – Invoke legacy demo server tests (requires demo scripts).
- `npm run generate-test-data` – Populate Supabase with demo data (requires proper environment setup).

> **Note:** Some historical scripts refer to demo test files. They remain for compatibility but may require bespoke fixtures to execute successfully.

## Deployment

- The project is configured for Vercel (`vercel.json`) to serve `/public` as static assets and route everything else through `server.js`.
- Dedicated rewrites ensure `/admin-signup/` and `/admin-signup.js` are served directly without hitting the login fallback.
- Update environment variables in Vercel to match your Supabase credentials before deploying.

## Support

Questions or requests? Contact the InsureVis engineering team at [support@insurevis.com](mailto:support@insurevis.com).
