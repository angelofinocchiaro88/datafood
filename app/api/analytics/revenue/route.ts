import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const period = searchParams.get("period") || "month"; // day, week, month

  let startDate: Date;
  const now = new Date();

  switch (period) {
    case "day":
      startDate = new Date(now.setHours(0, 0, 0, 0));
      break;
    case "week":
      startDate = new Date(now.setDate(now.getDate() - 7));
      break;
    case "month":
      startDate = new Date(now.setMonth(now.getMonth() - 1));
      break;
    default:
      startDate = new Date(now.setMonth(now.getMonth() - 1));
  }

  const dailySummaries = await prisma.dailySummary.findMany({
    where: { date: { gte: startDate } },
    orderBy: { date: "asc" },
  });

  const totalRevenue = dailySummaries.reduce((sum, d) => sum + d.totalRevenue, 0);
  const totalCovers = dailySummaries.reduce((sum, d) => sum + d.coverCount, 0);
  const totalTransactions = dailySummaries.reduce((sum, d) => sum + d.transactionCount, 0);
  const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

  // Calculate trend (compare to previous period)
  const periodLength = dailySummaries.length;
  const midpoint = Math.floor(periodLength / 2);
  const firstHalf = dailySummaries.slice(0, midpoint);
  const secondHalf = dailySummaries.slice(midpoint);

  const firstHalfRevenue = firstHalf.reduce((sum, d) => sum + d.totalRevenue, 0);
  const secondHalfRevenue = secondHalf.reduce((sum, d) => sum + d.totalRevenue, 0);

  const trend = firstHalfRevenue > 0
    ? ((secondHalfRevenue - firstHalfRevenue) / firstHalfRevenue) * 100
    : 0;

  // Daily chart data
  const chartData = dailySummaries.map((d) => ({
    date: d.date.toISOString().split("T")[0],
    revenue: d.totalRevenue,
    covers: d.coverCount,
    transactions: d.transactionCount,
    averageTicket: d.averageTicket,
  }));

  return NextResponse.json({
    period,
    totalRevenue,
    totalCovers,
    totalTransactions,
    averageTicket,
    trend: parseFloat(trend.toFixed(1)),
    chartData,
  });
}