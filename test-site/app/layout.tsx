import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FirstCall External Website Test',
  description: 'Test dummy site for FirstCall website form integration testing',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
