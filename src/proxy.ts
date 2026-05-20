import { NextResponse, type NextRequest } from 'next/server';

// Demo build — no auth. This proxy is a pass-through so every request
// reaches its route handler unchallenged. Keep the file (Next.js 16 looks
// for it) but drop the Clerk import so we don't need Clerk env vars to boot.
export function proxy(_req: NextRequest) {
  return NextResponse.next();
}

export default proxy;

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
};
