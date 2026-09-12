import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
async function main() {
  const db = await PGlite.create(".local-db");
  const server = new PGLiteSocketServer({
    db,
    maxConnections: 10,
    port: 5433,
    host: "127.0.0.1",
  });
  await server.start();
  console.log("PostgreSQL embarcado para desenvolvimento: 127.0.0.1:5433");
  async function stop() {
    await server.stop();
    await db.close();
    process.exit(0);
  }
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
