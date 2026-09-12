import { db } from "./db";
import type { Prisma, Role } from "@prisma/client";
import { detectEvents, scoreEvent, suggestMessage } from "./rules";
type Tx = Prisma.TransactionClient;
export type WorkflowActor = {
  id: string;
  organizationId: string;
  role: Role;
  name: string;
};
export async function lockCustomer(
  tx: Tx,
  organizationId: string,
  customerId: string,
) {
  await tx.$queryRaw`SELECT id FROM "Customer" WHERE id=${customerId} AND "organizationId"=${organizationId} FOR UPDATE`;
}
export async function authorizedCustomer(
  tx: Tx,
  actor: WorkflowActor,
  customerId: string,
) {
  if (actor.role === "MARKETING")
    throw new Error("Seu perfil permite somente consulta.");
  await lockCustomer(tx, actor.organizationId, customerId);
  const c = await tx.customer.findFirst({
    where: {
      id: customerId,
      organizationId: actor.organizationId,
      ...(actor.role === "SELLER" ? { ownerId: actor.id } : {}),
    },
  });
  if (!c) throw new Error("Cliente não encontrado ou sem permissão.");
  return c;
}
export async function timeline(
  tx: Tx,
  organizationId: string,
  customerId: string,
  type: string,
  title: string,
  detail?: string,
  actorName?: string,
) {
  return tx.timelineEvent.create({
    data: { organizationId, customerId, type, title, detail, actorName },
  });
}
export async function evaluateCustomer(
  organizationId: string,
  customerId: string,
  now = new Date(),
) {
  return db.$transaction(
    async (tx) => {
      await lockCustomer(tx, organizationId, customerId);
      const c = await tx.customer.findFirst({
        where: { id: customerId, organizationId },
        include: {
          pregnancies: true,
          children: true,
          purchases: true,
          conversation: true,
        },
      });
      if (!c) return 0;
      let count = 0;
      for (const event of detectEvents(c, now)) {
        const existing = await tx.journeyEvent.findUnique({
          where: { organizationId_key: { organizationId, key: event.key } },
        });
        if (existing) continue;
        const record = await tx.journeyEvent.create({
          data: {
            organizationId,
            customerId,
            key: event.key,
            rule: event.rule,
            reason: event.reason,
            occurredAt: event.occurredAt,
          },
        });
        const blocked =
          c.conversation?.automationStopped ||
          !!c.conversation?.firstOutboundAt;
        await tx.opportunity.create({
          data: {
            organizationId,
            customerId,
            eventId: record.id,
            reason: event.reason,
            action: event.action,
            category: event.category,
            ...scoreEvent(event, c.purchases, now),
            suggestedMessage: suggestMessage(c.name, event),
            status: blocked ? "REVIEW" : "APPROVAL",
          },
        });
        await timeline(tx, organizationId, customerId, "JOURNEY", event.reason);
        await timeline(
          tx,
          organizationId,
          customerId,
          "OPPORTUNITY",
          "Oportunidade criada",
          `${event.reason} · ${event.category}`,
        );
        count++;
      }
      return count;
    },
    { timeout: 20000 },
  );
}
export async function approveMessage(
  actor: WorkflowActor,
  opportunityId: string,
  body: string,
) {
  if (body.trim().length < 10 || body.length > 1500)
    throw new Error("A mensagem deve ter entre 10 e 1.500 caracteres.");
  return db.$transaction(async (tx) => {
    const op = await tx.opportunity.findFirst({
      where: { id: opportunityId, organizationId: actor.organizationId },
    });
    if (!op) throw new Error("Oportunidade não encontrada.");
    const customer = await authorizedCustomer(tx, actor, op.customerId);
    const fresh = await tx.opportunity.findUniqueOrThrow({
      where: { id: op.id },
    });
    if (fresh.status !== "APPROVAL")
      throw new Error("Esta oportunidade já saiu da fila de aprovação.");
    if (!customer.whatsappConsent)
      throw new Error(
        "Registre a permissão de contato por WhatsApp no perfil da cliente.",
      );
    const conversation = await tx.conversation.upsert({
      where: { customerId: customer.id },
      create: { organizationId: actor.organizationId, customerId: customer.id },
      update: {},
    });
    if (conversation.automationStopped || conversation.firstOutboundAt)
      throw new Error(
        "O primeiro contato já foi aprovado ou a cliente respondeu. Continue o atendimento humano.",
      );
    const message = await tx.message.create({
      data: {
        organizationId: actor.organizationId,
        customerId: customer.id,
        conversationId: conversation.id,
        opportunityId: op.id,
        direction: "OUTBOUND",
        body: body.trim(),
        status: "QUEUED",
        approvedBy: actor.name,
        firstOutboundKey: conversation.id,
      },
    });
    await tx.conversation.update({
      where: { id: conversation.id },
      data: { firstOutboundAt: new Date(), status: "QUEUED" },
    });
    await tx.opportunity.update({
      where: { id: op.id },
      data: { suggestedMessage: body.trim(), status: "REVIEW" },
    });
    await tx.opportunity.updateMany({
      where: {
        organizationId: actor.organizationId,
        customerId: customer.id,
        id: { not: op.id },
        status: "APPROVAL",
      },
      data: { status: "REVIEW" },
    });
    await tx.job.create({
      data: {
        organizationId: actor.organizationId,
        key: `send:${message.id}`,
        kind: "SEND",
        subjectId: message.id,
      },
    });
    await timeline(
      tx,
      actor.organizationId,
      customer.id,
      "APPROVAL",
      `Mensagem aprovada por ${actor.name}`,
      body.trim(),
      actor.name,
    );
    await timeline(
      tx,
      actor.organizationId,
      customer.id,
      "QUEUED",
      "Primeiro contato na fila",
      "O envio depende do transporte configurado.",
    );
    return message;
  });
}
export async function receiveReply(input: {
  organizationId: string;
  phone: string;
  providerId: string;
  body: string;
}) {
  return db.$transaction(async (tx) => {
    const c = await tx.customer.findUnique({
      where: {
        organizationId_phone: {
          organizationId: input.organizationId,
          phone: input.phone,
        },
      },
    });
    if (!c) throw new Error("Telefone não vinculado a uma cliente.");
    await lockCustomer(tx, input.organizationId, c.id);
    const duplicate = await tx.message.findUnique({
      where: {
        organizationId_providerId: {
          organizationId: input.organizationId,
          providerId: input.providerId,
        },
      },
    });
    if (duplicate) return duplicate;
    const conversation = await tx.conversation.upsert({
      where: { customerId: c.id },
      create: {
        organizationId: input.organizationId,
        customerId: c.id,
        automationStopped: true,
        status: "HUMAN_SERVICE",
        repliedAt: new Date(),
      },
      update: {
        automationStopped: true,
        status: "HUMAN_SERVICE",
        repliedAt: new Date(),
      },
    });
    const latest = await tx.message.findFirst({
      where: { conversationId: conversation.id, direction: "OUTBOUND" },
      orderBy: { createdAt: "desc" },
    });
    const message = await tx.message.create({
      data: {
        organizationId: input.organizationId,
        customerId: c.id,
        conversationId: conversation.id,
        opportunityId: latest?.opportunityId,
        providerId: input.providerId,
        direction: "INBOUND",
        body: input.body,
        status: "RECEIVED",
      },
    });
    await tx.message.updateMany({
      where: {
        conversationId: conversation.id,
        direction: "OUTBOUND",
        status: "QUEUED",
      },
      data: { status: "CANCELLED" },
    });
    await tx.opportunity.updateMany({
      where: {
        organizationId: input.organizationId,
        customerId: c.id,
        status: { in: ["NEW", "REVIEW", "APPROVAL", "SENT"] },
      },
      data: { status: "SERVICE" },
    });
    await timeline(
      tx,
      input.organizationId,
      c.id,
      "REPLY",
      "Cliente respondeu",
      input.body,
    );
    await timeline(
      tx,
      input.organizationId,
      c.id,
      "HANDOFF",
      "Atendimento humano necessário",
      "Automação interrompida para esta conversa.",
    );
    return message;
  });
}
export async function closeOpportunity(
  actor: WorkflowActor,
  opportunityId: string,
  status: "LOST" | "IGNORED",
) {
  return db.$transaction(async (tx) => {
    const op = await tx.opportunity.findFirst({
      where: { id: opportunityId, organizationId: actor.organizationId },
    });
    if (!op) throw new Error("Oportunidade não encontrada.");
    await authorizedCustomer(tx, actor, op.customerId);
    const fresh = await tx.opportunity.findUniqueOrThrow({
      where: { id: op.id },
    });
    if (["CONVERTED", "LOST", "IGNORED"].includes(fresh.status))
      throw new Error("Esta oportunidade já foi encerrada.");
    await tx.opportunity.update({ where: { id: op.id }, data: { status } });
    const cancelled = await tx.message.updateMany({
      where: { opportunityId: op.id, status: "QUEUED" },
      data: { status: "CANCELLED" },
    });
    if (cancelled.count)
      await tx.conversation.updateMany({
        where: {
          customerId: op.customerId,
          organizationId: actor.organizationId,
          status: "QUEUED",
        },
        data: { status: "CLOSED", automationStopped: true },
      });
    await timeline(
      tx,
      actor.organizationId,
      op.customerId,
      "CLOSED",
      status === "LOST" ? "Oportunidade perdida" : "Oportunidade ignorada",
      op.reason,
      actor.name,
    );
  });
}
