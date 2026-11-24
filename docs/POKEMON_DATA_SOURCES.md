# Pokémon catalog data and artwork

- Structured catalog source: PokéAPI GraphQL v1beta2 at https://graphql.pokeapi.co/v1beta2.
- The sync script reads species IDs, Italian/English localized names and aliases, generation, default types, legendary/mythical flags, varieties and Mega metadata.
- public/data/pokemon/catalog.json is generated from the source; the application does not call the API per Pokémon.
- Ultra Beasts and Paradox groupings are explicit, reviewable species lists in the sync script because the API does not expose them as universal species flags.
- Artwork/sprite URLs point to the PokeAPI sprites repository. Its CC0 dedication does not grant rights to third-party Pokémon characters/artwork; Pokémon IP remains with its respective rights holders.
- Renqd is an unofficial fan project and is not affiliated with or endorsed by Nintendo, Game Freak, Creatures or The Pokémon Company.
- Source completeness and third-party artwork permissions remain explicit technical/legal review items.
