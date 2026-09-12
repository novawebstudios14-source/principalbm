import { ActionForm, Submit } from "./form";
import { Field } from "./ui";
type CustomerValues = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  birthDate: Date | null;
  city: string | null;
  source: string | null;
  notes: string;
  ownerId: string;
  whatsappConsent: boolean;
};
export function CustomerForm({
  members,
  customer,
  defaultOwner,
}: {
  members: { id: string; user: { name: string } }[];
  customer?: CustomerValues;
  defaultOwner: string;
}) {
  return (
    <ActionForm kind="customer" customerId={customer?.id ?? ""}>
      <div className="fields">
        <Field label="Nome completo *">
          <input
            name="name"
            defaultValue={customer?.name}
            required
            minLength={3}
            maxLength={120}
          />
        </Field>
        <Field label="WhatsApp com DDD *">
          <input
            name="phone"
            type="tel"
            defaultValue={customer?.phone}
            required
            placeholder="(11) 99999-9999"
          />
        </Field>
        <Field label="E-mail">
          <input
            name="email"
            type="email"
            defaultValue={customer?.email ?? ""}
          />
        </Field>
        <Field label="Data de nascimento">
          <input
            name="birthDate"
            type="date"
            defaultValue={customer?.birthDate?.toISOString().slice(0, 10) ?? ""}
          />
        </Field>
        <Field label="Cidade">
          <input name="city" defaultValue={customer?.city ?? ""} />
        </Field>
        <Field label="Origem">
          <input
            name="source"
            placeholder="Loja física, Instagram, indicação…"
            defaultValue={customer?.source ?? ""}
          />
        </Field>
        <Field label="Responsável *">
          <select
            name="ownerId"
            defaultValue={customer?.ownerId ?? defaultOwner}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.user.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="full">
          <Field label="Observações">
            <textarea
              name="notes"
              defaultValue={customer?.notes ?? ""}
              maxLength={2000}
            />
          </Field>
        </div>
        <label className="checkbox full">
          <input
            type="checkbox"
            name="whatsappConsent"
            defaultChecked={customer?.whatsappConsent}
          />
          Cliente autorizou contato por WhatsApp
        </label>
      </div>
      <div>
        <Submit>Salvar cliente</Submit>
      </div>
    </ActionForm>
  );
}
