"use client"

import Link from "next/link"
import { ConnectButton } from "@rainbow-me/rainbowkit"
import { useIsMounted } from "@/hooks/use-is-mounted"
import { ThemeToggle } from "@/components/theme-toggle"

export function Navigation() {
  const mounted = useIsMounted()

  return (
    <nav className="border-b border-border bg-card">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-foreground hover:text-primary transition-colors">
          FutarFi
        </Link>

        <div className="flex items-center gap-4">
          <ThemeToggle />
          {mounted && <ConnectButton />}</div>
      </div>
    </nav>
  )
}
