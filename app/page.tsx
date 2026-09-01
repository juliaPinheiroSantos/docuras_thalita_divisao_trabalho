import { getPhoneSessionMember } from '@/app/phone-auth';
import { Dashboard } from '@/components/dashboard';
import { PhoneLogin } from '@/components/phone-login';
import { listAccessCredentials, listEmployees, listTasksForDate } from '@/db/store';

export const dynamic = 'force-dynamic';

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = (await searchParams) ?? {};
  const date = validDate(singleValue(params.date)) ?? todayInSaoPaulo();
  const notice = singleValue(params.aviso);
  const membership = await getPhoneSessionMember();

  if (!membership) return <PhoneLogin notice={notice} />;

  const employees = membership.role === 'owner' ? await listEmployees() : [];
  const accessCredentials = membership.role === 'owner' ? await listAccessCredentials() : [];
  const tasks = await listTasksForDate(date, membership.role === 'employee' ? membership : undefined);
  const cards = membership.role === 'owner'
    ? employees.map((employee) => ({
        ...employee,
        tasks: tasks.filter((task) => task.assignedUserId === employee.id),
      }))
    : [{ ...membership, tasks }];

  return (
    <Dashboard
      currentUser={membership}
      cards={cards}
      employees={employees}
      accessCredentials={accessCredentials}
      date={date}
      dateLabel={formatDate(date)}
      previousDate={shiftDate(date, -1)}
      nextDate={shiftDate(date, 1)}
      notice={notice}
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
