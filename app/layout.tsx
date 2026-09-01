import type { Metadata } from 'next';

import './globals.css';

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
      <body className="antialiased">{children}</body>
    </html>
  );
}
