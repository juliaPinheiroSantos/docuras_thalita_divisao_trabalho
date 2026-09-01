import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    authUserId: text('auth_user_id'),
    email: text('email').notNull(),
    phone: text('phone'),
    name: text('name').notNull(),
    role: text('role', { enum: ['owner', 'employee'] }).notNull(),
    jobTitle: text('job_title').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_users_email').on(table.email),
    uniqueIndex('idx_users_auth_user_id').on(table.authUserId),
    uniqueIndex('idx_users_phone').on(table.phone),
    index('idx_users_role_active').on(table.role, table.active),
  ],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    tokenHash: text('token_hash').notNull(),
    userId: text('user_id').notNull().references(() => users.id),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull(),
  },
  (table) => [
    uniqueIndex('idx_sessions_token_hash').on(table.tokenHash),
    index('idx_sessions_expires_at').on(table.expiresAt),
  ],
);

export const tasks = sqliteTable(
  'tasks',
  {
    id: text('id').primaryKey(),
    assignedUserId: text('assigned_user_id').notNull().references(() => users.id),
    title: text('title').notNull(),
    details: text('details'),
    taskDate: text('task_date').notNull(),
    status: text('status', { enum: ['pending', 'done'] }).notNull().default('pending'),
    createdBy: text('created_by').notNull().references(() => users.id),
    createdAt: text('created_at').notNull(),
    completedAt: text('completed_at'),
  },
  (table) => [
    index('idx_tasks_date_assignee').on(table.taskDate, table.assignedUserId),
    index('idx_tasks_assignee_status').on(table.assignedUserId, table.status),
  ],
);
