# Deploying to Vercel

This guide will help you deploy your BatteryLab application to Vercel.

## Prerequisites

1. A [Vercel account](https://vercel.com/signup) (free tier available)
2. Your project pushed to a Git repository (GitHub, GitLab, or Bitbucket)

## Option 1: Deploy via Vercel CLI (Fastest)

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Deploy

From your project directory, run:

```bash
vercel
```

Follow the prompts:
- Set up and deploy: **Yes**
- Which scope: Select your account
- Link to existing project: **No**
- Project name: (press Enter to use the default or enter a custom name)
- In which directory is your code located: **./** (press Enter)

For production deployment:

```bash
vercel --prod
```

## Option 2: Deploy via Vercel Dashboard (Recommended for beginners)

### Step 1: Push your code to GitHub

If you haven't already, commit and push your changes:

```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

If you don't have a remote repository yet:

1. Create a new repository on [GitHub](https://github.com/new)
2. Follow GitHub's instructions to push your local repository

### Step 2: Import to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your Git repository
4. Configure your project:
   - **Framework Preset**: Next.js (auto-detected)
   - **Build Command**: `npm run build` (or leave default)
   - **Install Command**: `npm install --legacy-peer-deps`
   - **Output Directory**: `.next` (default)
5. Click **"Deploy"**

### Step 3: Configure Environment Variables

After deployment, you may need to configure environment variables:

1. Go to your project settings in Vercel
2. Navigate to **Settings** → **Environment Variables**
3. Add any required variables from your `.env` file:
   - `DATABASE_URL` - SQLite database path (use: `file:./db/custom.db`)

Note: Vercel's serverless environment uses a temporary file system. For production, consider using:
- **Vercel Postgres** for relational data
- **Vercel KV** for key-value storage
- **Turso** or **PlanetScale** for SQLite-compatible cloud databases

## Important Notes

### Database Considerations

This project uses SQLite, which works locally but has limitations on Vercel:
- Vercel's filesystem is **read-only** except for `/tmp`
- Each serverless function invocation gets a fresh filesystem
- Data written to SQLite won't persist between deployments or function invocations

**For production deployment**, you should:

1. **Use Vercel Postgres** (recommended):
   ```bash
   vercel postgres create
   ```
   Then update your DATABASE_URL to use Postgres.

2. **Use Turso** (SQLite-compatible cloud database):
   - Sign up at [turso.tech](https://turso.tech)
   - Create a database and get the connection URL
   - Update your DATABASE_URL

3. **Use PlanetScale** (MySQL-compatible):
   - Sign up at [planetscale.com](https://planetscale.com)
   - Create a database and update your schema for MySQL

### Build Configuration

The `vercel.json` file is configured to:
- Use `npm install --legacy-peer-deps` (handles React peer dependency issues)
- Run the standard Next.js build command

### Automatic Deployments

Once connected to Git:
- **Push to main branch** → Automatic production deployment
- **Push to other branches** → Preview deployments

## Troubleshooting

### Build Errors

If you encounter build errors:
1. Check the build logs in Vercel dashboard
2. Ensure all dependencies are in `package.json`
3. Verify TypeScript errors are handled (currently ignoring build errors)

### Database Issues

If database operations fail:
1. Check that DATABASE_URL is set correctly
2. Consider migrating to a cloud database solution
3. Verify Prisma migrations are applied

### Performance

- Enable **Edge Runtime** for better performance (optional)
- Consider using **ISR** (Incremental Static Regeneration) for cacheable pages
- Monitor your usage in Vercel analytics

## Custom Domain

To add a custom domain:
1. Go to **Project Settings** → **Domains**
2. Add your domain
3. Configure DNS according to Vercel's instructions

## Support

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Vercel Community](https://github.com/vercel/vercel/discussions)
