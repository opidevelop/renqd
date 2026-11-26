"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

type DialogProps = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  overlayClassName?: string;
  className?: string;
  role?: "dialog" | "alertdialog";
  ariaLabel?: string;
  labelledBy?: string;
  describedBy?: string;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
};

const focusableSelector = '[autofocus],button:not(:disabled),[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex]:not([tabindex="-1"])';
const openDialogStack: HTMLElement[] = [];
let bodyLockCount = 0;
let savedBodyOverflow = "";
let savedBodyPaddingRight = "";
let savedScrollY = 0;

export function Dialog({
  open,
  onClose,
  children,
  overlayClassName = "renqd-dialog-overlay",
  className = "renqd-dialog",
  role = "dialog",
  ariaLabel,
  labelledBy,
  describedBy,
  closeOnBackdrop = true,
  closeOnEscape = true,
}: DialogProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const node = dialogRef.current;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (bodyLockCount === 0) {
      savedBodyOverflow = document.body.style.overflow;
      savedBodyPaddingRight = document.body.style.paddingRight;
      savedScrollY = window.scrollY;
      const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);
      document.body.style.overflow = "hidden";
      if (scrollbarWidth) document.body.style.paddingRight = scrollbarWidth + "px";
    }
    bodyLockCount += 1;
    if (node) openDialogStack.push(node);

    const focusInitial = () => {
      const target = node?.querySelector<HTMLElement>(focusableSelector) ?? node;
      target?.focus();
    };
    const frame = window.requestAnimationFrame(focusInitial);

    const onKeyDown = (event: KeyboardEvent) => {
      if (!node || openDialogStack[openDialogStack.length - 1] !== node) return;
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = node.querySelectorAll<HTMLElement>(focusableSelector);
      if (!nodes.length) {
        event.preventDefault();
        node.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (event.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKeyDown);
      if (node) {
        const index = openDialogStack.lastIndexOf(node);
        if (index >= 0) openDialogStack.splice(index, 1);
      }
      bodyLockCount = Math.max(0, bodyLockCount - 1);
      if (bodyLockCount === 0) {
        document.body.style.overflow = savedBodyOverflow;
        document.body.style.paddingRight = savedBodyPaddingRight;
        window.scrollTo({ top: savedScrollY, behavior: "auto" });
      }
      const topDialog = openDialogStack[openDialogStack.length - 1];
      if (!topDialog || (previousFocus && topDialog.contains(previousFocus))) previousFocus?.focus();
      else topDialog.querySelector<HTMLElement>(focusableSelector)?.focus();
    };
  }, [open, closeOnEscape]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={overlayClassName}
      onMouseDown={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) closeRef.current();
      }}
    >
      <section
        ref={dialogRef}
        className={className}
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        tabIndex={-1}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
