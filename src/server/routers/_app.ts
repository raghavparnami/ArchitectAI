import { router } from '../trpc';
import { projectsRouter } from './projects';
import { architecturesRouter } from './architectures';
import { llmKeysRouter } from './llm-keys';
import { codescanRouter } from './codescan';

export const appRouter = router({
  projects: projectsRouter,
  architectures: architecturesRouter,
  llmKeys: llmKeysRouter,
  codescan: codescanRouter,
});

export type AppRouter = typeof appRouter;
