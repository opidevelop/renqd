"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, LoaderCircle, Trash2 } from "lucide-react";
import { deleteAdminAccount } from "@/app/(platform)/admin/actions";

export default function DeleteAccountButton({
  targetUserId,
  username,
  location = "list",
}: {
  targetUserId: string;
  username: string;
  location?: "list" | "detail";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const matches = confirmation.trim().toLocaleLowerCase("it-IT") === username.trim().toLocaleLowerCase("it-IT");

  function cancel() {
    setOpen(false);
    setConfirmation("");
    setError("");
  }

  function removeAccount() {
    if (!matches || isPending) return;
    setError("");
    startTransition(async () => {
      const result = await deleteAdminAccount(targetUserId, confirmation);
      if (!result.ok) {
        setError(result.error || "Eliminazione non riuscita.");
        return;
      }
      if (result.error) {
        setError(result.error);
      }
      router.replace("/admin?section=users");
      router.refresh();
    });
  }

  return (
    <div className={"admin-delete-account" + (location === "detail" ? " is-detail" : "")}>
      {!open ? (
        <button type="button" className="admin-delete-trigger" onClick={() => { setOpen(true); setError(""); }}>
          <Trash2 size={14}/> Elimina definitivamente
        </button>
      ) : (
        <div className="admin-delete-confirmation" role="group" aria-label={"Eliminazione definitiva account " + username}>
          <strong><AlertTriangle size={14} style={{ display: "inline", verticalAlign: "middle", marginRight: 5 }}/> Eliminare definitivamente @{username}?</strong>
          <p>L'account, tutti i suoi Renq, i dati personali collegati e i file caricati saranno eliminati. L'operazione non può essere annullata.</p>
          <label htmlFor={"delete-account-confirm-" + targetUserId}>Per confermare, scrivi esattamente <b>{username}</b></label>
          <input
            id={"delete-account-confirm-" + targetUserId}
            autoComplete="off"
            value={confirmation}
            onChange={event => setConfirmation(event.target.value)}
            placeholder={username}
            disabled={isPending}
          />
          {error && <span className="admin-delete-feedback" role="alert">{error}</span>}
          <div className="admin-delete-confirmation-footer">
            <button type="button" onClick={cancel} disabled={isPending}>Annulla</button>
            <button type="button" className="is-danger" onClick={removeAccount} disabled={!matches || isPending}>
              {isPending ? <LoaderCircle size={13} className="admin-spin"/> : <Trash2 size={13}/>}
              Conferma eliminazione
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
