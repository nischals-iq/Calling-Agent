import fs from 'fs';

const targetPath = 'D:\\DashmindsIQ Projects\\afsha-ai-website\\app\\contact\\page.tsx';
let content = fs.readFileSync(targetPath, 'utf8');

// Ensure phone in reset
content = content.replace(
  'email: "",\n        company: "",',
  'email: "",\n        phone: "",\n        company: "",'
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log("Updated reset formData with phone!");
