import type { Prisma } from "@prisma/client";
import { addDays, addMonths, today } from "./rules";
export const segments = [
  ["pregnant", "Gestantes", "Clientes com gestação ativa."],
  ["trimester1", "1º trimestre", "Até 13 semanas de gestação."],
  ["trimester2", "2º trimestre", "Da 14ª à 27ª semana."],
  ["trimester3", "3º trimestre", "A partir da 28ª semana."],
  ["baby0", "Bebê de 0 a 3 meses", "Primeiros meses da família."],
  ["baby3", "Bebê de 3 a 6 meses", "Novos tamanhos e descobertas."],
  ["baby6", "Bebê de 6 a 12 meses", "Uma nova fase de desenvolvimento."],
  ["inactive", "90 dias sem comprar", "Oportunidades de retomar o contato."],
  ["replied", "Já responderam", "Clientes que iniciaram uma conversa."],
  ["never", "Nunca responderam", "Ainda sem resposta registrada."],
] as const;
export function segmentWhere(
  segment: string,
  now = new Date(),
): Prisma.CustomerWhereInput {
  const d = today(now);
  if (segment === "pregnant")
    return { pregnancies: { some: { status: "ACTIVE" } } };
  if (segment === "trimester1")
    return {
      pregnancies: {
        some: { status: "ACTIVE", dueDate: { gt: addDays(d, 182) } },
      },
    };
  if (segment === "trimester2")
    return {
      pregnancies: {
        some: {
          status: "ACTIVE",
          dueDate: { gt: addDays(d, 84), lte: addDays(d, 182) },
        },
      },
    };
  if (segment === "trimester3")
    return {
      pregnancies: {
        some: { status: "ACTIVE", dueDate: { lte: addDays(d, 84) } },
      },
    };
  const ages: Record<string, [number, number]> = {
    baby0: [0, 3],
    baby3: [3, 6],
    baby6: [6, 12],
  };
  if (ages[segment]) {
    const [min, max] = ages[segment];
    return {
      children: {
        some: {
          birthDate: { gt: addMonths(d, -max), lte: addMonths(d, -min) },
        },
      },
    };
  }
  if (segment === "inactive")
    return {
      AND: [
        { purchases: { none: { date: { gt: addDays(d, -90) } } } },
        {
          OR: [
            { purchases: { some: {} } },
            { createdAt: { lte: addDays(d, -90) } },
          ],
        },
      ],
    };
  if (segment === "replied")
    return { conversation: { is: { repliedAt: { not: null } } } };
  if (segment === "never")
    return {
      OR: [
        { conversation: { is: null } },
        { conversation: { is: { repliedAt: null } } },
      ],
    };
  return {};
}
