export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="text-6xl font-heading font-bold text-primary">404</h1>
        <h2 className="text-2xl font-heading font-semibold text-gray-900 mt-4">
          Pagina non trovata
        </h2>
        <p className="text-gray-500 mt-2">
          La pagina che stai cercando non esiste.
        </p>
        <a
          href="/"
          className="inline-block mt-6 px-6 py-3 bg-primary text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          Torna alla Dashboard
        </a>
      </div>
    </div>
  );
}
