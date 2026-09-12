import { requireMember } from "@/lib/access";
import { Navigation } from "@/components/navigation";
import { roleLabel } from "@/lib/format";
export const dynamic = "force-dynamic";
export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await requireMember();
  return (
    <div className="app-shell">
      <Navigation
        name={actor.organization.name}
        user={actor.user.name}
        role={roleLabel[actor.role]}
      />
      <div className="workspace">
        <div className="topbar">
          <span>Relacionamento com clientes</span>
          <span className="topbar-note">Um cuidado em cada fase</span>
        </div>
        <main>{children}</main>
        <footer>Principal · Acompanhe cada nova fase.</footer>
      </div>
    </div>
  );
}
