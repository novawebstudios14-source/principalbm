import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { db } from "../lib/db";
import { createRequire } from "node:module";
import { addDays } from "../lib/rules";
const base = process.env.BETTER_AUTH_URL!;
async function main() {
  const anonymous = await fetch(`${base}/dashboard`, { redirect: "manual" });
  assert.equal(anonymous.status, 307);
  assert.match(anonymous.headers.get("location") ?? "", /login/);
  const badLogin = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL,
      password: "incorrect-password-123",
    }),
  });
  assert.equal(badLogin.status, 401);
  const login = await fetch(`${base}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base },
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    }),
  });
  assert.equal(login.status, 200, await login.clone().text());
  const cookie = login.headers
    .getSetCookie()
    .map((c) => c.split(";")[0])
    .join("; ");
  assert.ok(cookie.includes("session_token"));
  for (const route of [
    "/dashboard",
    "/clientes",
    "/oportunidades",
    "/mensagens-para-aprovar",
    "/atendimento",
    "/segmentos",
    "/configuracoes",
  ]) {
    const response = await fetch(base + route, { headers: { cookie } });
    const html = await response.text();
    assert.equal(response.status, 200, route);
    assert.ok(
      !html.includes("Não foi possível carregar as informações."),
      route,
    );
    console.log(`OK rota autenticada ${route}`);
  }
  const reference = JSON.parse(
    await readFile(".next/server/server-reference-manifest.json", "utf8"),
  );
  const actionId = Object.keys(reference.node)[0];
  const { encodeReply } = createRequire(import.meta.url)(
    "next/dist/compiled/react-server-dom-webpack/client.node",
  ) as { encodeReply: (value: unknown) => Promise<string | FormData> };
  async function action(path: string, values: Record<string, string>) {
    const form = new FormData();
    for (const [key, value] of Object.entries(values)) form.append(key, value);
    const body = await encodeReply([{ ok: false, message: "" }, form]);
    const response = await fetch(base + path, {
      method: "POST",
      headers: { cookie, origin: base, "Next-Action": actionId },
      body,
    });
    const result = await response.text();
    assert.equal(response.status, 200, result);
    assert.match(result, /"ok":true/, result.slice(-1200));
    return result;
  }
  const member = await db.member.findFirstOrThrow({
    where: { user: { email: process.env.ADMIN_EMAIL } },
  });
  await action("/clientes", {
    kind: "customer",
    name: "Mariana Souza",
    phone: "11999998888",
    email: "",
    birthDate: "",
    city: "São Paulo",
    source: "Loja física",
    notes: "Aceite via formulários HTTP",
    ownerId: member.id,
    whatsappConsent: "on",
  });
  const c = await db.customer.findUniqueOrThrow({
    where: {
      organizationId_phone: {
        organizationId: member.organizationId,
        phone: "5511999998888",
      },
    },
  });
  const path = `/clientes/${c.id}`;
  await action(path, {
    kind: "pregnancy",
    customerId: c.id,
    dueDate: addDays(new Date(), 60).toISOString().slice(0, 10),
    status: "ACTIVE",
    notes: "",
  });
  await action(path, { kind: "evaluate", customerId: c.id });
  await action(path, { kind: "evaluate", customerId: c.id });
  assert.equal(await db.journeyEvent.count({ where: { customerId: c.id } }), 1);
  const op = await db.opportunity.findFirstOrThrow({
    where: { customerId: c.id },
  });
  await action("/mensagens-para-aprovar", {
    kind: "draft",
    opportunityId: op.id,
    body: "Oi Mariana! Posso te mostrar as opções de mala maternidade?",
  });
  assert.match(
    (await db.opportunity.findUniqueOrThrow({ where: { id: op.id } }))
      .suggestedMessage,
    /Oi Mariana!/,
  );
  await action("/mensagens-para-aprovar", {
    kind: "approve",
    opportunityId: op.id,
    body: "Oi Mariana! Posso te mostrar as opções de mala maternidade?",
  });
  assert.equal(
    await db.message.count({ where: { customerId: c.id, status: "QUEUED" } }),
    1,
  );
  const { receiveReply } = await import("../lib/workflow");
  await receiveReply({
    organizationId: member.organizationId,
    phone: c.phone,
    providerId: "http-acceptance",
    body: "Quero sim! Pode me mostrar?",
  });
  const service = await (
    await fetch(base + "/atendimento", { headers: { cookie } })
  ).text();
  assert.match(service, /Mariana Souza/);
  assert.match(service, /Quero sim!/);
  await action(path, {
    kind: "purchase",
    customerId: c.id,
    date: new Date().toISOString().slice(0, 10),
    total: "429.90",
    items: "Mala maternidade",
    category: "Enxoval",
    requestKey: crypto.randomUUID(),
    opportunityId: op.id,
  });
  assert.equal(
    (await db.opportunity.findUniqueOrThrow({ where: { id: op.id } })).status,
    "CONVERTED",
  );
  await action(path, {
    kind: "note",
    customerId: c.id,
    notes: "Cliente atendida e compra concluída.",
  });
  await action(path, { kind: "close-service", customerId: c.id });
  const profile = await (
    await fetch(base + path, { headers: { cookie } })
  ).text();
  assert.match(profile, /Cliente atendida e compra concluída/);
  assert.match(profile, /429,90/);
  assert.match(profile, /Automação interrompida/);
  const logout = await fetch(base + "/api/auth/sign-out", {
    method: "POST",
    headers: { cookie, origin: base, "content-type": "application/json" },
    body: "{}",
  });
  assert.equal(logout.status, 200);
  assert.equal(
    (
      await fetch(base + "/dashboard", {
        headers: { cookie },
        redirect: "manual",
      })
    ).status,
    307,
  );
  console.log(
    "OK aceite HTTP completo: login, criação, gestação, avaliação, edição, aprovação, resposta, atendimento, venda e logout.",
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
