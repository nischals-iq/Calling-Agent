import 'dotenv/config';
import { PrismaService } from './src/prisma/prisma.service.js';
import { IntegrationEncryptionService } from './src/modules/integrations/services/integration-encryption.service.js';
import { ChannelType } from '@prisma/client';

const prisma = new PrismaService();
const encryption = new IntegrationEncryptionService();

async function fixTenantAndSubscribe() {
  await prisma.onModuleInit();
  const realPageId = '1378772271983872';

  // 1. Check GT3 and reset its pageId to prevent tenant collisions
  const gt3 = await prisma.integration.findFirst({
    where: { client: { name: 'GT3' }, channel: ChannelType.META },
    include: { client: true },
  });

  if (gt3) {
    const gt3Meta = (gt3.metadata as Record<string, any>) || {};
    if (gt3Meta.pageId === realPageId) {
      console.log(`Resetting GT3 pageId to avoid tenant collision...`);
      await prisma.integration.update({
        where: { id: gt3.id },
        data: {
          metadata: {
            ...gt3Meta,
            pageId: '109283746501928', // revert GT3 to dummy ID
            pageName: 'Mock GT3 Page',
            pageSubscribed: false,
          },
        },
      });
      console.log(`GT3 pageId reset successfully.`);
    }
  }

  // 2. Identify the client with the real OAuth token (Supra)
  const supra = await prisma.integration.findFirst({
    where: { client: { name: 'Supra' }, channel: ChannelType.META },
    include: { client: true },
  });

  if (!supra) {
    throw new Error('Supra integration not found');
  }

  console.log(`\nFound Supra Integration: ${supra.id} (Client: ${supra.client.name}, ID: ${supra.clientId})`);

  const creds = (supra.credentials as Record<string, any>) || {};
  const metadata = (supra.metadata as Record<string, any>) || {};

  // Decrypt user OAuth access token
  const userAccessToken = encryption.decrypt(creds.accessToken);
  console.log(`Decrypted Supra User Access Token (length: ${userAccessToken.length})`);

  // 3. Resolve real Page Access Token from Meta Graph API
  console.log(`Resolving real Page Access Token for Page ${realPageId}...`);
  const pageRes = await fetch(
    `https://graph.facebook.com/v19.0/${realPageId}?fields=id,name,access_token&access_token=${userAccessToken}`
  );
  const pageData = await pageRes.json();

  if (!pageRes.ok || !pageData.access_token) {
    throw new Error(`Failed to resolve Page Access Token: ${JSON.stringify(pageData)}`);
  }

  const realPageName = pageData.name || 'Skyline Demo';
  const pageAccessToken = pageData.access_token;
  console.log(`Resolved Page: "${realPageName}" (${pageData.id})`);
  console.log(`Page Access Token length: ${pageAccessToken.length}`);

  // 4. Update Supra's Meta integration with real Page ID & encrypted Page Access Token
  console.log(`Updating Supra integration metadata and credentials...`);
  const updatedCreds = {
    ...creds,
    pageAccessToken: encryption.encrypt(pageAccessToken),
  };
  const updatedMeta = {
    ...metadata,
    pageId: realPageId,
    pageName: realPageName,
  };

  await prisma.integration.update({
    where: { id: supra.id },
    data: {
      credentials: updatedCreds,
      metadata: updatedMeta,
    },
  });
  console.log(`Supra integration updated in database.`);

  // 5. Execute POST /{PAGE_ID}/subscribed_apps?subscribed_fields=leadgen
  console.log(`\nExecuting POST /${realPageId}/subscribed_apps?subscribed_fields=leadgen...`);
  const postUrl = `https://graph.facebook.com/v19.0/${realPageId}/subscribed_apps?subscribed_fields=leadgen&access_token=${pageAccessToken}`;
  const postRes = await fetch(postUrl, { method: 'POST' });
  const postResult = await postRes.json();
  console.log(`POST response status: ${postRes.status}`, postResult);

  if (!postRes.ok || postResult.success !== true) {
    throw new Error(`Graph API subscription failed: ${JSON.stringify(postResult)}`);
  }

  // 6. Verify with GET /{PAGE_ID}/subscribed_apps
  console.log(`\nExecuting GET /${realPageId}/subscribed_apps...`);
  const getUrl = `https://graph.facebook.com/v19.0/${realPageId}/subscribed_apps?access_token=${pageAccessToken}`;
  const getRes = await fetch(getUrl);
  const getResult = await getRes.json();
  console.log(`GET response status: ${getRes.status}`, JSON.stringify(getResult, null, 2));

  // 7. Check that Skyline CRM Integration appears
  const apps = getResult.data || [];
  const skylineApp = apps.find((app: any) => app.id === '2081248696087230' || app.name?.toLowerCase().includes('skyline'));

  const isSubscribed = !!skylineApp && Array.isArray(skylineApp.subscribed_fields) && skylineApp.subscribed_fields.includes('leadgen');
  console.log(`\nSubscription verified: ${isSubscribed}`);
  console.log(`Matched App:`, skylineApp);

  // 8. Update Supra's metadata with subscription verification state
  if (isSubscribed) {
    await prisma.integration.update({
      where: { id: supra.id },
      data: {
        metadata: {
          ...updatedMeta,
          pageSubscribed: true,
          pageSubscribedAt: new Date().toISOString(),
          subscribedFields: skylineApp.subscribed_fields,
        },
      },
    });
  }

  return {
    clientUpdated: supra.client.name,
    clientId: supra.clientId,
    pageId: realPageId,
    pageName: realPageName,
    subscribed: isSubscribed,
    app: skylineApp,
  };
}

fixTenantAndSubscribe()
  .then((res) => {
    console.log('\n=== FINAL SUCCESS SUMMARY ===');
    console.log(JSON.stringify(res, null, 2));
  })
  .catch((err) => {
    console.error('Error during execution:', err);
  })
  .finally(() => prisma.onModuleDestroy());
