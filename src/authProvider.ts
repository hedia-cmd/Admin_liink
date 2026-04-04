import { supabase } from "./supabaseClient";

export const authProvider = {
  login: async ({ username, password }: { username: string; password: string }) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: username,
      password,
    });
    if (error) throw new Error(error.message);
    return Promise.resolve();
  },

  logout: async () => {
    await supabase.auth.signOut();
    return Promise.resolve();
  },

  checkAuth: async () => {
    const { data } = await supabase.auth.getUser();
    return data.user ? Promise.resolve() : Promise.reject();
  },

  checkError: () => Promise.resolve(),
  getPermissions: () => Promise.resolve(),
};
