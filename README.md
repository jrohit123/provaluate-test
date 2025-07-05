# ProValuate - AI-Powered Recruitment Assessment Platform

ProValuate is a sophisticated recruitment assessment platform that leverages AI to streamline the hiring process by evaluating job descriptions and candidate resumes to find the best matches.

## 🚀 Features

- **Job Description Management**
  - Upload and analyze job descriptions
  - Extract key requirements and skills
  - Create custom evaluation criteria

- **Resume Processing**
  - Upload and parse candidate resumes
  - AI-powered candidate evaluation
  - Score matching against job requirements

- **Smart Insights**
  - Detailed candidate scorecards
  - Match percentage calculations
  - Automated skill gap analysis

- **Multi-user Support**
  - Company-based organization
  - Role-based access control
  - Team collaboration features

## 🛠️ Technology Stack

- **Frontend**
  - React with TypeScript
  - Vite for build tooling
  - Tailwind CSS for styling
  - Shadcn UI components

- **Backend**
  - Supabase for backend services
  - PostgreSQL database
  - Real-time subscriptions
  - Secure authentication

## 📋 Database Schema

### Core Tables

1. **Companies**
   - Company profile management
   - Subscription tracking
   - Usage monitoring

2. **Users**
   - User authentication
   - Role management
   - Company association

3. **Job Descriptions**
   - Job posting details
   - Evaluation criteria
   - Company/user associations

4. **Resumes**
   - Candidate information
   - CV file storage
   - Evaluation scores

5. **Criteria**
   - Custom evaluation parameters
   - Weightage configuration
   - Calculation rules

6. **Plans**
   - Subscription tiers
   - Usage limits
   - Pricing information

## 🚀 Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or Bun package manager
- Supabase account

### Installation

1. Clone the repository:
\`\`\`bash
git clone [repository-url]
cd provaluate
\`\`\`

2. Install dependencies:
\`\`\`bash
npm install
# or
bun install
\`\`\`

3. Set up environment variables:
\`\`\`bash
cp .env.example .env
\`\`\`

4. Update the .env file with your Supabase credentials:
\`\`\`env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
\`\`\`

5. Start the development server:
\`\`\`bash
npm run dev
# or
bun dev
\`\`\`

## 🔒 Security

- Secure authentication via Supabase
- Row Level Security (RLS) policies
- Data encryption at rest
- Secure file storage

## 📦 Project Structure

\`\`\`
src/
├── components/         # Reusable UI components
├── hooks/             # Custom React hooks
├── integrations/      # External service integrations
├── lib/              # Utility functions
└── pages/            # Application pages
\`\`\`

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

## 📄 License

This project is licensed under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- [Supabase](https://supabase.com/) for backend services
- [Shadcn UI](https://ui.shadcn.com/) for UI components
- [Tailwind CSS](https://tailwindcss.com/) for styling
