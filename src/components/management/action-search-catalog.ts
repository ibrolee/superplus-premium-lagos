export type Access = 'all' | 'staff' | 'reception' | 'management' | 'admin';
export type Category = 'Attendance & QR' | 'Members & memberships' | 'Staff & payroll' | 'Revenue & reports' | 'Website & communications' | 'Workspaces & settings';
export type Action = { label: string; href: string; description: string; keywords: string; category: Category; access: Access; quick?: boolean };

// Only verified existing routes and admin sections are indexed. Destinations retain their own permissions.
export const actions: Action[] = [
  { label: 'Admin dashboard', href: '/staff-admin', description: 'Overview, revenue and staff management tools', keywords: 'admin home dashboard overview statistics', category: 'Workspaces & settings', access: 'management', quick: true },
  { label: 'Management overview', href: '/management-preview', description: 'Gym performance and daily operations overview', keywords: 'dashboard home business metrics', category: 'Workspaces & settings', access: 'reception', quick: true },
  { label: 'Operations hub', href: '/management-operations', description: 'Open the reception and management actions directory', keywords: 'tools menu all functions tasks actions', category: 'Workspaces & settings', access: 'reception', quick: true },
  { label: 'Reception workspace', href: '/reception-workspace', description: 'Front desk, member search and check-in tools', keywords: 'reception 2.0 counter desk member dashboard', category: 'Workspaces & settings', access: 'reception' },
  { label: 'My staff profile', href: '/staff', description: 'View employee account and personal staff tools', keywords: 'employee login information personal account', category: 'Workspaces & settings', access: 'staff' },
  { label: 'Staff clock in / out', href: '/staff-attendance', description: 'Record a shift using the employee QR scanner (approved profiles only)', keywords: 'attendance employee work hours timesheet shift punch scan start finish', category: 'Attendance & QR', access: 'all' },
  { label: 'Member attendance', href: '/management-attendance', description: 'Review gym visits, check-ins, check-outs and attendance history', keywords: 'gym attendance customer member visitor daily access entry exit visit log', category: 'Attendance & QR', access: 'reception', quick: true },
  { label: 'Member QR scanner', href: '/reception-checkin', description: 'Scan members into and out of the gym', keywords: 'gym attendance member visit entry exit checkin checkout camera qr barcode', category: 'Attendance & QR', access: 'reception' },
  { label: 'Staff attendance dashboard', href: '/staff-admin#attendance', description: 'View daily employee clock-ins, clock-outs and late arrivals', keywords: 'staff attendance daily work hours shift late absences timesheet', category: 'Attendance & QR', access: 'management', quick: true },
  { label: 'Staff attendance and directory', href: '/management-staff', description: 'Review staff details, QR check-ins and worked hours', keywords: 'staff attendance team employees register clockin clockout', category: 'Attendance & QR', access: 'management' },
  { label: 'Monthly staff attendance', href: '/management-staff-monthly', description: 'View monthly attendance, work hours and late arrival reports', keywords: 'staff attendance monthly report timesheet schedule punctuality hours payroll', category: 'Attendance & QR', access: 'management' },
  { label: 'Staff QR exceptions', href: '/management-staff-review', description: 'Review late, open, overlapping or invalid staff QR scans', keywords: 'staff attendance anomaly duplicate clockin missing checkout qr review exception', category: 'Attendance & QR', access: 'management' },
  { label: 'Missed-scan requests', href: '/staff-missed-scans', description: 'Report or review forgotten staff clock-ins and clock-outs', keywords: 'staff attendance missed scan missing qr forgot correction request', category: 'Attendance & QR', access: 'all' },
  { label: 'Review missed-scan approvals', href: '/staff-missed-scans', description: 'Review staff explanations and approve or reject requests', keywords: 'admin attendance forgotten clock in out correction approve reject', category: 'Attendance & QR', access: 'admin' },
  { label: 'Export staff attendance', href: '/management-attendance-export', description: 'Download attendance and work-hours CSV data', keywords: 'staff attendance download excel csv report timesheet export', category: 'Attendance & QR', access: 'management' },
  { label: 'Member directory', href: '/management-members', description: 'Find members, review plans, status and membership expiry', keywords: 'gym clients members search list subscription expiry', category: 'Members & memberships', access: 'reception', quick: true },
  { label: 'Member profiles', href: '/management-profiles', description: 'Open individual member profiles, memberships and visit history', keywords: 'member account customer personal details information subscriptions attendance', category: 'Members & memberships', access: 'reception' },
  { label: 'Register a member', href: '/management-standard-plan', description: 'Register a new gym member and initial plan', keywords: 'new customer signup onboarding membership first registration', category: 'Members & memberships', access: 'reception' },
  { label: 'Renew / add membership', href: '/management-standard-plan', description: 'Add a standard membership plan for an existing member', keywords: 'renew extension subscription plan daily weekly monthly payment register', category: 'Members & memberships', access: 'reception' },
  { label: 'Custom membership plan', href: '/management-custom-plan', description: 'Set custom membership days, price and optional registration fee', keywords: 'custom plan days duration discount amount price fee membership flexible', category: 'Members & memberships', access: 'reception' },
  { label: 'Historical member management', href: '/staff-admin#members', description: 'Manage historical member records in the admin dashboard', keywords: 'import past old members legacy historical registration database', category: 'Members & memberships', access: 'admin' },
  { label: 'Staff directory', href: '/staff-admin#staff', description: 'Open employee records, approvals and individual profiles', keywords: 'team human resources hr approve pending suspend inactive staff profile', category: 'Staff & payroll', access: 'management' },
  { label: 'Edit staff profiles', href: '/staff-admin#staff', description: 'Update employee details, roles and employment status', keywords: 'staff position department phone address birthday approval edit', category: 'Staff & payroll', access: 'management' },
  { label: 'Approve or suspend staff', href: '/staff-admin#staff', description: 'Review pending employees and manage account status', keywords: 'staff approve pending activate deactivate suspend permissions account', category: 'Staff & payroll', access: 'management' },
  { label: 'Salary records', href: '/management-payroll', description: 'Review recorded salary payments and their statuses', keywords: 'staff salary payroll wages paid pending ledger payslip', category: 'Staff & payroll', access: 'management' },
  { label: 'Manage staff salaries', href: '/staff-admin#staff', description: 'Access individual employee salary records in the admin dashboard', keywords: 'salary pay payroll staff compensation payments employee', category: 'Staff & payroll', access: 'management' },
  { label: 'Export salary records', href: '/management-payroll-export', description: 'Download payroll CSV spreadsheet', keywords: 'salary staff wages payroll spreadsheet excel download export', category: 'Staff & payroll', access: 'management' },
  { label: 'Revenue report', href: '/management-revenue', description: 'Review recorded gym income and successful payments', keywords: 'revenue money finance sales earnings payment transactions income report', category: 'Revenue & reports', access: 'management', quick: true },
  { label: 'Admin revenue report', href: '/staff-admin#revenue', description: 'Open original admin revenue report and payment details', keywords: 'finance revenue sales earnings transactions payment income monthly', category: 'Revenue & reports', access: 'management' },
  { label: 'Revenue by plan', href: '/staff-admin#revenue', description: 'Compare recorded revenue across membership plans', keywords: 'money memberships sales income finance report plan popularity', category: 'Revenue & reports', access: 'management' },
  { label: 'Payment transactions', href: '/staff-admin#revenue', description: 'Find payment records by member, reference or payment method', keywords: 'sales transfer cash pos paystack revenue finance receipts', category: 'Revenue & reports', access: 'management' },
  { label: 'Gallery management', href: '/staff-gallery', description: 'Upload, organise, publish or delete gym photos and videos', keywords: 'gallery image picture photo video media website thumbnail upload optimize', category: 'Website & communications', access: 'management', quick: true },
  { label: 'Blog management', href: '/staff-blog', description: 'Create, edit, schedule and publish blog posts and images', keywords: 'website article news content write post draft author blog', category: 'Website & communications', access: 'management' },
  { label: 'Member birthdays and reminders', href: '/management-communications', description: 'Prepare birthday and membership-expiry WhatsApp messages', keywords: 'communications birthday wishes whatsapp messaging notify notifications renewal expiry', category: 'Website & communications', access: 'reception' },
];

const normalize = (value: string) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokenize = (value: string) => normalize(value).split(/\s+/).filter(Boolean);
const related = [
  ['attendance', 'attend', 'presence', 'clock', 'checkin', 'checkout', 'visit', 'visits', 'timesheet', 'punctuality'],
  ['staff', 'employee', 'employees', 'team', 'worker', 'workers'],
  ['member', 'members', 'customer', 'customers', 'client', 'clients'],
  ['gym', 'fitness', 'facility', 'facilities'],
  ['salary', 'salaries', 'wages', 'payroll', 'payslip'],
  ['revenue', 'income', 'earnings', 'sales', 'finance'],
  ['gallery', 'photos', 'photo', 'pictures', 'picture', 'images', 'image', 'media'],
  ['video', 'videos', 'clip', 'clips'],
  ['blog', 'article', 'articles', 'post', 'posts'],
  ['register', 'registration', 'signup', 'enrol', 'enroll'],
  ['renew', 'renewal', 'subscription', 'membership'],
  ['qr', 'scan', 'scanner', 'scanning'],
  ['report', 'reports', 'export', 'download', 'spreadsheet', 'csv'],
  ['reminder', 'reminders', 'notification', 'notifications', 'message', 'messages'],
  ['payment', 'payments', 'transaction', 'transactions', 'pay'],
];
const groupFor = (word: string) => related.find((group) => group.includes(word));
function distanceWithin(a: string, b: string, limit: number): boolean {
  if (Math.abs(a.length - b.length) > limit) return false;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    const next = [i];
    for (let j = 1; j <= b.length; j++) next[j] = Math.min(previous[j] + 1, next[j - 1] + 1, previous[j - 1] + Number(a[i - 1] !== b[j - 1]));
    if (Math.min(...next) > limit) return false;
    previous = next;
  }
  return previous[b.length] <= limit;
}
function tokenScore(word: string, tokens: string[], weight: number): number {
  let best = 0;
  const aliases = groupFor(word);
  for (const token of tokens) {
    if (token === word) best = Math.max(best, 20 * weight);
    else if (token.startsWith(word) && word.length >= 2) best = Math.max(best, 15 * weight);
    else if (word.startsWith(token) && token.length >= 4) best = Math.max(best, 10 * weight);
    else if (aliases?.includes(token)) best = Math.max(best, 9 * weight);
    else if (word.length >= 4 && token.length >= 4 && distanceWithin(word, token, word.length >= 7 ? 2 : 1)) best = Math.max(best, 7 * weight);
  }
  return best;
}
export function isActionVisible(action: Action, role: string): boolean {
  const normalizedRole = role.trim().toLowerCase();
  const management = ['admin', 'owner', 'manager'].includes(normalizedRole);
  if (action.access === 'admin') return normalizedRole === 'admin';
  if (action.access === 'management') return management;
  if (action.access === 'reception') return management || normalizedRole === 'reception';
  if (action.access === 'staff') return !management && normalizedRole !== 'reception';
  return Boolean(normalizedRole);
}
export function searchActions(query: string, role: string): Action[] {
  const available = actions.filter((action) => isActionVisible(action, role));
  const words = tokenize(query);
  if (!words.length) return available.filter((action) => action.quick).slice(0, 8);
  const phrase = normalize(query);
  return available.map((action, index) => {
    const label = normalize(action.label);
    const labelTokens = tokenize(action.label);
    const descriptionTokens = tokenize(action.description);
    const keywordTokens = tokenize(action.keywords);
    if (!words.every((word) => Math.max(tokenScore(word, labelTokens, 4), tokenScore(word, keywordTokens, 2), tokenScore(word, descriptionTokens, 1)) > 0)) return null;
    let score = words.reduce((total, word) => total + Math.max(tokenScore(word, labelTokens, 4), tokenScore(word, keywordTokens, 2), tokenScore(word, descriptionTokens, 1)), 0);
    if (label === phrase) score += 220;
    else if (label.includes(phrase)) score += 90;
    return { action, score, index };
  }).filter((entry): entry is { action: Action; score: number; index: number } => entry !== null).sort((a, b) => b.score - a.score || a.index - b.index).map(({ action }) => action);
}
