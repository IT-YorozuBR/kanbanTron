import { z } from "zod";

const cuid = z.string().min(1).max(64);
const email = z.string().trim().toLowerCase().email("Informe um email valido").max(200);
const password = z.string().min(8, "A senha precisa ter ao menos 8 caracteres").max(200);

export const setupAdminSchema = z.object({
  email,
  password,
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe a senha").max(200),
});

export const createSectorSchema = z.object({
  name: z.string().trim().min(1, "Informe um nome").max(60),
});

export const createUserForAnySectorSchema = z.object({
  email,
  password,
  sectorId: cuid,
});

export const createUserForOwnSectorSchema = z.object({
  email,
  password,
});
