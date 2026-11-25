"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toPng } from "html-to-image";
import { ArrowDownToLine, Check, LoaderCircle, Plus, Search, Share2, X } from "lucide-react";
import {
  FavouriteMatrix, FavouriteSelection, GENERATION_LABELS, POKEMON_TYPE_LABELS,
  POKEMON_TYPES, PokemonCatalog, PokemonForm, PokemonSpecies,
  getPokemonCellKey, isPokemonCompatibleWithFavouriteCell, normalizePokemonName,
} from "@/lib/pokemon/catalog";
import { saveUltimateFavouriteAction } from "@/app/(platform)/pokemon/ultimate-favourite/actions";
import { getPokemonTypeIconUrl } from "@/lib/pokemon/type-icons";

type Candidate = { species: PokemonSpecies; form?: PokemonForm };
const columns = [...POKEMON_TYPES.map((type) => POKEMON_TYPE_LABELS[type]), "Mega", "Mitici", "Leggendari", "Preferito Gen."];

function labelForCell(row: number, column: number) {
  if (row === 9 && column === 21) return "Preferito assoluto";
  if (row === 9) return "Preferito della colonna · " + columns[column];
  if (column === 21) return "Preferito della generazione " + GENERATION_LABELS[row];
  return "Generazione " + GENERATION_LABELS[row] + " · " + columns[column];
}

function PokemonImage({ candidate, size = 48 }: { candidate: Candidate; size?: number }) {
  const [failed, setFailed] = useState(false);
  const form = candidate.form;
  const url = failed ? (form?.spriteUrl ?? candidate.species.spriteUrl) : (form?.artworkUrl ?? candidate.species.artworkUrl);
  return <img src={url} alt="" width={size} height={size} loading="lazy" onError={() => setFailed(true)} />;
}

function Grid({
  catalog, matrix, onCell, readOnly = false,
}: {
  catalog: PokemonCatalog; matrix: FavouriteMatrix;
  onCell?: (row: number, column: number) => void; readOnly?: boolean;
}) {
  const [activeGeneration, setActiveGeneration] = useState(0);
  const isOverall = activeGeneration === 9;
  const activeRow = isOverall ? 9 : activeGeneration;
  const selected = (selection?: FavouriteSelection): Candidate | undefined => {
    if (!selection) return undefined;
    const species = catalog.species.find((item) => item.id === selection.speciesId);
    if (!species) return undefined;
    return { species, form: selection.formId ? (species.forms.find((item) => item.id === selection.formId) ?? species.megaForms.find((item) => item.id === selection.formId)) : undefined };
  };
  const renderCell = (row: number, column: number, summary = false) => {
    const key = getPokemonCellKey(row, column);
    const candidate = selected(matrix[key]);
    const name = candidate ? candidate.species.name + (candidate.form?.label ? " " + candidate.form.label : "") : "";
    const body = candidate ? (
      <>
        <span className="pokemon-favourite-card-art"><PokemonImage candidate={candidate} size={summary ? 58 : 76} /></span>
        <span className="pokemon-favourite-card-copy"><strong>{name}</strong><small>#{candidate.species.id.toString().padStart(4, "0")}</small></span>
      </>
    ) : (
      <>
        <span className="pokemon-favourite-card-empty"><Plus size={summary ? 17 : 20} /></span>
        <span className="pokemon-favourite-card-copy"><strong>{summary ? "Da scegliere" : "Scegli Pokémon"}</strong><small>Seleziona un Pokémon</small></span>
      </>
    );
    const className = "pokemon-favourite-choice-card" + (candidate ? " is-filled" : "") + (summary ? " is-summary" : "") + (row === 9 && column === 21 ? " is-ultimate" : "");
    return readOnly ? (
      <div className={className} key={key} aria-label={labelForCell(row, column)}>{body}</div>
    ) : (
      <button type="button" className={className} key={key} onClick={() => onCell?.(row, column)}
        aria-label={labelForCell(row, column) + (candidate ? ": " + name : ", seleziona un Pokémon")}>
        {body}
      </button>
    );
  };
  return (
    <div className="pokemon-favourite-layout">
      <section className="pokemon-favourite-generation-section" aria-label="Seleziona una generazione">
        <div className="pokemon-favourite-section-heading">
          <div><span>LA TUA COLLEZIONE</span><h3>Scegli una generazione</h3><p>Ogni scheda raccoglie le tue selezioni; i preferiti assoluti arrivano dopo la Gen. IX.</p></div>
          <span className="pokemon-favourite-generation-count">{activeGeneration + 1} / 10</span>
        </div>
        <div className="pokemon-favourite-generation-tabs">
          {GENERATION_LABELS.slice(0, 9).map((generation, index) => (
            <button type="button" key={generation} className={activeGeneration === index ? "is-active" : ""}
              aria-pressed={activeGeneration === index} onClick={() => setActiveGeneration(index)}>
              <strong>{["I","II","III","IV","V","VI","VII","VIII","IX"][index]}</strong><span>Gen.</span>
            </button>
          ))}
          <button type="button" key="overall" className={isOverall ? "is-active is-overall" : "is-overall"}
            aria-pressed={isOverall} onClick={() => setActiveGeneration(9)}>
            <strong>✦</strong><span>Assoluti</span>
          </button>
        </div>
      </section>
      <section className="pokemon-favourite-generation-content">
        <div className="pokemon-favourite-section-heading">
          <div>
            <span>{isOverall ? "PREFERITI ASSOLUTI" : "GENERAZIONE " + GENERATION_LABELS[activeGeneration]}</span>
            <h3>{isOverall ? "I tuoi preferiti assoluti" : "I tuoi Pokémon preferiti"}</h3>
            <p>{isOverall
              ? "Ogni categoria propone soltanto i Pokémon che hai già scelto in quella categoria nelle generazioni."
              : "Il Preferito Gen. propone esclusivamente i Pokémon già selezionati nei tipi di questa generazione."}</p>
          </div>
        </div>
        <div className="pokemon-favourite-choice-grid">
          {columns.map((name, column) => {
            const type = POKEMON_TYPES[column];
            const special = column >= 18;
            const label = isOverall && column === 21 ? "Preferito assoluto" : name;
            return (
              <div className={"pokemon-favourite-choice-wrap" + (special ? " is-special" : "")} key={name + column}>
                <div className="pokemon-favourite-choice-label">
                  {type ? <img src={getPokemonTypeIconUrl(type)} alt="" loading="lazy" /> : <span className="pokemon-favourite-special-icon">{["✦","◆","★","♛"][column - 18] ?? "✦"}</span>}
                  <strong>{label}</strong>
                </div>
                {renderCell(activeRow, column, isOverall)}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export function UltimateFavouriteEditor({
  initialMatrix, initialRankingId, initialPublicSlug, initiallyPublished,
}: {
  initialMatrix: FavouriteMatrix; initialRankingId: string | null;
  initialPublicSlug: string | null; initiallyPublished: boolean;
}) {
  const router = useRouter();
  const exportRef = useRef<HTMLDivElement>(null);
  const [catalog, setCatalog] = useState<PokemonCatalog | null>(null);
  const [matrix, setMatrix] = useState<FavouriteMatrix>(initialMatrix);
  const [rankingId, setRankingId] = useState(initialRankingId);
  const [publicSlug, setPublicSlug] = useState(initialPublicSlug);
  const [published, setPublished] = useState(initiallyPublished);
  const [active, setActive] = useState<{ row: number; column: number } | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    fetch("/data/pokemon/catalog.json").then((response) => {
      if (!response.ok) throw new Error("Catalogo non disponibile");
      return response.json() as Promise<PokemonCatalog>;
    }).then((data) => { if (alive) setCatalog(data); })
      .catch(() => { if (alive) setStatus("Catalogo Pokémon temporaneamente non disponibile."); });
    return () => { alive = false; };
  }, []);

  const candidates = useMemo<Candidate[]>(() => {
    if (!catalog || !active) return [];
    const fromSelection = (selection?: FavouriteSelection): Candidate | undefined => {
      if (!selection) return undefined;
      const species = catalog.species.find((item) => item.id === selection.speciesId);
      if (!species) return undefined;
      const form = selection.formId
        ? (species.forms.find((item) => item.id === selection.formId) ?? species.megaForms.find((item) => item.id === selection.formId))
        : undefined;
      return { species, form };
    };
    let options: Candidate[];
    if (active.row === 9) {
      const source = active.column === 21
        ? Array.from({ length: 9 }, (_, row) => Array.from({ length: 21 }, (_, column) => matrix[getPokemonCellKey(row, column)]))
        : Array.from({ length: 9 }, (_, row) => [matrix[getPokemonCellKey(row, active.column)]]);
      const unique = new Map<string, Candidate>();
      source.flat().forEach((selection) => {
        const candidate = fromSelection(selection);
        if (candidate) unique.set(candidate.species.id + ":" + (candidate.form?.id ?? ""), candidate);
      });
      options = [...unique.values()];
    } else if (active.column === 21) {
      const unique = new Map<string, Candidate>();
      Array.from({ length: 18 }, (_, column) => matrix[getPokemonCellKey(active.row, column)]).forEach((selection) => {
        const candidate = fromSelection(selection);
        if (candidate) unique.set(candidate.species.id + ":" + (candidate.form?.id ?? ""), candidate);
      });
      options = [...unique.values()];
    } else {
      const available = catalog.species.filter((species) =>
        isPokemonCompatibleWithFavouriteCell(species, active.row, active.column)
      );
      options = active.column === 18
        ? available.flatMap((species) => species.megaForms.map((form) => ({ species, form })))
        : available.map((species) => ({ species }));
    }
    const normalized = normalizePokemonName(query);
    return (normalized ? options.filter(({ species, form }) =>
      [species.name, species.nameEn, species.slug, ...(species.aliases ?? []), form?.slug ?? "", form?.label ?? ""]
        .some((name) => normalizePokemonName(name).includes(normalized))
    ) : options).slice(0, 80);
  }, [catalog, active, query, matrix]);

  const choose = (candidate: Candidate) => {
    if (!active) return;
    const selection: FavouriteSelection = {
      speciesId: candidate.species.id,
      ...(candidate.form ? { formId: candidate.form.id } : {}),
    };
    setMatrix((current) => ({ ...current, [getPokemonCellKey(active.row,active.column)]: selection }));
    setActive(null); setQuery(""); setStatus("Selezione aggiornata. Salva la matrice per conservarla.");
  };

  const remove = () => {
    if (!active) return;
    const key = getPokemonCellKey(active.row,active.column);
    setMatrix((current) => { const next = { ...current }; delete next[key]; return next; });
    setActive(null); setStatus("Selezione rimossa. Salva la matrice per conservare la modifica.");
  };

  const save = (publish: boolean) => startTransition(async () => {
    const result = await saveUltimateFavouriteAction({ rankingId, matrix, publish });
    if (!result.ok || !result.rankingId) { setStatus(result.error ?? "Salvataggio non riuscito."); return; }
    setRankingId(result.rankingId); setPublicSlug(result.publicSlug ?? publicSlug);
    setPublished(Boolean(result.published));
    setStatus(publish ? "Matrice pubblicata nel tuo spazio Renqd." : "Matrice salvata.");
    router.refresh();
  });

  const exportPng = async () => {
    if (!exportRef.current) return;
    try {
      const node = exportRef.current;
      const width = node.scrollWidth;
      const height = node.scrollHeight;
      const url = await toPng(node, { cacheBust: true, pixelRatio: 2, width, height, canvasWidth: width * 2, canvasHeight: height * 2,
        style: { width: width + "px", height: height + "px", overflow: "visible" } });
      const link = document.createElement("a"); link.download = "renqd-ultimate-favourite.png"; link.href = url; link.click();
      setStatus("Esportazione PNG completata.");
    } catch { setStatus("Esportazione PNG non riuscita. Riprova."); }
  };

  const share = async () => {
    if (!publicSlug) return;
    try { await navigator.clipboard.writeText(window.location.origin + "/r/" + publicSlug); setStatus("Link Renqd copiato."); }
    catch { setStatus("Non è stato possibile copiare il link."); }
  };

  if (!catalog) return <div className="pokemon-favourite-loading"><LoaderCircle size={18} /> Caricamento del Pokédex…</div>;

  return (
    <main className="pokemon-page pokemon-favourite-editor">
      <header className="pokemon-favourite-heading">
        <div><span className="pokemon-page-eyebrow">RENQD × POKÉMON</span><h1>Ultimate Favourite</h1>
          <p>Costruisci la tua matrice Pokémon: 22 categorie, 10 righe e nessun limite di ripetizione tra celle compatibili.</p></div>
        <span className="pokemon-favourite-counter">{Object.keys(matrix).length} / 220</span>
      </header>
      <div className="pokemon-favourite-toolbar">
        <button type="button" onClick={exportPng} className="pokemon-favourite-secondary"><ArrowDownToLine size={15}/> Esporta PNG</button>
        {published && <button type="button" onClick={share} className="pokemon-favourite-secondary"><Share2 size={15}/> Condividi</button>}
        <span className="pokemon-favourite-spacer" />
        <button type="button" onClick={() => save(false)} disabled={pending} className="pokemon-favourite-secondary">
          {pending ? <LoaderCircle size={15}/> : <Check size={15}/>} Salva bozza
        </button>
        <button type="button" onClick={() => save(true)} disabled={pending} className="pokemon-favourite-primary">
          <Share2 size={15}/> {published ? "Aggiorna" : "Pubblica"}
        </button>
      </div>
      <section className="pokemon-favourite-board" ref={boardRef}>
        <div className="pokemon-favourite-board-title"><span>RENQD × POKÉMON</span><strong>Ultimate Favourite</strong><small>La mia matrice Pokémon</small></div>
        <Grid catalog={catalog} matrix={matrix} onCell={(row,column) => { setActive({row,column}); setQuery(""); }} />
      </section>
      <div className="pokemon-favourite-export-stage" aria-hidden="true">
        <div className="pokemon-favourite-export-sheet" ref={exportRef}>
          <header className="pokemon-favourite-export-heading">
            <span>RENQD × POKÉMON</span><strong>Ultimate Favourite</strong><small>La mia matrice Pokémon · 10 generazioni · 22 categorie</small>
          </header>
          {Array.from({ length: 10 }, (_, row) => (
            <section className="pokemon-favourite-export-generation" key={row}>
              <h2>{row === 9 ? "Preferiti assoluti e di categoria" : "Generazione " + GENERATION_LABELS[row]}</h2>
              <div className="pokemon-favourite-export-grid">
                {columns.map((category, column) => {
                  const selection = matrix[getPokemonCellKey(row, column)];
                  const species = selection ? catalog.species.find(item => item.id === selection.speciesId) : undefined;
                  const form = species && selection?.formId
                    ? (species.forms.find(item => item.id === selection.formId) ?? species.megaForms.find(item => item.id === selection.formId))
                    : undefined;
                  const name = species ? species.name + (form?.label ? " " + form.label : "") : "Non selezionato";
                  const image = form?.artworkUrl ?? species?.artworkUrl;
                  return <article className={"pokemon-favourite-export-cell" + (species ? " is-filled" : "")} key={category + "-" + column}>
                    <small>{row === 9 && column === 21 ? "Preferito assoluto" : row === 9 ? "Preferito · " + category : category}</small>
                    {image ? <img src={image} alt="" crossOrigin="anonymous" loading="eager"/> : <span className="pokemon-favourite-export-empty">—</span>}
                    <strong>{name}</strong>
                    {species && <em>#{String(species.id).padStart(4, "0")}</em>}
                  </article>;
                })}
              </div>
            </section>
          ))}
          <footer>RENQD · LA TUA MATRICE POKÉMON</footer>
        </div>
      </div>
      {status && <p className="pokemon-favourite-status" role="status">{status}</p>}
      {active && (
        <div className="pokemon-picker-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setActive(null); }}>
          <section className="pokemon-picker" role="dialog" aria-modal="true" aria-labelledby="pokemon-picker-title">
            <header><div><span className="pokemon-page-eyebrow">SELEZIONE POKÉMON</span><h2 id="pokemon-picker-title">{labelForCell(active.row,active.column)}</h2></div>
              <button type="button" onClick={() => setActive(null)} aria-label="Chiudi"><X size={18}/></button></header>
            <label className="pokemon-picker-search"><Search size={16}/><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca in italiano o inglese…"/></label>
            <div className="pokemon-picker-grid">
              {candidates.map((candidate) => {
                const name = candidate.species.name + (candidate.form?.label ? " " + candidate.form.label : "");
                return <button type="button" className="pokemon-picker-card" key={candidate.species.id + "-" + (candidate.form?.id ?? "base")} onClick={() => choose(candidate)}>
                  <span className="pokemon-picker-silhouette"><PokemonImage candidate={candidate} size={76}/></span>
                  <span className="pokemon-picker-card-copy"><strong>{name}</strong><small>#{candidate.species.id.toString().padStart(4,"0")} <i/> Gen. {GENERATION_LABELS[candidate.species.generation-1]}</small></span>
                </button>;
              })}
              {!candidates.length && <p>Nessun Pokémon già selezionato in questa categoria. Scegli prima i preferiti nelle generazioni.</p>}
            </div>
            {matrix[getPokemonCellKey(active.row,active.column)] && <button type="button" className="pokemon-picker-remove" onClick={remove}>Rimuovi selezione</button>}
          </section>
        </div>
      )}
    </main>
  );
}

export function PokemonFavouritePublicView({ matrix, ownerName }: { matrix: FavouriteMatrix; ownerName: string }) {
  const [catalog,setCatalog] = useState<PokemonCatalog | null>(null);
  useEffect(() => { let alive = true; fetch("/data/pokemon/catalog.json").then(r => r.json()).then((data: PokemonCatalog) => { if(alive)setCatalog(data); }).catch(()=>{}); return ()=>{alive=false;}; },[]);
  if (!catalog) return <div className="pokemon-favourite-loading">Caricamento della matrice…</div>;
  return <main className="pokemon-page"><header className="pokemon-favourite-heading"><div><span className="pokemon-page-eyebrow">RENQD × POKÉMON</span><h1>Ultimate Favourite</h1><p>La matrice Pokémon di {ownerName}.</p></div></header>
    <section className="pokemon-favourite-board"><div className="pokemon-favourite-board-title"><span>RENQD × POKÉMON</span><strong>Ultimate Favourite</strong><small>{ownerName}</small></div><Grid catalog={catalog} matrix={matrix} readOnly/></section>
  </main>;
}
