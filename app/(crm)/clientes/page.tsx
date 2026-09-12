import Link from "next/link";
import { db } from "@/lib/db";
import { requireMember, customerScope } from "@/lib/access";
import { segmentWhere, segments } from "@/lib/queries";
import { PageHeader, CustomerLink, Badge, Empty } from "@/components/ui";
import { CustomerForm } from "@/components/customer-form";
import { pregnancyStage, ageLabel } from "@/lib/rules";
import { date } from "@/lib/format";
export default async function Customers({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams,
    actor = await requireMember();
  const q = (params.q ?? "").slice(0, 120);
  const page = Math.max(1, Math.min(100000, Number(params.page) || 1));
  const where = {
    AND: [
      customerScope(actor),
      segmentWhere(params.segment ?? ""),
      ...(params.owner ? [{ ownerId: params.owner }] : []),
      ...(q
        ? [
            {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { phone: { contains: q } },
              ],
            },
          ]
        : []),
    ],
  };
  const [customers, count, members] = await Promise.all([
    db.customer.findMany({
      where,
      include: {
        owner: { include: { user: true } },
        pregnancies: { where: { status: "ACTIVE" } },
        children: true,
        purchases: { orderBy: { date: "desc" }, take: 1 },
      },
      orderBy:
        params.sort === "recent"
          ? { createdAt: "desc" as const }
          : {
              name:
                params.sort === "desc" ? ("desc" as const) : ("asc" as const),
            },
      take: 30,
      skip: (page - 1) * 30,
    }),
    db.customer.count({ where }),
    db.member.findMany({
      where: {
        organizationId: actor.organizationId,
        role: { not: "MARKETING" },
        ...(actor.role === "SELLER" ? { id: actor.id } : {}),
      },
      include: { user: true },
    }),
  ]);
  const pageHref = (p: number) =>
    `/clientes?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter((x): x is [string, string] => x[1] !== undefined)), page: String(p) })}`;
  return (
    <>
      <PageHeader
        title="Clientes"
        description="Cada família tem uma história. Tenha o contexto sempre por perto."
      />
      {actor.role !== "MARKETING" && (
        <details className="panel expandable" open={params.novo === "1"}>
          <summary>Nova cliente</summary>
          <div className="panel-body">
            <CustomerForm members={members} defaultOwner={actor.id} />
          </div>
        </details>
      )}
      <form className="filterbar">
        <input
          aria-label="Buscar clientes"
          name="q"
          placeholder="Buscar por nome ou telefone…"
          defaultValue={q}
        />
        <select
          aria-label="Filtrar por fase"
          name="segment"
          defaultValue={params.segment ?? ""}
        >
          <option value="">Todas as fases</option>
          {segments.map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="owner"
          aria-label="Filtrar por responsável"
          defaultValue={params.owner ?? ""}
        >
          <option value="">Todos os responsáveis</option>
          {members.map((m) => (
            <option key={m.id} value={m.id}>
              {m.user.name}
            </option>
          ))}
        </select>
        <select
          name="sort"
          aria-label="Ordenação"
          defaultValue={params.sort ?? "asc"}
        >
          <option value="asc">Nome A–Z</option>
          <option value="desc">Nome Z–A</option>
          <option value="recent">Mais recentes</option>
        </select>
        <button className="button-link secondary">Filtrar</button>
        <Link className="text-link" href="/clientes">
          Limpar
        </Link>
        <span className="count">{count} clientes</span>
      </form>
      <section className="panel">
        {customers.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Fase da família</th>
                  <th>Responsável</th>
                  <th>Última compra</th>
                  <th>Cidade</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <CustomerLink
                        id={c.id}
                        name={c.name}
                        sub={`+${c.phone}`}
                      />
                    </td>
                    <td>
                      <div className="pill-list">
                        {c.pregnancies.map((p) => (
                          <Badge key={p.id} tone="pink">
                            Gestante · {pregnancyStage(p.dueDate).week} semanas
                          </Badge>
                        ))}
                        {c.children.map((ch) => (
                          <Badge key={ch.id} tone="blue">
                            {ch.name} · {ageLabel(ch.birthDate)}
                          </Badge>
                        ))}
                        {!c.pregnancies.length && !c.children.length && (
                          <span className="muted">Fase não informada</span>
                        )}
                      </div>
                    </td>
                    <td>{c.owner.user.name}</td>
                    <td>
                      {c.purchases[0]
                        ? date(c.purchases[0].date)
                        : "Sem compras"}
                    </td>
                    <td>{c.city || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty
            title="Nenhuma cliente encontrada"
            detail="Cadastre uma cliente ou ajuste os filtros de busca."
          />
        )}
        {count > 30 && (
          <div className="pagination">
            {page > 1 && <Link href={pageHref(page - 1)}>← Anterior</Link>}
            <span>
              Página {page} de {Math.ceil(count / 30)}
            </span>
            {page * 30 < count && (
              <Link href={pageHref(page + 1)}>Próxima →</Link>
            )}
          </div>
        )}
      </section>
    </>
  );
}
