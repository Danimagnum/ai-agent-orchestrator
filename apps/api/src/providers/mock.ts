import { MockProvider as SharedMockProvider } from '@orchestrator/engine';
export class MockProvider extends SharedMockProvider {
  constructor(delayMs = Number(process.env.MOCK_CHUNK_DELAY_MS ?? 45)) {
    super(delayMs);
  }
}
