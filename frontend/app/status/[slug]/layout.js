import { Geist } from 'next/font/google';

const geist = Geist({ subsets: ['latin'] });

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export async function generateMetadata({ params }) {
  const { slug } = await params;
  try {
    const res = await fetch(`${API_BASE}/public/status/${slug}`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      const title = data?.statusPage?.title || data?.statusPage?.name;
      if (title) return { title };
    }
  } catch {
    // fall through to default
  }
  return { title: 'Status' };
}

export default function StatusPageLayout({ children }) {
  return (
    <div className={`${geist.className} min-h-screen bg-[var(--color-bg)]`}>
      {children}
    </div>
  );
}
