"use client";

import { usePathname } from "next/navigation";
import { Home, ChevronRight } from "lucide-react";

const routeNames: Record<string, string> = {
  "/": "Dashboard",
  "/menu": "Gestione Menu",
  "/magazzino": "Magazzino",
  "/fornitori": "Fornitori",
  "/food-cost": "Food Cost",
  "/report": "Report",
  "/settings": "Impostazioni",
};

export function Header() {
  const pathname = usePathname();
  const currentPage = routeNames[pathname] || "Pagina";

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Home className="w-4 h-4" />
        <ChevronRight className="w-4 h-4" />
        <span className="text-gray-900 font-medium">{currentPage}</span>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium text-gray-900">Mario Rossi</p>
          <p className="text-xs text-gray-500">Proprietario</p>
        </div>
        <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-medium">MR</div>
      </div>
    </header>
  );
}
