import { PlatformShell } from "@/components/platform-shell";
import "./platform.css";

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <PlatformShell>{children}</PlatformShell>;
}
