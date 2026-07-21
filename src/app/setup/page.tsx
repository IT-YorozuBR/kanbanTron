import { redirect } from "next/navigation";
import { hasAnyUser } from "@/lib/auth-actions";
import { SetupForm } from "@/components/auth/setup-form";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await hasAnyUser()) redirect("/login");

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="aero-glass w-full max-w-sm p-6">
        <h1 className="mb-1 text-xl font-extrabold tracking-tight">Configuracao inicial</h1>
        <p className="mb-5 text-sm text-black/60 dark:text-white/60">
          Crie a conta de administrador. Esta tela some depois de concluida.
        </p>
        <SetupForm />
      </div>
    </main>
  );
}
