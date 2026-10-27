import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'Idea Board — A little spark goes a long way',
  description: 'A shared space for small sparks and big possibilities. Share an idea and vote for what should happen next.',
};
export default function RootLayout({children}: {children: React.ReactNode}) {
  return <html lang="en"><body>{children}</body></html>;
}
