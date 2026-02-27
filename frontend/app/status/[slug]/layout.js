import { Geist } from 'next/font/google';

const geist = Geist({ subsets: ['latin'] });

export default function StatusPageLayout({ children }) {
  return (
    <div className={`${geist.className} min-h-screen bg-[var(--color-bg)]`}>
      {children}
    </div>
  );
}
