import 'dotenv/config';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'calling_agent_jwt_super_secret_production_key_2026';

// User IDs from database:
// Supra: don@gmail.com, id: 84e393a7-1821-4ee9-85c7-7f4ad6746f26, clientId: ece818d0-950c-480a-8873-00484c8f7ba9
// GT3: john@gmail.com, id: 8e70d703-b411-4c0e-92ec-8e17be1b2729, clientId: 45ac13b1-ca29-48ee-b3e9-110a134d2bbe

const supraToken = jwt.sign(
  { sub: '84e393a7-1821-4ee9-85c7-7f4ad6746f26', email: 'don@gmail.com', role: 'CLIENT_ADMIN', clientId: 'ece818d0-950c-480a-8873-00484c8f7ba9' },
  JWT_SECRET,
  { expiresIn: '7d' }
);

const gt3Token = jwt.sign(
  { sub: '8e70d703-b411-4c0e-92ec-8e17be1b2729', email: 'john@gmail.com', role: 'CLIENT_ADMIN', clientId: '45ac13b1-ca29-48ee-b3e9-110a134d2bbe' },
  JWT_SECRET,
  { expiresIn: '7d' }
);

async function testFetch(label, token, query = '') {
  const url = `http://localhost:8000/api/client/leads${query ? '?' + query : ''}`;
  try {
    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    const data = await res.json();
    console.log(`\n=== [${label}] GET ${url} (HTTP ${res.status}) ===`);
    console.log(`Meta:`, data.meta);
    console.log(`Leads (${data.data?.length || 0}):`, JSON.stringify(data.data?.map(l => ({
      id: l.id,
      name: `${l.firstName} ${l.lastName || ''}`,
      email: l.email,
      source: l.source,
      clientId: l.clientId,
      createdAt: l.createdAt
    })), null, 2));
  } catch (err) {
    console.error(`Error for ${label}:`, err.message);
  }
}

async function main() {
  await testFetch('SUPRA - default query', supraToken, 'page=1&limit=20');
  await testFetch('SUPRA - with source=META', supraToken, 'page=1&limit=20&source=META');
  await testFetch('GT3 - default query', gt3Token, 'page=1&limit=20');
  await testFetch('GT3 - with source=META', gt3Token, 'page=1&limit=20&source=META');
}

main();
