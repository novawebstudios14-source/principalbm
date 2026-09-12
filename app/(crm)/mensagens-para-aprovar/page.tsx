import { db } from "@/lib/db";
import { requireMember, customerScope } from "@/lib/access";
import { PageHeader, CustomerLink, Badge, Empty, Field } from "@/components/ui";
import { ActionForm, Submit } from "@/components/form";
export default async function Approvals() {
  const actor = await requireMember();
  const rows = await db.opportunity.findMany({
    where: { customer: customerScope(actor), status: "APPROVAL" },
    include: { customer: { include: { owner: { include: { user: true } } } } },
    orderBy: { score: "desc" },
    take: 200,
  });
  return (
    <>
      <PageHeader
        title="Mensagens para aprovar"
        description={`${rows.length} mensagens · Revise o contexto e personalize o primeiro contato.`}
      />
      <div className="notice">
        WhatsApp não configurado. As aprovações são salvas na fila. Nenhum envio
        externo será apresentado como concluído.
      </div>
      {!rows.length && (
        <section className="panel">
          <Empty
            title="Tudo revisado por aqui"
            detail="Novas oportunidades aparecem quando uma cliente chega a um marco da jornada."
          />
        </section>
      )}
      {rows.map((op) => (
        <article className="approval-card" key={op.id}>
          <div>
            <CustomerLink
              id={op.customerId}
              name={op.customer.name}
              sub={`Responsável: ${op.customer.owner.user.name}`}
            />
            <h3>{op.reason}</h3>
            <p>{op.action}</p>
            <Badge tone={op.priority === "Alta" ? "pink" : "amber"}>
              {op.priority} prioridade · Score {op.score}
            </Badge>
            <p className="section-note">{op.scoreReason}</p>
            {!op.customer.whatsappConsent && (
              <p className="section-note">
                Falta registrar a permissão de contato no perfil.
              </p>
            )}
          </div>
          <div>
            {actor.role !== "MARKETING" ? (
              <>
                <ActionForm kind="approve" opportunityId={op.id}>
                  <Field label="Primeira mensagem sugerida">
                    <textarea
                      name="body"
                      required
                      minLength={10}
                      maxLength={1500}
                      defaultValue={op.suggestedMessage}
                      rows={5}
                    />
                  </Field>
                  <div className="form-actions">
                    <Submit>Aprovar e colocar na fila</Submit>
                    <button
                      type="submit"
                      name="kind"
                      value="draft"
                      className="button-link secondary"
                    >
                      Salvar edição
                    </button>
                  </div>
                </ActionForm>
                <ActionForm
                  kind="ignore"
                  opportunityId={op.id}
                  className="inline"
                >
                  <Submit variant="ghost">Ignorar oportunidade</Submit>
                </ActionForm>
              </>
            ) : (
              <p>{op.suggestedMessage}</p>
            )}
          </div>
        </article>
      ))}
    </>
  );
}
