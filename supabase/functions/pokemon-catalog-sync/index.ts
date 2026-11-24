import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

type PokemonTypeRecord = { slot: number; type: { name: string } };
type PokemonFormRecord = { form_name?: string | null; is_mega: boolean };
type PokemonVarietyRecord = {
  id: number; name: string; is_default: boolean;
  pokemonforms?: PokemonFormRecord[]; pokemontypes?: PokemonTypeRecord[];
};
type PokemonSpeciesNameRecord = { name: string; language?: { name: string } };
type PokemonSpeciesRecord = {
  id: number; name: string; generation?: { name: string };
  is_legendary: boolean; is_mythical: boolean;
  pokemonspeciesnames?: PokemonSpeciesNameRecord[]; pokemons?: PokemonVarietyRecord[];
};
type PokemonCatalogResponse = { errors?: unknown[]; data?: { pokemonspecies?: PokemonSpeciesRecord[] } };

const endpoint = "https://graphql.pokeapi.co/v1beta2";
const query = "query RenqdPokemonCatalog { pokemonspecies(limit: 2000, order_by: { id: asc }) { id name generation { name } is_legendary is_mythical pokemonspeciesnames { name language { name } } pokemons { id name is_default pokemonforms { name form_name is_mega is_default } pokemontypes { slot type { name } } } } }";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};
const ultraBeastNames = new Set([
  "nihilego", "buzzwole", "pheromosa", "xurkitree", "celesteela",
  "kartana", "guzzlord", "poipole", "naganadel", "stakataka", "blacephalon",
]);
const paradoxNames = new Set([
  "great-tusk", "scream-tail", "brute-bonnet", "flutter-mane", "slither-wing",
  "sandy-shocks", "roaring-moon", "walking-wake", "gouging-fire", "raging-bolt",
  "koraidon", "iron-treads", "iron-bundle", "iron-hands", "iron-jugulis",
  "iron-moth", "iron-thorns", "iron-valiant", "iron-leaves", "iron-boulder",
  "iron-crown", "miraidon",
]);
const normalize = (value: string) => value
  .replaceAll("♀", " female ")
  .replaceAll("♂", " male ")
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("en")
  .replace(/[^a-z0-9]+/g, "");
const unique = (values: string[]) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];
const spriteUrls = (id: number) => ({
  sprite_url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/" + id + ".png",
  artwork_url: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/" + id + ".png",
});
const generationNumber = (slug: string) => {
  const roman = slug.replace("generation-", "");
  const map: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
  return map[roman] ?? 0;
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: corsHeaders });

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: "Server configuration unavailable" }, 500);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Authentication required" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Authentication required" }, 401);
  const { data: profile } = await userClient.from("profiles").select("status").eq("id", authData.user.id).maybeSingle();
  if (profile?.status !== "APPROVED") return json({ error: "Account not approved" }, 403);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: claimed, error: claimError } = await admin.rpc("claim_pokemon_catalog_sync");
  if (claimError) return json({ error: "Catalog sync lock unavailable" }, 503);
  if (!claimed) {
    const { data: state } = await admin.from("pokemon_catalog_sync_state").select("species_count,last_synced_at").eq("id", 1).maybeSingle();
    return json({ synced: false, speciesCount: state?.species_count ?? 0, lastSyncedAt: state?.last_synced_at ?? null });
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ query }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!response.ok) throw new Error("PokéAPI HTTP " + response.status);
    const payload = await response.json() as PokemonCatalogResponse;
    if (payload.errors?.length) throw new Error("PokéAPI GraphQL returned errors");
    const species = payload.data?.pokemonspecies;
    if (!Array.isArray(species) || species.length < 1000) throw new Error("Incomplete Pokédex response");

    const rows = species.map((entry) => {
      const localized = entry.pokemonspeciesnames ?? [];
      const nameEn = localized.find((item) => item.language?.name === "en")?.name ?? entry.name;
      const nameIt = localized.find((item) => item.language?.name === "it")?.name ?? nameEn;
      const defaultPokemon = entry.pokemons?.find((pokemon) => pokemon.is_default) ?? entry.pokemons?.[0];
      if (!defaultPokemon) throw new Error("Species missing default variety: " + entry.id);
      const forms = (entry.pokemons ?? [])
        .filter((pokemon) => !pokemon.is_default || pokemon.pokemonforms?.some((form) => form.is_mega))
        .map((pokemon) => {
          const formRecords = pokemon.pokemonforms ?? [];
          const isMega = formRecords.some((form) => form.is_mega);
          const formName = formRecords.find((form) => form.form_name)?.form_name ?? "";
          const suffix = pokemon.name.startsWith(entry.name + "-") ? pokemon.name.slice(entry.name.length + 1) : formName;
          const megaVariant = suffix.replace(/^mega-?/i, "").replaceAll("-", " ").trim();
          return {
            id: pokemon.id,
            slug: pokemon.name,
            label: isMega ? (megaVariant ? "Mega " + megaVariant.toUpperCase() : "Mega") : suffix.replaceAll("-", " "),
            isMega,
            isDefault: pokemon.is_default,
            types: (pokemon.pokemontypes ?? []).sort((a, b) => a.slot - b.slot).map((item) => item.type.name),
            ...spriteUrls(pokemon.id),
          };
        });
      const aliases = unique([entry.name, nameEn, nameIt, ...localized.map((item) => item.name)]);
      const generation = generationNumber(entry.generation?.name ?? "");
      const specialCategories: string[] = [];
      if (entry.is_legendary) specialCategories.push("legendary");
      if (entry.is_mythical) specialCategories.push("mythical");
      if (ultraBeastNames.has(entry.name)) specialCategories.push("ultra-beast");
      if (paradoxNames.has(entry.name)) specialCategories.push("paradox");
      return {
        national_dex: entry.id,
        slug: entry.name,
        name_it: nameIt,
        name_en: nameEn,
        aliases,
        normalized_aliases: unique(aliases.map(normalize)),
        generation,
        types: (defaultPokemon.pokemontypes ?? []).sort((a, b) => a.slot - b.slot).map((item) => item.type.name),
        is_legendary: Boolean(entry.is_legendary),
        is_mythical: Boolean(entry.is_mythical),
        is_ultra_beast: ultraBeastNames.has(entry.name),
        is_paradox: paradoxNames.has(entry.name),
        special_categories: specialCategories,
        ...spriteUrls(defaultPokemon.id),
        forms,
        mega_forms: forms.filter((form) => form.isMega),
        updated_at: new Date().toISOString(),
      };
    });

    for (let offset = 0; offset < rows.length; offset += 100) {
      const { error } = await admin.from("pokemon_catalog_species").upsert(rows.slice(offset, offset + 100), { onConflict: "national_dex" });
      if (error) throw new Error("Catalog batch upsert failed");
    }

    const now = new Date().toISOString();
    const formCount = rows.reduce((total, row) => total + row.forms.length, 0);
    const megaFormCount = rows.reduce((total, row) => total + row.mega_forms.length, 0);
    const { error: stateError } = await admin.from("pokemon_catalog_sync_state")
      .update({ last_synced_at: now, sync_lock_until: null, species_count: rows.length, updated_at: now })
      .eq("id", 1);
    if (stateError) throw new Error("Catalog sync state update failed");
    return json({ synced: true, speciesCount: rows.length, formCount, megaFormCount, lastSyncedAt: now });
  } catch (error) {
    await admin.from("pokemon_catalog_sync_state").update({ sync_lock_until: null, updated_at: new Date().toISOString() }).eq("id", 1);
    console.error("pokemon-catalog-sync failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Catalog synchronization failed" }, 502);
  }
});
