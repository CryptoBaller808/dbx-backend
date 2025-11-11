import http from 'http';

const PORT = process.env.PORT || 3000;
const HOST = '127.0.0.1';

async function checkEndpoint(path) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: HOST,
      port: PORT,
      path,
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.end();
  });
}

async function runBootCheck() {
  console.log(`\n🔍 [BootCheck] Testing http://${HOST}:${PORT}`);
  
  try {
    // Check /health
    console.log('\n[1/2] Testing /health...');
    const healthRes = await checkEndpoint('/health');
    console.log(`✅ /health → ${healthRes.status}`);
    console.log(JSON.stringify(healthRes.data, null, 2));

    if (healthRes.status !== 200 || !healthRes.data.ok) {
      throw new Error(`Health check failed: ${healthRes.status}`);
    }

    // Check /version
    console.log('\n[2/2] Testing /version...');
    const versionRes = await checkEndpoint('/version');
    console.log(`✅ /version → ${versionRes.status}`);
    console.log(JSON.stringify(versionRes.data, null, 2));

    if (versionRes.status !== 200) {
      throw new Error(`Version check failed: ${versionRes.status}`);
    }

    console.log('\n🎉 [BootCheck] All checks passed!\n');
    process.exit(0);
  } catch (error) {
    console.error(`\n❌ [BootCheck] Failed: ${error.message}\n`);
    process.exit(1);
  }
}

// Wait 1 second for server to fully start
setTimeout(runBootCheck, 1000);
