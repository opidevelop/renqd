import { readFile } from "node:fs/promises";
const path = new URL("../public/data/pokemon/catalog.json", import.meta.url);
const catalog = JSON.parse(await readFile(path, "utf8"));
const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(catalog.schemaVersion === 1, "Unsupported catalog schema");
assert(catalog.speciesCount >= 1000, "Catalog must contain at least 1,000 species");
assert(catalog.species.length === catalog.speciesCount, "Species count mismatch");
const ids = new Set(catalog.species.map((item) => item.id));
assert(ids.size === catalog.species.length, "Duplicate species IDs");
assert(catalog.species[0]?.id === 1, "Catalog must start at National Dex #1");
assert(catalog.species.at(-1)?.id >= 1000, "Catalog range is incomplete");
assert(catalog.species.every((item) => item.generation >= 1 && item.generation <= 9), "Generation outside I–IX");
assert(catalog.species.every((item) => item.aliases.length && item.normalizedAliases.length), "Species missing aliases");
assert(catalog.species.every((item) => item.megaForms.every((form) => form.isMega)), "Non-Mega form in Mega list");
assert(catalog.megaFormCount === catalog.species.reduce((sum,item) => sum + item.megaForms.length,0), "Mega count mismatch");
assert(catalog.species.some((item) => item.isLegendary), "Legendary classification missing");
assert(catalog.species.some((item) => item.isMythical), "Mythical classification missing");
assert(catalog.species.some((item) => item.isUltraBeast), "Ultra Beast classification missing");
assert(catalog.species.some((item) => item.isParadox), "Paradox classification missing");
console.log(JSON.stringify({
  valid: true, species: catalog.speciesCount, forms: catalog.formCount,
  megaForms: catalog.megaFormCount,
  generations: [...new Set(catalog.species.map((item) => item.generation))].length,
}));
