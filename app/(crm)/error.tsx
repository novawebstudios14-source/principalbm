"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <div className="empty">
      <h2>Não foi possível carregar as informações.</h2>
      <p>
        Tente novamente. Se o problema continuar, verifique a conexão com o
        banco.
      </p>
      <button className="button-link" onClick={reset}>
        Tentar novamente
      </button>
    </div>
  );
}
