"use client"
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import {signup, login, checkAuth} from "@/api/auth"
import { useRouter } from "next/navigation";

type initAuthContextValueType = {
    user: {
        name: string,
        email: string
    } | null,
    isLoading: boolean,
    signIn: (email: string, password: string) => any,
    signUp: (email: string, password: string, name: string) => any,
    signOut: () => void
} | null;

const AuthContext = createContext<initAuthContextValueType>(null);

export function AuthProvider({ children }: { children: ReactNode}) {
  const [user, setUser] = useState<{
    name: string,
    email: string
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useRouter();

  useEffect(() => {
    (async function() {
      try {
        const response = await checkAuth();
        setUser({
          name: `${response.fname} ${response.lname}`,
          email: response.email
        });
        setIsLoading(false);
      } catch (error) {
        setUser(null);
        setIsLoading(false);
      }
    })();
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);

    try {
      const response = await login({email, password});

      if (response.token.trim().length <= 0) {
        throw new Error("Something went wrong, try again");
      }

      // Log the user in
      localStorage.setItem("Helix_user_token", response.token);
      
      // Do whatever you want to do with the user data
      setUser({
        name: `${response.user.fname} ${response.user.lname}`,
        email: response.user.email
      });

      return { success: true, message: response.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : error}
    } finally {
      setIsLoading(false);
    }
  };

  const signUp = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    
    try {
      const [fname, lname] = name.split(" ");
      const response = await signup({
        fname,
        lname,
        email,
        password
      });

      setUser({ name, email });
      
      return { success: true, message: response.message };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : error }
    } finally {
      setIsLoading(false);
    }
};

  const signOut = () => {
    setUser(null);
    localStorage.removeItem("Helix_user_token");
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
