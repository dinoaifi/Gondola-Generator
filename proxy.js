import { clerkMiddleware } from "@clerk/nextjs/server";

const handler = clerkMiddleware(async (auth) => {
  await auth.protect();
});

export { handler as proxy };

export const config = {
  matcher: [
    // Run on everything except Next.js internals and static files
    "/((?!_next|.*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico)).*)",
    "/(api|trpc)(.*)",
  ],
};
