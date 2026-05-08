import { IPC } from '../../shared/constants';

export function TitleBar() {
  const handleClose = () => {
    void window.electronAPI.invoke(IPC.WINDOW_HIDE);
  };

  return (
    <div className="titlebar">
      <button
        type="button"
        className="titlebar-btn close"
        aria-label="隱藏到系統列"
        title="隱藏到系統列"
        onClick={handleClose}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden>
          <path
            d="M1 1 L9 9 M9 1 L1 9"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      </button>
    </div>
  );
}
