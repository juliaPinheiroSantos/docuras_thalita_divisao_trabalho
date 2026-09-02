import { getPhoneSessionMember } from '@/app/phone-auth';
import { Dashboard } from '@/components/dashboard';
import { PhoneLogin } from '@/components/phone-login';
import {
  countActiveEmployees,
  getTaskStatsForDate,
  listAccessCredentials,
  listEmployeeOptions,
  listEmployeesPage,
  listTasksForDate,
  type AccessCredential,
  type EmployeeOption,
  type Member,
  type TaskStats,
  type WorkTask,
} from '@/db/store';
import { OWNER_PHONES } from '@/lib/access';

export const dynamic = 'force-dynamic';

type HomeProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = (await searchParams) ?? {};
  const date = validDate(singleValue(params.date)) ?? todayInSaoPaulo();
  const notice = singleValue(params.aviso);
  const employeeSearch = (singleValue(params.busca) ?? '').slice(0, 80);
  const jobFilter = validJobFilter(singleValue(params.funcao));
  const requestedPage = positiveInteger(singleValue(params.pagina));
  const membership = await getPhoneSessionMember();

  if (!membership) {
    const credentials = await listAccessCredentials();
    const ownerSetupRequired = OWNER_PHONES.some((phone) => {
      const credential = credentials.find((item) => item.phone === phone);
      return !credential?.passwordConfigured;
    });
    return <PhoneLogin notice={notice} showOwnerSetup={ownerSetupRequired} />;
  }

  let employees: Member[] = [];
  let employeeOptions: EmployeeOption[] = [];
  let accessCredentials: AccessCredential[] = [];
  let employeeTotal = 0;
  let filteredEmployeeTotal = 0;
  let employeePage = 1;
  let employeePageCount = 1;
  let tasks: WorkTask[] = [];
  let taskStats: TaskStats;

  if (membership.role === 'owner') {
    const [directory, options, total, stats] = await Promise.all([
      listEmployeesPage({ search: employeeSearch, jobTitle: jobFilter, page: requestedPage, pageSize: 12 }),
      listEmployeeOptions(),
      countActiveEmployees(),
      getTaskStatsForDate(date),
    ]);
    employees = directory.items;
    employeeOptions = options;
    employeeTotal = total;
    filteredEmployeeTotal = directory.total;
    employeePage = directory.page;
    employeePageCount = directory.pageCount;
    taskStats = stats;
    [accessCredentials, tasks] = await Promise.all([
      listAccessCredentials([membership.id, ...employees.map((employee) => employee.id)]),
      listTasksForDate(date, undefined, employees.map((employee) => employee.id)),
    ]);
  } else {
    tasks = await listTasksForDate(date, membership);
    taskStats = {
      total: tasks.length,
      completed: tasks.filter((task) => task.status === 'done').length,
    };
  }

  const cards = membership.role === 'owner'
    ? employees.map((employee) => ({ ...employee, tasks: tasks.filter((task) => task.assignedUserId === employee.id) }))
    : [{ ...membership, tasks }];

  return (
    <Dashboard
      currentUser={membership}
      cards={cards}
      employees={employees}
      employeeOptions={employeeOptions}
      accessCredentials={accessCredentials}
      employeeTotal={employeeTotal}
      filteredEmployeeTotal={filteredEmployeeTotal}
      employeeSearch={employeeSearch}
      jobFilter={jobFilter}
      employeePage={employeePage}
      employeePageCount={employeePageCount}
      taskStats={taskStats}
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

function validJobFilter(value?: string) {
  return value === 'Produção' || value === 'Atendimento + produção' ? value : '';
}

function positiveInteger(value?: string) {
  const parsed = Number.parseInt(value ?? '1', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
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
