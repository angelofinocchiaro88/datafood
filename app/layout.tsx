import type { Metadata } from "next";
import { ToastProvider } from "@/components/ui";
import { Sidebar } from "@/components/layout";
import "./globals.css";

export const metadata: Metadata = {
  title: "DATAFOOD - Controllo di Gestione Ristorante",
  description: "Software completo per la gestione economica del tuo ristorante",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-gray-100">
        <ToastProvider>
          <div className="flex min-h-screen">
            <Sidebar />
            <main className="flex-1 min-h-screen">
              <div className="p-6 max-w-7xl mx-auto">{children}</div>
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}