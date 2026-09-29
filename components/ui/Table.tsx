import React from "react";

export function Table({ className = "", ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return <div className="w-full overflow-auto"><table className={`w-full border-collapse ${className}`} {...props} /></div>;
}

export function TableHeader({ className = "", ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={`bg-gray-50 border-b border-gray-200 ${className}`} {...props} />;
}

export function TableBody({ className = "", ...props }: React.TableHTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={`bg-white divide-y divide-gray-100 ${className}`} {...props} />;
}

export function TableRow({ className = "", ...props }: React.TableHTMLAttributes<HTMLTableRowElement>) {
  return <tr className={`hover:bg-gray-50 transition-colors ${className}`} {...props} />;
}

export function TableHead({ className = "", ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return <th className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${className}`} {...props} />;
}

export function TableCell({ className = "", ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={`px-4 py-3 text-sm text-gray-700 ${className}`} {...props} />;
}
