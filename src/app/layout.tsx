import { SessionPersistenceGate } from "@/components/auth/session-persistence-gate";
import type { Metadata } from "next";
import { JetBrains_Mono, Manrope } from "next/font/google";
import "./globals.css";

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kredio",
  description: "Gestion de clientes, campanas, compras y pagos para ventas a credito",
  icons: {
    icon: "/kredio-icon.svg",
    shortcut: "/kredio-icon.svg",
    apple: "/kredio-icon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${manrope.variable} ${jetBrainsMono.variable} antialiased`}>
        <SessionPersistenceGate />
        {children}
      </body>
    </html>
  );
}
