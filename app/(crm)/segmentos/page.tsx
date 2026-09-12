import Link from "next/link";
import { db } from "@/lib/db";
import { requireMember, customerScope } from "@/lib/access";
import { segments, segmentWhere } from "@/lib/queries";
import { PageHeader } from "@/components/ui";
export default async function Segments() {
  const actor = await requireMember();
  const counts = await Promise.all(
    segments.map(([key]) =>
      db.customer.count({
        where: { AND: [customerScope(actor), segmentWhere(key)] },
      }),
    ),
  );
  return (
    <>
      <PageHeader
        title="Segmentos"
        description="Grupos que se atualizam com a jornada e o histórico de cada família."
      />
      <div className="segment-grid">
        {segments.map(([key, label, description], i) => (
          <Link
            className="segment-card"
            href={`/clientes?segment=${key}`}
            key={key}
          >
            <h2>{label}</h2>
            <strong>
              {counts[i]} <small className="muted">clientes</small>
            </strong>
            <p>{description}</p>
            <span className="text-link">Ver clientes →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
