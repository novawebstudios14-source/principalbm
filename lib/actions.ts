"use server";
import { revalidatePath } from "next/cache";
import { db } from "./db";
import { requireMember, assertWrite, canManage, customerScope } from "./access";
import {
  customerInput,
  pregnancyInput,
  childInput,
  purchaseInput,
  replyInput,
} from "./validation";
import {
  approveMessage,
  closeOpportunity,
  authorizedCustomer,
  timeline,
  evaluateCustomer,
  receiveReply,
} from "./workflow";
import { canSimulate } from "./transport";
import { runSend } from "./jobs";
import { Prisma } from "@prisma/client";
import { z } from "zod";
export type ActionResult = { ok: boolean; message: string; redirect?: string };
export async function mutate(
  _previous: ActionResult,
  form: FormData,
): Promise<ActionResult> {
  const actor = await requireMember();
  const who = {
    id: actor.id,
    organizationId: actor.organizationId,
    role: actor.role,
    name: actor.user.name,
  };
  const values = Object.fromEntries(form);
  const kind = String(values.kind);
  const customerId = String(form.get("customerId") || "");
  try {
    assertWrite(actor);
    if (kind === "customer") {
      const input = customerInput.parse({
        ...values,
        whatsappConsent: form.get("whatsappConsent") === "on",
      });
      if (!canManage(actor)) input.ownerId = actor.id;
      const owner = await db.member.findFirst({
        where: {
          id: input.ownerId,
          organizationId: actor.organizationId,
          role: { not: "MARKETING" },
        },
      });
      if (!owner) throw new Error("Responsável inválido.");
      const c = await db.$transaction(async (tx) => {
        if (customerId) {
          await authorizedCustomer(tx, who, customerId);
          const updated = await tx.customer.update({
            where: { id: customerId },
            data: input,
          });
          await timeline(
            tx,
            actor.organizationId,
            customerId,
            "UPDATED",
            "Cadastro atualizado",
            undefined,
            who.name,
          );
          return updated;
        }
        const created = await tx.customer.create({
          data: { ...input, organizationId: actor.organizationId },
        });
        await timeline(
          tx,
          actor.organizationId,
          created.id,
          "CREATED",
          "Cliente cadastrada",
          undefined,
          who.name,
        );
        return created;
      });
      revalidatePath("/", "layout");
      return {
        ok: true,
        message: "Cadastro salvo.",
        redirect: `/clientes/${c.id}`,
      };
    }
    if (
      ["pregnancy", "child", "purchase", "note", "close-service"].includes(kind)
    ) {
      await db.$transaction(async (tx) => {
        await authorizedCustomer(tx, who, customerId);
        const base = { organizationId: actor.organizationId, customerId };
        if (kind === "pregnancy") {
          const input = pregnancyInput.parse(values);
          const id = String(form.get("pregnancyId") || "");
          if (id) {
            const p = await tx.pregnancy.findFirst({ where: { id, ...base } });
            if (!p) throw new Error("Gestação não encontrada.");
            await tx.pregnancy.update({ where: { id }, data: input });
          } else {
            if (
              input.status === "ACTIVE" &&
              (await tx.pregnancy.findFirst({
                where: { ...base, status: "ACTIVE" },
              }))
            )
              throw new Error(
                "Já existe uma gestação ativa. Atualize o registro existente.",
              );
            await tx.pregnancy.create({ data: { ...base, ...input } });
          }
          await timeline(
            tx,
            actor.organizationId,
            customerId,
            "PREGNANCY",
            id ? "Gestação atualizada" : "Gestação registrada",
            `DPP: ${input.dueDate.toLocaleDateString("pt-BR", { timeZone: "UTC" })}`,
            who.name,
          );
        }
        if (kind === "child") {
          await tx.child.create({
            data: { ...base, ...childInput.parse(values) },
          });
          await timeline(
            tx,
            actor.organizationId,
            customerId,
            "CHILD",
            "Filho registrado",
            String(values.name),
            who.name,
          );
        }
        if (kind === "purchase") {
          const input = purchaseInput.parse(values);
          const opportunityId = String(form.get("opportunityId") || "") || null;
          if (opportunityId) {
            const op = await tx.opportunity.findFirst({
              where: {
                ...base,
                id: opportunityId,
                status: { notIn: ["CONVERTED", "LOST", "IGNORED"] },
              },
            });
            if (!op) throw new Error("Oportunidade inválida ou encerrada.");
          }
          if (
            await tx.purchase.findUnique({
              where: { requestKey: input.requestKey },
            })
          )
            return;
          await tx.purchase.create({
            data: {
              ...base,
              ...input,
              sellerName: actor.user.name,
              opportunityId,
            },
          });
          await timeline(
            tx,
            actor.organizationId,
            customerId,
            "PURCHASE",
            "Compra registrada",
            `R$ ${input.total.toFixed(2)} · ${input.items}`,
            who.name,
          );
          if (opportunityId) {
            await tx.opportunity.update({
              where: { id: opportunityId },
              data: { status: "CONVERTED" },
            });
            await tx.message.updateMany({
              where: { opportunityId, status: "QUEUED" },
              data: { status: "CANCELLED" },
            });
            await timeline(
              tx,
              actor.organizationId,
              customerId,
              "CONVERTED",
              "Oportunidade convertida em venda",
              undefined,
              who.name,
            );
          }
        }
        if (kind === "note")
          await timeline(
            tx,
            actor.organizationId,
            customerId,
            "NOTE",
            "Nota de atendimento",
            z.string().trim().min(1).max(2000).parse(values.notes),
            who.name,
          );
        if (kind === "close-service") {
          const conversation = await tx.conversation.findFirst({
            where: { ...base, status: "HUMAN_SERVICE" },
          });
          if (!conversation) throw new Error("Não há atendimento aberto.");
          await tx.conversation.update({
            where: { id: conversation.id },
            data: { status: "CLOSED", automationStopped: true },
          });
          await timeline(
            tx,
            actor.organizationId,
            customerId,
            "SERVICE_CLOSED",
            "Atendimento encerrado",
            "A automação continua bloqueada.",
            who.name,
          );
        }
      });
    } else if (kind === "approve")
      await approveMessage(
        who,
        String(values.opportunityId),
        String(values.body),
      );
    else if (kind === "draft") {
      const op = await db.opportunity.findFirst({
        where: {
          id: String(values.opportunityId),
          customer: customerScope(actor),
        },
      });
      if (!op) throw new Error("Oportunidade não encontrada.");
      await db.$transaction(async (tx) => {
        await authorizedCustomer(tx, who, op.customerId);
        const changed = await tx.opportunity.updateMany({
          where: { id: op.id, status: "APPROVAL" },
          data: {
            suggestedMessage: z
              .string()
              .trim()
              .min(10)
              .max(1500)
              .parse(values.body),
          },
        });
        if (!changed.count) throw new Error("A oportunidade saiu da fila.");
      });
    } else if (kind === "ignore" || kind === "lost")
      await closeOpportunity(
        who,
        String(values.opportunityId),
        kind === "ignore" ? "IGNORED" : "LOST",
      );
    else if (kind === "evaluate") {
      if (customerId) {
        const c = await db.customer.findFirst({
          where: { ...customerScope(actor), id: customerId },
        });
        if (!c) throw new Error("Cliente não encontrada.");
        await evaluateCustomer(actor.organizationId, c.id);
      } else {
        if (!canManage(actor))
          throw new Error("Apenas a gestão pode avaliar todas as jornadas.");
        for (const c of await db.customer.findMany({
          where: customerScope(actor),
          select: { id: true },
        }))
          await evaluateCustomer(actor.organizationId, c.id);
      }
    } else if (kind === "simulate-reply") {
      if (!canSimulate())
        throw new Error("Simulação indisponível neste ambiente.");
      const c = await db.customer.findFirst({
        where: { ...customerScope(actor), id: customerId },
      });
      if (!c) throw new Error("Cliente não encontrada.");
      await receiveReply({
        organizationId: actor.organizationId,
        ...replyInput.parse({
          phone: c.phone,
          providerId: `dev:${crypto.randomUUID()}`,
          body: values.body,
        }),
      });
    } else if (kind === "simulate-send") {
      if (!canSimulate())
        throw new Error("Simulação indisponível neste ambiente.");
      const m = await db.message.findFirst({
        where: {
          id: String(values.messageId),
          conversation: { customer: customerScope(actor) },
        },
      });
      if (!m) throw new Error("Mensagem não encontrada.");
      await runSend(actor.organizationId, m.id);
    } else if (kind === "settings") {
      if (!canManage(actor))
        throw new Error("Apenas a gestão pode alterar a loja.");
      await db.organization.update({
        where: { id: actor.organizationId },
        data: { name: z.string().trim().min(2).max(120).parse(values.name) },
      });
    } else if (kind === "retry-job") {
      if (!canManage(actor))
        throw new Error("Apenas a gestão pode reprocessar tarefas.");
      await db.job.updateMany({
        where: {
          id: String(values.jobId),
          organizationId: actor.organizationId,
          finishedAt: null,
          attempts: { gte: 5 },
        },
        data: {
          attempts: 0,
          dueAt: new Date(),
          leasedUntil: null,
          lastError: null,
        },
      });
    } else if (
      !["pregnancy", "child", "purchase", "note", "close-service"].includes(
        kind,
      )
    )
      throw new Error("Ação inválida.");
    revalidatePath("/", "layout");
    return {
      ok: true,
      message:
        kind === "approve"
          ? "Mensagem aprovada e registrada na fila."
          : kind === "evaluate"
            ? "Jornadas avaliadas. Eventos anteriores não foram duplicados."
            : "Alteração salva.",
    };
  } catch (error) {
    if (error instanceof z.ZodError)
      return {
        ok: false,
        message: error.issues[0]?.message ?? "Revise os campos.",
      };
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002")
        return {
          ok: false,
          message:
            "Este registro já existe. Confira o telefone ou atualize a página.",
        };
      console.error("Database mutation error", error.code);
      return {
        ok: false,
        message: "Não foi possível salvar. Tente novamente.",
      };
    }
    return {
      ok: false,
      message:
        error instanceof Error ? error.message : "Não foi possível salvar.",
    };
  }
}
