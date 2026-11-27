import { redirect } from "next/navigation";

export default async function ModerationPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string }>;
}) {
  const params = await searchParams;
  const view = ["published", "reported", "trash"].includes((params.view ?? "").toLowerCase())
    ? (params.view ?? "published").toLowerCase()
    : "published";
  const query = params.q ? "&q=" + encodeURIComponent(params.q.slice(0, 100)) : "";
  redirect("/admin?section=moderation&view=" + view + query);
}
