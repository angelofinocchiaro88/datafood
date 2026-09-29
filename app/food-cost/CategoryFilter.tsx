"use client";

import { useRouter } from "next/navigation";

export function CategoryFilter({
  categories,
  selected,
}: {
  categories: string[];
  selected: string;
}) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-500">Filtra:</span>
      <button
        onClick={() => router.push("/food-cost")}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          !selected
            ? "bg-primary text-white"
            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
        }`}
      >
        Tutti
      </button>
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => router.push(`/food-cost?cat=${encodeURIComponent(cat)}`)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            selected === cat
              ? "bg-primary text-white"
              : "bg-gray-100 text-gray-600 hover:bg-gray-200"
          }`}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}