import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from '@/server/routers/_app';
import { createContext } from '@/server/context';

const handler = (req: Request) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext,
    onError({ error, path }) {
      // Defensive: never let request bodies (which can carry API keys
      // on the llmKeys.add path) hit logs.
      if (process.env.NODE_ENV !== 'production') {
        console.error(`[trpc] ${path ?? '<no-path>'}: ${error.code} — ${error.message}`);
      }
    },
  });

export { handler as GET, handler as POST };
