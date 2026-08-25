"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle, Check, Dna, Activity, ShieldCheck } from "lucide-react";

import Logo from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RowIcon } from "@/components/workbench/primitives";
import { useAuth } from "@/contexts/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";

const HIGHLIGHTS = [
  { icon: Dna, text: "Genomic sequence analysis & mutation scanning" },
  { icon: Activity, text: "Real-time microbial growth simulations" },
  { icon: ShieldCheck, text: "AI-powered antimicrobial resistance prediction" },
];

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { signUp, isLoading } = useAuth();
  const navigate = useRouter();

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const passwordRequirements = [
    { label: "At least 8 characters", met: password.length >= 8 },
    { label: "Contains a number", met: /\d/.test(password) },
    {
      label: "Contains a special character",
      met: /[!@#$%^&*(),.?":{}|<>]/.test(password),
    },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(password) },
    { label: "Contains lowercase letter", met: /[a-z]/.test(password) },
  ];

  const allRequirementsMet = passwordRequirements.every((r) => r.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    if (!email.trim()) {
      setError("Email is required");
      return;
    }

    if (!validateEmail(email)) {
      setError("Please enter a valid email address");
      return;
    }

    if (!allRequirementsMet) {
      setError("Password does not meet requirements");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    const result = await signUp(name, email, password);

    if (result.success) {
      toast({
        variant: "success",
        title: "Account created",
        description: "Sign in with your new credentials to continue.",
      });
      navigate.replace("/signin");
    } else {
      const reason = result.error || "Something went wrong";
      setError(reason);
      toast({
        variant: "destructive",
        title: "Couldn't create the account",
        description: reason,
      });
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
              Accelerate
              <br />
              biological
              <br />
              discovery.
            </h1>
            <p className="max-w-md text-base text-muted-foreground">
              Use AI-powered genomic analysis to explore, simulate, and predict
              biological outcomes with confidence.
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
            <h2 className="text-xl font-semibold tracking-tight">Create an account</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Enter your details to get started
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
              <label className="text-sm font-medium text-foreground">Full Name</label>
              <Input
                type="text"
                name="name"
                autoComplete="name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input
                type="email"
                placeholder="name@example.com"
                name="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  name="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
              {password && (
                <div className="grid grid-cols-1 gap-1.5 pt-1 sm:grid-cols-2">
                  {passwordRequirements.map((req, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs">
                      <span
                        className={`flex size-4 items-center justify-center rounded-full transition-colors ${
                          req.met
                            ? "bg-success/20 text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <Check className="size-2.5" />
                      </span>
                      <span className={req.met ? "text-foreground" : "text-muted-foreground"}>
                        {req.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Confirm Password</label>
              <Input
                type="password"
                name="confirm-password"
                autoComplete="new-password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-9"
              />
            </div>

            <Button
              type="submit"
              className="h-9 w-full"
              size="lg"
              disabled={isLoading || !allRequirementsMet}
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link href="/signin" className="font-medium text-foreground hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
