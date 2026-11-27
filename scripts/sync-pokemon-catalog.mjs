import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const endpoint = "https://graphql.pokeapi.co/v1beta2";
const output = new URL("../public/data/pokemon/catalog.json", import.meta.url);
const romanGenerations = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9 };
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
const query = "query RenqdPokemonCatalog { pokemonspecies(limit: 2000, order_by: { id: asc }) { id name generation { name } is_legendary is_mythical pokemonspeciesnames { name language { name } } pokemons { id name is_default pokemonforms { name form_name is_mega is_default } pokemontypes { slot type { name } } } } }";
const normalize = (value) => value
  .replaceAll("♀", " female ").replaceAll("♂", " male ")
  .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
  .toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "");
const unique = (values) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];
const spriteUrls = (id) => ({
  spriteUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/home/" + id + ".png",
  artworkUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/" + id + ".png",
});
const response = await fetch(endpoint, {
  method: "POST",
  headers: { "content-type": "application/json", accept: "application/json" },
  body: JSON.stringify({ query }),
  signal: AbortSignal.timeout(90_000),
});
if (!response.ok) throw new Error("PokéAPI HTTP " + response.status);
const payload = await response.json();
if (payload.errors?.length) throw new Error(JSON.stringify(payload.errors));
const sourceRows = payload.data?.pokemonspecies;
if (!Array.isArray(sourceRows) || sourceRows.length < 1000) {
  throw new Error("Incomplete catalog: " + (sourceRows?.length ?? 0) + " species");
}
const species = sourceRows.map((row) => {
  const localized = row.pokemonspeciesnames ?? [];
  const nameEn = localized.find((item) => item.language?.name === "en")?.name ?? row.name;
  const nameIt = localized.find((item) => item.language?.name === "it")?.name ?? nameEn;
  const base = row.pokemons?.find((pokemon) => pokemon.is_default) ?? row.pokemons?.[0];
  if (!base) throw new Error("Species " + row.id + " has no default variety");
  const forms = (row.pokemons ?? [])
    .filter((pokemon) => !pokemon.is_default || pokemon.pokemonforms?.some((form) => form.is_mega))
    .map((pokemon) => {
      const formRecords = pokemon.pokemonforms ?? [];
      const isMega = formRecords.some((form) => form.is_mega);
      const formName = formRecords.find((form) => form.form_name)?.form_name ?? "";
      const suffix = pokemon.name.startsWith(row.name + "-") ? pokemon.name.slice(row.name.length + 1) : formName;
      const megaVariant = suffix.replace(/^mega-?/i, "").replaceAll("-", " ").trim();
      return {
        id: pokemon.id, slug: pokemon.name,
        label: isMega ? (megaVariant ? "Mega " + megaVariant.toUpperCase() : "Mega") : suffix.replaceAll("-", " "),
        isMega, isDefault: pokemon.is_default,
        types: (pokemon.pokemontypes ?? []).sort((a,b) => a.slot-b.slot).map((item) => item.type.name),
        ...spriteUrls(pokemon.id),
      };
    });
  const aliases = unique([row.name, nameEn, nameIt, ...localized.map((item) => item.name)]);
  const generation = romanGenerations[(row.generation?.name ?? "").replace("generation-", "")] ?? 0;
  if (generation < 1 || generation > 9) throw new Error("Unsupported generation for species " + row.id);
  const specialCategories = [];
  if (row.is_legendary) specialCategories.push("legendary");
  if (row.is_mythical) specialCategories.push("mythical");
  if (ultraBeastNames.has(row.name)) specialCategories.push("ultra-beast");
  if (paradoxNames.has(row.name)) specialCategories.push("paradox");
  return {
    id: row.id, slug: row.name, name: nameIt, nameEn, aliases,
    normalizedAliases: unique(aliases.map(normalize)), generation,
    types: (base.pokemontypes ?? []).sort((a,b) => a.slot-b.slot).map((item) => item.type.name),
    isLegendary: Boolean(row.is_legendary), isMythical: Boolean(row.is_mythical),
    isUltraBeast: ultraBeastNames.has(row.name), isParadox: paradoxNames.has(row.name),
    specialCategories, ...spriteUrls(base.id), forms,
    megaForms: forms.filter((form) => form.isMega),
  };
});
const ids = new Set(species.map((item) => item.id));
if (ids.size !== species.length || species[0]?.id !== 1 || species.at(-1)?.id < 1000) {
  throw new Error("Catalog IDs are not unique or range is incomplete");
}
const catalog = {
  schemaVersion: 1, source: "PokéAPI GraphQL v1beta2",
  speciesCount: species.length,
  formCount: species.reduce((total,item) => total + item.forms.length,0),
  megaFormCount: species.reduce((total,item) => total + item.megaForms.length,0),
  species,
};
await mkdir(dirname(output.pathname), { recursive: true });
let previous = "";
try { previous = await readFile(output, "utf8"); } catch {}
const previousCatalog = previous ? JSON.parse(previous) : null;
const changed = JSON.stringify(previousCatalog?.species ?? null) !== JSON.stringify(species);
if (changed) {
  catalog.generatedAt = new Date().toISOString();
  await writeFile(output, JSON.stringify(catalog) + "\n");
}
console.log(JSON.stringify({
  species: catalog.speciesCount, forms: catalog.formCount,
  megaForms: catalog.megaFormCount, bytes: Buffer.byteLength(JSON.stringify(catalog)),
  changed,
}));
