import { notFound } from "next/navigation";
import Link from "next/link";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { requireMember, customerScope } from "@/lib/access";
import {
  PageHeader,
  Avatar,
  Field,
  Badge,
  Status,
  Empty,
} from "@/components/ui";
import { ActionForm, Submit } from "@/components/form";
import { CustomerForm } from "@/components/customer-form";
import { date, datetime, money, statusLabel } from "@/lib/format";
import { pregnancyStage, ageLabel } from "@/lib/rules";
import { canSimulate } from "@/lib/transport";
export default async function Profile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params,
    actor = await requireMember();
  const write = actor.role !== "MARKETING";
  const c = await db.customer.findFirst({
    where: { ...customerScope(actor), id },
    include: {
      owner: { include: { user: true } },
      pregnancies: { orderBy: { createdAt: "desc" } },
      children: { orderBy: { birthDate: "desc" } },
      purchases: { orderBy: { date: "desc" } },
      opportunities: { orderBy: { createdAt: "desc" } },
      timeline: { orderBy: { createdAt: "desc" }, take: 100 },
      conversation: {
        include: { messages: { orderBy: { createdAt: "asc" }, take: 100 } },
      },
    },
  });
  if (!c) notFound();
  const members = await db.member.findMany({
    where: {
      organizationId: actor.organizationId,
      role: { not: "MARKETING" },
      ...(actor.role === "SELLER" ? { id: actor.id } : {}),
    },
    include: { user: true },
  });
  const openOps = c.opportunities.filter(
    (op) => !["CONVERTED", "LOST", "IGNORED"].includes(op.status),
  );
  return (
    <>
      <Link href="/clientes" className="text-link">
        ← Todas as clientes
      </Link>
      <PageHeader
        title={c.name}
        description={`Cliente desde ${date(c.createdAt)} · Responsável: ${c.owner.user.name}`}
      >
        {write && (
          <ActionForm kind="evaluate" customerId={id}>
            <Submit variant="outline">Avaliar jornada</Submit>
          </ActionForm>
        )}
      </PageHeader>
      <div className="profile-grid">
        <div>
          <section className="panel">
            <div className="panel-heading">
              <div className="profile-info">
                <Avatar name={c.name} />
                <div>
                  <h2>Informações da cliente</h2>
                  <p>{c.source || "Origem não informada"}</p>
                </div>
              </div>
            </div>
            <div className="panel-body">
              <dl className="details">
                <div>
                  <dt>WhatsApp</dt>
                  <dd>+{c.phone}</dd>
                </div>
                <div>
                  <dt>E-mail</dt>
                  <dd>{c.email || "Não informado"}</dd>
                </div>
                <div>
                  <dt>Cidade</dt>
                  <dd>{c.city || "Não informada"}</dd>
                </div>
                <div>
                  <dt>Nascimento</dt>
                  <dd>{c.birthDate ? date(c.birthDate) : "Não informado"}</dd>
                </div>
                <div>
                  <dt>Compras acumuladas</dt>
                  <dd>
                    {money(
                      c.purchases.reduce((n, p) => n + Number(p.total), 0),
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Permissão de contato</dt>
                  <dd>
                    <Badge tone={c.whatsappConsent ? "green" : "amber"}>
                      {c.whatsappConsent
                        ? "WhatsApp autorizado"
                        : "Não registrada"}
                    </Badge>
                  </dd>
                </div>
              </dl>
              {c.notes && <p className="section-note">{c.notes}</p>}
            </div>
            {write && (
              <details className="expandable">
                <summary>Editar cadastro</summary>
                <div className="panel-body">
                  <CustomerForm
                    customer={c}
                    members={members}
                    defaultOwner={actor.id}
                  />
                </div>
              </details>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Gestação</h2>
            </div>
            <div className="panel-body">
              {!c.pregnancies.length && (
                <p className="muted">Nenhuma gestação registrada.</p>
              )}
              {c.pregnancies.map((p) => {
                const stage = pregnancyStage(p.dueDate);
                return (
                  <div key={p.id}>
                    <div className="journey-card">
                      <div>
                        <h3>DPP · {date(p.dueDate)}</h3>
                        <p>
                          {p.status === "ACTIVE"
                            ? `${stage.week} semanas · ${stage.trimester}º trimestre · mês aproximado ${stage.month}`
                            : p.status === "BORN"
                              ? "Bebê nasceu"
                              : "Gestação encerrada"}
                        </p>
                        {p.notes && <p>{p.notes}</p>}
                      </div>
                      <Badge tone="pink">
                        {stage.days >= 0
                          ? `${stage.days} dias para a DPP`
                          : "DPP ultrapassada"}
                      </Badge>
                    </div>
                    {write && (
                      <details className="expandable">
                        <summary>Atualizar gestação</summary>
                        <div className="panel-body">
                          <ActionForm
                            kind="pregnancy"
                            customerId={id}
                            pregnancyId={p.id}
                          >
                            <Field label="DPP">
                              <input
                                type="date"
                                name="dueDate"
                                required
                                defaultValue={p.dueDate
                                  .toISOString()
                                  .slice(0, 10)}
                              />
                            </Field>
                            <Field label="Situação">
                              <select name="status" defaultValue={p.status}>
                                <option value="ACTIVE">Em andamento</option>
                                <option value="BORN">Bebê nasceu</option>
                                <option value="ENDED">Encerrada</option>
                              </select>
                            </Field>
                            <Field label="Observações">
                              <textarea name="notes" defaultValue={p.notes} />
                            </Field>
                            <Submit>Atualizar gestação</Submit>
                          </ActionForm>
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
            {write && !c.pregnancies.some((p) => p.status === "ACTIVE") && (
              <details className="expandable">
                <summary>Registrar gestação</summary>
                <div className="panel-body">
                  <ActionForm kind="pregnancy" customerId={id} status="ACTIVE">
                    <Field label="Data provável do parto (DPP) *">
                      <input type="date" name="dueDate" required />
                    </Field>
                    <Field label="Observações">
                      <textarea name="notes" />
                    </Field>
                    <Submit>Salvar gestação</Submit>
                  </ActionForm>
                </div>
              </details>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Filhos</h2>
              <Badge>{c.children.length} registros</Badge>
            </div>
            <div className="panel-body">
              {!c.children.length && (
                <p className="muted">Nenhum filho registrado.</p>
              )}
              {c.children.map((ch) => (
                <div className="journey-card" key={ch.id}>
                  <div>
                    <h3>{ch.name}</h3>
                    <p>Nascimento: {date(ch.birthDate)}</p>
                    <p>
                      {[
                        ch.gender,
                        ch.clothingSize && `Roupa ${ch.clothingSize}`,
                        ch.shoeSize && `Calçado ${ch.shoeSize}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {ch.notes && <p>{ch.notes}</p>}
                  </div>
                  <Badge tone="blue">{ageLabel(ch.birthDate)}</Badge>
                </div>
              ))}
            </div>
            {write && (
              <details className="expandable">
                <summary>Registrar filho</summary>
                <div className="panel-body">
                  <ActionForm kind="child" customerId={id}>
                    <div className="fields">
                      <Field label="Nome *">
                        <input name="name" required maxLength={120} />
                      </Field>
                      <Field label="Nascimento *">
                        <input name="birthDate" type="date" required />
                      </Field>
                      <Field label="Gênero (opcional)">
                        <select name="gender">
                          <option value="">Não informado</option>
                          <option>Feminino</option>
                          <option>Masculino</option>
                          <option>Outro</option>
                        </select>
                      </Field>
                      <Field label="Tamanho da roupa">
                        <input name="clothingSize" />
                      </Field>
                      <Field label="Número do calçado">
                        <input name="shoeSize" />
                      </Field>
                      <Field label="Observações">
                        <textarea name="notes" />
                      </Field>
                    </div>
                    <Submit>Salvar filho</Submit>
                  </ActionForm>
                </div>
              </details>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Compras</h2>
              <Badge>
                {money(c.purchases.reduce((n, p) => n + Number(p.total), 0))}
              </Badge>
            </div>
            {c.purchases.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data / itens</th>
                      <th>Vendedor</th>
                      <th>Valor</th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.purchases.map((p) => (
                      <tr key={p.id}>
                        <td>
                          {date(p.date)}
                          <span className="subtext">{p.items}</span>
                        </td>
                        <td>{p.sellerName}</td>
                        <td>{money(p.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="panel-body muted">Nenhuma compra registrada.</div>
            )}
            {write && (
              <details className="expandable" id="registrar-venda">
                <summary>Registrar compra / converter oportunidade</summary>
                <div className="panel-body">
                  <ActionForm
                    kind="purchase"
                    customerId={id}
                    requestKey={randomUUID()}
                  >
                    <div className="fields">
                      <Field label="Data *">
                        <input
                          name="date"
                          type="date"
                          required
                          defaultValue={new Date().toISOString().slice(0, 10)}
                        />
                      </Field>
                      <Field label="Valor total (R$) *">
                        <input
                          name="total"
                          type="number"
                          min="0.01"
                          max="999999999"
                          step="0.01"
                          required
                        />
                      </Field>
                      <Field label="Itens comprados *">
                        <textarea name="items" required />
                      </Field>
                      <Field label="Categoria">
                        <input name="category" />
                      </Field>
                      <div className="full">
                        <Field label="Oportunidade convertida (opcional)">
                          <select name="opportunityId">
                            <option value="">
                              Compra sem oportunidade vinculada
                            </option>
                            {openOps.map((op) => (
                              <option value={op.id} key={op.id}>
                                {op.reason}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    </div>
                    <Submit>Registrar compra</Submit>
                  </ActionForm>
                </div>
              </details>
            )}
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Oportunidades</h2>
            </div>
            <div className="panel-body">
              {!c.opportunities.length && (
                <p className="muted">
                  Avalie a jornada para identificar oportunidades.
                </p>
              )}
              {c.opportunities.map((op) => (
                <div key={op.id} className="journey-card">
                  <div>
                    <h3>{op.reason}</h3>
                    <p>{op.action}</p>
                    <p>
                      Score {op.score} · {op.scoreReason}
                    </p>
                    <Status value={op.status} />
                    <div className="form-actions">
                      {op.status === "APPROVAL" && (
                        <Link
                          className="text-link"
                          href="/mensagens-para-aprovar"
                        >
                          Revisar mensagem →
                        </Link>
                      )}
                      {write && openOps.some((o) => o.id === op.id) && (
                        <>
                          <ActionForm kind="lost" opportunityId={op.id}>
                            <Submit variant="ghost">Marcar perdida</Submit>
                          </ActionForm>
                          <ActionForm kind="ignore" opportunityId={op.id}>
                            <Submit variant="ghost">Ignorar</Submit>
                          </ActionForm>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
        <div>
          <section className="panel">
            <div className="panel-heading">
              <h2>Conversa e atendimento</h2>
              {c.conversation && <Status value={c.conversation.status} />}
            </div>
            <div className="panel-body">
              {c.conversation?.automationStopped && (
                <div className="notice">
                  Automação interrompida. A continuidade do atendimento é
                  humana.
                </div>
              )}
              {c.conversation?.messages.length ? (
                c.conversation.messages.map((m) => (
                  <div
                    key={m.id}
                    className={`message-bubble ${m.direction === "OUTBOUND" ? "outbound" : ""}`}
                  >
                    <p>{m.body}</p>
                    <small>
                      {m.direction === "OUTBOUND" ? "Loja" : "Cliente"} ·{" "}
                      {datetime(m.createdAt)} · {statusLabel[m.status]}
                    </small>
                    {write && canSimulate() && m.status === "QUEUED" && (
                      <ActionForm kind="simulate-send" messageId={m.id}>
                        <Submit variant="ghost">
                          Processar transporte de teste
                        </Submit>
                      </ActionForm>
                    )}
                  </div>
                ))
              ) : (
                <p className="muted">Nenhuma mensagem registrada.</p>
              )}
              {write && canSimulate() && (
                <details className="expandable">
                  <summary>Simular resposta (desenvolvimento)</summary>
                  <ActionForm kind="simulate-reply" customerId={id}>
                    <Field label="Resposta simulada da cliente">
                      <textarea name="body" required maxLength={4000} />
                    </Field>
                    <Submit variant="outline">
                      Registrar resposta simulada
                    </Submit>
                  </ActionForm>
                </details>
              )}
              {write && c.conversation?.status === "HUMAN_SERVICE" && (
                <ActionForm kind="close-service" customerId={id}>
                  <Submit variant="outline">Encerrar atendimento</Submit>
                </ActionForm>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Histórico da cliente</h2>
              <Badge>Últimos 100 eventos</Badge>
            </div>
            {write && (
              <div className="panel-body">
                <ActionForm kind="note" customerId={id}>
                  <Field label="Registrar nota de atendimento">
                    <textarea
                      name="notes"
                      placeholder="O que foi conversado com a cliente?"
                      required
                      maxLength={2000}
                    />
                  </Field>
                  <Submit variant="outline">Adicionar nota</Submit>
                </ActionForm>
              </div>
            )}
            <div className="timeline">
              {c.timeline.map((t) => (
                <article className="timeline-item" key={t.id}>
                  <small>
                    {datetime(t.createdAt)}
                    {t.actorName ? ` · ${t.actorName}` : ""}
                  </small>
                  <div>
                    <strong>{t.title}</strong>
                    {t.detail && <p>{t.detail}</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
