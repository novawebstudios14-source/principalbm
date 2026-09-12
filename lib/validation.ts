import { z } from "zod";
z.config(z.locales.pt());
export const text = z.string().trim().max(2000);
export const optionalText = text.transform((v) => v || null);
export const dateInput = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data válida.")
  .refine(
    (v) =>
      !Number.isNaN(new Date(v).getTime()) &&
      new Date(v).toISOString().slice(0, 10) === v,
    "Data inválida.",
  )
  .transform((v) => new Date(`${v}T00:00:00Z`));
export const pastDate = dateInput.refine(
  (v) => v <= new Date(),
  "A data não pode ser futura.",
);
export const optionalDate = z.union([
  z.literal("").transform(() => null),
  pastDate,
]);
export const phoneInput = z
  .string()
  .transform((v) => v.replace(/\D/g, ""))
  .transform((v) => (v.length === 10 || v.length === 11 ? `55${v}` : v))
  .pipe(
    z
      .string()
      .regex(/^55\d{10,11}$/, "Informe um telefone brasileiro com DDD."),
  );
export const customerInput = z.object({
  name: z.string().trim().min(3, "Informe o nome completo.").max(120),
  phone: phoneInput,
  email: z
    .union([z.literal(""), z.email("E-mail inválido.")])
    .transform((v) => v || null),
  birthDate: optionalDate,
  city: optionalText,
  source: optionalText,
  notes: text,
  ownerId: z.string().min(1),
  whatsappConsent: z.coerce.boolean(),
});
export const pregnancyInput = z.object({
  dueDate: dateInput.refine(
    (v) =>
      v.getTime() > Date.now() - 300 * 86400000 &&
      v.getTime() < Date.now() + 300 * 86400000,
    "DPP fora do intervalo esperado.",
  ),
  status: z.enum(["ACTIVE", "BORN", "ENDED"]),
  notes: text,
});
export const childInput = z.object({
  name: z.string().trim().min(1, "Informe o nome.").max(120),
  birthDate: pastDate,
  gender: optionalText,
  clothingSize: optionalText,
  shoeSize: optionalText,
  notes: text,
});
export const purchaseInput = z.object({
  date: pastDate,
  total: z
    .string()
    .transform((v) => v.replace(",", "."))
    .pipe(
      z.coerce
        .number<string>()
        .positive("Informe um valor maior que zero.")
        .max(999999999)
        .refine(
          (v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.0001,
          "Use no máximo duas casas decimais.",
        ),
    ),
  items: z.string().trim().min(2, "Informe os itens.").max(2000),
  category: optionalText,
  requestKey: z.string().uuid(),
});
export const replyInput = z.object({
  phone: phoneInput,
  providerId: z.string().min(1).max(200),
  body: z.string().trim().min(1).max(4000),
});
