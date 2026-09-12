import "./globals.css";
export const metadata = {
  title: { default: "Principal · CRM", template: "%s · Principal" },
  description:
    "Relacionamento com clientes para lojas de maternidade, bebê e infantil.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
