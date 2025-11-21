#!/usr/bin/env node
/**
 * Startup Script with Migrations
 * 
 * This script:
 * 1. Runs database migrations
 * 2. Runs database seeders
 * 3. Starts the server
 * 
 * Usage: node scripts/start-with-migrations.js
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('🚀 [Startup] Starting DBX Backend with migrations...');
console.log('📍 [Startup] DATABASE_URL:', process.env.DATABASE_URL ? 'SET (***' + process.env.DATABASE_URL.slice(-20) + ')' : 'NOT SET');

async function runCommand(command, args, description) {
  return new Promise((resolve, reject) => {
    console.log(`\n🔄 [Startup] ${description}...`);
    console.log(`📝 [Startup] Command: ${command} ${args.join(' ')}`);
    
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: true,
      env: process.env
    });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ [Startup] ${description} completed successfully`);
        resolve();
      } else {
        console.warn(`⚠️ [Startup] ${description} exited with code ${code}`);
        // Don't reject - allow startup to continue even if migrations fail
        // This is important for idempotent migrations that may already be applied
        resolve();
      }
    });

    child.on('error', (error) => {
      console.error(`❌ [Startup] ${description} error:`, error.message);
      // Don't reject - allow startup to continue
      resolve();
    });
  });
}

async function startup() {
  try {
    // Step 1: Run migrations
    await runCommand('node', ['scripts/run-migrations.js'], 'Running database migrations');

    // Step 2: Run seeders (using sequelize-cli directly)
    if (process.env.DATABASE_URL) {
      console.log('\n🌱 [Startup] Running database seeders...');
      const { exec } = require('child_process');
      const util = require('util');
      const execPromise = util.promisify(exec);
      
      try {
        const { stdout, stderr } = await execPromise(`npx sequelize-cli db:seed:all --url "${process.env.DATABASE_URL}"`);
        if (stdout) console.log(stdout);
        if (stderr && !stderr.includes('Loaded configuration')) console.warn(stderr);
        console.log('✅ [Startup] Seeders completed');
      } catch (seedError) {
        console.warn('⚠️ [Startup] Seeder warning:', seedError.message);
        // Continue anyway - seeders are idempotent
      }
    } else {
      console.warn('⚠️ [Startup] DATABASE_URL not set, skipping seeders');
    }

    // Step 3: Start the server
    console.log('\n🚀 [Startup] Starting server...');
    console.log('═══════════════════════════════════════════════════════════');
    
    const server = spawn('node', ['server.js'], {
      stdio: 'inherit',
      shell: true,
      env: process.env
    });

    server.on('close', (code) => {
      console.log(`\n🛑 [Startup] Server exited with code ${code}`);
      process.exit(code);
    });

    server.on('error', (error) => {
      console.error(`\n❌ [Startup] Server error:`, error);
      process.exit(1);
    });

    // Handle process termination
    process.on('SIGTERM', () => {
      console.log('\n🛑 [Startup] Received SIGTERM, shutting down gracefully...');
      server.kill('SIGTERM');
    });

    process.on('SIGINT', () => {
      console.log('\n🛑 [Startup] Received SIGINT, shutting down gracefully...');
      server.kill('SIGINT');
    });

  } catch (error) {
    console.error('\n❌ [Startup] Fatal startup error:', error);
    process.exit(1);
  }
}

// Run startup sequence
startup();
