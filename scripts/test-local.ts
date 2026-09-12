import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
async function main() {
  const database = await PGlite.create();
  const server = new PGLiteSocketServer({
    db: database,
    maxConnections: 10,
    port: 5435,
    host: "127.0.0.1",
  });
  await server.start();
  const env = {
    ...process.env,
    DATABASE_URL:
      "postgresql://postgres:postgres@127.0.0.1:5435/postgres?schema=public&sslmode=disable&connection_limit=1&statement_cache_size=0&pgbouncer=true",
    BETTER_AUTH_SECRET: randomBytes(32).toString("hex"),
    BETTER_AUTH_URL: "http://127.0.0.1:3011",
    ADMIN_EMAIL: "http-admin@example.test",
    ADMIN_PASSWORD: randomBytes(24).toString("hex"),
    ADMIN_NAME: "Ana Testes",
    BUSINESS_NAME: "Loja de teste",
    ADMIN_ORGANIZATION_ID: "",
    CHECKPOINT_DISABLE: "1",
    PRISMA_HIDE_UPDATE_MESSAGE: "1",
  };
  async function run(args: string[]) {
    return new Promise<void>((resolve, reject) => {
      const child = spawn(process.execPath, args, { env, stdio: "inherit" });
      child.on("error", reject);
      child.on("exit", (code) =>
        code === 0
          ? resolve()
          : reject(new Error(`Falha (${code}): ${args.join(" ")}`)),
      );
    });
  }
  try {
    await run(["node_modules/prisma/build/index.js", "migrate", "deploy"]);
    await run(["--import", "tsx", "--test", "tests/workflow.test.ts"]);
    if (process.argv.includes("--http")) {
      await run(["--import", "tsx", "scripts/create-admin.ts"]);
      await run(["--import", "tsx", "scripts/seed.ts"]);
      await run(["--import", "tsx", "scripts/seed.ts"]);
      const app = spawn(
        process.execPath,
        [
          "node_modules/next/dist/bin/next",
          "start",
          "--hostname",
          "127.0.0.1",
          "--port",
          "3011",
        ],
        { env: { ...env, NODE_ENV: "production" }, stdio: "inherit" },
      );
      try {
        let ready = false;
        for (let attempt = 0; attempt < 150; attempt++) {
          try {
            const response = await fetch(env.BETTER_AUTH_URL + "/login");
            if (response.ok) {
              ready = true;
              break;
            }
          } catch {}
          await new Promise((r) => setTimeout(r, 200));
        }
        if (!ready) throw new Error("Servidor de teste não iniciou.");
        await run(["--import", "tsx", "tests/http-workflow.ts"]);
      } finally {
        app.kill("SIGTERM");
        await new Promise<void>((resolve) => {
          if (app.exitCode !== null) resolve();
          else app.once("exit", () => resolve());
        });
      }
    }
  } finally {
    await server.stop();
    await database.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
