"use client";

import { useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, AlertCircle, Check } from "lucide-react";

import Logo from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<"email" | "verify" | "reset">("email");

  // Password requirements
  const passwordRequirements = [
    { label: "At least 8 characters", met: newPassword.length >= 8 },
    { label: "Contains a number", met: /\d/.test(newPassword) },
    { label: "Contains a special character", met: /[!@#$%^&*(),.?\":{}|<>]/.test(newPassword) },
    { label: "Contains uppercase letter", met: /[A-Z]/.test(newPassword) },
    { label: "Contains lowercase letter", met: /[a-z]/.test(newPassword) },
  ];
  const allRequirementsMet = passwordRequirements.every((r) => r.met);

  const handleNext = async () => {
    setError("");
    if (!email.trim()) {
      setError("Email is required");
      return;
    }
    // TODO: send email with verification code
    toast.success("Verification code sent to your email");
    setStep("verify");
  };

  const handleVerify = async () => {
    setError("");
    if (!code.trim()) {
      setError("Verification code is required");
      return;
    }
    // TODO: verify code
    setStep("reset");
  };

  const handleReset = async () => {
    setError("");
    if (!allRequirementsMet) {
      setError("Password does not meet requirements");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    // TODO: call API to reset password
    toast.success("Password reset successfully!");
    setTimeout(() => window.location.assign("/signin"), 500);
  };

  return (
    <div className="  container mx-auto h-screen bg-background flex">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12 border-r border-border">
        <div className="flex items-center gap-3">
          <Logo />
        </div>
        <div className="space-y-6">
          <h1 className="text-4xl font-semibold leading-tight">
            Reset Your Password
            <br />
            <span className="text-muted-foreground">Secure your account.</span>
          </h1>
          <p className="max-w-md text-base text-muted-foreground">
            Use your email to recover your account and set a new password.
          </p>
        </div>
        <p className="text-sm text-muted-foreground">© 2025 HelixMind. All rights reserved.</p>
      </div>

      {/* Right Panel - Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <Card className="w-full max-w-md border-0 bg-transparent">
          <CardHeader className="space-y-2 text-center lg:text-left">
            <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
              <Logo />
            </div>
            <CardTitle className="text-xl">Reset Password</CardTitle>
            <CardDescription>Follow the steps to reset your password</CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm mb-4">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {step === "email" && (
              <div className="space-y-4">
                <label className="text-sm font-medium">Email</label>
                <Input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                />
                <Button onClick={handleNext} className="w-full" size="lg">
                  Send Verification Code
                </Button>
                <p className="text-center text-sm text-muted-foreground">
                  Remembered your password?{" "}
                  <Link href="/signin" className="text-foreground hover:underline font-medium">
                    Sign In
                  </Link>
                </p>
              </div>
            )}

            {step === "verify" && (
              <div className="space-y-4">
                <label className="text-sm font-medium">Verification Code</label>
                <Input
                  type="text"
                  placeholder="Enter code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
                <Button onClick={handleVerify} className="w-full" size="lg">
                  Verify Code
                </Button>
              </div>
            )}

            {step === "reset" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Password</label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {newPassword && (
                    <div className="space-y-1 mt-2">
                      {passwordRequirements.map((req, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <Check
                            className={`w-3 h-3 ${req.met ? "text-success" : "text-muted-foreground"}`}
                          />
                          <span className={req.met ? "text-muted-foreground" : "text-muted-foreground"}>
                            {req.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Confirm Password</label>
                  <Input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    autoComplete="new-password"
                  />
                </div>

                <Button
                  onClick={handleReset}
                  className="w-full"
                  size="lg"
                  disabled={!allRequirementsMet || isLoading}
                >
                  {isLoading ? "Resetting..." : "Reset Password"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
