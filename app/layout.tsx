// app/layout.tsx
import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { GlobalAddExpenseModal } from '@/components/groups/GlobalAddExpenseModal';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Expense Manager',
  description: 'Advanced group and personal expense splitting application with offline-first synchronization.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full bg-background">
      <body className={`${inter.className} bg-background min-h-full flex flex-col text-text-primary`}>
        <ToastProvider>
          {/* Main shell wrapper */}
          <div className="flex-1 w-full max-w-5xl mx-auto bg-background min-h-screen flex flex-col relative pb-24 sm:border-x border-border shadow-subtle">
            <Header />
            <main className="flex-1 overflow-y-auto px-4 sm:px-6 pt-4 sm:pt-6">
              {children}
            </main>
            <BottomNav />
          </div>
          <GlobalAddExpenseModal />
        </ToastProvider>
      </body>
    </html>
  );
}
