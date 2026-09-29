"use client";

interface LogoProps {
  size?: number;
  className?: string;
  showText?: boolean;
  dark?: boolean;
}

// Logo DATAFOOD: un piatto (cerchio) con grafico a barre che sale (dati + cibo)
export function DatafoodLogo({ size = 40, className = "", showText = false, dark = true }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="dfGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0ea5e9" />
            <stop offset="1" stopColor="#10b981" />
          </linearGradient>
        </defs>
        {/* Piatto */}
        <circle cx="24" cy="24" r="22" fill="url(#dfGrad)" />
        <circle cx="24" cy="24" r="17.5" fill="white" fillOpacity="0.12" />
        {/* Barre grafico (dati) che salgono - formano la D */}
        <rect x="16" y="26" width="3.5" height="10" rx="1.2" fill="white" />
        <rect x="21.5" y="21" width="3.5" height="15" rx="1.2" fill="white" />
        <rect x="27" y="17" width="3.5" height="19" rx="1.2" fill="white" />
        {/* Forchetta stilizzata in alto */}
        <path d="M33 12 L33 17 M31.5 12 L31.5 17 M34.5 12 L34.5 17" stroke="white" strokeWidth="1.4" strokeLinecap="round" />
        <circle cx="33" cy="20" r="2.5" fill="white" />
      </svg>
      {showText && (
        <div className="leading-none">
          <span className={`font-bold text-lg tracking-tight ${dark ? "text-white" : "text-slate-900"}`}>
            DATA<span style={{ fontFamily: "'Playfair Display', serif", fontStyle: "italic" }}>food</span>
          </span>
        </div>
      )}
    </div>
  );
}