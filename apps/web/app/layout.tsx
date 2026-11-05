import type { Metadata } from 'next';
import { Shell } from '../components/shell';
import './globals.css';
export const metadata: Metadata = {
  title: 'AI Agent Orchestrator', description: 'One task. A team of agents. Watch AI collaboration unfold with live traces, token usage and cost visibility.', icons: { icon: '/mark.svg' }
};
export default function RootLayout({ children }: {
  children: React.ReactNode;
}) {
  return <html lang="en">
    <body>
      <Shell>{children}</Shell>
    </body>
  </html>;
}
