import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'PulseCheck — Engineering Health Monitor',
  description:
    'Track your engineering team health. Get AI-powered insights on review velocity, contributor rhythm, bottlenecks, and more.',
  keywords: ['engineering', 'developer', 'metrics', 'GitHub', 'code review', 'team health'],
  openGraph: {
    title: 'PulseCheck — Engineering Health Monitor',
    description:
      'AI-powered engineering team health monitoring. Know before the slowdown becomes a crisis.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased bg-zinc-950 text-zinc-50`}>
        {children}
      </body>
    </html>
  );
}
