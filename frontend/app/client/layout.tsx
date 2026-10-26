import React from 'react';
import ClientLayoutWrapper from './ClientLayoutWrapper';

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return <ClientLayoutWrapper>{children}</ClientLayoutWrapper>;
}
