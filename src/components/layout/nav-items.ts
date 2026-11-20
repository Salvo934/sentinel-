import {
  Bot,
  Crosshair,
  FileText,
  FolderKanban,
  FolderLock,
  GraduationCap,
  Globe,
  LayoutDashboard,
  MailWarning,
  Network,
  Radar,
  ScanSearch,
  Settings,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Set for modules that are not built yet: the page explains the roadmap. */
  planned?: string;
};

export type NavSection = { label: string | null; items: NavItem[] };

export const NAV_SECTIONS: NavSection[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/investigations", label: "Investigations", icon: FolderKanban },
    ],
  },
  {
    label: "Analisi",
    items: [
      { href: "/osint", label: "OSINT Workspace", icon: ScanSearch },
      { href: "/threat-intel", label: "Threat Intelligence", icon: Radar },
      { href: "/attack", label: "MITRE ATT&CK", icon: Crosshair },
      { href: "/domains", label: "Domain Analysis", icon: Globe },
      { href: "/phishing", label: "Phishing Lab", icon: MailWarning },
      { href: "/graph", label: "Investigation Graph", icon: Network, planned: "Fase 3" },
      { href: "/risk", label: "Risk Assessment", icon: ShieldAlert, planned: "Fase 4" },
    ],
  },
  {
    label: "Produzione",
    items: [
      { href: "/evidence", label: "Evidence Library", icon: FolderLock },
      { href: "/reports", label: "Reports", icon: FileText },
    ],
  },
  {
    label: "Formazione",
    items: [
      { href: "/training", label: "Training Academy", icon: GraduationCap },
      { href: "/assistant", label: "AI Assistant", icon: Bot, planned: "Fase 5" },
    ],
  },
  {
    label: null,
    items: [{ href: "/settings", label: "Settings", icon: Settings }],
  },
];
