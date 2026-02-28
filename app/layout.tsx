import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'MindMirror | Burnout Intelligence',
  description: 'Digital behavior intelligence system analyzing browser activity to detect early burnout patterns.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-[#f8fafc] text-slate-800`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <header className="mb-10 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-900">MindMirror</h1>
              <p className="text-sm text-slate-500 mt-1">Digital Behavior Intelligence System</p>
            </div>
          </header>
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
