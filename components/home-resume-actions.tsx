'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Trash2, X } from 'lucide-react';

export function HomeResumeActions() {
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [refreshPending, setRefreshPending] = useState(false);

  useEffect(() => {
    if (!refreshPending) return;
    const timeout = window.setTimeout(() => {
      setRefreshPending(false);
      router.refresh();
    }, 1800);
    return () => window.clearTimeout(timeout);
  }, [refreshPending, router]);

  async function clearAll() {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/rankings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete-all-drafts' }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? 'Non è stato possibile svuotare le bozze.');
      setConfirmOpen(false);
      setFeedback({ type: 'success', message: 'Bozze rimosse da Riprendi Renq.' });
      setRefreshPending(true);
    } catch (error) {
      setFeedback({
        type: 'error',
        message: error instanceof Error ? error.message : 'Errore durante la cancellazione.',
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className='home-resume-actions'>
        <button type='button' onClick={() => { setFeedback(null); setConfirmOpen(true); }} disabled={busy}>
          <Trash2 size={14} /> Svuota tutto
        </button>
      </div>

      {feedback && (
        <div className={'home-resume-toast is-' + feedback.type} role='status' aria-live='polite'>
          {feedback.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{feedback.message}</span>
          <button type='button' onClick={() => setFeedback(null)} aria-label='Chiudi notifica'><X size={16} /></button>
        </div>
      )}

      {confirmOpen && typeof document !== 'undefined' && createPortal(
        <div
          className='home-resume-confirm-backdrop'
          onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) setConfirmOpen(false); }}
        >
          <section className='home-resume-confirm' role='dialog' aria-modal='true' aria-labelledby='home-resume-confirm-title'>
            <header>
              <span>GESTIONE DELLE BOZZE</span>
              <button type='button' onClick={() => setConfirmOpen(false)} disabled={busy} aria-label='Chiudi'><X size={18} /></button>
            </header>
            <div className='home-resume-confirm-copy'>
              <span className='home-resume-confirm-mark'><Trash2 size={20} /></span>
              <h2 id='home-resume-confirm-title'>Svuotare Riprendi Renq?</h2>
              <p>Le bozze attive verranno rimosse da questa sezione e spostate nel Cestino. Le sessioni multiplayer a cui partecipi non verranno modificate.</p>
              {feedback?.type === 'error' && <p className='home-resume-confirm-error' role='alert'>{feedback.message}</p>}
            </div>
            <footer>
              <button type='button' className='home-resume-confirm-cancel' onClick={() => setConfirmOpen(false)} disabled={busy}>Annulla</button>
              <button type='button' className='home-resume-confirm-submit' onClick={() => void clearAll()} disabled={busy}>
                <Trash2 size={14} /> {busy ? 'Svuotamento…' : 'Conferma svuotamento'}
              </button>
            </footer>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
