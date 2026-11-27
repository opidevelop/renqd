# Pokémon catalog data and artwork

- Structured catalog source: PokéAPI GraphQL v1beta2 at https://graphql.pokeapi.co/v1beta2.
- The sync script reads species IDs, Italian/English localized names and aliases, generation, default types, legendary/mythical flags, varieties and Mega metadata.
- public/data/pokemon/catalog.json is generated from the source; the application does not call the API per Pokémon.
- Ultra Beasts and Paradox groupings are explicit, reviewable species lists in the sync script because the API does not expose them as universal species flags.
- Artwork/sprite URLs point to the PokeAPI sprites repository. Its CC0 dedication does not grant rights to third-party Pokémon characters/artwork; Pokémon IP remains with its respective rights holders.
- Renqd is an unofficial fan project and is not affiliated with or endorsed by Nintendo, Game Freak, Creatures or The Pokémon Company.
- Source completeness and third-party artwork permissions remain explicit technical/legal review items.


## Official Pokémon IP guidance — review required before public release

- The Pokémon Support article “Posso usare nomi e immagini associati a Pokémon in un mio progetto?” (updated 30 January 2026) states that The Pokémon Company is not in a position to authorize Pokémon IP use in projects and asks users not to use Pokémon-related materials in any project: https://support.pokemon.com/hc/it/articles/360000634094-Posso-usare-nomi-e-immagini-associati-a-Pok%C3%A9mon-in-un-mio-progetto
- The PokeAPI sprites repository separately states that the images remain copyrighted by The Pokémon Company, even though the repository itself is distributed under CC0: https://github.com/PokeAPI/sprites/blob/master/LICENCE.txt
- Therefore CC0 does not clear the underlying character artwork, names, designs, trademarks or other Pokémon IP. The non-affiliation notice is not a license.
- Keep this review item open. Do not interpret PokeAPI availability, CC0 dedication, fan-project status or an unofficial disclaimer as permission from the IP owner. Obtain legal advice/permission or replace the protected material before a public/monetized release.
