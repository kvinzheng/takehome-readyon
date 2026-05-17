import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

export type UserRole = "employee" | "manager";

const USERS = [
  {
    id: "emp-1",
    name: "Alice Johnson",
    email: "alice@readyon.com",
    password: "alice123",
    role: "employee" as UserRole,
  },
  {
    id: "emp-3",
    name: "Carol Chen",
    email: "carol@readyon.com",
    password: "carol123",
    role: "manager" as UserRole,
  },
];

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const user = USERS.find(
          (u) =>
            u.email === credentials.email &&
            u.password === credentials.password
        );
        if (!user) return null;
        return { id: user.id, name: user.name, email: user.email, role: user.role };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: UserRole }).role;
      }
      return token;
    },
    session({ session, token }) {
      (session.user as unknown as Record<string, unknown>).id = token.id;
      (session.user as unknown as Record<string, unknown>).role = token.role;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});

/** Typed session user — role and id are always present after sign-in. */
export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: UserRole;
};

/** Cast session.user to SessionUser. Call only after confirming session != null. */
export function getSessionUser(session: { user?: unknown }): SessionUser {
  return session.user as SessionUser;
}
