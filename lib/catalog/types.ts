export type CatalogCategory = "music" | "games" | "film" | "books" | "sport" | "food" | "travel";
export type CatalogEntity = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  spotifyUrl?: string;
  provider: string;
  payload?: unknown;
};
export type CatalogItem = {
  id: string;
  title: string;
  subtitle?: string;
  imageUrl?: string;
  previewUrl?: string;
  appleMusicUrl?: string;
  spotifyUrl?: string;
  selected: boolean;
  source: "catalog" | "manual";
  payload?: unknown;
};
export interface CatalogProvider {
  id: string;
  supports(category: CatalogCategory, contentType: string): boolean;
  search(query: string, category: CatalogCategory, contentType: string): Promise<CatalogEntity[]>;
  getItems(entity: CatalogEntity, category: CatalogCategory, contentType: string): Promise<Omit<CatalogItem, "selected" | "source">[]>;
}
