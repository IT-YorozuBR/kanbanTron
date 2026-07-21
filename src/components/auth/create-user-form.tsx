"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createUserForAnySector } from "@/lib/auth-actions";

export function CreateUserForm({ sectors }: { sectors: { id: string; name: string }[] }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [sectorId, setSectorId] = useState(sectors[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sectorId) {
      setError("Crie um setor primeiro.");
      return;
    }
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const res = await createUserForAnySector({ email, password, sectorId });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setEmail("");
      setPassword("");
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <input
        type="email"
        className="aero-input"
        placeholder="Email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <input
        type="password"
        className="aero-input"
        placeholder="Senha (min. 8 caracteres)"
        value={password}
        minLength={8}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      <select className="aero-input" value={sectorId} onChange={(e) => setSectorId(e.target.value)}>
        <option value="" disabled>
          Selecione um setor
        </option>
        {sectors.map((sector) => (
          <option key={sector.id} value={sector.id}>
            {sector.name}
          </option>
        ))}
      </select>
      {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
      {success ? <p className="text-xs font-medium text-emerald-600">Usuario criado.</p> : null}
      <button type="submit" disabled={pending} className="aero-button aero-button-lime justify-center text-xs">
        Criar usuario
      </button>
    </form>
  );
}
