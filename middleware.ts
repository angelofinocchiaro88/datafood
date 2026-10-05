import { NextRequest, NextResponse } from "next/server";

const PUBLIC_API = new Set([
  "/api/auth/status",
  "/api/auth/bootstrap",
  "/api/auth/login",
  "/api/auth/accept-invitation",
]);

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function readClaims(token: string) {
  const secret = process.env.DATAFOOD_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  try {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
    if (!await crypto.subtle.verify("HMAC", key, decodeBase64Url(signature), new TextEncoder().encode(payload))) return null;
    const claims = JSON.parse(new TextDecoder().decode(decodeBase64Url(payload)));
    return typeof claims.exp === "number" && claims.exp * 1000 > Date.now() && typeof claims.sub === "string" && typeof claims.sid === "string" ? claims : null;
  } catch { return null; }
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico") return NextResponse.next();
  if (pathname === "/login" || pathname.startsWith("/invite/")) return NextResponse.next();
  if ((pathname.startsWith("/api/auth/") && PUBLIC_API.has(pathname)) || (request.method === "GET" && /^\/api\/auth\/invitations\/[^/]+$/.test(pathname))) return NextResponse.next();

  const token = request.cookies.get("df_session")?.value;
  const claims = token ? await readClaims(token) : null;
  if (!claims) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Autenticazione richiesta" }, { status: 401 });
    const login = new URL("/login", request.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  const selectedClientId = request.cookies.get("df_clientId")?.value || claims.memberships?.[0]?.clientId || "";
  const isPlatformAdmin = claims.platformRole === "datafood_admin";
  const membership = claims.memberships?.find((item: any) => item.clientId === selectedClientId);
  if (selectedClientId && !membership && !isPlatformAdmin) {
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Ristorante selezionato non autorizzato" }, { status: 403 })
      : NextResponse.redirect(new URL("/login?error=client_access", request.url));
  }
  if (membership) {
    const now = Date.now();
    const licenseValid = membership.clientActive && ["trial", "active"].includes(membership.licenseStatus)
      && new Date(membership.licenseStartsAt).getTime() <= now
      && (!membership.licenseEndsAt || new Date(membership.licenseEndsAt).getTime() >= now);
    const licenseManagementPath = pathname === "/clients" || pathname === "/api/auth/me" || pathname.startsWith("/api/clients");
    if (!licenseValid && !licenseManagementPath) return pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Licenza non attiva", code: "LICENSE_INACTIVE" }, { status: 402 })
      : NextResponse.redirect(new URL("/login?error=license", request.url));
    const serviceManagementPath = pathname === "/clients" || pathname.startsWith("/api/clients") || pathname === "/api/auth/me";
    if (membership.role === "datafood_operator" && (!membership.managedAccess || !membership.managedServiceEnabled || !["managed", "hybrid"].includes(membership.serviceMode)) && !serviceManagementPath) {
      return pathname.startsWith("/api/")
        ? NextResponse.json({ error: "Incarico DATAFOOD non attivo" }, { status: 403 })
        : NextResponse.redirect(new URL("/login?error=service_access", request.url));
    }
  }

  if (!selectedClientId && !isPlatformAdmin && pathname !== "/clients" && !pathname.startsWith("/api/auth/")) {
    return pathname.startsWith("/api/")
      ? NextResponse.json({ error: "Nessun ristorante associato all’account" }, { status: 403 })
      : NextResponse.redirect(new URL("/clients", request.url));
  }

  const writeRequest = ["POST", "PUT", "PATCH", "DELETE"].includes(request.method);
  const tenantAdministration = pathname === "/api/clients" || pathname.startsWith("/api/clients/");
  if (writeRequest && isPlatformAdmin && !tenantAdministration && !pathname.startsWith("/api/auth/")) {
    const explicitServiceGrant = membership?.role === "datafood_operator" && membership.managedAccess === true && membership.managedServiceEnabled === true && ["managed", "hybrid"].includes(membership.serviceMode);
    if (!explicitServiceGrant) return NextResponse.json({ error: "Per inserire dati per un ristorante serve un incarico gestito esplicito" }, { status: 403 });
  }
  if (writeRequest && !isPlatformAdmin && !pathname.startsWith("/api/auth/")) {
    const role = membership?.role;
    const financePaths = ["/api/sales", "/api/cashflow/", "/api/invoices", "/api/fatture-emesse", "/api/budget-targets"];
    const staffPaths = ["/api/sales", "/api/cashflow/transactions"];
    const allowed = role === "owner" || role === "manager"
      || (role === "accountant" && financePaths.some(path => pathname.startsWith(path)))
      || (role === "staff" && staffPaths.some(path => pathname.startsWith(path)))
      || (role === "datafood_operator" && membership?.managedAccess === true);
    if (!allowed) return NextResponse.json({ error: "Permesso di modifica insufficiente" }, { status: 403 });
  }

  const headers = new Headers(request.headers);
  headers.set("x-df-user-id", claims.sub);
  headers.set("x-df-platform-role", claims.platformRole || "restaurant_user");
  if (selectedClientId) headers.set("x-df-client-id", selectedClientId);
  if (membership) {
    headers.set("x-df-membership-role", membership.role);
    headers.set("x-df-managed-access", String(membership.managedAccess));
  }
  const response = NextResponse.next({ request: { headers } });
  if (!request.cookies.get("df_clientId") && selectedClientId) response.cookies.set("df_clientId", selectedClientId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
  return response;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
