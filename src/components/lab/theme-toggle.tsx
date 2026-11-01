"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Dark / light mode switch. The initial theme is applied before first paint
 * by the inline bootstrap script in layout.tsx (localStorage, fallback to the
 * OS preference). This toggle only flips the `dark` class on <html> and
 * persists it — the store subscription below re-renders the icon via a
 * MutationObserver, so no state syncing effects are needed.
 */

function subscribe(onChange: () => void) {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => obs.disconnect();
}
const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("batterylab-theme", next ? "dark" : "light");
    } catch {
      /* private mode — theme just won't persist */
    }
  }, []);

  return (
    <Button
      variant="outline"
      size="icon"
      className="h-8 w-8 shrink-0"
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
    >
      {/* icon shows what clicking switches to — re-keyed so it pops in on toggle */}
      {dark ? (
        <Sun key="sun" className="h-4 w-4 animate-scale-in text-amber-500" />
      ) : (
        <Moon key="moon" className="h-4 w-4 animate-scale-in" />
      )}
    </Button>
  );
}
