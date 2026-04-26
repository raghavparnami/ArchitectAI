import { router } from '../trpc';
import { projectsRouter } from './projects';
import { architecturesRouter } from './architectures';
import { llmKeysRouter } from './llm-keys';

export const appRouter = router({
  projects: projectsRouter,
  architectures: architecturesRouter,
  llmKeys: llmKeysRouter,
});

export type AppRouter = typeof appRouter;
