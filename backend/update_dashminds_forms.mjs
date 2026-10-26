import fs from 'fs';

function updateFile(filePath, formId) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('FirstCall CRM Lead Intake Integration')) return;

  const target = 'setStatus(\'success\');';
  const snippet = `      // 2. FirstCall CRM Lead Intake Integration
      try {
        const searchParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
        const firstCallApiUrl = process.env.NEXT_PUBLIC_FIRSTCALL_API_URL || 'http://localhost:8000/api';
        const tenantKey = process.env.NEXT_PUBLIC_FIRSTCALL_TENANT_KEY || 'ca_live_7139e1f2c0312291cbfba340e9364301';

        await fetch(\`\${firstCallApiUrl}/public/leads/capture\`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Tenant-Key': tenantKey,
          },
          body: JSON.stringify({
            firstName: formData.firstName,
            lastName: formData.lastName || undefined,
            email: formData.email,
            phone: (formData as any).phone || undefined,
            company: formData.company || undefined,
            message: (formData as any).purpose ? \`[\${(formData as any).purpose}] \${formData.message}\` : formData.message,
            source: 'WEBSITE',
            medium: 'contact-form',
            formId: '${formId}',
            landingPageUrl: typeof window !== 'undefined' ? window.location.href : 'https://dashmindsanalytics.com/contact',
            utmSource: searchParams?.get('utm_source') || undefined,
            utmMedium: searchParams?.get('utm_medium') || undefined,
            utmCampaign: searchParams?.get('utm_campaign') || undefined,
            utmContent: searchParams?.get('utm_content') || undefined,
            utmTerm: searchParams?.get('utm_term') || undefined,
          }),
        });
      } catch (fcErr) {
        console.warn('FirstCall lead capture notice:', fcErr);
      }

      setStatus('success');`;

  if (content.includes(target)) {
    content = content.replace(target, snippet);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
}

updateFile('D:\\DashmindsIQ Projects\\DashMinds-Analytics1\\dashminds-analytics\\src\\components\\layout\\DedicatedContactForm.tsx', 'dashminds-dedicated-contact');
updateFile('D:\\DashmindsIQ Projects\\DashMinds-Analytics1\\dashminds-analytics\\src\\components\\layout\\GlobalContactForm.tsx', 'dashminds-global-contact');
