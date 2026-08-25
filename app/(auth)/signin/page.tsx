"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle, Dna, Activity, ShieldCheck } from "lucide-react";

import Logo from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowIcon } from "@/components/workbench";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";

const HIGHLIGHTS = [
  { icon: Dna, text: "Genomic sequence analysis & mutation scanning" },
  { icon: Activity, text: "Real-time microbial growth simulations" },
  { icon: ShieldCheck, text: "AI-powered antimicrobial resistance prediction" },
];

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { isLoading, signIn } = useAuth();
  const navigate = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    if (!password.trim()) {
      setError("Password is required");
      return;
    }

    const result = await signIn(email, password);

    if (result.success) {
      toast({
        variant: "success",
        title: "Signed in",
        description: "Opening your workspace.",
      });
      navigate.replace("/dashboard");
    } else {
      const reason = result.error || "Something went wrong";
      setError(reason);
      // The inline banner sits above the fold on a short viewport, so the
      // toast is what makes a failed attempt visible without scrolling.
      toast({ variant: "destructive", title: "Couldn't sign in", description: reason });
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left — branded hero */}
      <div className="bg-grid relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-border p-12 lg:flex">
        <div className="aurora pointer-events-none absolute inset-0" />
        {/* Vignette anchored to the bottom edge only. Spanning the full height put
            its darkest band right across the headline and feature list, costing
            contrast on the very copy the hero exists to show. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-background/80 to-transparent" />

        <div className="relative flex items-center gap-3 text-lg font-semibold">
          <Logo />
        </div>

        <div className="relative space-y-8">
          <div className="space-y-4">
            <h1 className="text-gradient text-4xl font-semibold leading-[1.05] tracking-tight">
              Accelerating
              <br />
              biological
              <br />
              advancements.
            </h1>
            <p className="max-w-md text-base text-muted-foreground">
              Sign in to access your genomic analysis tools and mutation
              simulations.
            </p>
          </div>

          <ul className="space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-center gap-3 text-sm text-foreground/90">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-raised">
                  <Icon className="size-3.5" />
                </span>
                {text}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-foreground/70">
          © 2025 HelixMind. All rights reserved.
        </p>
      </div>

      {/* Right — form */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo />
          </div>

          <div className="mb-8">
            <h2 className="text-xl font-semibold tracking-tight">Welcome back</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Enter your credentials to continue
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                <RowIcon icon={AlertCircle} size="4" />
                <span className="min-w-0">{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                name="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-foreground">Password</label>
                <Link
                  href="/reset-password"
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  name="password"
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="h-9 pr-9"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" className="h-9 w-full" size="lg" disabled={isLoading}>
              {isLoading ? "Signing in..." : "Sign In"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="font-medium text-foreground hover:underline">
                Create one
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
