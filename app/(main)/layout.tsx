"use client"

import type React from "react"
import { useEffect } from "react"
import { useRouter } from "next/navigation"

import { useAuth } from "@/contexts/AuthContext"
import { Workbench, WorkbenchProvider } from "@/components/workbench"
import { WorkbenchBoot } from "@/components/workbench/workbench-boot"
import { NotificationsProvider } from "@/components/notifications/notifications-provider"

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/signin")
    }
  }, [isLoading, user, router])

  if (isLoading || !user) {
    return <WorkbenchBoot />
  }

  return (
    <NotificationsProvider>
      <WorkbenchProvider>
        <Workbench>{children}</Workbench>
      </WorkbenchProvider>
    </NotificationsProvider>
  )
}
