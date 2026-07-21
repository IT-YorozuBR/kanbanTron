import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { hasAnyUser } from "@/lib/auth-actions";
import { LoginForm } from "@/components/auth/login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");
  if (!(await hasAnyUser())) redirect("/setup");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="aero-glass w-full max-w-sm p-6">
        <h1 className="mb-1 text-xl font-extrabold tracking-tight">Entrar</h1>
        <p className="mb-5 text-sm text-black/60 dark:text-white/60">Acesse com seu email e senha.</p>
        <LoginForm />
      </div>
    </main>
  );
}
