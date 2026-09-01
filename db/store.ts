import type { ChatGPTUser } from '@/app/chatgpt-auth';
import { getD1 } from '@/db';

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
  schemaReady = (async () => {
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
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )`),
    ]);

    const columns = await db.prepare("PRAGMA table_info('users')").all<{ name: string }>();
    if (!columns.results.some((column) => column.name === 'phone')) {
      await db.prepare('ALTER TABLE users ADD COLUMN phone TEXT').run();
    }

    await db.batch([
      db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)'),
      db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_auth_user_id ON users(auth_user_id)'),
      db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, active)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_date_assignee ON tasks(task_date, assigned_user_id)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_tasks_assignee_status ON tasks(assigned_user_id, status)'),
      db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash)'),
      db.prepare('CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)'),
    ]);
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

export async function getOrCreateMembership(user: ChatGPTUser): Promise<Member | null> {
  await ensureSchema();
  const db = getD1();
  const byAuth = await db
    .prepare('SELECT * FROM users WHERE auth_user_id = ? AND active = 1 LIMIT 1')
    .bind(user.userId)
    .first<Record<string, unknown>>();
  if (byAuth) return normalizeMember(byAuth);

  const email = user.email.trim().toLowerCase();
  const invited = await db
    .prepare('SELECT * FROM users WHERE lower(email) = ? AND active = 1 LIMIT 1')
    .bind(email)
    .first<Record<string, unknown>>();
  if (invited) {
    const member = normalizeMember(invited);
    await db
      .prepare('UPDATE users SET auth_user_id = ? WHERE id = ? AND auth_user_id IS NULL')
      .bind(user.userId, member.id)
      .run();
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
  await db
    .prepare(`INSERT INTO users
      (id, auth_user_id, email, phone, name, role, job_title, active, created_at)
      VALUES (?, ?, ?, NULL, ?, 'owner', ?, 1, ?)`)
    .bind(owner.id, owner.authUserId, owner.email, owner.name, owner.jobTitle, owner.createdAt)
    .run();
  return owner;
}

export async function findActiveMemberByPhone(phone: string): Promise<Member | null> {
  await ensureSchema();
  const row = await getD1()
    .prepare('SELECT * FROM users WHERE phone = ? AND active = 1 LIMIT 1')
    .bind(phone)
    .first<Record<string, unknown>>();
  return row ? normalizeMember(row) : null;
}

export async function findActiveMemberById(memberId: string): Promise<Member | null> {
  await ensureSchema();
  const row = await getD1()
    .prepare('SELECT * FROM users WHERE id = ? AND active = 1 LIMIT 1')
    .bind(memberId)
    .first<Record<string, unknown>>();
  return row ? normalizeMember(row) : null;
}

export async function listEmployees(): Promise<Member[]> {
  await ensureSchema();
  const result = await getD1()
    .prepare("SELECT * FROM users WHERE role = 'employee' AND active = 1 ORDER BY name COLLATE NOCASE")
    .all<Record<string, unknown>>();
  return result.results.map(normalizeMember);
}

export async function listTasksForDate(date: string, member?: Member): Promise<WorkTask[]> {
  await ensureSchema();
  const query = member?.role === 'employee'
    ? getD1().prepare(`SELECT * FROM tasks WHERE task_date = ? AND assigned_user_id = ?
        ORDER BY status ASC, created_at ASC`).bind(date, member.id)
    : getD1().prepare(`SELECT * FROM tasks WHERE task_date = ?
        ORDER BY status ASC, created_at ASC`).bind(date);
  const result = await query.all<Record<string, unknown>>();
  return result.results.map(normalizeTask);
}

export async function createEmployee(input: { name: string; phone: string; jobTitle: string }) {
  await ensureSchema();
  const db = getD1();
  const count = await db
    .prepare("SELECT COUNT(*) AS total FROM users WHERE role = 'employee' AND active = 1")
    .first<{ total: number }>();
  if (Number(count?.total ?? 0) >= 5) throw new Error('A equipe já tem 5 funcionários ativos.');

  const existing = await db
    .prepare('SELECT id FROM users WHERE phone = ? LIMIT 1')
    .bind(input.phone)
    .first<{ id: string }>();
  if (existing) throw new Error('Este celular já está cadastrado.');

  const id = crypto.randomUUID();
  const internalEmail = `phone-${input.phone}-${id.slice(0, 8)}@internal.invalid`;
  await db
    .prepare(`INSERT INTO users
      (id, auth_user_id, email, phone, name, role, job_title, active, created_at)
      VALUES (?, NULL, ?, ?, ?, 'employee', ?, 1, ?)`)
    .bind(id, internalEmail, input.phone, input.name.trim(), input.jobTitle, new Date().toISOString())
    .run();
}

export async function updateMemberPhone(memberId: string, phone: string) {
  await ensureSchema();
  const db = getD1();
  const existing = await db
    .prepare('SELECT id FROM users WHERE phone = ? AND id != ? LIMIT 1')
    .bind(phone, memberId)
    .first<{ id: string }>();
  if (existing) throw new Error('Este celular já está cadastrado.');
  await db.batch([
    db.prepare('UPDATE users SET phone = ? WHERE id = ? AND active = 1').bind(phone, memberId),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(memberId),
  ]);
}

export async function deactivateEmployee(memberId: string) {
  await ensureSchema();
  const db = getD1();
  await db.batch([
    db.prepare("UPDATE users SET active = 0 WHERE id = ? AND role = 'employee'").bind(memberId),
    db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(memberId),
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

  await db
    .prepare(`INSERT INTO tasks
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
  const task = await db
    .prepare('SELECT assigned_user_id, status FROM tasks WHERE id = ? LIMIT 1')
    .bind(taskId)
    .first<{ assigned_user_id: string; status: 'pending' | 'done' }>();
  if (!task) throw new Error('Tarefa não encontrada.');
  if (actor.role !== 'owner' && task.assigned_user_id !== actor.id) {
    throw new Error('Acesso não autorizado.');
  }
  const status = task.status === 'done' ? 'pending' : 'done';
  await db
    .prepare('UPDATE tasks SET status = ?, completed_at = ? WHERE id = ?')
    .bind(status, status === 'done' ? new Date().toISOString() : null, taskId)
    .run();
}

export async function deleteTask(taskId: string) {
  await ensureSchema();
  await getD1().prepare('DELETE FROM tasks WHERE id = ?').bind(taskId).run();
}

function normalizeMember(row: Record<string, unknown>): Member {
  return {
    id: String(row.id),
    authUserId: row.auth_user_id ? String(row.auth_user_id) : null,
    email: String(row.email),
    phone: row.phone ? String(row.phone) : null,
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
    details: row.details ? String(row.details) : null,
    taskDate: String(row.task_date),
    status: String(row.status) as 'pending' | 'done',
    createdBy: String(row.created_by),
    createdAt: String(row.created_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}
