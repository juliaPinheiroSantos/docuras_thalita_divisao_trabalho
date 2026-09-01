import type { Metadata } from 'next';
import { DM_Sans, Fraunces } from 'next/font/google';

import './globals.css';

const sans = DM_Sans({ variable: '--font-dm-sans', subsets: ['latin'] });
const heading = Fraunces({ variable: '--font-fraunces', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Doçuras da Thalita | Tarefas da equipe',
  description: 'Organização interna da produção e do atendimento da Doçuras da Thalita.',
  openGraph: {
    title: 'Doçuras da Thalita | Organização da equipe',
    description: 'Tarefas diárias da produção e do atendimento em um só lugar.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Doçuras da Thalita | Organização da equipe',
    description: 'Tarefas diárias da produção e do atendimento em um só lugar.',
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${sans.variable} ${heading.variable} antialiased`}>{children}</body>
    </html>
  );
}
