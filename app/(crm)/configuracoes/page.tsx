import { db } from "@/lib/db";
import { requireMember, canManage } from "@/lib/access";
import { PageHeader, Badge, Field } from "@/components/ui";
import { ActionForm, Submit } from "@/components/form";
import { roleLabel, datetime } from "@/lib/format";
import { getTransport } from "@/lib/transport";
export default async function Settings() {
  const actor = await requireMember();
  const members = await db.member.findMany({
    where: { organizationId: actor.organizationId },
    include: { user: true },
  });
  const jobs = canManage(actor)
    ? await db.job.findMany({
        where: { organizationId: actor.organizationId },
        orderBy: { createdAt: "desc" },
        take: 12,
      })
    : [];
  return (
    <>
      <PageHeader
        title="Configurações"
        description="Sua loja, sua equipe e as regras de relacionamento."
      />
      <div className="profile-grid">
        <div>
          <section className="panel">
            <div className="panel-heading">
              <h2>A loja</h2>
            </div>
            <div className="panel-body">
              {canManage(actor) ? (
                <ActionForm kind="settings">
                  <Field label="Nome da loja">
                    <input
                      name="name"
                      defaultValue={actor.organization.name}
                      required
                      minLength={2}
                    />
                  </Field>
                  <Submit>Salvar nome</Submit>
                </ActionForm>
              ) : (
                <p>{actor.organization.name}</p>
              )}
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Equipe</h2>
              <Badge>{members.length} pessoas</Badge>
            </div>
            <ul className="simple-list">
              {members.map((m) => (
                <li key={m.id}>
                  <div>
                    <strong>{m.user.name}</strong>
                    <span className="subtext">{m.user.email}</span>
                  </div>
                  <Badge>{roleLabel[m.role]}</Badge>
                </li>
              ))}
            </ul>
            <div className="panel-body">
              <p className="section-note">
                A criação de contas é restrita ao administrador da instalação.
              </p>
            </div>
          </section>
        </div>
        <div>
          <section className="panel">
            <div className="panel-heading">
              <h2>WhatsApp</h2>
              <Badge tone="amber">Não configurado</Badge>
            </div>
            <div className="panel-body">
              <p>Nenhum provedor externo conectado.</p>
              <p className="section-note">
                {getTransport().mode === "mock"
                  ? "Transporte de desenvolvimento ativo: as entregas são simuladas e identificadas no histórico."
                  : "Mensagens aprovadas permanecem na fila até que um transporte esteja disponível."}
              </p>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Modo de automação</h2>
              <Badge tone="pink">Aprovação</Badge>
            </div>
            <div className="panel-body">
              <p>A equipe revisa e aprova o primeiro contato.</p>
              <p className="section-note">
                Uma única mensagem inicial por cliente. Após a resposta, a
                automação para e o atendimento fica com a equipe.
              </p>
            </div>
          </section>
          <section className="panel">
            <div className="panel-heading">
              <h2>Inteligência artificial</h2>
              <Badge>Não configurada</Badge>
            </div>
            <div className="panel-body">
              <p className="section-note">
                Jornadas, pontuação e sugestões funcionam com regras fixas, sem
                depender de IA.
              </p>
            </div>
          </section>
        </div>
      </div>
      {canManage(actor) && (
        <section className="panel">
          <div className="panel-heading">
            <h2>Processamento de jornadas e mensagens</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tarefa</th>
                  <th>Criada em</th>
                  <th>Situação</th>
                  <th>Tentativas</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id}>
                    <td>
                      {j.kind === "JOURNEY"
                        ? "Avaliação de jornadas"
                        : "Primeiro contato"}
                    </td>
                    <td>{datetime(j.createdAt)}</td>
                    <td>
                      {j.finishedAt
                        ? "Concluída"
                        : j.attempts >= 5
                          ? "Requer atenção"
                          : "Pendente"}
                      {j.lastError && (
                        <span className="subtext">{j.lastError}</span>
                      )}
                    </td>
                    <td>{j.attempts}</td>
                    <td>
                      {!j.finishedAt && j.attempts >= 5 && (
                        <ActionForm kind="retry-job" jobId={j.id}>
                          <Submit variant="outline">Tentar novamente</Submit>
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
