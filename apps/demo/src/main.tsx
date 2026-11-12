import { createRoot } from 'react-dom/client';
import { Composer } from '../../web/components/composer';
import { History } from '../../web/components/history';
import { RunView } from '../../web/components/run-view';
import { Shell } from '../../web/components/shell';
import { usePathname } from './navigation';
import '../../web/app/globals.css';
import './style.css';

function App() {
  const path = usePathname();
  return <Shell localDemo>
    <aside className="simulation-notice" aria-label="Modo de demostración">
      <strong>Demo en modo simulado: respuestas pregeneradas, sin llamadas reales a modelos</strong>
      <span>Motor local · tokens y coste simulados · historial de esta pestaña (máximo 20 ejecuciones; se borra al recargar).</span>
      <div><a href="https://github.com/Danimagnum/ai-agent-orchestrator" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
        <a href="https://github.com/Danimagnum/ai-agent-orchestrator/blob/main/docs/CLAUDE-LIVE.md" target="_blank" rel="noopener noreferrer">Ejecución real con Claude ↗</a></div>
    </aside>
    {path.startsWith('/runs/') ? <RunView key={path} id={path.slice(6)} localDemo /> : path === '/history' ? <History /> : <Composer localDemo />}
  </Shell>;
}
createRoot(document.getElementById('root')!).render(<App />);
