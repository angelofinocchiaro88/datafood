import { PrismaClient } from "@prisma/client";
import { headers } from "next/headers";
const { applyClientToWhere, applyClientToData } = require("./tenant-scope.cjs") as {
  applyClientToWhere: (model: string, where: any, clientId: string) => any;
  applyClientToData: (model: string, data: any, clientId: string) => any;
};

async function requestContext() {
  try {
    const requestHeaders = await headers();
    const platformRole = requestHeaders.get("x-df-platform-role");
    const selectedClientId = requestHeaders.get("x-df-client-id");
    const userId = requestHeaders.get("x-df-user-id");
    return {
      clientId: selectedClientId || (platformRole === "datafood_admin" ? null : userId ? "__no_selected_client__" : "default"),
      userId,
      platformRole,
      membershipRole: requestHeaders.get("x-df-membership-role"),
    };
  } catch {
    // Fail closed in production if a request loses its middleware tenant context.
    if (process.env.NODE_ENV === "production") throw new Error("Tenant request context unavailable");
    // Local scripts/seeds without HTTP context use the legacy tenant.
    return { clientId: "default", userId: null, platformRole: null, membershipRole: null };
  }
}

function createPrisma() {
  const base = new PrismaClient();
  const noAutomaticAudit = new Set(["Order", "OrderItem", "Movement", "CashTransaction", "PaymentSchedule"]);
  const manuallyAuditedModels = new Set(["Client", "Sale", "Invoice", "FatturaEmessa", "UserInvitation", "ClientAuditLog"]);
  return base.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const context = await requestContext();
          const { clientId } = context;
          if (!clientId || model === "Client" || model === "User" || model === "UserSession" || model === "ClientMembership" || model === "UserInvitation" || model === "ClientAuditLog" || model === "UserMemory") {
            return query(args);
          }

          const scopedArgs = args as any;
          if (["findUnique", "findUniqueOrThrow", "findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy", "update", "updateMany", "delete", "deleteMany", "upsert"].includes(operation)) {
            scopedArgs.where = applyClientToWhere(model, scopedArgs.where || {}, clientId);
          }
          if (operation === "create" || operation === "update" || operation === "updateMany") scopedArgs.data = applyClientToData(model, scopedArgs.data, clientId);
          if (operation === "createMany") scopedArgs.data = applyClientToData(model, scopedArgs.data, clientId);
          if (operation === "upsert") {
            scopedArgs.create = applyClientToData(model, scopedArgs.create, clientId);
            scopedArgs.update = applyClientToData(model, scopedArgs.update, clientId);
          }
          const result: any = await query(scopedArgs);
          const mutation = ["create", "createMany", "update", "updateMany", "upsert", "delete", "deleteMany"].includes(operation);
          if (mutation && context.userId && !noAutomaticAudit.has(model) && !manuallyAuditedModels.has(model)) {
            const entityId = typeof result?.id === "string" ? result.id : null;
            const source = context.membershipRole === "datafood_operator" ? "datafood_operator" : context.platformRole === "datafood_admin" ? "datafood_admin" : "restaurant_user";
            try {
              await base.clientAuditLog.create({ data: { clientId, actorUserId: context.userId, action: `${model.toLocaleLowerCase()}_${operation}`, entity: model, entityId, source } });
            } catch (error) {
              console.error("Client data audit log failed:", error);
            }
          }
          return result;
        },
      },
    },
  });
}

const globalForPrisma = globalThis as unknown as { prisma: ReturnType<typeof createPrisma> | undefined };
export const prisma = globalForPrisma.prisma ?? createPrisma();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
