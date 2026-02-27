import { NextResponse } from 'next/server';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Domains that should NOT be treated as custom domains
const MAIN_DOMAINS = new Set(
  (process.env.MAIN_DOMAINS || 'localhost').split(',').map(d => d.trim().toLowerCase())
);

export async function middleware(request) {
  const hostname = request.headers.get('host')?.split(':')[0]?.toLowerCase();
  const { pathname } = request.nextUrl;

  // Skip if it's the main domain, an API route, static file, or already a status page route
  if (
    !hostname ||
    MAIN_DOMAINS.has(hostname) ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/status/') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Custom domain detected — try to resolve it to a status page slug
  try {
    const res = await fetch(`${API_BASE}/public/status/by-domain/${hostname}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 60 },
    });

    if (res.ok) {
      const data = await res.json();
      const slug = data.slug || data.status_page?.slug;
      if (slug) {
        // Rewrite to the public status page
        const url = request.nextUrl.clone();
        if (pathname === '/' || pathname === '') {
          url.pathname = `/status/${slug}`;
        } else {
          url.pathname = `/status/${slug}${pathname}`;
        }
        return NextResponse.rewrite(url);
      }
    }
  } catch {
    // If lookup fails, continue normally
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (browser icon)
     * - public files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*$).*)',
  ],
};
