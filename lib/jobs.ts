import { db } from "./db";
import { evaluateCustomer, lockCustomer, timeline } from "./workflow";
import { getTransport } from "./transport";
import type { Job } from "@prisma/client";
export async function scheduleEvaluation(organizationId: string) {
  const key = `journey:${organizationId}:${new Date().toISOString().slice(0, 10)}`;
  return db.job.upsert({
    where: { key },
    create: { key, organizationId, kind: "JOURNEY" },
    update: {},
  });
}
export async function runSend(organizationId: string, messageId: string) {
  return db.$transaction(async (tx) => {
    const initial = await tx.message.findFirst({
      where: { id: messageId, organizationId },
      include: { conversation: { include: { customer: true } } },
    });
    if (!initial) return true;
    await lockCustomer(tx, organizationId, initial.customerId);
    const message = await tx.message.findUniqueOrThrow({
      where: { id: messageId },
      include: { conversation: { include: { customer: true } } },
    });
    if (message.status !== "QUEUED") return true;
    if (
      message.conversation.automationStopped ||
      !message.conversation.customer.whatsappConsent
    ) {
      await tx.message.update({
        where: { id: messageId },
        data: { status: "CANCELLED" },
      });
      await tx.conversation.updateMany({
        where: { id: message.conversationId, status: "QUEUED" },
        data: { status: "CLOSED", automationStopped: true },
      });
      await timeline(
        tx,
        organizationId,
        message.customerId,
        "CANCELLED",
        "Envio cancelado",
        "A automação está bloqueada ou a permissão de contato foi retirada.",
      );
      return true;
    }
    const result = await getTransport().send({
      id: message.id,
      phone: message.conversation.customer.phone,
      body: message.body,
    });
    if (result.status === "QUEUED") return false;
    await tx.message.update({ where: { id: messageId }, data: result });
    await tx.conversation.update({
      where: { id: message.conversationId },
      data: { status: "AWAITING_CUSTOMER" },
    });
    if (message.opportunityId)
      await tx.opportunity.update({
        where: { id: message.opportunityId },
        data: { status: "SENT" },
      });
    await timeline(
      tx,
      organizationId,
      message.customerId,
      "MOCK_SENT",
      "Entrega simulada de WhatsApp",
      "Nenhuma mensagem foi enviada a um provedor externo.",
    );
    return true;
  });
}
export async function workOnce() {
  const jobs = await db.$queryRaw<
    Job[]
  >`UPDATE "Job" j SET "leasedUntil"=NOW()+INTERVAL '5 minutes', attempts=j.attempts+1 FROM (SELECT id FROM "Job" WHERE "finishedAt" IS NULL AND "dueAt"<=NOW() AND ("leasedUntil" IS NULL OR "leasedUntil"<NOW()) AND attempts<5 ORDER BY "dueAt" LIMIT 1 FOR UPDATE SKIP LOCKED) due WHERE j.id=due.id RETURNING j.*`;
  for (const job of jobs) {
    try {
      let done = true;
      if (job.kind === "JOURNEY") {
        const customers = await db.customer.findMany({
          where: { organizationId: job.organizationId },
          select: { id: true },
        });
        for (const c of customers) {
          await evaluateCustomer(job.organizationId, c.id);
          await db.job.update({
            where: { id: job.id },
            data: { leasedUntil: new Date(Date.now() + 300000) },
          });
        }
      } else if (job.kind === "SEND" && job.subjectId)
        done = await runSend(job.organizationId, job.subjectId);
      await db.job.update({
        where: { id: job.id },
        data: done
          ? { finishedAt: new Date(), leasedUntil: null, lastError: null }
          : {
              leasedUntil: null,
              dueAt: new Date(Date.now() + 60000),
              attempts: 0,
              lastError: "WhatsApp não configurado; aguardando transporte.",
            },
      });
    } catch (error) {
      console.error(
        `Job ${job.id}:`,
        error instanceof Error ? error.message : "Falha",
      );
      await db.job.update({
        where: { id: job.id },
        data: {
          leasedUntil: null,
          lastError: "Falha no processamento. Consulte o log do worker.",
          dueAt: new Date(
            Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000,
          ),
        },
      });
    }
  }
  return jobs.length;
}
