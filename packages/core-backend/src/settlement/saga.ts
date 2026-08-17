export interface SagaCompensation {
  name: string;
  run: () => Promise<void>;
}

export interface SagaStepResult {
  name: string;
  ok: boolean;
  message: string;
}

/**
 * Compensating saga: each resource key keeps a single undo action.
 * Later steps replace earlier undos (lock reverse → release reverse) so rollback is not double-applied.
 */
export class CompensatingSaga {
  private readonly keys: string[] = [];
  private readonly byKey = new Map<string, SagaCompensation>();

  register(key: string, compensation: SagaCompensation): void {
    if (!this.byKey.has(key)) {
      this.keys.push(key);
    }
    this.byKey.set(key, compensation);
  }

  async rollback(): Promise<SagaStepResult[]> {
    const results: SagaStepResult[] = [];
    for (let i = this.keys.length - 1; i >= 0; i -= 1) {
      const key = this.keys[i];
      const step = this.byKey.get(key);
      if (!step) continue;
      try {
        await step.run();
        results.push({ name: step.name, ok: true, message: "ok" });
      } catch (error) {
        results.push({
          name: step.name,
          ok: false,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }
    this.keys.length = 0;
    this.byKey.clear();
    return results;
  }
}
