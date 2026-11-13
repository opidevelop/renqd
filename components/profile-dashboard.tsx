"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { ArrowUpRight, BadgeCheck, Camera, FolderPlus, Globe2, Heart, ImagePlus, LockKeyhole, Plus, Save, Share2, Sparkles, Trash2, Trophy, Users, Pencil, Search, LoaderCircle, X } from "lucide-react";

type PublicProfile = {
  user_id: string; username: string; display_name: string; bio: string;
  avatar_url: string | null; banner_url: string | null; website_url: string | null;
  location: string | null; is_private: boolean;
};
type Collection = {
  id: string; title: string; slug: string; description: string; banner_url: string | null;
  visibility: "PUBLIC" | "PRIVATE"; is_featured: boolean; item_count: number; item_ids: string[];
};
type Renq = { id: string; title: string; public_slug: string; mode: string; settings: Record<string, unknown> };
type CollectionSearchResult = { id: string; title: string; coverImage: string | null; rows: { title: string; image_url?: string | null; rank_position?: number | null }[] };

export function ProfileDashboard({ profile: initialProfile, collections: initialCollections, rankings, favorites, followerCount, followingCount, likeCount }: {
  profile: PublicProfile; collections: Collection[]; rankings: Renq[]; favorites: Renq[];
  followerCount: number; followingCount: number; likeCount: number;
}) {
  const [profile, setProfile] = useState(initialProfile);
  const [collections, setCollections] = useState(initialCollections);
  const [savingProfile, setSavingProfile] = useState(false);
  const [creatingCollection, setCreatingCollection] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [collectionFormOpen, setCollectionFormOpen] = useState(false);
  const [collectionSearchTarget, setCollectionSearchTarget] = useState<string | null>(null);
  const [collectionSearchQuery, setCollectionSearchQuery] = useState("");
  const [collectionSearchResults, setCollectionSearchResults] = useState<CollectionSearchResult[]>([]);
  const [collectionSearchLoading, setCollectionSearchLoading] = useState(false);
  const [displayName, setDisplayName] = useState(initialProfile.display_name || "");
  const [bio, setBio] = useState(initialProfile.bio || "");
  const [collectionTitle, setCollectionTitle] = useState("");
  const [collectionDescription, setCollectionDescription] = useState("");
  const [collectionVisibility, setCollectionVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [collectionFile, setCollectionFile] = useState<File | null>(null);
  const [selectedRenqIds, setSelectedRenqIds] = useState<string[]>([]);
  const [collectionSelections, setCollectionSelections] = useState<Record<string,string[]>>({});
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const query = collectionSearchQuery.trim();
    if (!collectionSearchTarget || query.length < 2) {
      setCollectionSearchResults([]);
      setCollectionSearchLoading(false);
      return;
    }
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setCollectionSearchLoading(true);
      try {
        const response = await fetch("/api/my-renqs?q=" + encodeURIComponent(query), { signal: controller.signal, cache: "no-store" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Ricerca Renq non disponibile.");
        setCollectionSearchResults(result.items ?? []);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") return;
        setError(e instanceof Error ? e.message : "Ricerca Renq non disponibile.");
      } finally {
        if (!controller.signal.aborted) setCollectionSearchLoading(false);
      }
    }, 260);
    return () => { window.clearTimeout(timeout); controller.abort(); };
  }, [collectionSearchTarget, collectionSearchQuery]);

  function toggleSearchSelection(id: string, target: string) {
    if (target === "new") {
      setSelectedRenqIds(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
      return;
    }
    setCollectionSelections(current => {
      const values = current[target] ?? [];
      return { ...current, [target]: values.includes(id) ? values.filter(value => value !== id) : [...values, id] };
    });
  }

  function renderCollectionSearch(target: string) {
    const selectedIds = target === "new" ? selectedRenqIds : collectionSelections[target] ?? [];
    const results = target === collectionSearchTarget ? collectionSearchResults : [];
    return <div className="profile-collection-search">
      <label><Search size={15}/><input value={target === collectionSearchTarget ? collectionSearchQuery : ""} onFocus={() => setCollectionSearchTarget(target)} onChange={event => { setCollectionSearchTarget(target); setCollectionSearchQuery(event.target.value); }} placeholder="Cerca tra i tuoi Renq…"/></label>
      {target === collectionSearchTarget && collectionSearchLoading && <small className="profile-search-status"><LoaderCircle size={13}/> Ricerca in corso…</small>}
      {target === collectionSearchTarget && collectionSearchQuery.trim().length > 0 && collectionSearchQuery.trim().length < 2 && <small className="profile-search-status">Inserisci almeno 2 caratteri.</small>}
      {results.length > 0 && <div className="profile-collection-search-results">{results.filter(item => target === "new" || !(collections.find(collection => collection.id === target)?.item_ids ?? []).includes(item.id)).map(item => <button type="button" key={item.id} className={selectedIds.includes(item.id) ? "is-selected" : ""} aria-pressed={selectedIds.includes(item.id)} onClick={() => toggleSearchSelection(item.id, target)}>{item.coverImage ? <img src={item.coverImage} alt=""/> : <span className="profile-search-placeholder"><Trophy size={14}/></span>}<span><strong>{item.title}</strong><small>{item.rows.length} elementi</small></span>{selectedIds.includes(item.id) ? <BadgeCheck size={16}/> : <Plus size={16}/>}</button>)}</div>}
      {target === collectionSearchTarget && collectionSearchQuery.trim().length >= 2 && !collectionSearchLoading && results.length === 0 && <small className="profile-search-status">Nessun Renq corrispondente.</small>}
      {selectedIds.length > 0 && <small className="profile-search-selected">{selectedIds.length} Renq selezionati</small>}
    </div>;
  }

  async function uploadImage(file: File, prefix: string) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Scegli un'immagine JPG, PNG o WebP.");
    if (file.size > 8 * 1024 * 1024) throw new Error("L'immagine deve pesare al massimo 8 MB.");
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Accedi di nuovo per caricare un'immagine.");
    const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
    const path = user.id + "/" + prefix + "-" + crypto.randomUUID() + "." + extension;
    const { error: uploadError } = await supabase.storage.from("profile-media").upload(path, file, { contentType: file.type, cacheControl: "31536000", upsert: false });
    if (uploadError) throw uploadError;
    return supabase.storage.from("profile-media").getPublicUrl(path).data.publicUrl;
  }

  async function updateProfileImage(file: File | null, field: "avatar_url" | "banner_url") {
    if (!file) return;
    setError(""); setMessage("");
    try {
      const url = await uploadImage(file, field === "avatar_url" ? "avatar" : "profile-banner");
      setProfile(current => ({ ...current, [field]: url }));
      setMessage("Immagine caricata. Salva il profilo per confermare.");
    } catch (e) { setError(e instanceof Error ? e.message : "Caricamento non riuscito."); }
  }

  async function saveProfile() {
    setSavingProfile(true); setError(""); setMessage("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessione scaduta. Accedi di nuovo.");
      const next = { ...profile, display_name: displayName.trim().slice(0, 60), bio: bio.trim().slice(0, 280), updated_at: new Date().toISOString() };
      const { error: saveError } = await supabase.from("public_profiles").upsert({ ...next, user_id: user.id, username: profile.username }, { onConflict: "user_id" });
      if (saveError) throw saveError;
      setProfile(next); setMessage("Profilo aggiornato.");
    } catch (e) { setError(e instanceof Error ? e.message : "Non è stato possibile salvare il profilo."); }
    finally { setSavingProfile(false); }
  }

  async function togglePrivacy() {
    setError(""); setMessage("");
    const next = !profile.is_private;
    const supabase = createClient();
    const { error: updateError } = await supabase.from("public_profiles").update({ is_private: next, updated_at: new Date().toISOString() }).eq("user_id", profile.user_id);
    if (updateError) { setError(updateError.message); return; }
    setProfile(current => ({ ...current, is_private: next }));
    setMessage(next ? "Profilo impostato come privato." : "Profilo impostato come pubblico.");
  }

  async function createCollection(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!collectionTitle.trim() || creatingCollection) return;
    setCreatingCollection(true); setError(""); setMessage("");
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessione scaduta. Accedi di nuovo.");
      const bannerUrl = collectionFile ? await uploadImage(collectionFile, "collection") : null;
      const slugBase = collectionTitle.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 38) || "collezione";
      const slug = profile.username.toLowerCase() + "-" + slugBase + "-" + crypto.randomUUID().slice(0, 5);
      const { data: created, error: insertError } = await supabase.from("profile_collections").insert({
        owner_id: user.id, title: collectionTitle.trim(), slug, description: collectionDescription.trim(),
        banner_url: bannerUrl, visibility: collectionVisibility, sort_order: collections.length
      }).select("id,title,slug,description,banner_url,visibility,is_featured").single();
      if (insertError || !created) throw insertError ?? new Error("Non è stato possibile creare la collezione.");
      if (selectedRenqIds.length) {
        const { error: itemError } = await supabase.from("profile_collection_items").insert(selectedRenqIds.map((rankingId, index) => ({
          collection_id: created.id, ranking_id: rankingId, owner_id: user.id, position: index
        })));
        if (itemError) throw itemError;
      }
      setCollections(current => [...current, { ...created, item_count: selectedRenqIds.length, item_ids: selectedRenqIds }]);
      setCollectionTitle(""); setCollectionDescription(""); setCollectionFile(null); setSelectedRenqIds([]);
      setCollectionFormOpen(false); setCollectionSearchTarget(null); setCollectionSearchQuery("");
      setMessage("Collezione creata.");
    } catch (e) { setError(e instanceof Error ? e.message : "Non è stato possibile creare la collezione."); }
    finally { setCreatingCollection(false); }
  }

  async function updateCollection(id: string, patch: Partial<Pick<Collection, "is_featured" | "visibility" | "banner_url">>) {
    const supabase = createClient();
    const { error: updateError } = await supabase.from("profile_collections").update(patch).eq("id", id);
    if (updateError) { setError(updateError.message); return; }
    setCollections(current => current.map(item => item.id === id ? { ...item, ...patch } : item));
  }

  async function addRenqsToCollection(collection: Collection) {
    const ids = collectionSelections[collection.id] ?? [];
    const newIds = ids.filter(id => !collection.item_ids.includes(id));
    if (!newIds.length) return;
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setError("Sessione scaduta."); return; }
    const { error: insertError } = await supabase.from("profile_collection_items").insert(newIds.map((rankingId,index)=>({ collection_id: collection.id, ranking_id: rankingId, owner_id: user.id, position: collection.item_count + index })));
    if (insertError) { setError(insertError.message); return; }
    setCollections(current=>current.map(item=>item.id===collection.id?{...item,item_count:item.item_count+newIds.length,item_ids:[...item.item_ids,...newIds]}:item));
    setCollectionSelections(current=>({...current,[collection.id]:[]}));
    setMessage("Renq aggiunti alla collezione.");
  }

  async function updateCollectionBanner(collection: Collection, file: File | null) {
    if (!file) return;
    try {
      const url = await uploadImage(file,"collection-banner");
      await updateCollection(collection.id,{banner_url:url});
      setMessage("Banner della collezione aggiornato.");
    } catch (e) { setError(e instanceof Error ? e.message : "Non è stato possibile aggiornare il banner."); }
  }

  async function deleteCollection(id: string) {
    if (!window.confirm("Vuoi eliminare questa collezione? I Renq non verranno cancellati.")) return;
    const supabase = createClient();
    const { error: deleteError } = await supabase.from("profile_collections").delete().eq("id", id);
    if (deleteError) { setError(deleteError.message); return; }
    setCollections(current => current.filter(item => item.id !== id));
    setMessage("Collezione eliminata.");
  }

  async function shareProfile() {
    const url = window.location.origin + "/u/" + profile.username;
    try {
      if (navigator.share) await navigator.share({ title: profile.display_name || profile.username, url });
      else { await navigator.clipboard.writeText(url); setMessage("Link del profilo copiato."); }
    } catch { setMessage("Non è stato possibile condividere il profilo."); }
  }

  const badges = [
    rankings.length >= 1 ? "Primo Renq" : null,
    rankings.length >= 5 ? "Creatore attivo" : null,
    collections.length >= 3 ? "Collezionista" : null,
    likeCount >= 10 ? "Apprezzato dalla community" : null
  ].filter(Boolean) as string[];

  function firstCollectionCover(collection: Collection) {
    const firstId = collection.item_ids[0];
    const firstRenq = rankings.find(item => item.id === firstId);
    if (!firstRenq) return null;
    const settings = firstRenq.settings ?? {};
    const snapshot = settings.savedSnapshot as { items?: { image_url?: string | null }[] } | undefined;
    return (typeof settings.coverImageUrl === "string" ? settings.coverImageUrl : null) ?? snapshot?.items?.find(item => item.image_url)?.image_url ?? null;
  }

  return <div className="profile-dashboard">
    <section className="profile-cover" style={profile.banner_url ? { backgroundImage: "linear-gradient(90deg,rgba(18,14,11,.78),rgba(18,14,11,.16)),url(" + profile.banner_url + ")" } : undefined}>
      <div className="profile-cover-copy"><span>IL TUO PROFILO SU RENQD</span><h1>{profile.display_name || profile.username}</h1><p>@{profile.username}</p></div>
      <button type="button" className="profile-share-button" onClick={() => void shareProfile()}><Share2 size={16}/> Condividi</button>
    </section>

    <section className="profile-overview">
      <div className="profile-avatar-wrap">
        {profile.avatar_url ? <img src={profile.avatar_url} alt="Avatar profilo"/> : <span>{(profile.display_name || profile.username).slice(0, 1).toUpperCase()}</span>}
      </div>
      <div className="profile-overview-copy"><h2>{profile.display_name || profile.username}</h2><p>@{profile.username}</p>{profile.bio && <div className="profile-bio">{profile.bio}</div>}</div>
      <div className="profile-overview-actions"><div className="profile-privacy-pill">{profile.is_private ? <><LockKeyhole size={14}/> Privato</> : <><Globe2 size={14}/> Pubblico</>}</div><button type="button" className="profile-edit-trigger" onClick={() => setProfileEditorOpen(value => !value)} aria-expanded={profileEditorOpen}><Pencil size={14}/> Modifica profilo</button></div>
    </section>

    <section className="profile-stats-badges">
      <div className="profile-stats-grid">
        <div><strong>{rankings.length}</strong><span>RENQ</span></div>
        <div><strong>{collections.length}</strong><span>COLLEZIONI</span></div>
        <div><strong>{followerCount}</strong><span>FOLLOWER</span></div>
        <div><strong>{likeCount}</strong><span>LIKE RICEVUTI</span></div>
      </div>
      {badges.length > 0 && <div className="profile-badges-section"><div className="profile-badges-heading"><span>TRAGUARDI</span><strong>I tuoi badge</strong></div><div className="profile-badge-list">{badges.map(badge => <span key={badge}><BadgeCheck size={15}/>{badge}</span>)}</div></div>}
    </section>

    {profileEditorOpen && <section className="profile-editor-panel">
      <div className="profile-section-heading"><div><span>PERSONALIZZAZIONE</span><h2>Il tuo profilo</h2></div><Sparkles size={20}/></div>
      <div className="profile-image-editors">
        <label className="profile-image-upload">{profile.avatar_url ? <img src={profile.avatar_url} alt=""/> : <Camera size={20}/>}<span>Avatar</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void updateProfileImage(event.target.files?.[0] ?? null, "avatar_url")}/></label>
        <label className="profile-image-upload profile-banner-upload"><ImagePlus size={20}/><span>Cambia banner</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void updateProfileImage(event.target.files?.[0] ?? null, "banner_url")}/></label>
      </div>
      <div className="profile-edit-grid">
        <label>Nome visualizzato<input value={displayName} maxLength={60} onChange={event => setDisplayName(event.target.value)} placeholder="Come vuoi apparire"/></label>
        <label className="profile-edit-wide">Biografia<textarea value={bio} maxLength={280} rows={3} onChange={event => setBio(event.target.value)} placeholder="Racconta qualcosa di te…"/></label>
      </div>
      <div className="profile-editor-actions"><button type="button" className="profile-save-button" onClick={() => void saveProfile()} disabled={savingProfile}><Save size={16}/>{savingProfile ? "Salvataggio…" : "Salva profilo"}</button><button type="button" className="profile-privacy-button" onClick={() => void togglePrivacy()}>{profile.is_private ? <Globe2 size={15}/> : <LockKeyhole size={15}/>} {profile.is_private ? "Rendi pubblico" : "Rendi privato"}</button></div>
    </section>}

    <section className="profile-collections-section">
      <div className="profile-section-heading"><div><span>LA TUA LIBRERIA</span><h2>Le tue collezioni</h2><p>Crea cartelle con un banner personalizzato e raccogli i tuoi Renq.</p></div><button type="button" className="profile-add-collection" aria-label={collectionFormOpen ? "Chiudi creazione collezione" : "Crea una collezione"} onClick={() => { setCollectionFormOpen(value => !value); setCollectionSearchTarget(collectionFormOpen ? null : "new"); setCollectionSearchQuery(""); }}><FolderPlus size={20}/></button></div>
      {collections.length ? <div className="profile-collection-grid">{collections.map(collection => { const cover = collection.banner_url || firstCollectionCover(collection); return <article className={"profile-collection-card" + (collection.is_featured ? " is-featured" : "")} key={collection.id}>
        <Link href={"/collections/" + collection.slug} className="profile-collection-art" style={cover ? { backgroundImage: "linear-gradient(0deg,rgba(16,13,11,.72),rgba(16,13,11,.05)),url(" + cover + ")" } : undefined}><span>{collection.visibility === "PRIVATE" ? <LockKeyhole size={13}/> : <Globe2 size={13}/>} {collection.visibility === "PRIVATE" ? "PRIVATA" : "PUBBLICA"}</span><strong>{collection.title}</strong><small>{collection.item_count} Renq</small></Link>
        <div className="profile-collection-actions"><button type="button" onClick={() => void updateCollection(collection.id, { is_featured: !collection.is_featured })}>{collection.is_featured ? <BadgeCheck size={14}/> : <Sparkles size={14}/>} {collection.is_featured ? "In evidenza" : "Metti in evidenza"}</button><button type="button" onClick={() => void updateCollection(collection.id,{visibility:collection.visibility==="PUBLIC"?"PRIVATE":"PUBLIC"})}>{collection.visibility==="PUBLIC"?<LockKeyhole size={13}/>:<Globe2 size={13}/>} {collection.visibility==="PUBLIC"?"Rendi privata":"Rendi pubblica"}</button><label className="profile-banner-change" aria-label="Cambia banner della cartella" title="Cambia banner"><ImagePlus size={14}/><input type="file" accept="image/jpeg,image/png,image/webp" onChange={event=>void updateCollectionBanner(collection,event.target.files?.[0]??null)}/></label><button type="button" aria-label="Elimina collezione" onClick={() => void deleteCollection(collection.id)}><Trash2 size={14}/></button></div>
        <details className="profile-collection-manage"><summary onClick={() => { setCollectionSearchTarget(collection.id); setCollectionSearchQuery(""); }}>Aggiungi Renq alla cartella</summary><div>{renderCollectionSearch(collection.id)}<button type="button" className="profile-save-button" onClick={()=>void addRenqsToCollection(collection)} disabled={!(collectionSelections[collection.id]??[]).length}>Aggiungi selezionati</button></div></details>
      </article>;})}</div> : <div className="profile-empty-state"><FolderPlus size={24}/><strong>Ancora nessuna collezione</strong><p>Crea la tua prima cartella e inizia a organizzare i Renq.</p></div>}
      {collectionFormOpen && <form className="profile-create-collection" onSubmit={event => void createCollection(event)}>
        <div className="profile-create-collection-heading"><Plus size={18}/><strong>Crea una nuova collezione</strong><button type="button" onClick={() => { setCollectionFormOpen(false); setCollectionSearchTarget(null); }} aria-label="Chiudi"><X size={16}/></button></div>
        <div className="profile-edit-grid"><label>Nome cartella<input value={collectionTitle} onChange={event => setCollectionTitle(event.target.value)} maxLength={70} required placeholder="Es. Le mie auto preferite"/></label><label>Visibilità<select value={collectionVisibility} onChange={event => setCollectionVisibility(event.target.value as "PUBLIC" | "PRIVATE")}><option value="PUBLIC">Pubblica</option><option value="PRIVATE">Privata</option></select></label><label className="profile-edit-wide">Descrizione<input value={collectionDescription} onChange={event => setCollectionDescription(event.target.value)} maxLength={240} placeholder="Descrivi questa raccolta…"/></label><label className="profile-edit-wide profile-file-field">Banner della cartella<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setCollectionFile(event.target.files?.[0] ?? null)}/><small>{collectionFile ? collectionFile.name : "JPG, PNG o WebP · massimo 8 MB"}</small></label></div>
        {renderCollectionSearch("new")}
        <button type="submit" className="profile-save-button" disabled={creatingCollection || !collectionTitle.trim()}><FolderPlus size={16}/>{creatingCollection ? "Creazione…" : "Crea collezione"}</button>
      </form>}
    </section>

    {favorites.length > 0 && <section className="profile-renqs-section"><div className="profile-section-heading"><div><span>RACCOLTA PERSONALE</span><h2>I miei preferiti</h2><p>I Renq degli altri utenti che hai apprezzato.</p></div><Heart size={20}/></div><div className="profile-renq-grid">{favorites.map(ranking => { const settings = ranking.settings ?? {}; const cover = typeof settings.coverImageUrl === "string" ? settings.coverImageUrl : null; return <Link key={ranking.id} href={"/r/" + (ranking.public_slug || ranking.id)} className="profile-renq-card"><div style={cover ? { backgroundImage: "linear-gradient(0deg,rgba(15,12,10,.75),rgba(15,12,10,.05)),url(" + cover + ")" } : undefined}><span>{String(ranking.mode).replaceAll("_", " ")}</span><ArrowUpRight size={17}/></div><strong>{ranking.title}</strong></Link>; })}</div></section>}

    <section className="profile-renqs-section">
      <div className="profile-section-heading"><div><span>LE TUE CLASSIFICHE</span><h2>I miei Renq</h2><p>Tutti i Renq completati, anche quelli non inseriti in una collezione.</p></div><Trophy size={21}/></div>
      {rankings.length ? <div className="profile-renq-grid">{rankings.map(ranking => {
        const settings = ranking.settings ?? {};
        const cover = typeof settings.coverImageUrl === "string" ? settings.coverImageUrl : null;
        return <Link key={ranking.id} href={"/renq/" + (ranking.public_slug || ranking.id)} className="profile-renq-card"><div style={cover ? { backgroundImage: "linear-gradient(0deg,rgba(15,12,10,.75),rgba(15,12,10,.05)),url(" + cover + ")" } : undefined}><span>{String(ranking.mode).replaceAll("_", " ")}</span><ArrowUpRight size={17}/></div><strong>{ranking.title}</strong></Link>;
      })}</div> : <div className="profile-empty-state"><Trophy size={24}/><strong>Il tuo primo Renq ti aspetta</strong><p>Quando completi una classifica, la ritroverai qui.</p><Link href="/create">Crea un Renq <ArrowUpRight size={15}/></Link></div>}
    </section>
    <div className="profile-social-meta"><span><Users size={14}/> Segui {followingCount} profili</span><span><Heart size={14}/> {likeCount} apprezzamenti ricevuti</span><Link href={"/u/" + profile.username}>Apri il profilo pubblico <ArrowUpRight size={14}/></Link></div>
    {(message || error) && <p className={"profile-feedback" + (error ? " is-error" : "")} role="status">{error || message}</p>}
  </div>;
}
