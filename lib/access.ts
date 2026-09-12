import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "./auth";
import { db } from "./db";
import type { Prisma } from "@prisma/client";
export const requireMember = cache(async () => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  const member = await db.member.findFirst({
    where: { userId: session.user.id },
    include: { user: true, organization: true },
    orderBy: { id: "asc" },
  });
  if (!member) redirect("/login?error=membership");
  return member;
});
export type Actor = Awaited<ReturnType<typeof requireMember>>;
export function customerScope(
  actor: Pick<Actor, "organizationId" | "role" | "id">,
): Prisma.CustomerWhereInput {
  return {
    organizationId: actor.organizationId,
    ...(actor.role === "SELLER" ? { ownerId: actor.id } : {}),
  };
}
export function canManage(actor: Pick<Actor, "role">) {
  return actor.role === "OWNER" || actor.role === "MANAGER";
}
export function assertWrite(actor: Pick<Actor, "role">) {
  if (actor.role === "MARKETING")
    throw new Error(
      "Seu perfil permite consulta. Peça a um gerente para fazer esta alteração.",
    );
}
