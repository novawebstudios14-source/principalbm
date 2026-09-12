import { test, after } from "node:test";
import assert from "node:assert/strict";
import { db } from "../lib/db";
import {
  evaluateCustomer,
  approveMessage,
  receiveReply,
  closeOpportunity,
} from "../lib/workflow";
import { runSend, scheduleEvaluation, workOnce } from "../lib/jobs";
import { POST as webhook } from "../app/api/whatsapp/webhook/route";
import { addDays } from "../lib/rules";
import { createHmac } from "node:crypto";
after(() => db.$disconnect());
test("fluxo persistido: evento único, aprovação única, bloqueio após resposta e isolamento", async () => {
  const org = await db.organization.create({ data: { name: "Teste isolado" } });
  const other = await db.organization.create({
    data: { name: "Outra organização" },
  });
  const user = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      name: "Ana",
      email: `${crypto.randomUUID()}@example.test`,
    },
  });
  const member = await db.member.create({
    data: { organizationId: org.id, userId: user.id, role: "OWNER" },
  });
  const actor = { ...member, name: user.name };
  const now = new Date("2026-09-11");
  try {
    const c = await db.customer.create({
      data: {
        organizationId: org.id,
        ownerId: member.id,
        name: "Mariana Souza",
        phone: "5511999990001",
        whatsappConsent: true,
        createdAt: now,
        pregnancies: { create: { dueDate: new Date("2026-11-10") } },
      },
    });
    await Promise.all([
      evaluateCustomer(org.id, c.id, now),
      evaluateCustomer(org.id, c.id, now),
    ]);
    assert.equal(
      await db.journeyEvent.count({ where: { customerId: c.id } }),
      1,
    );
    assert.equal(
      await db.opportunity.count({ where: { customerId: c.id } }),
      1,
    );
    const op = await db.opportunity.findFirstOrThrow({
      where: { customerId: c.id },
    });
    assert.equal(op.status, "APPROVAL");
    assert.ok(op.score > 0);
    await assert.rejects(() =>
      approveMessage(
        { ...actor, organizationId: other.id },
        op.id,
        op.suggestedMessage,
      ),
    );
    await assert.rejects(() =>
      approveMessage(
        { ...actor, role: "SELLER", id: "another-seller" },
        op.id,
        op.suggestedMessage,
      ),
    );
    await assert.rejects(() =>
      approveMessage(
        { ...actor, role: "MARKETING" },
        op.id,
        op.suggestedMessage,
      ),
    );
    const results = await Promise.allSettled([
      approveMessage(
        actor,
        op.id,
        "Oi Mariana! Posso mostrar opções para a mala maternidade?",
      ),
      approveMessage(
        actor,
        op.id,
        "Oi Mariana! Posso mostrar opções para a mala maternidade?",
      ),
    ]);
    assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
    assert.equal(
      await db.message.count({
        where: { customerId: c.id, direction: "OUTBOUND" },
      }),
      1,
    );
    const m = await db.message.findFirstOrThrow({
      where: { customerId: c.id },
    });
    process.env.WHATSAPP_TRANSPORT = "disabled";
    assert.equal(await runSend(org.id, m.id), false);
    assert.equal(
      (await db.message.findUniqueOrThrow({ where: { id: m.id } })).status,
      "QUEUED",
    );
    const input = {
      organizationId: org.id,
      phone: c.phone,
      providerId: "test-reply",
      body: "Sim! Pode me mostrar?",
    };
    await Promise.all([receiveReply(input), receiveReply(input)]);
    assert.equal(
      await db.message.count({
        where: { customerId: c.id, direction: "INBOUND" },
      }),
      1,
    );
    const convo = await db.conversation.findUniqueOrThrow({
      where: { customerId: c.id },
    });
    assert.equal(convo.status, "HUMAN_SERVICE");
    assert.equal(convo.automationStopped, true);
    assert.equal(
      (await db.message.findUniqueOrThrow({ where: { id: m.id } })).status,
      "CANCELLED",
    );
    process.env.WHATSAPP_TRANSPORT = "mock";
    await runSend(org.id, m.id);
    assert.equal(
      (await db.message.findUniqueOrThrow({ where: { id: m.id } })).status,
      "CANCELLED",
    );
    await evaluateCustomer(org.id, c.id, new Date("2026-10-12"));
    const second = await db.opportunity.findFirstOrThrow({
      where: { customerId: c.id, id: { not: op.id } },
    });
    assert.equal(second.status, "REVIEW");
    await assert.rejects(() =>
      approveMessage(actor, second.id, second.suggestedMessage),
    );
    const titles = (
      await db.timelineEvent.findMany({ where: { customerId: c.id } })
    ).map((t) => t.type);
    for (const type of [
      "JOURNEY",
      "OPPORTUNITY",
      "APPROVAL",
      "QUEUED",
      "REPLY",
      "HANDOFF",
    ])
      assert.ok(titles.includes(type));
    await closeOpportunity(actor, second.id, "IGNORED");
    await assert.rejects(() => closeOpportunity(actor, second.id, "LOST"));
    process.env.WHATSAPP_WEBHOOK_SECRET = "test-secret";
    process.env.WHATSAPP_WEBHOOK_ORGANIZATION_ID = org.id;
    const body = JSON.stringify({
      phone: c.phone,
      providerId: "webhook-2",
      body: "Obrigada!",
    });
    assert.equal(
      (
        await webhook(
          new Request("http://localhost/api/whatsapp/webhook", {
            method: "POST",
            body,
          }),
        )
      ).status,
      401,
    );
    const signed = new Request("http://localhost/api/whatsapp/webhook", {
      method: "POST",
      body,
      headers: {
        "x-signature-sha256": createHmac("sha256", "test-secret")
          .update(body)
          .digest("hex"),
      },
    });
    assert.equal((await webhook(signed)).status, 200);
  } finally {
    await db.message.deleteMany({ where: { organizationId: org.id } });
    await db.purchase.deleteMany({ where: { organizationId: org.id } });
    await db.opportunity.deleteMany({ where: { organizationId: org.id } });
    await db.customer.deleteMany({ where: { organizationId: org.id } });
    await db.organization.delete({ where: { id: org.id } });
    await db.organization.delete({ where: { id: other.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});

test("worker persistido: agenda única, entrega mock e interrupção", async () => {
  const org = await db.organization.create({ data: { name: "Teste worker" } });
  const user = await db.user.create({
    data: {
      id: crypto.randomUUID(),
      name: "Ana",
      email: `${crypto.randomUUID()}@example.test`,
    },
  });
  const member = await db.member.create({
    data: { organizationId: org.id, userId: user.id, role: "OWNER" },
  });
  try {
    const customer = await db.customer.create({
      data: {
        organizationId: org.id,
        ownerId: member.id,
        name: "Cliente Worker",
        phone: "5511999990002",
        whatsappConsent: true,
        pregnancies: { create: { dueDate: addDays(new Date(), 60) } },
      },
    });
    await scheduleEvaluation(org.id);
    await scheduleEvaluation(org.id);
    assert.equal(
      await db.job.count({
        where: { organizationId: org.id, kind: "JOURNEY" },
      }),
      1,
    );
    const claims = await Promise.all([workOnce(), workOnce()]);
    assert.equal(
      claims.reduce((a, b) => a + b, 0),
      1,
    );
    const opportunity = await db.opportunity.findFirstOrThrow({
      where: { customerId: customer.id },
    });
    const message = await approveMessage(
      { ...member, name: user.name },
      opportunity.id,
      opportunity.suggestedMessage,
    );
    process.env.WHATSAPP_TRANSPORT = "mock";
    await workOnce();
    assert.equal(
      (await db.message.findUniqueOrThrow({ where: { id: message.id } }))
        .status,
      "MOCK_SENT",
    );
    assert.equal(
      (
        await db.conversation.findUniqueOrThrow({
          where: { customerId: customer.id },
        })
      ).status,
      "AWAITING_CUSTOMER",
    );
    await receiveReply({
      organizationId: org.id,
      phone: customer.phone,
      providerId: "worker-reply",
      body: "Quero conhecer as opções.",
    });
    await workOnce();
    assert.equal(
      await db.message.count({
        where: { customerId: customer.id, direction: "OUTBOUND" },
      }),
      1,
    );
    assert.equal(
      (
        await db.conversation.findUniqueOrThrow({
          where: { customerId: customer.id },
        })
      ).automationStopped,
      true,
    );
  } finally {
    await db.message.deleteMany({ where: { organizationId: org.id } });
    await db.opportunity.deleteMany({ where: { organizationId: org.id } });
    await db.customer.deleteMany({ where: { organizationId: org.id } });
    await db.organization.delete({ where: { id: org.id } });
    await db.user.delete({ where: { id: user.id } });
  }
});
