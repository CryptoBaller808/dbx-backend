# DBX Backend - DATABASE_URL Configuration Guide

## 🚀 Render PostgreSQL Setup

### Step 1: Create PostgreSQL Database in Render

1. **Go to Render Dashboard**: https://dashboard.render.com
2. **Click "New +"** → **"PostgreSQL"**
3. **Configure Database**:
   - **Name**: `dbx-production-db`
   - **Database**: `dbx_production`
   - **User**: `dbx_user`
   - **Region**: Choose closest to your users
   - **Plan**: Starter ($7/month) or higher

### Step 2: Get DATABASE_URL

After creating the database, Render will provide:
- **Internal Database URL**: For connecting from Render services
- **External Database URL**: For external connections

**Use the INTERNAL DATABASE_URL for your backend service!**

### Step 3: Set Environment Variable

1. **Go to your Backend Service** in Render Dashboard
2. **Click "Environment" tab**
3. **Add Environment Variable**:
   - **Key**: `DATABASE_URL`
   - **Value**: Your PostgreSQL connection string

### DATABASE_URL Format

```
postgresql://username:password@hostname:port/database_name
```

**Example**:
```
postgresql://dbx_user:secure_password123@dpg-abc123def456-a.oregon-postgres.render.com:5432/dbx_production
```

### Step 4: Required Environment Variables

Set these in your Render service environment:

```bash
# Database Configuration
DATABASE_URL=postgresql://dbx_user:password@hostname:port/dbx_production
NODE_ENV=production

# Application Configuration
PORT=10000
JWT_SECRET=your_jwt_secret_key_here
ENCRYPTION_KEY=your_32_character_encryption_key

# API Keys (if needed)
XUMM_API_KEY=your_xumm_api_key
XUMM_API_SECRET=your_xumm_api_secret

# CORS Configuration
FRONTEND_URL=https://your-frontend.onrender.com
ADMIN_URL=https://your-admin.onrender.com
```

### Step 5: Verify Connection

After setting DATABASE_URL, redeploy your service. Check logs for:

```
✅ [Database] DATABASE_URL format validation passed
🔗 [Database] Connecting to: hostname:5432/database_name
🔄 [Database] Initializing Sequelize with DATABASE_URL...
✅ [Database] Sequelize instance created successfully
✅ [Database] Database connection established successfully
```

## 🔧 Troubleshooting

### Error: "Cannot read properties of undefined (reading 'searchParams')"

**Cause**: DATABASE_URL is missing or malformed

**Solution**:
1. Verify DATABASE_URL is set in Render environment
2. Check the format matches: `postgresql://user:pass@host:port/db`
3. Ensure no extra spaces or characters

### Error: "DATABASE_URL environment variable is not set"

**Cause**: Missing DATABASE_URL environment variable

**Solution**:
1. Go to Render service → Environment tab
2. Add DATABASE_URL with your PostgreSQL connection string
3. Redeploy the service

### Error: "Invalid DATABASE_URL format"

**Cause**: Malformed connection string

**Solution**:
1. Verify format: `postgresql://username:password@hostname:port/database_name`
2. Check for special characters in password (URL encode if needed)
3. Ensure hostname and database name are correct

### Connection Timeout

**Cause**: Network or SSL issues

**Solution**:
1. Verify SSL is enabled (required for Render PostgreSQL)
2. Check if database is in same region as backend service
3. Verify database is running and accessible

## 📋 Quick Setup Checklist

- [ ] PostgreSQL database created in Render
- [ ] DATABASE_URL copied from database dashboard
- [ ] DATABASE_URL set in backend service environment
- [ ] NODE_ENV=production set
- [ ] Other required environment variables configured
- [ ] Service redeployed
- [ ] Logs checked for successful connection

## 🎯 Expected Log Output

When everything is configured correctly:

```
🔄 [Database] Initializing Sequelize with DATABASE_URL...
✅ [Database] Sequelize instance created successfully
✅ [Database] Database connection established successfully
[Models] Database models synchronized
[Server] Initializing enhanced database services...
[Server] Initializing blockchain services...
[Server] DBX Backend API server running on port 10000
```

## 🚀 Ready for Production!

Once DATABASE_URL is properly configured, your DBX backend will:
- ✅ Connect to PostgreSQL successfully
- ✅ Initialize all Sequelize models
- ✅ Start the Express server
- ✅ Be ready for frontend connections

**Your DBX platform will be LIVE and ready for global users!** 🌍✨

