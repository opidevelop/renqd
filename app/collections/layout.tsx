import "../(platform)/platform.css";
import { requireApprovedUser } from "@/lib/supabase/authorization";

export const dynamic = "force-dynamic";

export default async function CollectionsLayout({ children }: { children: React.ReactNode }) {
  await requireApprovedUser();
  return children;
}
