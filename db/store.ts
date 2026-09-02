import type { ChatGPTUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';
import { isOwnerPhone, OWNER_PHONES } from '@/lib/access';

export type MemberRole = 'owner' | 'employee';

export type Member = {
  id: string;
  authUserId: string | null;
  email: string;
  phone: string | null;
  name: string;
  role: MemberRole;
  jobTitle: string;
  active: number;
  createdAt: string;
};

export type AccessCredential = {
  id: string;
  userId: string;
  phone: string;
  passwordConfigured: boolean;
};

export type EmployeeOption = Pick<Member, 'id' | 'name' | 'jobTitle'>;

export type EmployeePage = {
  items: Member[];
  total: number;
  page: number;
  pageCount: number;
};

export type TaskStats = {
  total: number;
  completed: number;
};

export type CredentialLogin = {
  credentialId: string;
  phone: string;
  passwordHash: string | null;
  passwordSalt: string | null;
  member: Member;
};

export type WorkTask = {
  id: string;
  assignedUserId: string;
  title: string;
  details: string | null;
  taskDate: string;
  status: 'pending' | 'done';
  createdBy: string;
  createdAt: string;
  completedAt: string | null;
};

let schemaReady: Promise<void> | null = null;

export async function ensureSchema() {
  if (schemaReady) return schemaReady;
  schemaReady = initializeSchema().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

async function initializeSchema() {
  const db = getD1();
  await db.batch([
    db.prepare(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY NOT NULL,
      auth_user_id TEXT,
      email TEXT NOT NULL,
      phone TEXT,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('owner', 'employee')),
      job_title TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS login_credentials (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      phone TEXT NOT NULL,
      password_hash TEXT,
      password_salt TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      assigned_user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      details TEXT,
      task_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'done')),
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (assigned_user_id) REFERENCES users(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    )`),
    db.prepare(`CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY NOT NULL,
      token_hash TEXT NOT NULL,
      user_id TEXT NOT NULL,
      credential_id TEXT,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (credential_id) REFERENCES login_credentials(id)
    )`),
  ]);

  const userColumns = await db.prepare("PRAGMA table_info('users')").all<{ name: string }>();
  if (!userColumns.results.some((column) => column.name === 'phone')) {
    await db.prepare('ALTER TABLE users ADD COLUMN phone TEXT').run();
  }
  const sessionColumns = await db.prepare("PRAGMA table_info('sessions')").all<{ name: string }>();
  if (!sessionColumns.results.some((column) => column.name === 'credential_id')) {
    await db.prepare('ALTER TABLE sessions ADD COLUMN credential_id TEXT').run();
  }

  await db.batch([
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)'),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id)'),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_users_role_active_job_title ON users(role, active, job_title)'),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_login_credentials_phone ON login_credentials(phone)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_login_credentials_user_id ON login_credentials(user_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_date_assignee ON tasks(task_date, assigned_user_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assigned_user_id, status)'),
    db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_credential_id ON sessions(credential_id)'),
    db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)'),
  ]);

  const legacyPhones = await db
    .prepare("SELECT id, phone FROM users WHERE phone IS NOT NULL AND phone != ''")
    .all<{ id: string; phone: string }>();
  for (const row of legacyPhones.results) {
    const existing = await db
      .prepare('SELECT id FROM login_credentials WHERE phone = ? LIMIT 1')
      .bind(row.phone)
      .first<{ id: string }>();
    if (!existing) {
      const now = new Date().toISOString();
      await db.prepare(`INSERT INTO login_credentials
        (id, user_id, phone, password_hash, password_salt, created_at, updated_at)
        VALUES (?, ?, ?, NULL, NULL, ?, ?)`)
        .bind(crypto.randomUUID(), row.id, row.phone, now, now)
        .run();
    }
  }

  const owner = await db
    .prepare("SELECT id FROM users WHERE role = 'owner' AND active = 1 LIMIT 1")
    .first<{ id: string }>();
  if (owner) await seedOwnerCredentials(db, owner.id);

  await db.batch([
    db.prepare('DELETE FROM sessions WHERE credential_id IS NULL'),
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(new Date().toISOString()),
    db.prepare('PRAGMA optimize'),
  ]);
}

export async function getOrCreateMembership(user: ChatGPTUser): Promise<Member | null> {
  await ensureSchema();
  const db = getD1();
  const byAuth = await db
    .prepare('SELECT * FROM users WHERE auth_user_id = ? AND active = 1 LIMIT 1')
    .bind(user.userId)
    .first<Record<string, unknown>>();
  if (byAuth) {
    const member = normalizeMember(byAuth);
    if (member.role === 'owner') await ensureOwnerCredentials(member.id);
    return member;
  }

  const email = user.email.trim().toLowerCase();
  const invited = await db
    .prepare('SELECT * FROM users WHERE lower(email) = ? AND active = 1 LIMIT 1')
    .bind(email)
    .first<Record<string, unknown>>();
  if (invited) {
    const member = normalizeMember(invited);
    await db.prepare('UPDATE users SET auth_user_id = ? WHERE id = ? AND auth_user_id IS NULL')
      .bind(user.userId, member.id)
      .run();
    if (member.role === 'owner') await ensureOwnerCredentials(member.id);
    return { ...member, authUserId: user.userId };
  }

  const count = await db.prepare('SELECT COUNT(*) AS total FROM users').first<{ total: number }>();
  if (Number(count?.total ?? 0) > 0) return null;

  const owner: Member = {
    id: crypto.randomUUID(),
    authUserId: user.userId,
    email,
    phone: null,
    name: user.fullName?.trim() || email.split('@')[0] || 'Proprietária',
    role: 'owner',
    jobTitle: 'Proprietária',
    active: 1,
    createdAt: new Date().toISOString(),
  };
  await db.prepare(`INSERT INTO users
    (id, auth_user_id, email, phone, name, role, job_title, active, created_at)
    VALUES (?, ?, ?, NULL, ?, 'owner', ?, 1, ?)`)
    .bind(owner.id, owner.authUserId, owner.email, owner.name, owner.jobTitle, owner.createdAt)
    .run();
  await ensureOwnerCredentials(owner.id);
  return owner;
}

export async function getOrCreateBootstrapOwner(): Promise<Member | null> {
  await ensureSchema();
  const db = getD1();
  const existing = await db
    .prepare("SELECT * FROM users WHERE role = 'owner' AND active = 1 LIMIT 1")
    .first<Record<string, unknown>>();
  if (existing) {
    const owner = normalizeMember(existing);
    await ensureOwnerCredentials(owner.id);
    return owner;
  }

  const count = await db.prepare('SELECT COUNT(*) AS total FROM users').first<{ total: number }>();
  if (Number(count?.total ?? 0) > 0) return null;

  const owner: Member = {
    id: crypto.randomUUID(),
    authUserId: null,
    email: 'proprietaria@internal.invalid',
    phone: null,
    name: 'Proprietária',
    role: 'owner',
    jobTitle: 'Proprietária',
    active: 1,
    createdAt: new Date().toISOString(),
  };
  await db.prepare(`INSERT INTO users
    (id, auth_user_id, email, phone, name, role, job_title, active, created_at)
    VALUES (?, NULL, ?, NULL, ?, 'owner', ?, 1, ?)`)
    .bind(owner.id, owner.email, owner.name, owner.jobTitle, owner.createdAt)
    .run();
  await ensureOwnerCredentials(owner.id);
  return owner;
}

export async function ensureOwnerCredentials(ownerId: string) {
  await ensureSchema();
  await seedOwnerCredentials(getD1(), ownerId);
}

async function seedOwnerCredentials(db: D1Database, ownerId: string) {
  const now = new Date().toISOString();
  for (const phone of OWNER_PHONES) {
    const existing = await db
      .prepare('SELECT id, user_id FROM login_credentials WHERE phone = ? LIMIT 1')
      .bind(phone)
      .first<{ id: string; user_id: string }>();
    if (existing) {
      if (existing.user_id !== ownerId) {
        await db.batch([
          db.prepare('DELETE FROM sessions WHERE credential_id = ?').bind(existing.id),
          db.prepare(`UPDATE login_credentials
            SET user_id = ?, password_hash = NULL, password_salt = NULL, updated_at = ?
            WHERE id = ?`).bind(ownerId, now, existing.id),
        ]);
      }
    } else {
      await db.prepare(`INSERT INTO login_credentials
        (id, user_id, phone, password_hash, password_salt, created_at, updated_at)
        VALUES (?, ?, ?, NULL, NULL, ?, ?)`)
        .bind(crypto.randomUUID(), ownerId, phone, now, now)
        .run();
    }
  }

  const ownerCredentials = await db
    .prepare('SELECT id, phone FROM login_credentials WHERE user_id = ?')
    .bind(ownerId)
    .all<{ id: string; phone: string }>();
  for (const credential of ownerCredentials.results) {
    if (!isOwnerPhone(credential.phone)) {
      await db.batch([
        db.prepare('DELETE FROM sessions WHERE credential_id = ?').bind(credential.id),
        db.prepare('DELETE FROM login_credentials WHERE id = ?').bind(credential.id),
      ]);
    }
  }
}

export async function findCredentialLoginByPhone(phone: string): Promise<CredentialLogin | null> {
  await ensureSchema();
  const row = await getD1().prepare(`SELECT
      c.id AS credential_id,
      c.phone AS credential_phone,
      c.password_hash,
      c.password_salt,
      u.*
    FROM login_credentials c
    JOIN users u ON u.id = c.user_id
    WHERE c.phone = ? AND u.active = 1
    LIMIT 1`)
    .bind(phone)
    .first<Record<string, unknown>>();
  if (!row) return null;
  const member = normalizeMember(row);
  if (member.role === 'owner' && !isOwnerPhone(String(row.credential_phone))) return null;
  return {
    credentialId: String(row.credential_id),
    phone: String(row.credential_phone),
    passwordHash: nullableString(row.password_hash),
    passwordSalt: nullableString(row.password_salt),
    member,
  };
}

export async function findActiveMemberById(memberId: string): Promise<Member | null> {
  await ensureSchema();
  const row = await getD1()
    .prepare('SELECT * FROM users WHERE id = ? AND active = 1 LIMIT 1')
    .bind(memberId)
    .first<Record<string, unknown>>();
  return row ? normalizeMember(row) : null;
}

export async function listAccessCredentials(userIds?: string[]): Promise<AccessCredential[]> {
  await ensureSchema();
  if (userIds && userIds.length === 0) return [];
  const filter = userIds ? ` AND c.user_id IN (${userIds.map(() => '?').join(', ')})` : '';
  const query = getD1().prepare(`SELECT c.id, c.user_id, c.phone, c.password_hash
    FROM login_credentials c
    JOIN users u ON u.id = c.user_id
    WHERE u.active = 1${filter}
    ORDER BY c.phone`);
  const result = await (userIds ? query.bind(...userIds) : query).all<Record<string, unknown>>();
  return result.results.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    phone: String(row.phone),
    passwordConfigured: Boolean(row.password_hash),
  }));
}

export async function setMemberCredential(input: {
  memberId: string;
  phone: string;
  passwordHash: string;
  passwordSalt: string;
}) {
  await ensureSchema();
  const db = getD1();
  const memberRow = await db
    .prepare('SELECT id, role FROM users WHERE id = ? AND active = 1 LIMIT 1')
    .bind(input.memberId)
    .first<{ id: string; role: MemberRole }>();
  if (!memberRow) throw new Error('Usuário não encontrado.');
  if (memberRow.role === 'owner' && !isOwnerPhone(input.phone)) {
    throw new Error('Número não autorizado para proprietário.');
  }
  if (memberRow.role === 'employee' && isOwnerPhone(input.phone)) {
    throw new Error('Número reservado ao proprietário.');
  }

  const byPhone = await db
    .prepare('SELECT id, user_id FROM login_credentials WHERE phone = ? LIMIT 1')
    .bind(input.phone)
    .first<{ id: string; user_id: string }>();
  if (byPhone && byPhone.user_id !== input.memberId) throw new Error('Este celular já está cadastrado.');

  const existing = memberRow.role === 'owner'
    ? byPhone
    : await db.prepare('SELECT id, user_id FROM login_credentials WHERE user_id = ? LIMIT 1')
      .bind(input.memberId)
      .first<{ id: string; user_id: string }>();
  const now = new Date().toISOString();
  if (existing) {
    await db.batch([
      db.prepare(`UPDATE login_credentials
        SET phone = ?, password_hash = ?, password_salt = ?, updated_at = ?
        WHERE id = ?`)
        .bind(input.phone, input.passwordHash, input.passwordSalt, now, existing.id),
      db.prepare('DELETE FROM sessions WHERE credential_id = ?').bind(existing.id),
    ]);
  } else {
    await db.prepare(`INSERT INTO login_credentials
      (id, user_id, phone, password_hash, password_salt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), input.memberId, input.phone, input.passwordHash, input.passwordSalt, now, now)
      .run();
  }
  if (memberRow.role === 'employee') {
    await db.prepare('UPDATE users SET phone = ? WHERE id = ?').bind(input.phone, input.memberId).run();
  }
}

export async function listEmployeesPage(input: {
  search?: string;
  jobTitle?: string;
  page?: number;
  pageSize?: number;
}): Promise<EmployeePage> {
  await ensureSchema();
  const db = getD1();
  const conditions = ["role = 'employee'", 'active = 1'];
  const bindings: Array<string | number> = [];
  const search = input.search?.trim().toLowerCase();
  if (search) {
    const term = `%${escapeLike(search)}%`;
    conditions.push("(lower(name) LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\')");
    bindings.push(term, term);
  }
  if (input.jobTitle) {
    conditions.push('job_title = ?');
    bindings.push(input.jobTitle);
  }
  const where = conditions.join(' AND ');
  const count = await db.prepare(`SELECT COUNT(*) AS total FROM users WHERE ${where}`)
    .bind(...bindings)
    .first<{ total: number }>();
  const total = Number(count?.total ?? 0);
  const pageSize = Math.min(Math.max(input.pageSize ?? 12, 6), 48);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(Math.max(input.page ?? 1, 1), pageCount);
  const result = await db.prepare(`SELECT * FROM users WHERE ${where}
    ORDER BY name COLLATE NOCASE LIMIT ? OFFSET ?`)
    .bind(...bindings, pageSize, (page - 1) * pageSize)
    .all<Record<string, unknown>>();
  return { items: result.results.map(normalizeMember), total, page, pageCount };
}

export async function countActiveEmployees() {
  await ensureSchema();
  const row = await getD1()
    .prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'employee' AND active = 1")
    .first<{ total: number }>();
  return Number(row?.total ?? 0);
}

export async function listEmployeeOptions(): Promise<EmployeeOption[]> {
  await ensureSchema();
  const result = await getD1()
    .prepare("SELECT id, name, job_title FROM users WHERE role = 'employee' AND active = 1 ORDER BY name COLLATE NOCASE")
    .all<Record<string, unknown>>();
  return result.results.map((row) => ({
    id: String(row.id),
    name: String(row.name),
    jobTitle: String(row.job_title),
  }));
}

export async function listTasksForDate(date: string, member?: Member, assignedUserIds?: string[]): Promise<WorkTask[]> {
  await ensureSchema();
  if (!member && assignedUserIds && assignedUserIds.length === 0) return [];
  const ownerFilter = assignedUserIds
    ? ` AND assigned_user_id IN (${assignedUserIds.map(() => '?').join(', ')})`
    : '';
  const query = member?.role === 'employee'
    ? getD1().prepare(`SELECT * FROM tasks WHERE task_date = ? AND assigned_user_id = ?
        ORDER BY status ASC, created_at ASC`).bind(date, member.id)
    : getD1().prepare(`SELECT * FROM tasks WHERE task_date = ?${ownerFilter}
        ORDER BY status ASC, created_at ASC`).bind(date, ...(assignedUserIds ?? []));
  const result = await query.all<Record<string, unknown>>();
  return result.results.map(normalizeTask);
}

export async function getTaskStatsForDate(date: string): Promise<TaskStats> {
  await ensureSchema();
  const row = await getD1().prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completed
    FROM tasks WHERE task_date = ?`)
    .bind(date)
    .first<{ total: number; completed: number | null }>();
  return { total: Number(row?.total ?? 0), completed: Number(row?.completed ?? 0) };
}

export async function createEmployee(input: {
  name: string;
  phone: string;
  jobTitle: string;
  passwordHash: string;
  passwordSalt: string;
}) {
  await ensureSchema();
  if (isOwnerPhone(input.phone)) throw new Error('Número reservado ao proprietário.');
  const db = getD1();
  const existing = await db.prepare('SELECT id FROM login_credentials WHERE phone = ? LIMIT 1')
    .bind(input.phone)
    .first<{ id: string }>();
  if (existing) throw new Error('Este celular já está cadastrado.');

  const id = crypto.randomUUID();
  const credentialId = crypto.randomUUID();
  const now = new Date().toISOString();
  const internalEmail = `phone-${input.phone}-${id.slice(0, 8)}@internal.invalid`;
  await db.batch([
    db.prepare(`INSERT INTO users
      (id, auth_user_id, email, phone, name, role, job_title, active, created_at)
      VALUES (?, NULL, ?, ?, ?, 'employee', ?, 1, ?)`)
      .bind(id, internalEmail, input.phone, input.name.trim(), input.jobTitle, now),
    db.prepare(`INSERT INTO login_credentials
      (id, user_id, phone, password_hash, password_salt, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(credentialId, id, input.phone, input.passwordHash, input.passwordSalt, now, now),
  ]);
}

export async function deactivateEmployee(memberId: string) {
  await ensureSchema();
  const db = getD1();
  await db.batch([
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(memberId),
    db.prepare('DELETE FROM login_credentials WHERE user_id = ?').bind(memberId),
    db.prepare("UPDATE users SET active = 0 WHERE id = ? AND role = 'employee'").bind(memberId),
  ]);
}

export async function createTask(input: {
  title: string;
  details: string | null;
  assignedUserId: string;
  taskDate: string;
  createdBy: string;
}) {
  await ensureSchema();
  const db = getD1();
  const assignee = await db
    .prepare("SELECT id FROM users WHERE id = ? AND role = 'employee' AND active = 1")
    .bind(input.assignedUserId)
    .first<{ id: string }>();
  if (!assignee) throw new Error('Funcionário inválido.');
  await db.prepare(`INSERT INTO tasks
    (id, assigned_user_id, title, details, task_date, status, created_by, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, NULL)`)
    .bind(
      crypto.randomUUID(), input.assignedUserId, input.title.trim(), input.details,
      input.taskDate, input.createdBy, new Date().toISOString(),
    )
    .run();
}

export async function toggleTask(taskId: string, actor: Member) {
  await ensureSchema();
  const db = getD1();
  const task = await db.prepare('SELECT assigned_user_id, status FROM tasks WHERE id = ? LIMIT 1')
    .bind(taskId)
    .first<{ assigned_user_id: string; status: 'pending' | 'done' }>();
  if (!task) throw new Error('Tarefa não encontrada.');
  if (actor.role !== 'owner' && task.assigned_user_id !== actor.id) throw new Error('Acesso não autorizado.');
  const status: WorkTask['status'] = task.status === 'done' ? 'pending' : 'done';
  await db.prepare('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?')
    .bind(status, status === 'done' ? new Date().toISOString() : null, taskId)
    .run();
  return status;
}

export async function deleteTask(taskId: string) {
  await ensureSchema();
  await getD1().prepare('DELETE FROM tasks WHERE id = ?').bind(taskId).run();
}

function normalizeMember(row: Record<string, unknown>): Member {
  return {
    id: String(row.id),
    authUserId: nullableString(row.auth_user_id),
    email: String(row.email),
    phone: nullableString(row.phone),
    name: String(row.name),
    role: String(row.role) as MemberRole,
    jobTitle: String(row.job_title),
    active: Number(row.active),
    createdAt: String(row.created_at),
  };
}

function normalizeTask(row: Record<string, unknown>): WorkTask {
  return {
    id: String(row.id),
    assignedUserId: String(row.assigned_user_id),
    title: String(row.title),
    details: nullableString(row.details),
    taskDate: String(row.task_date),
    status: String(row.status) as 'pending' | 'done',
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    completedAt: nullableString(row.completed_at),
  };
}

function nullableString(value: unknown) {
  return typeof value === 'string' && value ? value : null;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}
