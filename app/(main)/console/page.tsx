import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { getChatHistory, getOrCreateUser } from "@/db/queries";
import { ChatWindow } from "@/components/console/chat-window";
import { Message } from "@/components/console/chat-context";

export default async function ConsolePage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in");

  const clerkUser = await currentUser();
  const email = clerkUser?.emailAddresses[0]?.emailAddress ?? "";
  const name = clerkUser?.fullName ?? "";
  const user = await getOrCreateUser(clerkId, email, name);
  if (!user) redirect("/sign-in");

  const dbHistory = await getChatHistory(user.id);
  const history: Message[] = dbHistory.map((m) => ({
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt: m.createdAt.toISOString(),
  }));

  return (
    <div className="fixed inset-0 left-40 lg:left-64 flex flex-col">
      <ChatWindow history={history} />
    </div>
  );
}
