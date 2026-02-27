'use client';

import Link from 'next/link';
import clsx from 'clsx';

export default function EmptyState({ icon: Icon, title, description, action, className }) {
  // action can be a React node OR a descriptor { label, href, onClick }
  let actionNode = null;
  if (action) {
    if (typeof action === 'object' && !('$$typeof' in action) && ('label' in action)) {
      const { label, href, onClick } = action;
      const cls = 'mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors';
      actionNode = href
        ? <Link href={href} className={cls}>{label}</Link>
        : <button type="button" onClick={onClick} className={cls + ' cursor-pointer'}>{label}</button>;
    } else {
      actionNode = action;
    }
  }

  return (
    <div className={clsx('flex flex-col items-center justify-center py-16 text-center', className)}>
      {Icon && (
        <div className="mb-4 rounded-xl bg-[var(--color-bg-tertiary)] p-4">
          <Icon size={32} className="text-[var(--color-text-tertiary)]" />
        </div>
      )}
      <h3 className="text-lg font-medium text-[var(--color-text)]">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-[var(--color-text-secondary)] max-w-sm">{description}</p>
      )}
      {actionNode && <div className="mt-4">{actionNode}</div>}
    </div>
  );
}
