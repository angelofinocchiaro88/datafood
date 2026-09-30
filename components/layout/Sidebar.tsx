"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClientSelector } from "./ClientSelector";
import { DatafoodLogo } from "@/components/brand/DatafoodLogo";
import {
  UtensilsCrossed, Package, Truck, Receipt,
  TrendingUp, TrendingDown, Calculator, FileText, Settings, Target,
  ShoppingCart, DollarSign, ClipboardList, BarChart3, ChevronLeft, ChevronRight,
  PieChart, Home, Archive, BookOpenCheck, Wallet, LogOut, Users, Scale,
} from "lucide-react";
import { useState } from "react";

const SECTIONS = [
  {
    label: "PANORAMICA",
    color: "text-slate-700 border-slate-300",
    items: [
      { icon: BarChart3, label: "Dashboard", href: "/dashboard" },
    ],
  },
  {
    label: "RICETTARIO & FOOD COST",
    color: "text-emerald-700 border-emerald-300",
    items: [
      { icon: BookOpenCheck, label: "Menu Engineering", href: "/menu" },
      { icon: TrendingDown, label: "Food Cost", href: "/food-cost" },
    ],
  },
  {
    label: "VENDITE",
    color: "text-sky-700 border-sky-300",
    items: [
      { icon: Receipt, label: "Corrispettivi", href: "/corrispettivi" },
      { icon: FileText, label: "Fatture Emesse", href: "/fatture-emesse" },
      { icon: TrendingUp, label: "Vendite", href: "/vendite" },
    ],
  },
  {
    label: "ACQUISTI",
    color: "text-amber-700 border-amber-300",
    items: [
      { icon: Archive, label: "Fatture", href: "/accounting" },
      { icon: Truck, label: "Fornitori", href: "/fornitori" },
      { icon: ShoppingCart, label: "Ordini", href: "/ordini" },
    ],
  },
  {
    label: "MAGAZZINO",
    color: "text-orange-700 border-orange-300",
    items: [
      { icon: Package, label: "Magazzino", href: "/magazzino" },
    ],
  },
  {
    label: "PERSONALE",
    color: "text-rose-700 border-rose-300",
    items: [
      { icon: Users, label: "Personale", href: "/personale" },
    ],
  },
  {
    label: "CONTROLLO DI GESTIONE",
    color: "text-violet-700 border-violet-300",
    items: [
      { icon: TrendingUp, label: "Controllo di Gestione", href: "/controllo-gestione" },
      { icon: Scale, label: "Bilancio (CE + SP)", href: "/bilancio" },
      { icon: PieChart, label: "KPI Report", href: "/report" },
      { icon: Target, label: "Budget", href: "/budget" },
      { icon: Wallet, label: "Cash Flow", href: "/cash-flow" },
      { icon: Calculator, label: "Ammortamenti", href: "/ammortamenti" },
    ],
  },
  {
    label: "SISTEMA",
    color: "text-slate-500 border-slate-300",
    items: [
      { icon: Settings, label: "Impostazioni", href: "/settings" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const isHomePage = pathname === "/";
  if (isHomePage) return null;

  const handleLogout = () => {
    localStorage.removeItem("df_clientId");
    router.push("/");
  };

  return (
    <aside className={`${collapsed ? "w-16" : "w-60"} bg-white border-r border-slate-200 flex flex-col transition-all duration-200 overflow-hidden shrink-0`}>
      {/* Logo */}
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        {!collapsed ? (
          <Link href="/dashboard">
            <DatafoodLogo size={36} showText dark={false} />
          </Link>
        ) : (
          <Link href="/dashboard" className="mx-auto"><DatafoodLogo size={32} /></Link>
        )}
        <button onClick={() => setCollapsed(!collapsed)} className="text-slate-400 hover:text-slate-600 p-1 shrink-0">
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Client Selector */}
      {!collapsed && (
        <div className="px-3 py-2 border-b border-slate-200">
          <ClientSelector />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className={`px-3 py-1.5 mb-1 text-xs font-bold tracking-wide uppercase border-l-2 pl-2.5 ${section.color}`}>
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href.split("#")[0]));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isActive
                        ? "bg-emerald-50 text-emerald-700 font-medium"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <item.icon className={`w-5 h-5 flex-shrink-0 ${isActive ? "text-emerald-600" : "text-slate-400"}`} />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer - torna al control panel */}
      <div className="p-3 border-t border-slate-200 space-y-1">
        <button onClick={handleLogout}
          className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-900 transition-colors ${collapsed ? "justify-center" : ""}`}>
          <LogOut className="w-4 h-4" />
          {!collapsed && "Torna al Control Panel"}
        </button>
      </div>
    </aside>
  );
}
