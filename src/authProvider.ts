import { supabase } from "./supabaseClient";

const UNAUTHORIZED_MESSAGE =
  "Accès non autorisé: ce compte n'est pas autorisé à utiliser cet admin.";

type LoginParams = {
  username?: string;
  password?: string;
  provider?: "google";
};

async function getCurrentUserOrThrow() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new Error("Session invalide.");
  }
  return data.user;
}

async function ensureAllowlistedOrThrow() {
  const { data, error } = await supabase.rpc("is_admin_user");

  if (error || data !== true) {
    await supabase.auth.signOut();
    throw new Error(UNAUTHORIZED_MESSAGE);
  }
}

export const authProvider = {
  login: async ({ username, password, provider }: LoginParams) => {
    if (provider === "google") {
      const redirectTo =
        typeof window !== "undefined" ? `${window.location.origin}/` : undefined;
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: redirectTo ? { redirectTo } : undefined,
      });
      if (error) throw new Error(error.message);
      return Promise.resolve();
    }

    if (!username || !password) {
      throw new Error("Email et mot de passe requis.");
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: username,
      password,
    });
    if (error) throw new Error(error.message);
    await getCurrentUserOrThrow();
    await ensureAllowlistedOrThrow();
    return Promise.resolve();
  },

  logout: async () => {
    await supabase.auth.signOut();
    return Promise.resolve();
  },

  checkAuth: async () => {
    try {
      await getCurrentUserOrThrow();
      await ensureAllowlistedOrThrow();
      return Promise.resolve();
    } catch (error) {
      return Promise.reject(error);
    }
  },

  checkError: () => Promise.resolve(),
  getPermissions: () => Promise.resolve(),
};
