"use client"
import type React from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Toaster } from "@/components/ui/toaster"
import { Sidebar } from "@/components/sidebar"
import { Header } from "@/components/header"
import { useEffect, useState } from "react"
import { useRouter, usePathname } from "next/navigation"

// icons
import { FlaskConical, Beaker, Microscope, Atom } from "lucide-react"

const LAB_STEPS = [
  { icon: FlaskConical, label: "Mixing reagents..." },
  { icon: Beaker,       label: "Calibrating instruments..." },
  { icon: Microscope,   label: "Analyzing samples..." },
  { icon: Atom,         label: "Building Digital Laboratory..." },
]

// Route → header title. Derived here so the header lives in the shell instead
// of being re-declared (and re-mounted) inside every page.
const PAGE_TITLES: Array<[string, string]> = [
  ["/dashboard", "Dashboard"],
  ["/dna-scanner", "DNA Scanner"],
  ["/mutation-simulator", "Mutation Simulator"],
  ["/microbe-growth-lab", "Microbe Growth Lab"],
  ["/amr-analysis-engine", "AMR Analysis Engine"],
  ["/notifications", "Notifications"],
  ["/settings", "Settings"],
]

function titleForPath(pathname: string): string {
  const match = PAGE_TITLES.find(
    ([href]) => pathname === href || pathname.startsWith(href + "/"),
  )
  return match ? match[1] : "HelixMind"
}

function LabLoader() {
  const [step, setStep] = useState(0)
  const [dots, setDots] = useState("")

  useEffect(() => {
    const stepTimer = setInterval(() => {
      setStep(s => (s + 1) % LAB_STEPS.length)
    }, 1800)
    return () => clearInterval(stepTimer)
  }, [])

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots(d => (d.length >= 3 ? "" : d + "."))
    }, 400)
    return () => clearInterval(dotTimer)
  }, [])

  const { icon: Icon, label } = LAB_STEPS[step]

  return (
    <div className="min-h-svh flex flex-col items-center justify-center gap-6 bg-background text-foreground">
      {/* Orbiting icons ring */}
      <div className="relative flex items-center justify-center w-28 h-28">
        {/* Spinning ring */}
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-muted-foreground/30 animate-spin [animation-duration:8s]" />
        {/* Counter-spinning inner ring */}
        <div className="absolute inset-3 rounded-full border border-muted-foreground/20 animate-spin [animation-duration:5s] [animation-direction:reverse]" />

        {/* Orbiting dots */}
        {[0, 1, 2, 3].map(i => (
          <span
            key={i}
            className="absolute w-2 h-2 rounded-full bg-primary/60"
            style={{
              transform: `rotate(${i * 90}deg) translateX(48px)`,
              animation: `spin 3s linear infinite`,
              animationDelay: `${i * 0.2}s`,
            }}
          />
        ))}

        {/* Centre icon — swaps with each step */}
        <div
          key={step}
          className="z-10 flex items-center justify-center w-12 h-12 rounded-full bg-muted shadow-inner"
          style={{ animation: "fadeScaleIn 0.4s ease" }}
        >
          <Icon className="w-6 h-6 text-primary animate-pulse" />
        </div>
      </div>

      {/* Step progress pips */}
      <div className="flex gap-2">
        {LAB_STEPS.map((_, i) => (
          <span
            key={i}
            className={`block h-1.5 rounded-full transition-all duration-500 ${
              i === step ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>

      {/* Animated label */}
      <p
        key={step}
        className="text-sm font-mono text-muted-foreground tracking-wide"
        style={{ animation: "fadeScaleIn 0.4s ease" }}
      >
        {label.replace("...", "")}{dots}
      </p>

      {/* Keyframes injected inline so no extra CSS file is needed */}
      <style>{`
        @keyframes fadeScaleIn {
          from { opacity: 0; transform: scale(0.85); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const navigate = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && !user) {
      navigate.push("/signin")
    }
  }, [isLoading, user, navigate])

  if (!isLoading && user) {
    return (
      <div className="min-h-svh bg-background">
        {/* Persistent app shell — mounted once, survives every navigation so
            sidebar/header state and focus are preserved between routes. */}
        <Sidebar />
        <Header title={titleForPath(pathname)} />

        <div className="mx-auto container min-h-svh max-w-8xl w-full mb-4">
          {children}
          <Toaster />
        </div>
      </div>
    )
  }

  return <LabLoader />
}
