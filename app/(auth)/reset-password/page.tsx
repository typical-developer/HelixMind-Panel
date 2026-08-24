"use client";

import Link from "next/link";
import { AlertCircle, LifeBuoy, Mail } from "lucide-react";

import Logo from "@/components/ui/Logo";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL } from "@/lib/app-info";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * Password reset is not implemented, and this page says so.
 *
 * `api/auth.ts` exposes exactly three endpoints — signup, login and
 * `me/auth`. There is no reset. The page used to carry a three-step wizard
 * over that gap: the first step claimed "Verification code sent to your
 * email" without sending one, the second accepted any non-empty string as a
 * valid code, and the third announced "Password reset successfully!" and
 * redirected to sign-in. A user walked away believing their password had
 * changed when nothing whatsoever had happened.
 *
 * A later pass replaced those claims with an error message but left the whole
 * wizard standing: an email field, a "Send Verification Code" button that
 * always failed, and roughly 140 lines rendering `verify` and `reset` steps
 * that were unreachable because `setStep` was never called from anywhere. A
 * form that cannot succeed is worse than no form — it invites the attempt.
 *
 * What is left is the truth and a way forward. When the endpoint exists, the
 * wizard belongs here again.
 */
export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Left — branded hero, matching sign-in and sign-up. */}
      <div className="bg-grid relative hidden w-1/2 flex-col justify-between overflow-hidden border-r border-border p-12 lg:flex">
        <div className="aurora pointer-events-none absolute inset-0" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-background/80 to-transparent" />

        <div className="relative flex items-center gap-3 text-lg font-semibold">
          <Logo />
        </div>

        <div className="relative space-y-4">
          <h1 className="text-gradient text-4xl leading-[1.05] font-semibold tracking-tight">
            Account
            <br />
            recovery.
          </h1>
          <p className="max-w-md text-base text-muted-foreground">
            Self-service password reset is not available yet. Support can
            restore access to your account.
          </p>
        </div>

        <p className="relative text-sm text-foreground/70">
          © 2025 HelixMind. All rights reserved.
        </p>
      </div>

      {/* Right — the honest answer. */}
      <div className="flex w-full items-center justify-center p-6 lg:w-1/2">
        <Card className="w-full max-w-md border-0 bg-transparent shadow-none">
          <CardHeader className="space-y-2 px-0 text-center lg:text-left">
            <div className="mb-6 flex items-center justify-center gap-3 lg:hidden">
              <Logo />
            </div>
            <CardTitle className="text-xl">Reset your password</CardTitle>
            <CardDescription>
              This step needs support for now.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-5 px-0">
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <span className="leading-relaxed">
                Password reset isn&apos;t available in this build — the API
                exposes no endpoint for it, so nothing here could change your
                password.
              </span>
            </div>

            <div className="space-y-2 rounded-lg border border-border p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <LifeBuoy className="size-4 shrink-0" />
                How to get back in
              </p>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Email support from the address on your account and include your
                account email. They can reset it for you.
              </p>
            </div>

            <Button asChild className="h-9 w-full" size="lg">
              <a
                href={`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
                  "Password reset request",
                )}`}
              >
                <Mail className="size-4" />
                Email support
              </a>
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              Remembered your password?{" "}
              <Link
                href="/signin"
                className="font-medium text-foreground hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
