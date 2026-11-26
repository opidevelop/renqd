import { redirect } from "next/navigation";

export default function LegacyPokemonProfilePage() {
  redirect("/profile?section=pokemon");
}
