import { auth, getSessionUser } from "@/auth";
import { redirect } from "next/navigation";

export default async function Home() {
  const session = await auth();
  if (!session) redirect("/login");
  if (getSessionUser(session).role === "manager") redirect("/manager");
  redirect("/employee");
}
