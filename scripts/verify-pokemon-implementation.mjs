import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const solo = read("components/pokemon/name-em-all.tsx");
const multiplayer = read("components/pokemon/multiplayer-game.tsx");
const sound = read("lib/pokemon/sounds.ts");
const soundPreference = read("components/pokemon/use-pokemon-sound-preference.ts");
const dailyGame = read("components/pokemon/daily-game.tsx");
const socialAction = read("app/(platform)/pokemon/name-em-all/actions.ts");
const visibilityMigration = read("supabase/migrations/20261124205653_pokemon_name_em_all_rls_visibility_guard.sql");
const commentLikeMigration = read("supabase/migrations/20261124205731_pokemon_comment_likes_block_visibility_guard.sql");
const catalog = JSON.parse(read("public/data/pokemon/catalog.json"));

for (const effect of ["correct", "incorrect", "unlock", "complete"]) {
  assert.match(sound, new RegExp(`\\b${effect}:\\s*\\[`), `Missing ${effect} sound pattern`);
}
assert.match(soundPreference, /getServerSnapshot\(\)\s*\{\s*return true;/, "Sound must be enabled by default");
assert.match(solo, /usePokemonSoundPreference/);
assert.match(multiplayer, /usePokemonSoundPreference/);
assert.match(solo, /Effetti sonori/);
assert.match(multiplayer, /Effetti sonori/);
assert.match(solo, /completedGenerationKey/);
assert.match(multiplayer, /completedGenerationKey/);
assert.match(solo, /pokemon-nae-section-nav/);
assert.match(multiplayer, /pokemon-nae-section-nav/);
assert.match(multiplayer, /special-mega/);
assert.match(multiplayer, /megaForms\.map/);
assert.match(multiplayer, /pokemon-nae-detail-forms/);
assert.match(multiplayer, /Già indovinato da/);
assert.match(multiplayer, /pokemon-nae-leaderboard-toggle/);
assert.match(socialAction, /discoveredByName/);
assert.match(visibilityMigration, /parent\.id = ranking_comments\.parent_comment_id/);
assert.match(visibilityMigration, /can_view_pokemon_name_em_all_result\(r\.id\)/);
assert.match(commentLikeMigration, /not private\.is_user_blocked_with\(user_id\)/);
assert.match(dailyGame, /Aprire o giocare nell’iframe non modifica automaticamente lo stato/);
assert.match(dailyGame, /onLoad=\{\(\) => \{ setLoaded\(true\); setTimedOut\(false\); \}\}/);
assert.equal(catalog.species.length, 1025, "Unexpected catalog species count");
assert.equal(catalog.species.reduce((sum, item) => sum + item.forms.length, 0), 326, "Unexpected form count");
assert.equal(catalog.species.reduce((sum, item) => sum + item.megaForms.length, 0), 97, "Unexpected Mega form count");

console.log(JSON.stringify({ valid: true, species: catalog.species.length, forms: 326, megaForms: 97 }));
