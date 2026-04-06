'use client'

import { useEffect, useId } from 'react';
import type { ReactNode } from 'react';

export interface ConfirmationDialogClasses {
  backdrop: string;
  dialog: string;
  body: string;
  actions: string;
  cancelButton: string;
  confirmButton: string;
}

interface ConfirmationDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  isConfirming?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  classes?: Partial<ConfirmationDialogClasses>;
}

export function ConfirmationDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  isConfirming = false,
  onCancel,
  onConfirm,
  classes,
}: ConfirmationDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isConfirming) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isConfirming, onCancel, open]);

  if (!open) {
    return null;
  }

  return (
    <div
      className={classes?.backdrop}
      onClick={() => {
        if (!isConfirming) {
          onCancel();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        className={classes?.dialog}
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className={classes?.body}>
          <h2 id={titleId}>{title}</h2>
          {description ? <div id={descriptionId}>{description}</div> : null}
        </div>
        <div className={classes?.actions}>
          <button
            type="button"
            className={classes?.cancelButton}
            onClick={onCancel}
            disabled={isConfirming}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className={classes?.confirmButton}
            onClick={onConfirm}
            disabled={isConfirming}
          >
            {isConfirming ? '删除中…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
