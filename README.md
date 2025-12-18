# InsureVis Web Portal

> *Streamlining insurance claim document verification between car companies and insurance carriers.*

---

## 📖 About
InsureVis Web Portal is a **multi-role document verification platform** designed to bridge the gap between car companies and insurance companies during the claims process. The system eliminates manual verification bottlenecks by providing dedicated portals for each stakeholder, ensuring secure, role-based access to insurance claim documents.

**Why this project?**  
Traditional insurance claim verification involves fragmented communication, delayed document sharing, and manual approval workflows. InsureVis centralizes this process with real-time document uploads, verification workflows, and comprehensive audit trails—reducing claim processing time and improving transparency.

---

## 🛠 Tech Stack

**Frontend:**
* Vanilla JavaScript (ES6+)
* HTML5 & CSS3
* [Font Awesome](https://fontawesome.com/) for icons

**Backend:**
* [Node.js](https://nodejs.org/) (v14+)
* [Express.js](https://expressjs.com/) - API gateway and server
* [Multer](https://github.com/expressjs/multer) - File upload handling

**Database & Authentication:**
* [Supabase](https://supabase.com/) - PostgreSQL database, authentication, and storage
* [@supabase/supabase-js](https://www.npmjs.com/package/@supabase/supabase-js) - Supabase client library

**Deployment:**
* [Vercel](https://vercel.com/) - Serverless deployment platform

---

## ✨ Key Features

* **Role-Based Authentication:** Secure login system with automatic role detection and workspace routing (Admin, Car Company, Insurance Company)
* **Dedicated Partner Dashboards:** Separate interfaces for car companies and insurance carriers with tailored workflows
* **Document Verification System:** Upload, review, and approve/reject insurance claim documents with status tracking
* **Hidden Admin Portal:** Administrative sign-up page for provisioning new partner accounts (security through obscurity)
* **Audit Trail Logging:** Comprehensive tracking of all verification actions and document status changes
* **Real-Time Data Sync:** Integration with Supabase for instant updates across all connected sessions
* **Secure File Storage:** Cloud-based document storage with role-based access controls
* **Responsive Design:** Works seamlessly across desktop and mobile devices

---

## 🚀 Getting Started

Follow these steps to set up the project locally.

### Prerequisites
* Node.js (v14 or higher)
* npm or yarn
* Supabase account with a configured project

### Installation

1. **Clone the repository**
   ```sh
   git clone https://github.com/yourusername/insurevis-web-portal.git
   cd insurevis-web-portal
   ```

2. **Install dependencies**
   ```sh
   npm install
   ```

3. **Configure Supabase**
   - Create a Supabase project at [supabase.com](https://supabase.com)
   - Update your Supabase URL and anon key in:
     - `public/login.js`
     - `public/admin-signup.js`
     - `supabase_config.js`
   - Run the SQL migrations in `db/` and `supabase_*.sql` files to set up tables and policies

4. **Set up environment variables**
   - Create a `.env` file in the root directory
   - Add your Supabase credentials:
     ```
     SUPABASE_URL=your_supabase_url
     SUPABASE_ANON_KEY=your_anon_key
     SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
     ```

5. **Generate test data (optional)**
   ```sh
   npm run generate-test-data
   ```

6. **Run the development server**
   ```sh
   npm run dev
   ```
   The application will be available at `http://localhost:3000`

### Usage

- **Login:** Navigate to `/` and sign in with your credentials
- **Admin Sign-up:** Access `/admin-signup/` to create new partner accounts (admin only)
- **Car Company Portal:** Automatically redirected to `/car-company/` after login
- **Insurance Company Portal:** Automatically redirected to `/insurance-company/` after login

---

## 📂 Project Structure

```
web_portal/
├── public/                        # Static frontend assets
│   ├── index.html                 # Login page
│   ├── login.js                   # Authentication logic
│   ├── styles.css                 # Global styles
│   ├── admin-signup/              # Hidden admin interface
│   │   └── index.html
│   ├── car-company/               # Car company workspace
│   │   ├── index.html
│   │   ├── app.js
│   │   └── styles.css
│   └── insurance-company/         # Insurance carrier workspace
│       ├── index.html
│       ├── app.js
│       └── styles.css
├── api/
│   └── config/
│       └── supabase.js            # Supabase configuration
├── db/                            # Database migrations
├── server.js                      # Express API gateway
├── supabase_config.js             # Server-side Supabase client
├── generate_test_data.js          # Test data generator
├── package.json
├── vercel.json                    # Vercel deployment config
└── README.md
```
---

## 🚦 Available Scripts

- `npm start` - Run the production server
- `npm run dev` - Start development server with hot reload (nodemon)
- `npm run generate-test-data` - Populate database with sample insurance claims
- `npm run cleanup-test-data` - Remove test data from database
- `npm run test-info` - Display information about test data

---

## 🌐 Deployment

The project is configured for **Vercel** deployment:

1. Push your code to GitHub
2. Import the project in Vercel
3. Add environment variables in Vercel dashboard:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Deploy!

The `vercel.json` configuration handles routing, serving static files from `/public`, and API routes through `server.js`.

---

## 📝 License

This project is licensed under the MIT License.

---

*Built with ❤️ for streamlined insurance claim processing*
