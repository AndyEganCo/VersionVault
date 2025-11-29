# VersionVault

**Never miss a software update.** Track software versions across your entire toolset and get notified when new releases are available.

[![Live Site](https://img.shields.io/badge/Live-versionvault.dev-blue)](https://www.versionvault.dev)

## Overview

VersionVault is a software version tracking platform that helps teams and individuals monitor updates for their critical software tools. Built with React, TypeScript, and Supabase.

### Key Features

- 📦 **Public Software Directory** - Browse all tracked software and current versions (no login required)
- 🔔 **Smart Notifications** - Get alerted when your tracked software releases new versions
- 📊 **Dashboard** - View recent updates and track your software portfolio
- 🔍 **Search & Filter** - Find software by name, category, or manufacturer
- 👥 **Admin Panel** - Manage software entries and version history
- 🌙 **Dark Mode** - Full dark mode support

## Quick Start

### Prerequisites

- Node.js 20+
- npm or yarn
- Supabase account

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/AndyEganCo/VersionVault.git
   cd VersionVault
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**

   Create a `.env.local` file in the root directory:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   VITE_OPENAI_API_KEY=your_openai_api_key
   ```

4. **Set up Supabase database**

   See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed database setup instructions.

   **Quick fix for public home page:**
   ```sql
   -- Run this in your Supabase SQL Editor
   ALTER TABLE software ENABLE ROW LEVEL SECURITY;
   ALTER TABLE software_version_history ENABLE ROW LEVEL SECURITY;

   CREATE POLICY "Public read access to software"
   ON software FOR SELECT TO anon, authenticated USING (true);

   CREATE POLICY "Public read access to version history"
   ON software_version_history FOR SELECT TO anon, authenticated USING (true);
   ```

5. **Run the development server**
   ```bash
   npm run dev
   ```

   Open [http://localhost:5173](http://localhost:5173) in your browser.

## Project Structure

```
VersionVault/
├── src/
│   ├── components/        # React components
│   │   ├── admin/        # Admin panel components
│   │   ├── auth/         # Authentication components
│   │   ├── layout/       # Layout components
│   │   ├── software/     # Software-related components
│   │   └── ui/           # Reusable UI components (shadcn)
│   ├── contexts/         # React contexts (auth, etc.)
│   ├── data/             # Static data and constants
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utilities and API functions
│   │   ├── ai/           # AI-powered version detection
│   │   ├── auth/         # Authentication utilities
│   │   ├── software/     # Software data management
│   │   └── supabase.ts   # Supabase client
│   ├── pages/            # Page components
│   ├── types/            # TypeScript type definitions
│   └── App.tsx           # Main application component
├── supabase/
│   └── migrations/       # Database migrations
└── public/               # Static assets
```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking

## Tech Stack

- **Frontend:** React 18, TypeScript, Vite
- **UI Library:** Radix UI, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, RLS)
- **AI:** OpenAI GPT-4 for version extraction
- **Deployment:** Vercel (with Cron Jobs)
- **Analytics:** Vercel Analytics

## Database Schema

### Core Tables

- `software` - Software catalog with metadata
- `software_version_history` - Version history and release notes
- `tracked_software` - User software tracking
- `admin_users` - Admin role assignments
- `software_requests` - User requests for new software

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for complete schema and RLS policies.

## Deployment

The project is configured for Vercel deployment with automated cron jobs for version checking.

### Deploy to Vercel

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Add environment variables in Vercel dashboard:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_OPENAI_API_KEY`
   - `CRON_SECRET` (optional, for securing cron endpoints)
4. Deploy!

The `vercel.json` configuration includes:
- Automated daily version checking via cron jobs
- Optimized build settings
- Environment variable references

## Development Roadmap

- [x] Public home page with software directory
- [x] User authentication and profiles
- [x] Software tracking and subscriptions
- [x] Admin panel for software management
- [x] AI-powered version detection
- [x] Automated version checking (Vercel cron jobs)
- [x] Software request approval workflow
- [ ] Email notifications for version updates
- [ ] API documentation
- [ ] Mobile app
- [ ] Webhook notifications

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is private and proprietary.

## Support

For issues and questions, please create an issue in the GitHub repository.

---

Built with ❤️ by Andy Egan Co
