import type { Metadata } from 'next';
import '../styles/globals.css';
import { Navigation } from '@/components/navigation';

export const metadata: Metadata = {
  title: 'XHS Pilot',
  description: '小红书内容资产、检索与创作工作台。',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="appLayout">
          <Navigation />
          <main className="appContent">{children}</main>
        </div>
      </body>
    </html>
  );
}
