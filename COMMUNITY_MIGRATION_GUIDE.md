# Community Section Database Migration Guide

## Issue
The community section is showing an error because the required database tables have not been created. The code defines these tables in the schema, but the migrations have not been applied to your Turso database.

## Missing Tables
- `community_profiles` - User profiles for the marketplace
- `freelancer_offers` - Service offerings from freelancers
- `freelancer_portfolio` - Portfolio items for freelancers
- `client_projects` - Projects posted by clients
- `proposals` - Proposals submitted by freelancers on client projects
- `community_dms` - Direct messages between users

## Solution

### Step 1: Ensure Environment Variables are Set
Make sure your `.env.local` file has these variables:
```
TURSO_CONNECTION_URL=your_turso_database_url
TURSO_AUTH_TOKEN=your_turso_auth_token
```

### Step 2: Run the Migration

#### Option A: Using the provided script (Windows)
```powershell
.\run-migration.ps1
```

#### Option B: Using the provided script (Linux/Mac)
```bash
bash run-migration.sh
```

#### Option C: Manual NPX command
```bash
npx drizzle-kit migrate
```

### Step 3: Verify the Migration
After running the migration, check that the tables were created successfully. You can verify this by:
1. Checking your Turso dashboard
2. Making a test request to the community section

## What Was Done

1. **Created Migration File**: `drizzle/0004_community_tables.sql`
   - Contains SQL to create all 6 missing tables
   - Includes proper foreign key relationships
   - Includes proper indexes

2. **Updated Migration Journal**: `drizzle/meta/_journal.json`
   - Registered the new migration entry

## If the Error Persists

If you still see the error after running the migration:

1. Clear your browser cache
2. Restart your development server
3. Check that the database tables were actually created in your Turso dashboard
4. Check the browser console for specific error messages

## Database Schema Reference

### community_profiles
- Stores user profiles with type (freelancer/client)
- Tracks skills, hourly rate, portfolio URLs

### freelancer_offers
- Services offered by freelancers
- Includes title, description, category, price, delivery days

### freelancer_portfolio
- Portfolio items showcasing freelancer work
- Links to external projects

### client_projects
- Projects posted by clients looking for help
- Tracks title, budget, deadline, required skills

### proposals
- Freelancer proposals on client projects
- Includes cover letter, bid amount, delivery timeline

### community_dms
- Direct messages between community users
- Supports file attachments and project links

## Questions or Issues?

If you encounter any issues:
1. Check that all environment variables are correctly set
2. Verify the Turso database connection is working
3. Check the server logs for any SQL errors
