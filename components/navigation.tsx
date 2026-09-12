"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Target,
  MessageSquare,
  Headphones,
  ListFilter,
  Settings,
  Heart,
  LogOut,
} from "lucide-react";
import { createAuthClient } from "better-auth/react";
const client = createAuthClient();
const items = [
  ["/dashboard", "Visão geral", LayoutDashboard],
  ["/clientes", "Clientes", Users],
  ["/oportunidades", "Oportunidades", Target],
  ["/mensagens-para-aprovar", "Mensagens para aprovar", MessageSquare],
  ["/atendimento", "Atendimento", Headphones],
  ["/segmentos", "Segmentos", ListFilter],
  ["/configuracoes", "Configurações", Settings],
] as const;
export function Navigation({
  name,
  user,
  role,
}: {
  name: string;
  user: string;
  role: string;
}) {
  const pathname = usePathname();
  return (
    <aside className="sidebar">
      <Link href="/dashboard" className="brand">
        <span className="brand-mark">
          <Heart size={23} />
        </span>
        <span>
          principal<small>CRM · MAMÃE & BEBÊ</small>
        </span>
      </Link>
      <div className="workspace-label">{name}</div>
      <nav aria-label="Navegação principal">
        {items.map(([href, label, Icon]) => (
          <Link
            key={href}
            href={href}
            className={pathname.startsWith(href) ? "active" : ""}
            aria-current={pathname.startsWith(href) ? "page" : undefined}
          >
            <Icon size={19} />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <span className="user-circle">{user[0]}</span>
        <div>
          <strong>{user}</strong>
          <small>{role}</small>
        </div>
        <button
          aria-label="Sair"
          title="Sair"
          onClick={async () => {
            await client.signOut();
            window.location.href = "/login";
          }}
        >
          <LogOut size={18} />
        </button>
      </div>
    </aside>
  );
}
