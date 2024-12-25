import NextAuth from "next-auth";
import { authConfig } from "./auth.config";
import Credentials from "next-auth/providers/credentials";
import { createClient } from "./app/utils/supabase/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { User } from "./app/lib/definitions";
import bcrypt from "bcrypt";

// query the user credentials from the database
export const getUser = async (email: string): Promise<User | undefined> => {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  try {
    const { data: user, error } = await supabase
      .from("users")
      .select()
      .eq("email", email);

    if (error) {
      throw error;
    }

    console.log("user", user);
    return user ? user[0] : undefined;
  } catch (error) {
    console.error("Database Error:", error);
    throw new Error("Failed to fetch user.");
  }
};

export const { auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        // check if the user credentials are match zod schema
        const parsedCredentials = z
          .object({
            email: z.string().email(),
            password: z.string().min(6),
          })
          .safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          const user = await getUser(email);
          if (!user) return null;
          const passwordMatch = await bcrypt.compare(password, user.password);
          if (passwordMatch) {
            return user;
          }
        }
        console.log("invalid credentials");
        return null;
      },
    }),
  ],
});
