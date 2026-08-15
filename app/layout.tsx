import './globals.css';
import type { Metadata } from 'next';
import { EB_Garamond } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import PostHogProvider from '@/components/PostHogProvider';

const garamond = EB_Garamond({ 
  subsets: ['latin'],
  variable: '--font-garamond',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Sensor Fusion Conflict Resolver',
  description: 'Real-time drone telemetry sensor fusion conflict resolver — event-sourced, deterministic, live.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${garamond.variable}`}>
      <body className={`${GeistSans.className} antialiased bg-[#0a0a0f] text-zinc-100 h-screen overflow-hidden flex flex-col`}>
        <PostHogProvider>
          {children}
        </PostHogProvider>
      </body>
    </html>
  );
}
