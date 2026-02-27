'use client';

import Modal from './ui/modal';
import Button from './ui/button';
import { AlertTriangle } from 'lucide-react';

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmText = 'Delete', loading = false, variant = 'danger' }) {
  return (
    <Modal open={open} onClose={onClose} title={title || 'Confirm Action'} size="sm">
      <div className="flex items-start gap-3 mb-6">
        <div className="p-2 rounded-lg bg-red-500/10">
          <AlertTriangle size={20} className="text-red-500" />
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mt-1">{message || 'Are you sure? This action cannot be undone.'}</p>
      </div>
      <div className="flex justify-end gap-3">
        <Button variant="ghost" onClick={onClose} disabled={loading}>Cancel</Button>
        <Button variant={variant} onClick={onConfirm} disabled={loading}>
          {loading ? 'Processing...' : confirmText}
        </Button>
      </div>
    </Modal>
  );
}
