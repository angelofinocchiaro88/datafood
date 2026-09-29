"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Badge } from "@/components/ui";
import { Save, User, Bell, Database, Link, RefreshCw, MessageSquare, Settings, History, Trash2, Bot, CheckCircle2, XCircle, Download, Mail } from "lucide-react";

interface ChatSession {
  id: string;
  title: string;
  updatedAt: string;
}

interface OllamaStatus {
  running: boolean;
  models?: { name: string; size: string }[];
  recommended?: string;
  modelCount?: number;
  error?: string;
  message?: string;
}

export default function SettingsPage() {
  const [cassaApiKey, setCassaApiKey] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const [ollamaStatus, setOllamaStatus] = useState<OllamaStatus | null>(null);
  const [ollamaChecking, setOllamaChecking] = useState(false);
  const [ollamaModel, setOllamaModel] = useState("llama3.2");

  // Email config
  const [emailConfig, setEmailConfig] = useState<any>({ configured: false });
  const [emailForm, setEmailForm] = useState({ host: "", port: "587", secure: false, user: "", password: "", fromName: "DATAFOOD", fromEmail: "", replyTo: "", enabled: false });
  const [emailSaved, setEmailSaved] = useState("");

  useEffect(() => {
    fetchChatSessions();
    checkOllama();
    fetchEmailConfig();
  }, []);

  const fetchEmailConfig = async () => {
    try {
      const res = await fetch("/api/email/config");
      const data = await res.json();
      setEmailConfig(data);
      if (data.configured) {
        setEmailForm({ host: data.host, port: String(data.port), secure: data.port === "465", user: data.user, password: "", fromName: data.fromName, fromEmail: data.fromEmail, replyTo: data.replyTo || "", enabled: data.enabled });
      }
    } catch {}
  };

  const saveEmailConfig = async () => {
    const res = await fetch("/api/email/config", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(emailForm),
    });
    const data = await res.json();
    if (data.success) { setEmailSaved("✅ Configurazione email salvata"); setEmailConfig({ configured: true, ...emailForm }); }
    else setEmailSaved("⚠️ " + (data.error || "Errore"));
  };

  const checkOllama = async () => {
    setOllamaChecking(true);
    try {
      const res = await fetch("/api/ollama/status");
      const data = await res.json();
      setOllamaStatus(data);
      if (data.models?.length && data.recommended) {
        setOllamaModel(data.recommended);
      }
    } catch (e) {
      console.error("Ollama check failed");
    }
    setOllamaChecking(false);
  };

  const fetchChatSessions = async () => {
    setLoadingSessions(true);
    try {
      const res = await fetch("/api/chat/sessions");
      const data = await res.json();
      setChatSessions(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error("Failed to fetch chat sessions");
    }
    setLoadingSessions(false);
  };

  const handleSyncCassa = async () => {
    if (!cassaApiKey) return;
    setSyncing(true);
    try {
      const res = await fetch("/api/cassa/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: cassaApiKey }),
      });
      const data = await res.json();
      if (data.success) setLastSync(new Date().toLocaleString());
      else alert("Sync fallita: " + data.error);
    } catch (e) { alert("Errore sync"); }
    setSyncing(false);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("Eliminare questa conversazione?")) return;
    try {
      await fetch(`/api/chat/sessions?sessionId=${sessionId}`, { method: "DELETE" });
      fetchChatSessions();
    } catch (e) { console.error("Failed to delete session"); }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-heading font-bold text-gray-900">Impostazioni</h1>
        <p className="text-gray-500 mt-1">Configura il sistema e le integrazioni</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />AI Chat - Ollama
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`rounded-lg p-4 flex items-start gap-3 ${ollamaStatus?.running ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
            {ollamaChecking ? (
              <RefreshCw className="w-5 h-5 animate-spin text-gray-500 mt-0.5" />
            ) : ollamaStatus?.running ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 mt-0.5" />
            ) : (
              <XCircle className="w-5 h-5 text-amber-600 mt-0.5" />
            )}
            <div className="flex-1">
              {ollamaChecking ? (
                <p className="text-sm">Verifica in corso...</p>
              ) : ollamaStatus?.running ? (
                <>
                  <p className="font-medium text-emerald-800">Ollama attivo</p>
                  <p className="text-sm text-emerald-700 mt-1">
                    {ollamaStatus.modelCount} modelli trovati.
                    {ollamaStatus.recommended && <span> Consigliato: <strong>{ollamaStatus.recommended}</strong></span>}
                  </p>
                  {ollamaStatus.models && ollamaStatus.models.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {ollamaStatus.models.map((m) => (
                        <Badge key={m.name} variant={m.name === ollamaStatus.recommended ? "success" : "secondary"}>
                          {m.name} ({m.size})
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-3">
                    <label className="text-sm font-medium text-gray-700 block mb-1">Modello predefinito</label>
                    <select
                      value={ollamaModel}
                      onChange={(e) => setOllamaModel(e.target.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    >
                      {ollamaStatus.models?.map((m) => (
                        <option key={m.name} value={m.name}>{m.name} ({m.size})</option>
                      ))}
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <p className="font-medium text-amber-800">Ollama non rilevato</p>
                  <p className="text-sm text-amber-700 mt-1">{ollamaStatus?.message}</p>
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium">Per installare:</p>
                    <ol className="text-sm text-amber-700 list-decimal list-inside space-y-1">
                      <li>Scarica Ollama da <a href="https://ollama.com" className="underline" target="_blank" rel="noopener">ollama.com</a></li>
                      <li>Installa e avvia Ollama</li>
                      <li>Apri il terminale e scrivi: <code className="bg-amber-100 px-1 rounded">ollama pull llama3.2</code></li>
                      <li>Torna qui e clicca "Verifica"</li>
                    </ol>
                    <Button size="sm" variant="outline" onClick={checkOllama} className="mt-2">
                      <RefreshCw className="w-4 h-4 mr-1" /> Verifica
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Link className="w-5 h-5" />Integrazioni POS</CardTitle></CardHeader>
        <CardContent className="space-y-6">
          <div className="border-b pb-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-medium flex items-center gap-2">Cassa in Cloud <Badge variant="success">API</Badge></h3>
                <p className="text-sm text-gray-500">Sincronizza vendite, scontrini e listini</p>
              </div>
            </div>
            <div className="space-y-3">
              <Input label="API Key" type="password" value={cassaApiKey} onChange={(e) => setCassaApiKey(e.target.value)} placeholder="Inserisci la tua API key" />
              <div className="flex items-center gap-3">
                <Button onClick={handleSyncCassa} disabled={syncing || !cassaApiKey}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                  {syncing ? "Sincronizzazione..." : "Sincronizza"}
                </Button>
                {lastSync && <span className="text-sm text-gray-500">Ultima sync: {lastSync}</span>}
              </div>
            </div>
          </div>

          <div className="border-b pb-4">
            <div className="flex items-center justify-between">
              <div><h3 className="font-medium">SumUp</h3><p className="text-sm text-gray-500">Pagamenti e transazioni POS</p></div>
              <Badge variant="secondary">Prossimamente</Badge>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between">
              <div><h3 className="font-medium">Passpartout</h3><p className="text-sm text-gray-500">Gestione cassa completa</p></div>
              <Badge variant="secondary">Prossimamente</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5" />Memoria Chat
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">Le conversazioni sono salvate nel database e l'AI carica la cronologia per rispondere in contesto.</p>
          {loadingSessions ? (
            <p className="text-sm text-gray-500">Caricamento...</p>
          ) : chatSessions.length === 0 ? (
            <p className="text-sm text-gray-500">Nessuna conversazione.</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {chatSessions.slice(0, 10).map((s) => (
                <div key={s.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-sm truncate max-w-80">{s.title}</p>
                    <p className="text-xs text-gray-500">{new Date(s.updatedAt).toLocaleString("it-IT")}</p>
                  </div>
                  <button onClick={() => handleDeleteSession(s.id)} className="text-red-500 hover:text-red-700 p-1"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" /> Sistema Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={`rounded-lg p-3 text-sm ${emailConfig.configured ? "bg-emerald-50 border border-emerald-200 text-emerald-800" : "bg-amber-50 border border-amber-200 text-amber-800"}`}>
            {emailConfig.configured ? "✅ SMTP configurato — invio email attivo" : "⚠️ Non configurato — le email sono in modalità test (simulate e loggate)"}
          </div>
          <p className="text-xs text-gray-500">
            Predisposizione sistema email per invio ordini ai fornitori, report e notifiche. Configura un account SMTP (es. Gmail, Zoho, Postale) per attivare l'invio reale.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Host SMTP" value={emailForm.host} onChange={e => setEmailForm({...emailForm, host: e.target.value})} placeholder="smtp.gmail.com" />
            <Input label="Porta" value={emailForm.port} onChange={e => setEmailForm({...emailForm, port: e.target.value})} placeholder="587" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Utente" value={emailForm.user} onChange={e => setEmailForm({...emailForm, user: e.target.value})} placeholder="tuo@email.com" />
            <Input label="Password / App Password" type="password" value={emailForm.password} onChange={e => setEmailForm({...emailForm, password: e.target.value})} placeholder="••••••••" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nome mittente" value={emailForm.fromName} onChange={e => setEmailForm({...emailForm, fromName: e.target.value})} placeholder="DATAFOOD" />
            <Input label="Email mittente" value={emailForm.fromEmail} onChange={e => setEmailForm({...emailForm, fromEmail: e.target.value})} placeholder="noreply@tuo.it" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={emailForm.secure} onChange={e => setEmailForm({...emailForm, secure: e.target.checked})} className="w-4 h-4" />
            Connessione sicura (SSL/TLS)
          </label>
          {emailSaved && <p className="text-sm text-emerald-700">{emailSaved}</p>}
          <Button onClick={saveEmailConfig}><Save className="w-4 h-4 mr-2" /> Salva Configurazione</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><User className="w-5 h-5" />Profilo</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Nome" defaultValue="Mario" />
            <Input label="Cognome" defaultValue="Rossi" />
          </div>
          <Input label="Email" type="email" defaultValue="mario.rossi@ristorante.it" />
          <Input label="Telefono" defaultValue="+39 333 1234567" />
          <Button><Save className="w-4 h-4 mr-2" />Salva</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Database className="w-5 h-5" />Sistema</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-gray-600">Database SQLite locale. I dati sono archiviati sul tuo PC.</p>
          <div className="flex gap-3">
            <Button variant="outline">Esporta</Button>
            <Button variant="outline">Importa</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}