"use client";

import { useRef, useState } from "react";
import { ImagePlus, RotateCcw, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  value: string | null;
  onChange: (path: string, previewUrl: string) => void;
  onReset?: () => void;
  canReset?: boolean;
  variant?: "panel" | "overlay";
};

export function RenqCoverPicker({ value, onChange, onReset, canReset = false, focusPosition = { x: 50, y: 50 }, onFocusChange, variant = "panel" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");\n  const [focus, setFocus] = useState(focusPosition);\n\n  function changeFocus(axis: "x" | "y", value: number) { setFocus(current => ({ ...current, [axis]: value })); }\n  function commitFocus() { onFocusChange?.(focus); }

  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Scegli un'immagine JPG, PNG o WebP.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("L'immagine deve pesare al massimo 8 MB.");
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Accedi di nuovo per caricare una copertina.");
      const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
      const path = user.id + "/" + crypto.randomUUID() + "." + extension;
      const { error: uploadError } = await supabase.storage.from("renq-covers").upload(path, file, {
        cacheControl: "31536000",
        contentType: file.type,
        upsert: false
      });
      if (uploadError) throw uploadError;
      const { data: signed, error: signedError } = await supabase.storage.from("renq-covers").createSignedUrl(path, 60 * 60 * 24 * 7);
      if (signedError || !signed?.signedUrl) throw signedError ?? new Error("Anteprima della copertina non disponibile.");
      onChange(path, signed.signedUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Non è stato possibile caricare la copertina.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={"renq-cover-picker " + (variant === "overlay" ? "is-overlay" : "is-panel")}>
      {variant === "panel" && <div className="renq-cover-picker-preview">
        {value ? <img src={value} alt="Anteprima copertina" style={{ objectPosition: `${focus.x}% ${focus.y}%` }} /> : <span><ImagePlus size={22} /></span>}
      </div>}
      <div className="renq-cover-picker-actions">
        <button type="button" className="renq-cover-picker-button" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <LoaderCircle size={16} className="spin" /> : <ImagePlus size={16} />}
          <span>{uploading ? "Caricamento…" : value ? "Cambia copertina" : "Carica copertina"}</span>
        </button>
        {variant === "overlay" && <div className="renq-cover-focus-controls"><label><span>Orizzontale</span><input aria-label="Fuoco orizzontale copertina" type="range" min="0" max="100" value={focus.x} onChange={event => changeFocus("x", Number(event.target.value))} onPointerUp={commitFocus} onKeyUp={commitFocus} disabled={uploading} /></label><label><span>Verticale</span><input aria-label="Fuoco verticale copertina" type="range" min="0" max="100" value={focus.y} onChange={event => changeFocus("y", Number(event.target.value))} onPointerUp={commitFocus} onKeyUp={commitFocus} disabled={uploading} /></label></div>}\n        {canReset && onReset && <button type="button" className="renq-cover-reset" onClick={onReset} disabled={uploading}><RotateCcw size={14} /> Ripristina originale</button>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => void upload(event.target.files?.[0])} />
      {error && <p className="renq-cover-error" role="alert">{error}</p>}
    </div>
  );
}
