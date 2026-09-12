import { db } from "../lib/db";
import { scheduleEvaluation, workOnce } from "../lib/jobs";
let stopped = false;
process.on("SIGINT", () => {
  stopped = true;
});
process.on("SIGTERM", () => {
  stopped = true;
});
async function main() {
  console.log("Worker de jornadas e mensagens iniciado.");
  while (!stopped) {
    try {
      for (const org of await db.organization.findMany({
        select: { id: true },
      }))
        await scheduleEvaluation(org.id);
      if (await workOnce()) continue;
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Falha no worker");
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  await db.$disconnect();
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
