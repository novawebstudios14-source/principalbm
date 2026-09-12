export const DAY = 86400000;
export function today(now = new Date()) {
  return new Date(`${now.toISOString().slice(0, 10)}T00:00:00.000Z`);
}
export function addDays(value: Date, days: number) {
  return new Date(today(value).getTime() + days * DAY);
}
export function addMonths(value: Date, months: number) {
  const d = today(value);
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const end = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, end));
  return d;
}
export function pregnancyStage(due: Date, now = new Date()) {
  const days = Math.floor((today(due).getTime() - today(now).getTime()) / DAY);
  const week = Math.max(0, Math.min(42, Math.floor((280 - days) / 7)));
  return {
    week,
    month:
      week < 5
        ? 1
        : week < 9
          ? 2
          : week < 14
            ? 3
            : week < 18
              ? 4
              : week < 23
                ? 5
                : week < 28
                  ? 6
                  : week < 32
                    ? 7
                    : week < 36
                      ? 8
                      : 9,
    trimester: week < 14 ? 1 : week < 28 ? 2 : 3,
    days,
  };
}
export function ageMonths(birth: Date, now = new Date()) {
  return Math.max(
    0,
    (now.getUTCFullYear() - birth.getUTCFullYear()) * 12 +
      now.getUTCMonth() -
      birth.getUTCMonth() -
      (now.getUTCDate() < birth.getUTCDate() ? 1 : 0),
  );
}
export function ageLabel(birth: Date, now = new Date()) {
  const months = ageMonths(birth, now);
  if (months < 1)
    return `${Math.max(0, Math.floor((today(now).getTime() - today(birth).getTime()) / DAY))} dias`;
  if (months < 12) return `${months} ${months === 1 ? "mês" : "meses"}`;
  return `${Math.floor(months / 12)} ${months < 24 ? "ano" : "anos"}${months % 12 ? ` e ${months % 12} ${months % 12 === 1 ? "mês" : "meses"}` : ""}`;
}
type JourneyCustomer = {
  id: string;
  name: string;
  createdAt: Date;
  pregnancies: { id: string; dueDate: Date; status: string }[];
  children: { id: string; birthDate: Date }[];
  purchases: { id: string; date: Date; total: unknown }[];
};
export type DetectedEvent = {
  key: string;
  rule: string;
  reason: string;
  occurredAt: Date;
  category: string;
  action: string;
  relevance: number;
};
export function detectEvents(
  customer: JourneyCustomer,
  now = new Date(),
): DetectedEvent[] {
  const result: DetectedEvent[] = [];
  const day = today(now);
  const milestone = (anchor: Date, window: number) =>
    day >= anchor && day < addDays(anchor, window);
  for (const p of customer.pregnancies.filter((p) => p.status === "ACTIVE")) {
    const seventh = addDays(p.dueDate, -84),
      near = addDays(p.dueDate, -30);
    if (milestone(seventh, 28))
      result.push({
        key: `pregnancy:${p.id}:month7`,
        rule: "PREGNANCY_7",
        reason: "7º mês de gestação",
        occurredAt: seventh,
        category: "Mala maternidade e enxoval",
        action: "Revisar o enxoval e oferecer ajuda com a mala maternidade.",
        relevance: 65,
      });
    if (milestone(near, 31))
      result.push({
        key: `pregnancy:${p.id}:dpp30`,
        rule: "DPP_30",
        reason: "Faltam até 30 dias para a DPP",
        occurredAt: near,
        category: "Complementos do enxoval",
        action: "Conferir os últimos itens para a chegada do bebê.",
        relevance: 75,
      });
  }
  for (const child of customer.children)
    for (const months of [3, 6]) {
      const anchor = addMonths(child.birthDate, months);
      if (milestone(anchor, 30))
        result.push({
          key: `child:${child.id}:${months}`,
          rule: `BABY_${months}`,
          reason: `Bebê completou ${months} meses`,
          occurredAt: anchor,
          category:
            months === 3
              ? "Roupinhas e tamanhos"
              : "Introdução alimentar e novas fases",
          action:
            months === 3
              ? "Conferir o tamanho atual e sugerir novas roupinhas."
              : "Oferecer itens adequados para a nova fase do bebê.",
          relevance: 60,
        });
    }
  const last = [...customer.purchases].sort(
    (a, b) => b.date.getTime() - a.date.getTime(),
  )[0];
  const anchor = addDays(last?.date ?? customer.createdAt, 90);
  if (day >= anchor)
    result.push({
      key: `inactive:${customer.id}:${last?.id ?? "registration"}`,
      rule: "INACTIVE_90",
      reason: "90 dias sem comprar",
      occurredAt: anchor,
      category: "Novidades da loja",
      action: "Retomar o contato e entender o momento da família.",
      relevance: 40,
    });
  return result;
}
export function scoreEvent(
  event: DetectedEvent,
  purchases: { date: Date; total: unknown }[],
  now = new Date(),
) {
  const recent = purchases.some((p) => p.date >= addDays(now, -60));
  const frequency = purchases.length >= 3;
  const ltv = purchases.reduce((sum, p) => sum + Number(p.total), 0) >= 1000;
  const score = Math.min(
    100,
    event.relevance + (recent ? 10 : 0) + (frequency ? 10 : 0) + (ltv ? 10 : 0),
  );
  return {
    score,
    priority: score >= 75 ? "Alta" : score >= 50 ? "Média" : "Baixa",
    scoreReason: [
      `${event.reason} (+${event.relevance})`,
      recent ? "compra nos últimos 60 dias (+10)" : null,
      frequency ? "3 ou mais compras (+10)" : null,
      ltv ? "compras somam R$ 1.000 ou mais (+10)" : null,
    ]
      .filter(Boolean)
      .join(" · "),
  };
}
export function suggestMessage(name: string, event: DetectedEvent) {
  return `Oi, ${name.split(" ")[0]}! Aqui é da loja. ${event.rule === "INACTIVE_90" ? "Faz um tempinho que não conversamos e chegaram novidades por aqui." : "Separei algumas opções que podem fazer sentido para a fase da sua família."} Posso te mostrar opções de ${event.category.toLowerCase()}?`;
}
