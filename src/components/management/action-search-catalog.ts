export type Access = 'all' | 'staff' | 'reception' | 'management' | 'admin';
export type Category = 'Attendance & QR' | 'Members & memberships' | 'Staff & payroll' | 'Revenue & reports' | 'Website & communications' | 'Workspaces & settings';
export type Action = { label: string; href: string; description: string; keywords: string; category: Category; access: Access; quick?: boolean };

// Legacy search is retained for older workspace pages. Registration and renewals now share one direct workflow.
export const actions: Action[] = [
 { label:'Admin dashboard',href:'/admin-workspace',description:'Revenue and management oversight',keywords:'admin overview',category:'Workspaces & settings',access:'management',quick:true },
 { label:'Reception dashboard',href:'/reception-workspace',description:'Daily front desk workspace',keywords:'home gym front desk',category:'Workspaces & settings',access:'reception',quick:true },
 { label:'Register or renew',href:'/reception-register',description:'Register a new member or renew an existing member directly without approval',keywords:'registration join renewal cash transfer pos REGOFF direct membership',category:'Members & memberships',access:'reception',quick:true },
 { label:'Online member payment',href:'/login',description:'Existing member signs in and pays through their dashboard',keywords:'online membership renewal paystack profile',category:'Members & memberships',access:'reception' },
 { label:'My staff profile',href:'/staff',description:'View your employee account',keywords:'employee staff account',category:'Workspaces & settings',access:'staff' },
 { label:'Staff clock in / out',href:'/staff-attendance',description:'Record a staff shift',keywords:'attendance qr work hours',category:'Attendance & QR',access:'all' },
 { label:'Member attendance',href:'/management-attendance',description:'Gym visits and attendance history',keywords:'gym checkin checkout visit',category:'Attendance & QR',access:'reception',quick:true },
 { label:'Member QR scanner',href:'/reception-checkin',description:'Scan member entry and exit',keywords:'camera qr attendance',category:'Attendance & QR',access:'reception',quick:true },
 { label:'Staff attendance dashboard',href:'/staff-admin#attendance',description:'Review daily employee attendance',keywords:'employee shifts clock ins',category:'Attendance & QR',access:'management' },
 { label:'Staff attendance directory',href:'/management-staff',description:'Review employees and their hours',keywords:'employees worked hours',category:'Attendance & QR',access:'management' },
 { label:'Monthly staff attendance',href:'/management-staff-monthly',description:'Monthly hours and attendance reports',keywords:'shifts payroll time',category:'Attendance & QR',access:'management' },
 { label:'Staff QR exceptions',href:'/management-staff-review',description:'Staff QR anomaly reports',keywords:'late overlaps scans',category:'Attendance & QR',access:'management' },
 { label:'Missed scan request',href:'/staff-missed-scans',description:'Report or review a missed shift scan',keywords:'attendance correction',category:'Attendance & QR',access:'all' },
 { label:'Review staff missed scan',href:'/staff-missed-scans',description:'Review staff requests',keywords:'attendance approval employee',category:'Attendance & QR',access:'admin' },
 { label:'Export staff attendance',href:'/management-attendance-export',description:'Download attendance CSV',keywords:'spreadsheet hours',category:'Attendance & QR',access:'management' },
 { label:'Member directory',href:'/management-members',description:'Search gym members, plans and expiry',keywords:'clients customers search',category:'Members & memberships',access:'reception',quick:true },
 { label:'Member profiles',href:'/management-profiles',description:'Open existing member details',keywords:'member history subscription',category:'Members & memberships',access:'reception' },
 { label:'Custom membership plan',href:'/reception-register',description:'Select custom duration and price on direct registration or renewal',keywords:'custom days fee discount price',category:'Members & memberships',access:'reception' },
 { label:'Historical member import',href:'/staff-admin#members',description:'Admin-only historical activation excluded from revenue',keywords:'legacy import nonrevenue',category:'Members & memberships',access:'admin' },
 { label:'Staff directory',href:'/staff-admin#staff',description:'Employee profiles and management',keywords:'team hr',category:'Staff & payroll',access:'management' },
 { label:'Edit staff profiles',href:'/staff-admin#staff',description:'Update employee records',keywords:'team roles',category:'Staff & payroll',access:'management' },
 { label:'Staff account requests',href:'/admin-approvals',description:'Manage employee account requests',keywords:'staff approvals',category:'Staff & payroll',access:'management' },
 { label:'Salary records',href:'/management-payroll',description:'Review salary payments',keywords:'payroll wages',category:'Staff & payroll',access:'management' },
 { label:'Manage staff salaries',href:'/staff-admin#staff',description:'Individual employee salary records',keywords:'pay compensation',category:'Staff & payroll',access:'management' },
 { label:'Export salary records',href:'/management-payroll-export',description:'Download salary CSV',keywords:'payroll spreadsheet',category:'Staff & payroll',access:'management' },
 { label:'Revenue report',href:'/management-revenue',description:'Successful gym payments including direct reception collections',keywords:'sales income finance',category:'Revenue & reports',access:'management',quick:true },
 { label:'Admin revenue report',href:'/staff-admin#revenue',description:'Original detailed revenue report',keywords:'income monthly financial',category:'Revenue & reports',access:'management' },
 { label:'Revenue by plan',href:'/staff-admin#revenue',description:'Recorded membership revenue by plan',keywords:'sales income finance',category:'Revenue & reports',access:'management' },
 { label:'Payment transactions',href:'/staff-admin#revenue',description:'Find successful payment records',keywords:'cash pos transfer paystack receipts',category:'Revenue & reports',access:'management' },
 { label:'Gallery management',href:'/staff-gallery',description:'Manage photos and videos',keywords:'upload website images',category:'Website & communications',access:'management' },
 { label:'Blog management',href:'/staff-blog',description:'Publish blog posts',keywords:'articles website',category:'Website & communications',access:'management' },
 { label:'Birthday and expiry reminders',href:'/management-communications',description:'Prepare member reminders',keywords:'whatsapp birthday notification',category:'Website & communications',access:'reception' },
];
const normalize=(value:string)=>value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const tokenize=(value:string)=>normalize(value).split(/\s+/).filter(Boolean);
const related=[
 ['attendance','attend','presence','clock','checkin','checkout','visit','visits','timesheet','punctuality'],
 ['staff','employee','employees','team','worker','workers'],
 ['member','members','customer','customers','client','clients'],
 ['gym','fitness','facility','facilities'],
 ['salary','salaries','wages','payroll','payslip'],
 ['revenue','income','earnings','sales','finance'],
 ['gallery','photos','photo','pictures','picture','images','image','media'],
 ['video','videos','clip','clips'],
 ['blog','article','articles','post','posts'],
 ['register','registration','signup','enrol','enroll'],
 ['renew','renewal','subscription','membership'],
 ['qr','scan','scanner','scanning'],
 ['report','reports','export','download','spreadsheet','csv'],
 ['reminder','reminders','notification','notifications','message','messages'],
 ['payment','payments','transaction','transactions','pay'],
];
const groupFor=(word:string)=>related.find(group=>group.includes(word));
function distanceWithin(a:string,b:string,limit:number):boolean{
 if(Math.abs(a.length-b.length)>limit)return false;
 let previous=Array.from({length:b.length+1},(_,index)=>index);
 for(let i=1;i<=a.length;i++){
  const next=[i];
  for(let j=1;j<=b.length;j++)next[j]=Math.min((previous[j]??Infinity)+1,(next[j-1]??Infinity)+1,(previous[j-1]??Infinity)+Number(a[i-1]!==b[j-1]));
  if(Math.min(...next)>limit)return false;
  previous=next;
 }
 return (previous[b.length]??Infinity)<=limit;
}
function tokenScore(word:string,tokens:string[],weight:number){let best=0;const aliases=groupFor(word);for(const token of tokens){if(token===word)best=Math.max(best,20*weight);else if(token.startsWith(word)&&word.length>=2)best=Math.max(best,15*weight);else if(word.startsWith(token)&&token.length>=4)best=Math.max(best,10*weight);else if(aliases?.includes(token))best=Math.max(best,9*weight);else if(word.length>=4&&token.length>=4&&distanceWithin(word,token,word.length>=7?2:1))best=Math.max(best,7*weight);}return best;}
export function isActionVisible(action:Action,role:string):boolean{const normalized=role.trim().toLowerCase(),management=['admin','owner','manager'].includes(normalized);if(action.access==='admin')return normalized==='admin';if(action.access==='management')return management;if(action.access==='reception')return management||normalized==='reception';if(action.access==='staff')return !management&&normalized!=='reception';return Boolean(normalized);}
export function searchActions(query:string,role:string):Action[]{const available=actions.filter(action=>isActionVisible(action,role)),words=tokenize(query);if(!words.length)return available.filter(action=>action.quick).slice(0,8);const phrase=normalize(query);return available.map((action,index)=>{const label=normalize(action.label),labelTokens=tokenize(action.label),descriptionTokens=tokenize(action.description),keywordTokens=tokenize(action.keywords);if(!words.every(word=>Math.max(tokenScore(word,labelTokens,4),tokenScore(word,keywordTokens,2),tokenScore(word,descriptionTokens,1))>0))return null;let score=words.reduce((sum,word)=>sum+Math.max(tokenScore(word,labelTokens,4),tokenScore(word,keywordTokens,2),tokenScore(word,descriptionTokens,1)),0);if(label===phrase)score+=220;else if(label.includes(phrase))score+=90;return {action,score,index};}).filter((entry):entry is {action:Action;score:number;index:number}=>entry!==null).sort((a,b)=>b.score-a.score||a.index-b.index).map(({action})=>action);}
