export type PokemonForm = {
  id: number;
  slug: string;
  label: string;
  isMega: boolean;
  isDefault: boolean;
  types: string[];
  spriteUrl: string;
  artworkUrl: string;
};

export type PokemonSpecies = {
  id: number;
  slug: string;
  name: string;
  nameEn: string;
  aliases: string[];
  normalizedAliases: string[];
  generation: number;
  types: string[];
  isLegendary: boolean;
  isMythical: boolean;
  isUltraBeast: boolean;
  isParadox: boolean;
  specialCategories: string[];
  spriteUrl: string;
  artworkUrl: string;
  forms: PokemonForm[];
  megaForms: PokemonForm[];
};

export type PokemonCatalog = {
  schemaVersion: number;
  source: string;
  generatedAt?: string;
  speciesCount: number;
  formCount: number;
  megaFormCount: number;
  species: PokemonSpecies[];
};

export type FavouriteSelection = { speciesId: number; formId?: number };
export type FavouriteMatrix = Record<string, FavouriteSelection>;

export const POKEMON_TYPES = [
  "normal", "fire", "water", "electric", "grass", "ice", "fighting", "poison",
  "ground", "flying", "psychic", "bug", "rock", "ghost", "dragon", "dark",
  "steel", "fairy",
] as const;

export const POKEMON_TYPE_LABELS: Record<string, string> = {
  normal: "Normale", fire: "Fuoco", water: "Acqua", electric: "Elettro",
  grass: "Erba", ice: "Ghiaccio", fighting: "Lotta", poison: "Veleno",
  ground: "Terra", flying: "Volante", psychic: "Psico", bug: "Coleottero",
  rock: "Roccia", ghost: "Spettro", dragon: "Drago", dark: "Buio",
  steel: "Acciaio", fairy: "Folletto",
};
export const GENERATION_LABELS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];

export function normalizePokemonName(value: string): string {
  return value.replaceAll("♀", " female ").replaceAll("♂", " male ")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("en").replace(/[^a-z0-9]+/g, "");
}

export function getPokemonCellKey(row: number, column: number): string {
  return "r" + (row + 1) + "-c" + (column + 1);
}

export function isPokemonCompatibleWithFavouriteCell(
  species: PokemonSpecies, row: number, column: number,
): boolean {
  if (row < 0 || row > 9 || column < 0 || column > 21) return false;
  if (column === 21) return row === 9 || species.generation === row + 1;
  if (row < 9 && species.generation !== row + 1) return false;
  if (column < 18) return species.types.includes(POKEMON_TYPES[column]);
  if (column === 18) return species.megaForms.length > 0;
  if (column === 19) return species.isMythical;
  if (column === 20) return species.isLegendary;
  return false;
}

export function searchPokemonSpecies(
  species: PokemonSpecies[], query: string, limit = 50,
): PokemonSpecies[] {
  const normalized = normalizePokemonName(query);
  if (!normalized) return species.slice(0, limit);
  return species.map((entry) => {
    const aliases = (entry.normalizedAliases?.length ? entry.normalizedAliases : entry.aliases.map(normalizePokemonName));
    const exact = aliases.some((alias) => alias === normalized);
    const starts = aliases.some((alias) => alias.startsWith(normalized));
    const contains = aliases.some((alias) => alias.includes(normalized));
    return { entry, score: exact ? 0 : starts ? 1 : contains ? 2 : 3 };
  }).filter((item) => item.score < 3)
    .sort((a,b) => a.score-b.score || a.entry.id-b.entry.id)
    .slice(0,limit).map((item) => item.entry);
}
