const OLLAMA_HOST = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";

export interface OllamaModel {
  name: string;
  modified_at: string;
  size: number;
}

export interface OllamaStatus {
  running: boolean;
  version?: string;
  models?: OllamaModel[];
  error?: string;
}

export async function checkOllama(): Promise<OllamaStatus> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return { running: false, error: `HTTP ${res.status}` };
    const data = await res.json();
    const models: OllamaModel[] = (data.models || []).map((m: OllamaModel) => ({
      name: m.name,
      modified_at: m.modified_at,
      size: m.size,
    }));
    return { running: true, models };
  } catch (e) {
    return { running: false, error: e instanceof Error ? e.message : "Ollama non raggiungibile" };
  }
}

export async function listModels(): Promise<OllamaModel[]> {
  const res = await fetch(`${OLLAMA_HOST}/api/tags`, { signal: AbortSignal.timeout(5000) });
  const data = await res.json();
  return (data.models || []).map((m: OllamaModel) => ({
    name: m.name,
    modified_at: m.modified_at,
    size: m.size,
  }));
}

export async function pullModel(model: string): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_HOST}/api/pull`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: model }),
      signal: AbortSignal.timeout(120000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function generateChat(
  model: string,
  messages: { role: string; content: string }[],
  systemPrompt?: string,
): Promise<string> {
  const ollamaMessages = systemPrompt
    ? [{ role: "system", content: systemPrompt }, ...messages]
    : messages;

  const res = await fetch(`${OLLAMA_HOST}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: ollamaMessages,
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.9,
      },
    }),
    signal: AbortSignal.timeout(60000),
  });

  if (!res.ok) throw new Error(`Ollama error: ${res.statusText}`);
  const data = await res.json();
  return data.message?.content || "";
}

export async function getChatResponse(
  model: string,
  message: string,
  history: { role: string; content: string }[],
  dbContext?: string,
): Promise<string> {
  const systemPrompt = `Sei l'assistente AI di RistoGest, un software di controllo di gestione per ristoranti italiani.

Rispondi SEMPRE in italiano. Sii conciso, professionale e amichevole.

Puoi aiutare con:
- Food Cost: analisi costi ingredienti, margini per piatto
- Vendite: statistiche, incassi, ticket medio
- Menu: gestione piatti e categorie
- Magazzino: scorte ingredienti, alert
- Fornitori: elenco e gestione
- Fatture SDI: fatture elettroniche
- Report: bilanci e analisi

Se l'utente chiede dati numerici, calcolali e forniscili.
Se l'utente chiede di navigare, suggerisci la pagina (es. "Vai al menu").
Se non capisci, chiedi chiarimenti.

${dbContext ? `\nContesto dal database:\n${dbContext}` : ""}`;

  const chatMessages = [
    ...history.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content: message },
  ];

  return generateChat(model, chatMessages, systemPrompt);
}

export function getRecommendedModel(models: OllamaModel[]): string {
  const preferences = [
    "llama3.2",
    "llama3.1",
    "llama3",
    "mistral",
    "phi3",
    "phi3.5",
    "gemma2",
    "qwen2.5",
    "tinyllama",
  ];

  for (const preferred of preferences) {
    const found = models.find((m) => m.name.startsWith(preferred));
    if (found) return found.name;
  }

  if (models.length > 0) return models[0].name;
  return "llama3.2";
}

export function formatModelSize(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}