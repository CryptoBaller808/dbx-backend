import fetch from 'node-fetch';

const BASE_URL = process.env.API_URL || 'https://dbx-backend-api-production-98f3.up.railway.app';

async function runSmokeTest() {
  console.log(`🔥 Running smoke test against: ${BASE_URL}`);

  try {
    // 1. Fetch /version
    console.log('\n[1/2] Fetching /version...');
    const versionRes = await fetch(`${BASE_URL}/version`);
    const versionData = await versionRes.json();
    console.log('✅ /version response:', JSON.stringify(versionData, null, 2));

    if (!versionRes.ok || !versionData.ok) {
      throw new Error(`Version check failed with status ${versionRes.status}`);
    }

    // 2. Fetch /api/admin/liquidity/config
    console.log('\n[2/2] Fetching /api/admin/liquidity/config...');
    const configRes = await fetch(`${BASE_URL}/api/admin/liquidity/config`);
    const configData = await configRes.json();
    console.log('✅ /api/admin/liquidity/config response:', JSON.stringify(configData, null, 2));

    if (!configRes.ok || !configData.ok) {
      throw new Error(`Config check failed with status ${configRes.status}`);
    }

    console.log('\n🎉 Smoke test passed successfully!\n');
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Smoke test failed:', error.message);
    process.exit(1);
  }
}

runSmokeTest();
();
runSmokeTest();
