import { createClient } from "@/lib/supabase/server";
import { UltimateFavouriteEditor } from "@/components/pokemon/ultimate-favourite";
import { FavouriteMatrix } from "@/lib/pokemon/catalog";

export const dynamic = "force-dynamic";

export default async function UltimateFavouritePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: ranking } = user ? await supabase.from("rankings")
    .select("id,public_slug,status,settings")
    .eq("user_id",user.id).eq("mode","POKEMON_ULTIMATE_FAVOURITE")
    .is("deleted_at",null).order("updated_at",{ascending:false}).limit(1).maybeSingle() : { data: null };
  const settings = (ranking?.settings ?? {}) as { matrix?: FavouriteMatrix };
  return <UltimateFavouriteEditor initialMatrix={settings.matrix ?? {}} initialRankingId={ranking?.id ?? null}
    initialPublicSlug={ranking?.public_slug ?? null} initiallyPublished={ranking?.status === "COMPLETED"}/>;
}
