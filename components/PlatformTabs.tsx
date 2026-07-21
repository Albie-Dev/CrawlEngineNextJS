import Link from "next/link";
import { platformLabels } from "@/lib/constants";
import type { Platform } from "@/lib/types";
import { cn } from "@/lib/utils";

const tabs: Array<{ href: string; platform: Platform }> = [
  { href: "/youtube", platform: "youtube" },
  { href: "/tiktok", platform: "tiktok" },
  { href: "/facebook", platform: "facebook" }
];

export function PlatformTabs({ active }: { active: Platform }) {
  return (
    <div className="inline-flex rounded border border-kolia-line dark:border-slate-800 bg-white dark:bg-slate-900 p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.platform}
          href={tab.href}
          className={cn(
            "rounded px-4 py-2 text-sm font-bold",
            active === tab.platform 
              ? "bg-kolia-ink text-white dark:bg-slate-100 dark:text-slate-900" 
              : "text-slate-600 dark:text-slate-400 hover:bg-kolia-mint dark:hover:bg-slate-800"
          )}
        >
          {platformLabels[tab.platform]}
        </Link>
      ))}
    </div>
  );
}
