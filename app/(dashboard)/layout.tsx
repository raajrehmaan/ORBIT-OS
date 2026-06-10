import { TopNavigation } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <div className="min-w-0">
        <Topbar
          name="Raaj"
          role="admin"
          organisationName="OrbitOS"
          logoUrl={null}
        />

        <TopNavigation />

        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
