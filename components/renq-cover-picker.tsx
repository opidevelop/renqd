"use client";

import { useRef, useState } from "react";
import { ImagePlus, RotateCcw, LoaderCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Props = {
  value: string | null;
  onChange: (url: string) => void;
  onReset?: () => void;
  canReset?: boolean;
  variant?: "panel" | "overlay";
};

export function RenqCoverPicker({ value, onChange, onReset, canReset = false, variant = "panel" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

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
      const { data } = supabase.storage.from("renq-covers").getPublicUrl(path);
      onChange(data.publicUrl);
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
        {value ? <img src={value} alt="Anteprima copertina" /> : <span><ImagePlus size={22} /></span>}
      </div>}
      <div className="renq-cover-picker-actions">
        <button type="button" className="renq-cover-picker-button" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <LoaderCircle size={16} className="spin" /> : <ImagePlus size={16} />}
          <span>{uploading ? "Caricamento…" : value ? "Cambia copertina" : "Carica copertina"}</span>
        </button>
        {canReset && onReset && <button type="button" className="renq-cover-reset" onClick={onReset} disabled={uploading}><RotateCcw size={14} /> Ripristina automatica</button>}
      </div>
      <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={event => void upload(event.target.files?.[0])} />
      {error && <p className="renq-cover-error" role="alert">{error}</p>}
    </div>
  );
}
