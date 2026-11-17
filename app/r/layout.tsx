import { requireApprovedUser } from "@/lib/supabase/authorization";
import "../(platform)/platform.css";

export const dynamic = "force-dynamic";

export default async function PublicRenqLayout({ children }: { children: React.ReactNode }) {
  await requireApprovedUser();
  return children;
}
