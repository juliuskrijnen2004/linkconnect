import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export default async function AdminLayout({ children }: { children: React.ReactNode }) { const session = await getCurrentSession(); if (!session) redirect("/inloggen"); if (session.role !== "ADMIN") redirect("/dashboard"); return children; }
