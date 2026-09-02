import { notFound, redirect } from 'next/navigation';

import { getPhoneSessionMember } from '@/app/phone-auth';
import { Dashboard } from '@/components/dashboard';
import { findActiveMemberById, listTasksForDate } from '@/db/store';

export const dynamic = 'force-dynamic';

type EmployeePanelProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function EmployeePanel({ params, searchParams }: EmployeePanelProps) {
  const owner = await getPhoneSessionMember();
  if (!owner) redirect('/?aviso=login-necessario');
  if (owner.role !== 'owner') redirect('/');

  const { id } = await params;
  const employee = await findActiveMemberById(id);
  if (!employee || employee.role !== 'employee') notFound();

  const query = (await searchParams) ?? {};
  const date = validDate(singleValue(query.date)) ?? todayInSaoPaulo();
  const tasks = await listTasksForDate(date, employee);

  return (
    <Dashboard
      currentUser={employee}
      cards={[{ ...employee, tasks }]}
      employees={[]}
      employeeOptions={[]}
      accessCredentials={[]}
      employeeTotal={1}
      filteredEmployeeTotal={1}
      employeeSearch=""
      jobFilter=""
      employeePage={1}
      employeePageCount={1}
      taskStats={{
        total: tasks.length,
        completed: tasks.filter((task) => task.status === 'done').length,
      }}
      date={date}
      dateLabel={formatDate(date)}
      previousDate={shiftDate(date, -1)}
      nextDate={shiftDate(date, 1)}
      previewEmployeeId={employee.id}
    />
  );
}

function singleValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function validDate(value?: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : value;
}

function todayInSaoPaulo() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function formatDate(value: string) {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T12:00:00Z`));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function shiftDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
