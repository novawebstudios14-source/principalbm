import { hashPassword } from "better-auth/crypto";
import { db } from "../lib/db";
import { z } from "zod";
async function main() {
  const email = z.email().parse(process.env.ADMIN_EMAIL);
  const password = z.string().min(12).parse(process.env.ADMIN_PASSWORD);
  const name = z
    .string()
    .min(2)
    .parse(process.env.ADMIN_NAME || "Administrador");
  if (await db.user.findUnique({ where: { email } }))
    throw new Error("Esta conta já existe. A senha não foi alterada.");
  const passwordHash = await hashPassword(password);
  const organizationId = process.env.ADMIN_ORGANIZATION_ID;
  const role = z
    .enum(["OWNER", "MANAGER", "SELLER", "MARKETING"])
    .parse(process.env.ADMIN_ROLE || "OWNER");
  const result = await db.$transaction(async (tx) => {
    const org = organizationId
      ? await tx.organization.findUniqueOrThrow({
          where: { id: organizationId },
        })
      : await tx.organization.create({
          data: { name: process.env.BUSINESS_NAME || "Principal Bebê & Mamãe" },
        });
    const user = await tx.user.create({
      data: { id: crypto.randomUUID(), email, name, emailVerified: true },
    });
    await tx.account.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: passwordHash,
      },
    });
    await tx.member.create({
      data: { userId: user.id, organizationId: org.id, role },
    });
    return org;
  });
  console.log(
    `Conta criada. Organização: ${result.id}. Nenhuma senha foi exibida.`,
  );
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
