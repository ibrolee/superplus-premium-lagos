import {
  Activity,
  BookOpen,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  Dumbbell,
  FileDown,
  Home,
  Images,
  LayoutDashboard,
  Megaphone,
  Menu,
  MessageSquareWarning,
  Search,
  ShieldCheck,
  UserPlus,
  UserRound,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
type Tool = {
  label: string;
  href: string;
  icon: LucideIcon;
  keywords?: string;
  adminOnly?: boolean;
  ownerOrAdmin?: boolean;
};
type Group = { name: string; icon: LucideIcon; tools: Tool[] };
const originalGroups: Group[] = [
  {
    name: "Overview",
    icon: LayoutDashboard,
    tools: [
      {
        label: "Website homepage",
        href: "/",
        icon: Home,
        keywords: "public website home homepage visitor",
      },
      {
        label: "Admin dashboard",
        href: "/admin-workspace",
        icon: LayoutDashboard,
        keywords: "home revenue summary overview",
      },
      {
        label: "Reception dashboard",
        href: "/reception-workspace",
        icon: UserPlus,
        keywords: "front desk daily tools registration renewal",
      },
    ],
  },
  {
    name: "Members",
    icon: Users,
    tools: [
      {
        label: "Members list",
        href: "/admin-members",
        icon: Users,
        keywords: "search directory customers clients",
      },
      {
        label: "Member profiles",
        href: "/management-profiles",
        icon: UserRound,
        keywords: "history plans renewals profile",
      },
      {
        label: "Member attendance",
        href: "/management-attendance",
        icon: Activity,
        keywords: "visits check in check out records",
      },
      {
        label: "Member ID cards",
        href: "/management-member-cards",
        icon: CreditCard,
        adminOnly: true,
        keywords: "print card svg pdf batch",
      },
      {
        label: "Member Reports & Suggestions",
        href: "/management-member-feedback",
        icon: MessageSquareWarning,
        keywords:
          "confidential suggestions complaints issues equipment coach staff safety feedback",
      },
    ],
  },
  {
    name: "Reception operations",
    icon: ClipboardList,
    tools: [
      {
        label: "Register or renew",
        href: "/reception-register",
        icon: UserPlus,
        keywords: "new member existing member renewal coupon cash pos transfer",
      },
      {
        label: "QR scanner",
        href: "/reception-checkin",
        icon: Activity,
        keywords: "member scan checkin checkout",
      },
      {
        label: "Birthdays & reminders",
        href: "/management-communications",
        icon: CalendarDays,
        keywords: "expiry birthday whatsapp follow up",
      },
      {
        label: "Member bookings",
        href: "/management-bookings",
        icon: CalendarDays,
        keywords: "class personal training massage pedicure spa appointment requests",
      },
      {
        label: "Operations hub",
        href: "/management-operations",
        icon: ClipboardList,
        keywords: "front desk tools workflows",
      },
    ],
  },
  {
    name: "Staff accounts",
    icon: ShieldCheck,
    tools: [
      {
        label: "Staff requests & complaints",
        href: "/management-staff-support",
        icon: MessageSquareWarning,
        ownerOrAdmin: true,
        keywords: "staff employee requests complaints concerns messages support responses review",
      },
      {
        label: "Staff approvals",
        href: "/admin-approvals",
        icon: ShieldCheck,
        keywords: "employee attendance account requests",
      },
      {
        label: "Staff account requests",
        href: "/staff-account-requests",
        icon: Users,
        adminOnly: true,
        keywords: "employee authorisation approve reject",
      },
      {
        label: "Missed-scan requests",
        href: "/staff-missed-scans",
        icon: CalendarDays,
        adminOnly: true,
        keywords: "staff missed scan correction",
      },
      {
        label: "Staff directory",
        href: "/management-staff",
        icon: Users,
        keywords: "employees attendance report",
      },
      {
        label: "Staff management",
        href: "/management-staff-management",
        icon: ShieldCheck,
        ownerOrAdmin: true,
        keywords:
          "staff profiles titles positions in-house coach part-time coach roles employment salary",
      },
    ],
  },
  {
    name: "Personal Training",
    icon: Dumbbell,
    tools: [
      {
        label: "PT management",
        href: "/management-personal-training",
        icon: Dumbbell,
        keywords:
          "personal training pt coaches trainers assignments evaluations renew change trainer expiry",
      },
    ],
  },
  {
    name: "Payroll",
    icon: Wallet,
    tools: [
      {
        label: "Salary payments",
        href: "/management-salary-payments",
        icon: Wallet,
        ownerOrAdmin: true,
        keywords: "salary calculator monthly wages coach pt first second half mark paid",
      },
      {
        label: "Payroll records",
        href: "/management-payroll",
        ownerOrAdmin: true,
        icon: Wallet,
        keywords: "wages salaries salary payments",
      },
      {
        label: "Payroll export",
        href: "/management-payroll-export",
        ownerOrAdmin: true,
        icon: FileDown,
        keywords: "download salary csv",
      },
    ],
  },
  {
    name: "Reports",
    icon: FileDown,
    tools: [
      {
        label: "Expenses & profit",
        href: "/management-expenses",
        icon: Wallet,
        ownerOrAdmin: true,
        keywords: "expenses profit loss internet electricity petrol gas costs month end finance",
      },
      {
        label: "Revenue report",
        href: "/management-revenue",
        icon: Wallet,
        keywords: "sales payments income revenue finance",
      },
      {
        label: "Attendance export",
        href: "/management-attendance-export",
        icon: FileDown,
        keywords: "download member staff csv",
      },
      {
        label: "Monthly staff attendance",
        href: "/management-staff-monthly",
        icon: CalendarDays,
        keywords: "hours shifts monthly report",
      },
      {
        label: "QR attendance review",
        href: "/management-staff-review",
        icon: ShieldCheck,
        keywords: "employee QR exceptions anomaly",
      },
    ],
  },
  {
    name: "App & website content",
    icon: Images,
    tools: [
      {
        label: "App management",
        href: "/admin-engagement",
        icon: Megaphone,
        keywords:
          "mobile app management points badges rewards challenges sessions bookings push notifications loyalty redemptions",
      },
      {
        label: "Announcements",
        href: "/admin-announcements",
        icon: Megaphone,
        keywords: "banner popup flyer notice",
      },
      { label: "Gallery", href: "/staff-gallery", icon: Images, keywords: "photos videos media" },
      { label: "Blog", href: "/staff-blog", icon: BookOpen, keywords: "articles posts website" },
    ],
  },
  {
    name: "Legacy tools",
    icon: ShieldCheck,
    tools: [
      {
        label: "Original financial report",
        href: "/staff-admin#revenue",
        icon: Wallet,
        keywords: "ledger historical baseline old",
      },
      {
        label: "Historical members",
        href: "/admin-historical-members",
        icon: ShieldCheck,
        adminOnly: true,
        keywords: "admin import excluded revenue legacy",
      },
      {
        label: "Full legacy console",
        href: "/staff-admin",
        icon: ShieldCheck,
        adminOnly: true,
        keywords: "original admin all tools",
      },
    ],
  },
];
export function canSeeAdminTool(tool: Tool, role: string | null) {
  return (
    !!role &&
    (!tool.adminOnly || role === "admin") &&
    (!tool.ownerOrAdmin || role === "admin" || role === "owner")
  );
}

const originalTools = originalGroups.flatMap((group) => group.tools);
function tool(label: string, nextLabel?: string): Tool {
  const found = originalTools.find((item) => item.label === label);
  if (!found) throw new Error(`Unknown admin tool: ${label}`);
  return { ...found, label: nextLabel || found.label };
}
export const adminGroups: Group[] = [
  { name: "Dashboard", icon: LayoutDashboard, tools: [tool("Admin dashboard", "Overview")] },
  {
    name: "Members",
    icon: Users,
    tools: [
      tool("Members list", "Member directory"),
      tool("Register or renew"),
      tool("Reception dashboard", "Reception workspace"),
      tool("QR scanner"),
      tool("Operations hub"),
      {
        label: "Family Plan setup",
        href: "/management-family",
        icon: Users,
        keywords: "family three link membership",
      },
      tool("Member attendance", "Gym attendance"),
      tool("Member ID cards", "ID cards"),
      tool("Birthdays & reminders"),
      tool("Member Reports & Suggestions", "Member feedback"),
    ],
  },
  {
    name: "Staff",
    icon: Users,
    tools: [
      tool("Staff management", "Team & employment"),
      tool("Staff directory", "Daily attendance"),
      tool("Staff approvals", "Account & scan requests"),
      tool("Staff requests & complaints", "Requests & complaints"),
      tool("Monthly staff attendance", "Monthly attendance"),
      tool("QR attendance review", "Attendance exceptions"),
      tool("Attendance export", "Attendance exports"),
    ],
  },
  {
    name: "PT & Spa",
    icon: Dumbbell,
    tools: [tool("PT management", "Personal Training"), tool("Member bookings", "Bookings & spa")],
  },
  {
    name: "Finance",
    icon: Wallet,
    tools: [
      tool("Revenue report", "Revenue"),
      tool("Salary payments", "Salaries & commissions"),
      tool("Expenses & profit"),
      tool("Payroll records", "Salary records"),
      tool("Payroll export", "Salary export"),
    ],
  },
  {
    name: "App & Content",
    icon: Megaphone,
    tools: [tool("App management"), tool("Announcements"), tool("Gallery"), tool("Blog"), tool("Website homepage", "Public website")],
  },
  {
    name: "Advanced",
    icon: ShieldCheck,
    tools: [
      tool("Historical members"),
      tool("Full legacy console", "Legacy console"),
      tool("Original financial report"),
    ],
  },
];
export const adminSearchTools = [...adminGroups.flatMap((group) => group.tools), ...originalTools];
