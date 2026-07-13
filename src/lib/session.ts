import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { toAdminPath } from "@/lib/admin-path";
import { authOptions } from "@/lib/auth";
import { ADMIN_USER_ID } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

export async function requireAdmin() {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id || session.user.id !== ADMIN_USER_ID) {
    redirect(toAdminPath("/login"));
  }

  const user = await prisma.user.findUnique({
    where: { id: ADMIN_USER_ID },
    select: { email: true, id: true, name: true, role: true },
  });

  if (!user || user.role !== "ADMIN") {
    redirect(toAdminPath("/login"));
  }

  return { session, user };
}
