"use server";

import { encrypt } from "@/lib/encryption";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export async function saveApiKeys(formData: FormData) {
  const { userId: clerkId } = await auth();
  if (!clerkId) throw new Error("Unauthorized");

  const openaiKey = formData.get("openaiApiKey") as string | null;
  const calcomKey = formData.get("calcomApiKey") as string | null;

  const [user] = await db
    .select({ id: users.id, preferences: users.preferences })
    .from(users)
    .where(eq(users.clerkId, clerkId))
    .limit(1);

  if (!user) throw new Error("User not found");

  const current = (user.preferences as Record<string, string>) ?? {};

  const updated: Record<string, string> = { ...current };

  if (openaiKey && openaiKey.trim()) {
    updated.openaiApiKey = encrypt(openaiKey.trim());
  }
  if (calcomKey && calcomKey.trim()) {
    updated.calcomApiKey = encrypt(calcomKey.trim());
  }

  await db
    .update(users)
    .set({ preferences: updated })
    .where(eq(users.id, user.id));

  revalidatePath("/settings");
}
