import { LoginForm } from "@/components/LoginForm";

export default function LoginPage() {
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


