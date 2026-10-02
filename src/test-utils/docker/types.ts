/**
 * Types for the Docker-backed test helpers
 */

import type { ChildProcess } from 'child_process';

/** A container started as an attached child process (`docker run --rm`, no -d) */
export interface RunningContainer {
  /** Container name */
  name: string;
  /** The attached `docker run` process */
  child: ChildProcess;
  /** Container stdout and stderr, in arrival order */
  logs: string[];
}
