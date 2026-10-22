// One account per state the app must handle (PRD section 3): each role, each status,
// an unverified email, a Telegram signup with no password yet, and a Telegram-only signup
// with an incomplete profile.
// `password: true` means the account gets the shared seed password.
// Optional timing fields (days before the seed runs): `signedUpDaysAgo` sets the signup date
// (the Pending queue is oldest first), `lastLoginDaysAgo` the last login. `approvedBy` is the
// key of the admin who approved the user; it becomes their pending to active status change.
const handwritten = [
  {
    key: 'admin',
    name: 'Ada Admin',
    email: 'admin@example.com',
    emailVerified: true,
    password: true,
    role: 'admin',
    status: 'active',
  },
  {
    // Signs in with Telegram only. A verified email keeps the profile complete.
    key: 'telegramAdmin',
    name: 'Tom Telegram-Admin',
    email: 'telegram-admin@example.com',
    emailVerified: true,
    telegramId: '100000004',
    telegramUsername: 'tom_admin',
    role: 'admin',
    status: 'active',
  },
  {
    key: 'staff',
    name: 'Sam Staff',
    email: 'staff@example.com',
    emailVerified: true,
    password: true,
    role: 'staff',
    status: 'active',
  },
  {
    key: 'staff2',
    name: 'Lena Linked',
    email: 'linked@example.com',
    emailVerified: true,
    // Persian-speaking user, so the UI, emails and bot messages can be seen in Persian.
    language: 'fa',
    password: true,
    telegramId: '100000002',
    telegramUsername: 'lena_linked',
    role: 'staff',
    status: 'active',
  },
  {
    key: 'pending',
    name: 'Pat Pending',
    email: 'pending@example.com',
    emailVerified: true,
    password: true,
    role: 'staff',
    status: 'pending',
  },
  {
    key: 'rejected',
    name: 'Rex Rejected',
    email: 'rejected@example.com',
    emailVerified: true,
    password: true,
    role: 'staff',
    status: 'rejected',
    statusChangedBy: 'admin',
    statusReason: 'Not part of the warehouse team.',
  },
  {
    // Telegram sign-in sends no code and shows the generic refusal.
    key: 'telegramRejected',
    name: 'Rita Rejected-Telegram',
    email: 'rejected-telegram@example.com',
    emailVerified: true,
    telegramId: '100000005',
    telegramUsername: 'rita_rejected',
    role: 'staff',
    status: 'rejected',
    statusChangedBy: 'admin',
    statusReason: 'Signed up by mistake.',
  },
  {
    key: 'unverified',
    name: 'Uma Unverified',
    email: 'unverified@example.com',
    emailVerified: false,
    password: true,
    role: 'staff',
    status: 'pending',
  },
  {
    // Signed up through Telegram and completed the profile, but never set a password:
    // can set a first password through Forgot password.
    key: 'telegramNoPassword',
    name: 'Theo Telegram',
    email: 'telegram-nopass@example.com',
    emailVerified: true,
    telegramId: '100000003',
    telegramUsername: 'theo_tg',
    role: 'staff',
    status: 'active',
  },
  {
    // Telegram signup on the "Check your email" screen: entered an email, not verified yet.
    // Resend on Complete profile sends the link.
    key: 'telegramAwaitingEmail',
    name: 'Pia Placeholder',
    pendingEmail: 'pia@example.com',
    telegramId: '100000006',
    telegramUsername: 'pia_tg',
    role: 'staff',
    status: 'pending',
  },
  {
    key: 'telegramOnly',
    name: 'Tara Telegram',
    telegramId: '100000001',
    telegramUsername: 'tara_tg',
    role: 'staff',
    status: 'pending',
  },
];

// Enough people to page, search and filter the Users page: more than one page of Active
// staff (some Telegram-linked, some never logged in), a queue of Pending signups with
// complete profiles, more unfinished signups, Rejected users with reasons, and one user who
// was rejected and then reactivated (its history is in statusChanges.js).
const ACTIVE_STAFF = [
  'Aiden Brooks',
  'Bella Carter',
  'Caleb Diaz',
  'Daria Evans',
  'Eli Foster',
  'Fiona Grant',
  'Gabe Hughes',
  'Hana Ito',
  'Ian Jones',
  'Jade Kim',
  'Kofi Lane',
  'Lila Moore',
  'Mateo Novak',
  'Nora Ortiz',
  'Omar Patel',
  'Pia Quinn',
  'Raj Singh',
  'Sofia Tran',
  'Theo Underwood',
  'Uma Vega',
  'Vik Wong',
  'Wren Xu',
];

const emailFor = (name) => `${name.toLowerCase().replace(' ', '.')}@example.com`;

const activeStaff = ACTIVE_STAFF.map((name, index) => ({
  key: `activeStaff${index + 1}`,
  name,
  email: emailFor(name),
  emailVerified: true,
  password: index % 3 !== 0,
  // Every fifth person also signs in with Telegram.
  ...(index % 5 === 0 && {
    telegramId: `1000100${String(index).padStart(2, '0')}`,
    telegramUsername: `${name.split(' ')[0].toLowerCase()}_tg`,
  }),
  role: 'staff',
  status: 'active',
  signedUpDaysAgo: 40 + index,
  // Some have never logged in.
  ...(index % 4 !== 0 && { lastLoginDaysAgo: index % 12 }),
  approvedBy: index % 2 === 0 ? 'admin' : 'telegramAdmin',
}));

const pendingQueue = ['Pat Quill', 'Quinn Rowe', 'Rhea Stone', 'Sid Tate'].map((name, index) => ({
  key: `pendingQueue${index + 1}`,
  name,
  email: emailFor(name),
  emailVerified: true,
  password: true,
  role: 'staff',
  status: 'pending',
  // The first one has waited the longest.
  signedUpDaysAgo: 4 - index,
}));

const unfinished = [
  {
    // Signed up with a password and never opened the verification link.
    key: 'unverifiedPending',
    name: 'Vera Unverified',
    email: 'vera.unverified@example.com',
    emailVerified: false,
    password: true,
    role: 'staff',
    status: 'pending',
    signedUpDaysAgo: 6,
  },
  {
    key: 'telegramPlaceholder',
    name: 'Tess Placeholder',
    telegramId: '100000201',
    telegramUsername: 'tess_tg',
    role: 'staff',
    status: 'pending',
    signedUpDaysAgo: 3,
  },
];

const rejectedStaff = [
  ['Walt Duplicate', 'Duplicate account.'],
  ['Xena Former', 'Left the company.'],
  ['Yuri Outsider', 'Not part of the warehouse team.'],
].map(([name, statusReason], index) => ({
  key: `rejectedStaff${index + 1}`,
  name,
  email: emailFor(name),
  emailVerified: true,
  password: true,
  role: 'staff',
  status: 'rejected',
  statusChangedBy: 'admin',
  statusReason,
  signedUpDaysAgo: 30 + index,
}));

const reactivated = {
  key: 'reactivated',
  name: 'Rory Returned',
  email: 'rory.returned@example.com',
  emailVerified: true,
  password: true,
  role: 'staff',
  status: 'active',
  statusChangedBy: 'admin',
  signedUpDaysAgo: 25,
  lastLoginDaysAgo: 1,
};

export const users = [
  ...handwritten,
  ...activeStaff,
  ...pendingQueue,
  ...unfinished,
  ...rejectedStaff,
  reactivated,
];
