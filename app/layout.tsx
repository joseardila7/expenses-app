import type { Metadata } from "next";

import { ToastViewport } from "@/components/toast-viewport";

import "./globals.css";

export const metadata: Metadata = {
  title: "Gastos App",
  description: "Controla gastos compartidos con una experiencia clara y visual.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full flex flex-col">
        {children}
        <ToastViewport />
      </body>
    </html>
  );
}
