import Link from "next/link";
export default function NotFound() {
  return (
    <div className="empty">
      <h1>Registro não encontrado</h1>
      <Link href="/clientes">Voltar para clientes</Link>
    </div>
  );
}
