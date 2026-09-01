import { LockKeyhole, LogOut } from 'lucide-react';

import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { Button } from '@/components/ui/button';
import { Dashboard } from '@/components/dashboard';
import { getOrCreateMembership, listEmployees, listTasksForDate } from '@/db/store';

export const dynamic = 'force-dynamic';

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = (await searchParams) ?? {};
  const date = validDate(singleValue(params.date)) ?? todayInSaoPaulo();
  const notice = singleValue(params.aviso);
  const user = await requireChatGPTUser(`/?date=${date}`);
  const membership = await getOrCreateMembership(user);

  if (!membership) return <NoAccess email={user.email} />;

  const employees = membership.role === 'owner' ? await listEmployees() : [];
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
      date={date}
      dateLabel={formatDate(date)}
      previousDate={shiftDate(date, -1)}
      nextDate={shiftDate(date, 1)}
      notice={notice}
    />
  );
}

function NoAccess({ email }: { email: string }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-5">
      <section className="w-full max-w-md rounded-3xl border border-brand/10 bg-white p-7 text-center shadow-[0_24px_70px_rgb(90_45_45/9%)] sm:p-9">
        <img src="/logo-docuras-da-thalita.svg" alt="Doçuras da Thalita" className="mx-auto h-24 w-28 object-contain" />
        <span className="mx-auto mt-3 grid size-12 place-items-center rounded-2xl bg-blush/20 text-brand"><LockKeyhole className="size-6" /></span>
        <h1 className="mt-5 font-heading text-2xl font-semibold">Acesso ainda não liberado</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          O e-mail <strong className="font-medium text-foreground">{email}</strong> ainda não faz parte da equipe. Peça ao proprietário para cadastrá-lo exatamente como aparece aqui.
        </p>
        <Button variant="outline" className="mt-6" render={<a href="/signout-with-chatgpt?return_to=%2F" />}><LogOut /> Entrar com outro e-mail</Button>
      </section>
    </main>
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
