import { Inngest, EventSchemas } from 'inngest';
import type { Architecture } from '@/lib/architecture/schema';

/**
 * Strongly-typed Inngest event registry. Adding a new event type here
 * surfaces it everywhere — function signatures, send() calls, and the
 * Inngest dashboard's event schema viewer.
 */
type Events = {
  'architecture/generate.requested': {
    data: {
      projectId: string;
      level: 'HLD' | 'LLD';
      problemStatement: string;
      techHints?: string[];
      parentArchitectureId?: string;
      requestedBy: string;
      provider: 'anthropic' | 'openai' | 'google' | 'custom';
      modelId?: string;
    };
  };
  'architecture/regenerate.requested': {
    data: {
      architectureId: string;
      instruction: string;
      requestedBy: string;
      provider: 'anthropic' | 'openai' | 'google' | 'custom';
      modelId?: string;
    };
  };
  'architecture/generated': {
    data: {
      architectureId: string;
      version: number;
    };
  };
  'architecture/generation.failed': {
    data: {
      projectId: string;
      reason: string;
      requestedBy: string;
    };
  };
};

export const inngest = new Inngest({
  id: 'architectai',
  schemas: new EventSchemas().fromRecord<Events>(),
});

// Re-exported for convenience in route handlers and elsewhere.
export type ArchitectureType = Architecture;
