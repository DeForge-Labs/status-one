import { Geist } from 'next/font/google';

const geist = Geist({ subsets: ['latin'] });

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';

// Derive the public-facing app origin for absolute OG URLs.
// Prefer an explicit NEXT_PUBLIC_APP_URL, otherwise strip the path from the API URL.
function getAppOrigin() {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL;
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api').origin;
  } catch {
    return 'http://localhost:3000';
  }
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const appOrigin = getAppOrigin();

  const base = {
    metadataBase: new URL(appOrigin),
    openGraph: {
      images: [{ url: '/Cover.jpg', width: 1200, height: 630 }],
      type: 'website',
    },
    twitter: { card: 'summary_large_image', images: ['/Cover.jpg'] },
  };

  try {
    const res = await fetch(`${API_BASE}/public/status/${slug}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const sp = data?.statusPage;
      const title = sp?.title || sp?.name;
      const description = sp?.description || `Live status and uptime for ${title}`;
      if (title) {
        return {
          ...base,
          title,
          description,
          openGraph: {
            ...base.openGraph,
            title,
            description,
            url: `${appOrigin}/status/${slug}`,
          },
          twitter: { ...base.twitter, title, description },
        };
      }
    }
  } catch {
    // fall through to default
  }
  return { ...base, title: 'Status' };
}

export default function StatusPageLayout({ children }) {
  return (
    <div className={`${geist.className} min-h-screen bg-[var(--color-bg)]`}>
      {children}
    </div>
  );
}
