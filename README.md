# KPI Dashboard — GitHub Pages (React + Vite)

Upload these files to your repo root. The GitHub Actions workflow will build and publish automatically to GitHub Pages.

## Features

### 🎥 Enhanced Videos Component

The dashboard includes a comprehensive Videos feature with modern UI/UX and advanced functionality:

#### ✨ Key Features
- **Smart Embed Detection**: Automatically detects and embeds YouTube/Vimeo videos
- **Professional Styling**: CSS modules with responsive grid layout
- **Supabase Settings UI**: localStorage-based configuration panel
- **Accessibility**: Proper ARIA labels and semantic HTML
- **Fallback Support**: Works with localStorage when Supabase is unavailable
- **Mobile Responsive**: Adapts to different screen sizes

#### 🚀 Usage
```jsx
// Basic usage with Supabase client
<Videos supabase={supabaseClient} />

// Embedded mode (no header)
<Videos supabase={supabaseClient} embedded={true} />

// With custom bucket
<Videos supabase={supabaseClient} bucket="my-videos" />

// Standalone with localStorage fallback
<Videos />
```

#### 📂 Files
- `src/components/Videos.jsx` - Enhanced main component
- `src/components/Videos.module.css` - Professional styling
- `src/components/SupabaseSettings.jsx` - Settings UI component
- `public/videos.html` - Standalone demo page
- `db/videos-table.md` - SQL documentation and setup guide

#### ⚙️ Supabase Setup
To enable video uploads and cloud storage:

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Get your project URL and anon key from Settings → API
3. Create a public storage bucket named "videos"
4. Create a "videos" table using the SQL in `db/videos-table.md`
5. Configure settings using the SupabaseSettings component or set localStorage keys:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

#### 🎯 Integration
The Videos component is integrated into the main application:
- Added to the TABS array in `App.jsx`
- "Videos" navigation link positioned after "Procedures"
- Full Supabase client integration for uploads and persistence
- localStorage fallback for environments without Supabase

## Local dev
```bash
npm install
npm run dev
```

## Demo Pages
- `/videos.html` - Standalone Videos component demo
- `/demo.html` - Feature overview and documentation

Commit to main to deploy via GitHub Actions.