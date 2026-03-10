import { useEffect, useRef } from "react";

interface Props {
  turnIndex: number;
  userMessage: string;
  onClose: () => void;
}

export function DetailPopup({ turnIndex, userMessage, onClose }: Props) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div className="popup-overlay" ref={overlayRef} onClick={handleOverlayClick}>
      <div className="popup-content">
        <div className="popup-header">
          <h3>Turn {turnIndex}</h3>
          <button className="popup-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="popup-body">
          <h4>User Message</h4>
          <pre className="popup-message">{userMessage}</pre>
        </div>
      </div>
    </div>
  );
}
