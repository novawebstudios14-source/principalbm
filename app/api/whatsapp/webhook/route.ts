import { createHmac, timingSafeEqual } from "node:crypto";
import { receiveReply } from "@/lib/workflow";
import { replyInput } from "@/lib/validation";
export async function POST(request: Request) {
  const secret = process.env.WHATSAPP_WEBHOOK_SECRET,
    organizationId = process.env.WHATSAPP_WEBHOOK_ORGANIZATION_ID;
  if (!secret || !organizationId)
    return Response.json(
      { error: "Webhook não configurado." },
      { status: 503 },
    );
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 65536)
    return new Response(null, { status: 413 });
  const supplied = request.headers.get("x-signature-sha256") ?? "";
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  if (
    !/^[a-f0-9]{64}$/.test(supplied) ||
    !timingSafeEqual(Buffer.from(supplied, "hex"), Buffer.from(expected, "hex"))
  )
    return new Response(null, { status: 401 });
  try {
    const input = replyInput.parse(JSON.parse(raw));
    await receiveReply({ ...input, organizationId });
    return Response.json({ received: true });
  } catch {
    return Response.json(
      { error: "Mensagem inválida ou cliente não cadastrada." },
      { status: 400 },
    );
  }
}
