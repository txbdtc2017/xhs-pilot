import type { Metadata } from 'next';
import '../styles/globals.css';
import { Navigation } from '@/components/navigation';
import { PwaRegister } from '@/components/pwa-register';
import { appMetadata } from './metadata';

export const metadata: Metadata = appMetadata;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <PwaRegister />
        <div className="appWorkbench">
          <Navigation />
          <main className="workbenchMain">{children}</main>
        </div>
      </body>
    </html>
  );
}
