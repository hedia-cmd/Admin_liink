import { supabase } from "./supabaseClient";

const UNAUTHORIZED_MESSAGE =
  "Accès non autorisé: ce compte n'est pas autorisé à utiliser cet admin.";

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
  login: async ({ username, password }: { username: string; password: string }) => {
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
