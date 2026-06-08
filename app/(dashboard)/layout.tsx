import { TopNavigation } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { requireUserProfile } from "@/lib/auth/session";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUserProfile();

  return (
    <div className="min-h-screen bg-background">
      <div className="min-w-0">
        <Topbar name={profile.full_name} role={profile.role} />
        <TopNavigation />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
