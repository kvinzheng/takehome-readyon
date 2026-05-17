import { redirect } from "next/navigation";
import { auth, getSessionUser } from "@/auth";
import { LoginForm } from "@/components/shared/LoginForm";

export default async function LoginPage() {
  const session = await auth();
  if (session) {
    const user = getSessionUser(session);
    redirect(user.role === "manager" ? "/manager" : "/employee");
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold text-indigo-600">ReadyOn</span>
          <p className="mt-1 text-sm text-gray-500">Time-Off Management</p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}


