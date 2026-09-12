import { db } from "../lib/db";
import { addDays, addMonths, today } from "../lib/rules";
import {
  evaluateCustomer,
  approveMessage,
  receiveReply,
} from "../lib/workflow";
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Seed bloqueado em produção.");
  const member = await db.member.findFirst({
    where: { user: { email: process.env.ADMIN_EMAIL } },
    include: { user: true },
  });
  if (!member)
    throw new Error(
      "Execute admin:create primeiro com ADMIN_EMAIL configurado.",
    );
  const { organizationId, id: ownerId } = member;
  const now = today();
  const samples = [
    {
      name: "Mariana Souza",
      phone: "5511998761234",
      city: "São Paulo",
      due: addDays(now, 60),
    },
    {
      name: "Camila Oliveira",
      phone: "5511987652345",
      city: "Campinas",
      child: 3,
    },
    {
      name: "Juliana Santos",
      phone: "5511976543456",
      city: "São Paulo",
      child: 6,
    },
    {
      name: "Beatriz Lima",
      phone: "5511965434567",
      city: "Santo André",
      inactive: true,
    },
    {
      name: "Fernanda Costa",
      phone: "5511954325678",
      city: "São Paulo",
      due: addDays(now, 20),
    },
    {
      name: "Ana Paula Ribeiro",
      phone: "5511943216789",
      city: "Guarulhos",
      child: 3,
    },
  ];
  for (const [index, s] of samples.entries()) {
    if (
      await db.customer.findUnique({
        where: { organizationId_phone: { organizationId, phone: s.phone } },
      })
    )
      continue;
    const c = await db.customer.create({
      data: {
        organizationId,
        ownerId,
        name: s.name,
        phone: s.phone,
        city: s.city,
        source: index % 2 ? "Indicação" : "Loja física",
        whatsappConsent: true,
        notes: "Dado de demonstração, criado pelo seed.",
        createdAt: s.inactive ? addDays(now, -150) : now,
        timeline: {
          create: {
            type: "CREATED",
            title: "Cliente cadastrada",
            detail: "Dados de demonstração",
          },
        },
      },
    });
    if (s.due)
      await db.pregnancy.create({
        data: { organizationId, customerId: c.id, dueDate: s.due },
      });
    if (s.child)
      await db.child.create({
        data: {
          organizationId,
          customerId: c.id,
          name: index === 1 ? "Miguel" : "Laura",
          birthDate: addMonths(now, -s.child),
        },
      });
    if (index === 2)
      await db.child.create({
        data: {
          organizationId,
          customerId: c.id,
          name: "Sofia",
          birthDate: addMonths(now, -28),
          clothingSize: "3",
        },
      });
    await db.purchase.create({
      data: {
        organizationId,
        customerId: c.id,
        date: addDays(now, s.inactive ? -120 : -15),
        total: [429, 189, 650, 259, 1150, 349][index],
        items: [
          "Kit de enxoval e mantas",
          "Bodies e macacões",
          "Carrinho e roupinhas",
          "Vestido infantil",
          "Berço e enxoval",
          "Kit de passeio",
        ][index],
        sellerName: member.user.name,
        requestKey: crypto.randomUUID(),
      },
    });
    await evaluateCustomer(organizationId, c.id);
    if (index === 5) {
      const op = await db.opportunity.findFirstOrThrow({
        where: { customerId: c.id },
      });
      await approveMessage(
        { ...member, name: member.user.name },
        op.id,
        op.suggestedMessage,
      );
      await receiveReply({
        organizationId,
        phone: s.phone,
        providerId: `seed:${c.id}`,
        body: "Oi! Quero sim. Você tem opções no tamanho M?",
      });
    }
  }
  console.log(
    "Dados demonstrativos criados. O seed não envia mensagens externas.",
  );
}
main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
