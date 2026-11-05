import { setTimeout as delay } from 'node:timers/promises';
import type { Call, Completion, LLMProvider } from '../orchestration/contracts';
export class MockProvider implements LLMProvider {
  constructor(private readonly delayMs = Number(process.env.MOCK_CHUNK_DELAY_MS ?? 45)) {
  }
  async complete(call: Call, onChunk: (chunk: string) => Promise<void>, signal: AbortSignal): Promise<Completion> {
    const task = call.input.split('\n')[0] ?? call.input;
    const coffee = /coffee|cafe|café|landing/i.test(task);
    let text = '';
    const toolCalls: Completion['toolCalls'] = [];
    const tool = call.tools?.[0]?.name;
    if (tool === 'delegate') {
      text = 'I’m splitting this into research, a clear narrative, and a practical implementation. Independent work can run in parallel. I’ll synthesize the findings and request a quality review.';
      toolCalls.push({
        name: tool, arguments: {
          subtasks: [
            {
              agent: 'Researcher', task: `Analyze requirements, trade-offs and risks for: ${task}`
            },
            { agent: 'Writer', task: `Develop the structure and narrative for: ${task}` },
            { agent: 'Coder', task: `Propose a concrete implementation for: ${task}` },
          ]
        }
      });
    }
    else if (tool === 'review') {
      const rejected = /\[retry\]/i.test(task) && !call.input.includes('Revision: true');
      text = rejected ? 'The proposal needs measurable acceptance criteria. Requesting one correction.' : 'Review complete. The result addresses the task, states trade-offs, and includes concrete acceptance criteria.';
      toolCalls.push({
        name: tool, arguments: {
          approved: !rejected, feedback: rejected ? 'Add measurable acceptance criteria.' : 'Approved. Clear scope, concrete implementation, and explicit limitations.'
        }
      });
    }
    else if (tool === 'decide_retry') {
      text = 'The feedback is actionable. I’ll request one revision and review the updated result.';
      toolCalls.push({ name: tool, arguments: { retry: true } });
    }
    else if (call.agent === 'Researcher') {
      text = coffee ? 'Audience & opportunity\n\nLocal customers need three things quickly: opening hours, location, and a reason to visit. Lead with the coffee experience, then make the menu easy to scan.\n\nPriorities\n• Mobile-first layout and prominent directions.\n• Seasonal drinks with clear prices.\n• Real photography and an accessible menu.\n\nAssumptions: independent neighborhood café. These are simulated findings, not web research.' : `Requirements & trade-offs\n\nFor “${task}”, evaluate operational complexity, delivery guarantees, latency, and team familiarity.\n\nKafka favors durable logs, replay and high-throughput event pipelines. RabbitMQ favors flexible routing and conventional task delivery. Neither replaces the authoritative game server.\n\nValidate the decision with a representative load test. These are simulated findings, not live research.`;
    }
    else if (call.agent === 'Writer') {
      text = coffee ? 'A neighborhood ritual, beautifully made.\n\nStart with a warm, direct promise: exceptional coffee, just around the corner. Follow with the seasonal menu, the people behind the counter, and a simple invitation to visit.\n\nPage outline\n1. Hero with “Explore the menu” and opening hours.\n2. Three signature drinks with prices.\n3. Our approach to sourcing and roasting.\n4. Location, directions, and contact details.' : `Recommendation narrative\n\nFrame “${task}” around the actual workload, not feature count. Explain the delivery model, failure behavior, operational burden, and when the alternative becomes preferable.\n\nKeep latency-sensitive gameplay on direct server connections. Move analytics, notifications and background processing onto the broker. End with a measurable proof of concept.`;
    }
    else if (call.agent === 'Coder') {
      text = coffee ? 'Implementation sketch\n\nexport default function CoffeePage() {\n  return (\n    <main>\n      <h1>Your daily coffee ritual.</h1>\n      <a href="#menu">Explore the menu</a>\n      <section id="menu" aria-label="Seasonal menu">\n        {/* Accessible menu cards with clear prices */}\n      </section>\n    </main>\n  );\n}\n\nUse responsive images, semantic sections, and visible keyboard focus. Validate at 375px and 1440px. Target LCP below 2.5s on a representative mobile connection.' : 'Implementation plan\n\ninterface DomainEvent {\n  id: string;\n  type: string;\n  occurredAt: string;\n  payload: Record<string, unknown>;\n}\n\nPublish events through a transactional outbox. Use idempotent consumers, bounded retries, and a dead-letter queue. Separate gameplay traffic from background workloads.\n\nAcceptance criteria: sustain the target throughput, recover from consumer restarts without duplicate side effects, and expose end-to-end latency metrics.';
    }
    else {
      text = coffee ? '# A landing page worth visiting\n\nBuild a fast, inviting home for a neighborhood coffee shop. The first screen should answer: what makes the coffee special, when you’re open, and how to find you.\n\n## The experience\nLead with “Your daily coffee ritual.” Pair a real café photograph with two actions: Explore the menu and Get directions. Follow with signature drinks, sourcing, and a location section.\n\n## Implementation\nUse a responsive Next.js page with semantic HTML, optimized photography, and an accessible menu. Keep opening hours and prices in one editable source.\n\n## Acceptance criteria\n• Works at 375px through desktop with no horizontal overflow.\n• Every action is keyboard accessible.\n• Menu and directions are reachable in one click.\n• Target mobile LCP below 2.5s; verify with real assets.\n\n## Next step\nCollect the actual menu, opening hours, address, and brand photography. Replace all assumptions before publishing.' : `# A practical decision for your system\n\nTask: ${task}\n\n## Recommendation\nStart with the simplest broker that satisfies your delivery and replay requirements. For a real-time game backend, RabbitMQ is a useful default for routed background jobs; Kafka becomes compelling when durable replay and high-volume event pipelines are central.\n\n## Architecture\nKeep authoritative gameplay on direct server connections. Publish committed domain events through an outbox and consume them idempotently. Separate analytics from user-facing background tasks.\n\n## Trade-offs\nKafka adds partitioning and retention decisions. RabbitMQ adds queue and routing topology decisions. Both require operational ownership, backpressure, and recovery tests.\n\n## Acceptance criteria\nMeasure p95 delivery latency and throughput under realistic load. Restart consumers to verify recovery. Inject duplicate events and confirm side effects remain idempotent.\n\nSimulated demo: this recommendation illustrates orchestration and requires validation against your actual workload.`;
    }
    for (const chunk of text.match(/.{1,28}(?:\s|$)|.{1,28}/gs) ?? []) {
      signal.throwIfAborted();
      if (this.delayMs)
        await delay(this.delayMs, undefined, { signal });
      await onChunk(chunk);
    }
    return {
      text, toolCalls, promptTokens: Math.ceil((call.input.length + call.system.length) / 4), completionTokens: Math.ceil((text.length + JSON.stringify(toolCalls).length) / 4)
    };
  }
}
