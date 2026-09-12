import Link from "next/link";
import { Inbox } from "lucide-react";
import { initials, statusLabel } from "@/lib/format";
export function PageHeader({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      <div className="header-actions">{children}</div>
    </header>
  );
}
export function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: string;
}) {
  return <span className={`badge ${tone}`}>{children}</span>;
}
export function Status({ value }: { value: keyof typeof statusLabel }) {
  return (
    <Badge
      tone={
        value === "SERVICE" || value === "HUMAN_SERVICE"
          ? "blue"
          : value === "CONVERTED"
            ? "green"
            : value === "APPROVAL"
              ? "pink"
              : "neutral"
      }
    >
      {statusLabel[value]}
    </Badge>
  );
}
export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {initials(name)}
    </span>
  );
}
export function CustomerLink({
  id,
  name,
  sub,
}: {
  id: string;
  name: string;
  sub?: string;
}) {
  return (
    <Link href={`/clientes/${id}`} className="person">
      <Avatar name={name} />
      <span>
        <strong>{name}</strong>
        {sub && <small>{sub}</small>}
      </span>
    </Link>
  );
}
export function Empty({ title, detail }: { title: string; detail?: string }) {
  return (
    <div className="empty">
      <Inbox size={30} />
      <h3>{title}</h3>
      {detail && <p>{detail}</p>}
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
