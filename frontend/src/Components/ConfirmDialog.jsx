import Modal from './Modal';

export default function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirm', danger = false }) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      {message && <p className="text-sm mb-6" style={{ color: 'var(--text-sec)' }}>{message}</p>}
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 rounded-xl text-sm font-semibold border transition-all"
          style={{ borderColor: 'var(--border)', color: 'var(--text-sec)' }}
        >
          Cancel
        </button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          style={{ background: danger ? 'var(--red, #ef4444)' : 'var(--accent)', color: '#fff' }}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
