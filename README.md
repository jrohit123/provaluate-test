# ProValuate Project Overview

## 🚀 Project Purpose
ProValuate is an AI-powered recruitment assessment platform that streamlines hiring by evaluating job descriptions and candidate resumes to find the best matches. It supports job description management, resume uploads, AI-driven candidate evaluation, and detailed scorecards.

---

## 🗂️ Project Structure
```
src/
├── components/         # Reusable UI components (cards, forms, sections)
├── hooks/             # Custom React hooks (auth, toast, etc.)
├── integrations/      # Supabase and external service integrations
├── lib/               # Utility functions
├── pages/             # Main application pages (Dashboard, Login, etc.)
├── App.tsx            # App entry point
├── main.tsx           # React root and routing
```

---

## 🧩 Main Components
- **AppSidebar**: Navigation sidebar for main app sections
- **Header**: Top bar with user/company info and logout
- **JobUploadSection**: Upload and manage job descriptions, configure evaluation criteria
- **ResumeUploadSection**: Upload resumes, select job/criteria, send to n8n, view candidate pool
- **MatchScorecardSection**: Display evaluation results with rankings
- **CandidateDeepDive**: Detailed candidate analysis and insights
- **SmartInsights**: AI-powered matching insights and recommendations
- **Header**: Navigation and user interface elements
- **AdminUserManagement**: User management for organizations
- **UI Components**: Cards, buttons, forms, dialogs, select, progress, etc. (in `components/ui/`)

---

## 🪝 Key Hooks
- **useAuth**: Handles authentication, user profile, and company context
- **useToast**: Toast notification system
- **use-mobile**: Responsive/mobile detection

---

## 🔗 Integrations
- **Supabase**: Auth, database, storage, and RLS policies
- **n8n Webhooks**: For AI resume/job description processing
- **Shadcn UI**: Modern UI component library
- **Tailwind CSS**: Utility-first styling

---

## 🗄️ Supabase Database Tables

### 1. `companies`
| Column              | Type      | Description                  |
|---------------------|-----------|------------------------------|
| company_id          | uuid      | Primary key                  |
| company_name        | string    | Name of the company          |
| email_domain        | string    | Email domain (optional)      |
| selected_plan       | string    | Subscription plan            |
| subscription_status | string    | Plan status                  |
| created_at, updated_at | timestamp | Timestamps                |

### 2. `users`
| Column        | Type      | Description                  |
|---------------|-----------|------------------------------|
| user_id       | uuid      | Primary key (matches Auth)   |
| company_id    | uuid      | FK to companies              |
| email         | string    | User email                   |
| first_name    | string    | User first name              |
| last_name     | string    | User last name               |
| role          | string    | User role                    |
| user_status   | string    | Status (active, etc.)        |
| created_at    | timestamp | Creation time                |

### 3. `job_descriptions`
| Column         | Type      | Description                  |
|--------------- |-----------|------------------------------|
| jd_id          | uuid      | Primary key                  |
| company_id     | uuid      | FK to companies              |
| user_id        | uuid      | FK to users                  |
| title          | string    | Job title                    |
| description    | string    | Job description text         |
| jd_file        | string    | File URL (Supabase Storage)  |
| criteria_id    | uuid      | FK to criteria grid          |
| created_at, updated_at | timestamp | Timestamps            |

### 4. `resumes`
| Column           | Type      | Description                  |
|------------------|-----------|------------------------------|
| resume_id        | uuid      | Primary key                  |
| company_id       | uuid      | FK to companies              |
| user_id          | uuid      | FK to users                  |
| candidate_name   | string    | Candidate's name             |
| cv_file          | string    | Resume file URL              |
| evaluation_scores| json      | AI evaluation results        |
| created_at, updated_at | timestamp | Timestamps            |

### 5. `criteria`
| Column         | Type      | Description                  |
|--------------- |-----------|------------------------------|
| criteria_id    | uuid      | Primary key                  |
| criteria_name  | string    | Name of the criteria grid    |
| parameter      | string    | Parameter name               |
| weightage      | number    | Weight for this parameter    |
| calc_note      | string    | Notes                        |
| created_by     | uuid      | FK to users                  |
| company_id     | uuid      | FK to companies              |
| created_at, updated_at | timestamp | Timestamps            |

### 6. `assessment_reports`
| Column             | Type      | Description                  |
|--------------------|-----------|------------------------------|
| id                 | uuid      | Primary key                  |
| candidate_name     | string    | Candidate's name             |
| job_description_id | uuid      | FK to job_descriptions       |
| criteria_id        | uuid      | FK to criteria               |
| resume_url         | string    | Resume file URL              |
| scoring            | json/text | Detailed scoring breakdown   |
| overall_score      | number    | Overall match %              |
| recommendation     | string    | AI recommendation            |
| detailed_assessment| string    | Full assessment text         |
| status             | string    | Status (processing, completed)|
| created_at         | timestamp | Creation time                |

### 7. `plans`, `clients`, `contracts`
- **plans**: Subscription plans, usage limits, pricing
- **clients**: Client companies (for contracts)
- **contracts**: Contract details, pricing, validity, client association

---

## 🔒 Security & RLS
- Supabase Auth for user authentication
- Row Level Security (RLS) enabled on all sensitive tables
- Policies allow users to access only their own/company data

---

## 📝 Key Flows
- **Job Upload**: Upload JD file → AI analysis (n8n) → Save JD & criteria
- **Resume Upload**: Upload resume → Save to DB → Send to n8n for AI evaluation
- **Scorecard**: Fetch assessment reports for selected JD/criteria → Show candidate pool & scores
- **Deep Dive**: View detailed AI assessment for a candidate

---

## 🛠️ Setup & Development
- See README.md for setup, environment, and run instructions
- All environment variables (Supabase URL, anon key) in `.env`
- Main entry: `src/main.tsx` (routing, protected routes)
- Dashboard: `src/pages/Dashboard.tsx` (section switching)

---

## 📚 Useful References
- [Supabase Docs](https://supabase.com/docs)
- [Shadcn UI](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

---

*This file provides a high-level context for onboarding, debugging, and extending the ProValuate project.* 