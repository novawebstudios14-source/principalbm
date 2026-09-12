"use client";
import { useState } from "react";
import { createAuthClient } from "better-auth/react";
import { Heart, ArrowRight } from "lucide-react";
const auth = createAuthClient();
export default function Login() {
  const [error, setError] = useState(""),
    [pending, setPending] = useState(false);
  return (
    <div className="login">
      <section className="login-story">
        <div className="brand">
          <Heart /> principal
        </div>
        <div>
          <span className="eyebrow">PERTO EM CADA FASE</span>
          <h1>
            O próximo capítulo
            <br />
            começa com
            <br />
            <em>um cuidado.</em>
          </h1>
          <p>
            Conheça a história de cada família.
            <br />
            Esteja presente nos momentos que importam.
          </p>
        </div>
        <small>CRM para maternidade, bebê e infantil.</small>
      </section>
      <section className="login-form">
        <div>
          <span className="eyebrow">BEM-VINDO À PRINCIPAL</span>
          <h2>
            Vamos cuidar dos
            <br />
            próximos momentos?
          </h2>
          <p>Entre com sua conta da equipe.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setPending(true);
              setError("");
              const data = new FormData(e.currentTarget);
              try {
                const result = await auth.signIn.email({
                  email: String(data.get("email")),
                  password: String(data.get("password")),
                });
                if (result.error)
                  setError("E-mail ou senha inválidos. Tente novamente.");
                else window.location.href = "/dashboard";
              } catch {
                setError("Não foi possível entrar. Tente novamente.");
              } finally {
                setPending(false);
              }
            }}
          >
            <label className="field">
              E-mail
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
                placeholder="voce@loja.com.br"
              />
            </label>
            <label className="field">
              Senha
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
                minLength={12}
              />
            </label>
            {error && (
              <p role="alert" className="feedback error">
                {error}
              </p>
            )}
            <button disabled={pending} className="button-link">
              {pending ? "Entrando…" : "Entrar na Principal"}
              <ArrowRight size={18} />
            </button>
          </form>
          <small>
            Precisa de acesso? Fale com a pessoa responsável pela loja.
          </small>
        </div>
      </section>
    </div>
  );
}
