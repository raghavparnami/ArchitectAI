import { clerkMiddleware /*, createRouteMatcher */ } from '@clerk/nextjs/server';

// ─── DEMO BYPASS ────────────────────────────────────────────────────────────
// Auth gate temporarily disabled so the demo can be driven without signing in.
// To restore: uncomment the `isPublicRoute` matcher + the `auth.protect()`
// guard below, then delete the no-op handler.
//
// const isPublicRoute = createRouteMatcher([
//   '/',
//   '/pricing',
//   '/sign-in(.*)',
//   '/sign-up(.*)',
//   '/api/webhooks(.*)',
//   // Inngest's runner posts here with its own HMAC signature; Clerk auth
//   // would block its requests.
//   '/api/inngest(.*)',
// ]);

// Next.js 16: file is `proxy.ts` and the export is named `proxy`.
// Clerk's clerkMiddleware() returns a request handler we re-export.
export const proxy = clerkMiddleware(async (/* auth, req */) => {
  // DEMO BYPASS — original guard:
  // if (!isPublicRoute(req)) {
  //   await auth.protect();
  // }
});

export default proxy;

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
