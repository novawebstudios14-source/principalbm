import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addMonths,
  ageLabel,
  detectEvents,
  pregnancyStage,
  scoreEvent,
} from "../lib/rules";
const now = new Date("2026-09-11T00:00:00Z");
const customer = {
  id: "mariana",
  name: "Mariana Souza",
  createdAt: now,
  pregnancies: [
    { id: "pregnancy", dueDate: new Date("2026-11-10"), status: "ACTIVE" },
  ],
  children: [],
  purchases: [],
};
test("Mariana: DPP 10/11/2026 produz um evento relevante em 11/09/2026", () => {
  const events = detectEvents(customer, now);
  assert.equal(events.length, 1);
  assert.equal(events[0].rule, "PREGNANCY_7");
  assert.equal(pregnancyStage(customer.pregnancies[0].dueDate, now).week, 31);
  assert.equal(scoreEvent(events[0], [], now).score, 65);
});
test("meses são calendários e respeitam o último dia", () => {
  assert.equal(
    addMonths(new Date("2026-01-31"), 1).toISOString().slice(0, 10),
    "2026-02-28",
  );
  assert.equal(ageLabel(new Date("2025-06-11"), now), "1 ano e 3 meses");
});
test("não dispara marcos futuros nem gestação encerrada", () => {
  assert.equal(
    detectEvents(
      {
        ...customer,
        pregnancies: [{ ...customer.pregnancies[0], status: "ENDED" }],
      },
      now,
    ).length,
    0,
  );
  assert.equal(detectEvents(customer, new Date("2026-07-01")).length, 0);
});
test("score respeita limite de 100 e mostra contribuições", () => {
  const e = detectEvents(customer, now)[0];
  const purchases = Array.from({ length: 3 }, () => ({
    date: now,
    total: 500,
  }));
  assert.equal(scoreEvent({ ...e, relevance: 75 }, purchases, now).score, 100);
  assert.match(scoreEvent(e, purchases, now).scoreReason, /últimos 60 dias/);
});
