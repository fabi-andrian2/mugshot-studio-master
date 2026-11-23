const ConfirmDialog = ({
  title,
  message,
  confirmLabel,
  cancelLabel = 'Annuler',
  tone = 'danger',
  extraLabel,
  onConfirm,
  onExtra,
  onCancel,
}) => (
  <div
    className="fixed inset-0 bg-black/75 z-[60] flex items-center justify-center animate-fade-in"
    onClick={onCancel}
  >
    <div
      role="alertdialog"
      aria-modal="true"
      className="bg-[#1c1c1c] border border-gray-700 rounded-xl p-6 w-[26rem] max-w-[92vw] shadow-2xl animate-pop-in"
      onClick={(e) => e.stopPropagation()}
    >
      <h2 className="text-sm font-semibold text-white mb-2">{title}</h2>
      <p className="text-xs text-gray-400 leading-relaxed mb-5">{message}</p>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs px-3 py-2 rounded border border-gray-700 text-gray-300 hover:bg-gray-800 transition"
        >
          {cancelLabel}
        </button>
        {extraLabel && (
          <button
            type="button"
            onClick={onExtra}
            className="text-xs px-3 py-2 rounded border border-gray-700 text-gray-300 hover:bg-gray-800 transition"
          >
            {extraLabel}
          </button>
        )}
        <button
          type="button"
          autoFocus
          onClick={onConfirm}
          className={`text-xs px-3 py-2 rounded font-semibold transition ${
            tone === 'danger'
              ? 'bg-red-600 hover:bg-red-500 text-white'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white'
          }`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  </div>
);

export default ConfirmDialog;
