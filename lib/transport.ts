export interface WhatsAppTransport {
  mode: "disabled" | "mock";
  send(input: {
    id: string;
    phone: string;
    body: string;
  }): Promise<{ status: "QUEUED" | "MOCK_SENT"; providerId?: string }>;
}
export function getTransport(): WhatsAppTransport {
  if (
    process.env.WHATSAPP_TRANSPORT === "mock" &&
    process.env.NODE_ENV !== "production"
  )
    return {
      mode: "mock",
      async send(input) {
        return { status: "MOCK_SENT", providerId: `mock:${input.id}` };
      },
    };
  return {
    mode: "disabled",
    async send() {
      return { status: "QUEUED" };
    },
  };
}
export function canSimulate() {
  return (
    process.env.NODE_ENV !== "production" &&
    process.env.DEV_REPLY_ENABLED === "true"
  );
}
