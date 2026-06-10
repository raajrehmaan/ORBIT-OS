import { TopNavigation } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { requireUserProfile } from "@/lib/auth/session";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const profile = await requireUserProfile();
  const supabase = await createSupabaseServerClient();
  const { data: organisation } = profile.organisation_id
    ? await supabase.from("organisations").select("name, logo_path").eq("id", profile.organisation_id).maybeSingle()
    : { data: null };
  const logoUrl = organisation?.logo_path
    ? (await supabase.storage.from("organisation-assets").createSignedUrl(organisation.logo_path, 60 * 10)).data?.signedUrl ?? null
    : null;

  return (
    <div className="min-h-screen bg-background">
      <div className="min-w-0">
        <Topbar name={profile.full_name} role={profile.role} organisationName={organisation?.name} logoUrl={logoUrl} />
        <TopNavigation />
        <main className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">{children}</main>
      </div>
    </div>
  );
}
