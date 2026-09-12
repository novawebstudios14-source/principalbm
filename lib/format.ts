export const money = (value: number | string | { toString(): string }) =>
  Number(value.toString()).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
export const date = (value: Date | string) =>
  new Date(value).toLocaleDateString("pt-BR", { timeZone: "UTC" });
export const datetime = (value: Date | string) =>
  new Date(value).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "short",
    timeStyle: "short",
  });
export const initials = (name: string) =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();
export const statusLabel = {
  NEW: "Nova",
  REVIEW: "Para revisar",
  APPROVAL: "Mensagem para aprovar",
  SENT: "Mensagem enviada",
  SERVICE: "Em atendimento",
  CONVERTED: "Convertida",
  LOST: "Perdida",
  IGNORED: "Ignorada",
  QUEUED: "Na fila",
  AWAITING_CUSTOMER: "Aguardando cliente",
  HUMAN_SERVICE: "Em atendimento",
  CLOSED: "Encerrada",
  MOCK_SENT: "Entrega simulada",
  DELIVERED: "Entregue",
  RECEIVED: "Recebida",
  CANCELLED: "Cancelada",
  FAILED: "Falha no envio",
  DRAFT: "Rascunho",
};
export const roleLabel = {
  OWNER: "Proprietário",
  MANAGER: "Gerente",
  SELLER: "Vendedor",
  MARKETING: "Marketing / CRM",
};
