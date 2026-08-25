# Gondola Generator - Website Version

A real, permanently-hosted version of the gondola planogram tool. Unlike the
in-chat version, this one has a real server, which means:

- Uploaded product photos get a real, permanent public URL automatically
- No more platform restrictions on loading external images
- Everything persists properly (no re-entering data between sessions)

## What's inside

- `app/page.jsx` - the homepage
- `components/GondolaGenerator.jsx` - the actual tool (same features as before)
- `app/api/upload/route.js` - handles photo uploads, stores them via Vercel Blob, returns a real URL
- `app/api/registry/route.js` - stores/loads the shared product info (name, UPC, price, photo URL)

## Deploying (no coding required)

1. Create a free GitHub account at github.com if you don't have one.
2. Create a new repository and upload all these files to it (drag and drop
   through GitHub's website works fine, or use "Add file > Upload files").
3. Create a free Vercel account at vercel.com, and sign in with your GitHub account.
4. Click "Add New Project" in Vercel, and select the repository you just created.
   Vercel will auto-detect it's a Next.js project. Click Deploy.
5. Once deployed, go to your project's Storage tab in Vercel, and create a new
   Blob store. Connect it to this project. Vercel automatically provides the
   credentials the app needs -- nothing to copy or configure.
6. Redeploy the project (Vercel usually does this automatically after step 5).
7. Your site is live at the URL Vercel gives you.

## Notes

- The free "Hobby" tier is fine for internal testing. If this goes live for
  real client use, Vercel's terms require upgrading to the Pro plan ($20/mo).
