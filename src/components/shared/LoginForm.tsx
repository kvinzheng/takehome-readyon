"use client";

import React, { useActionState, useRef } from "react";
import { login } from "@/app/actions";

const DEMO_ACCOUNTS = [
  { label: "Employee (Alice)", email: "alice@readyon.com", password: "alice123" },
  { label: "Manager (Carol)", email: "carol@readyon.com", password: "carol123" },
];

export function LoginForm() {
  const [error, formAction, isPending] = useActionState(login, null);
  const formRef = useRef<HTMLFormElement>(null);

  function signInAs(email: string, password: string) {
    const form = formRef.current;
    if (!form) return;
    (form.elements.namedItem("email") as HTMLInputElement).value = email;
    (form.elements.namedItem("password") as HTMLInputElement).value = password;
    form.requestSubmit();
  }

  return (
    <form
      ref={formRef}
      action={formAction}
      className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm"
    >
      <h1 className="mb-6 text-lg font-semibold text-gray-900">Sign in</h1>

      <div className="mb-4">
        <label
          htmlFor="email"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@readyon.com"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      <div className="mb-6">
        <label
          htmlFor="password"
          className="mb-1 block text-sm font-medium text-gray-700"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isPending ? "Signing in…" : "Sign in"}
      </button>

      <div className="mt-6 rounded-lg bg-gray-50 p-3">
        <p className="mb-2 text-xs font-medium text-gray-700">Demo accounts</p>
        <div className="flex flex-col gap-2">
          {DEMO_ACCOUNTS.map((acct) => (
            <button
              key={acct.email}
              type="button"
              disabled={isPending}
              onClick={() => signInAs(acct.email, acct.password)}
              data-testid={`demo-signin-${acct.email}`}
              className="rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Sign in as {acct.label}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
