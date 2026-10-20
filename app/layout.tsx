import './globals.css';
import { AuthGuard } from '@/components/auth/AuthGuard';

export const metadata = {
  title: 'Mine Shift Workboard',
  description: 'Mining CMMS Fleet Workboard & Shift Handover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}