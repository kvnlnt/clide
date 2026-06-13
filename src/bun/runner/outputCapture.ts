import { join } from "node:path";
import { ensureDir, runDir } from "../paths";

/**
 * Accumulates captured stdout for a run and persists it to
 * <projectPath>/runs/<runId>/output for non-text output types.
 */
export class OutputCapture {
  private buffer = "";
  readonly path: string;

  constructor(projectPath: string, runId: string) {
    const dir = runDir(projectPath, runId);
    ensureDir(dir);
    this.path = join(dir, "output");
  }

  append(chunk: string): void {
    this.buffer += chunk;
  }

  async flush(): Promise<string> {
    await Bun.write(this.path, this.buffer);
    return this.path;
  }

  get text(): string {
    return this.buffer;
  }
}
