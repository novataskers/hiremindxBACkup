#!/bin/bash
# Migration setup script for community tables

# This script applies the missing database migrations for the community marketplace features
# Make sure you have the required environment variables set:
# - TURSO_CONNECTION_URL
# - TURSO_AUTH_TOKEN

echo "Starting database migration..."
echo "This will add the community marketplace tables to your database"
echo ""

# Check if environment variables are set
if [ -z "$TURSO_CONNECTION_URL" ] || [ -z "$TURSO_AUTH_TOKEN" ]; then
    echo "ERROR: Missing environment variables"
    echo "Please set TURSO_CONNECTION_URL and TURSO_AUTH_TOKEN"
    exit 1
fi

# Run drizzle migrations
echo "Applying migrations..."
npx drizzle-kit migrate

echo ""
echo "Migration complete!"
echo "The community marketplace tables have been created."
