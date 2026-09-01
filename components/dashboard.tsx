'use client';

import { useState } from 'react';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LogOut,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';

import {
  addEmployeeAction,
  createTaskAction,
  deactivateEmployeeAction,
  deleteTaskAction,
  toggleTaskAction,
} from '@/app/actions';
import type { Member, WorkTask } from '@/db/store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

type MemberTasks = Member & { tasks: WorkTask[] };

type DashboardProps = {
  currentUser: Member;
  cards: MemberTasks[];
  employees: Member[];
  date: string;
  dateLabel: string;
  previousDate: string;
  nextDate: string;
  notice?: string;
};

const notices: Record<string, string> = {
  'tarefa-adicionada': 'Tarefa adicionada à lista.',
  'tarefa-excluida': 'Tarefa excluída.',
  'funcionario-adicionado': 'Funcionário adicionado. O acesso será liberado pelo e-mail cadastrado.',
  'funcionario-removido': 'Funcionário removido da equipe ativa.',
  'erro-tarefa': 'Não foi possível adicionar a tarefa. Tente novamente.',
  'erro-funcionario': 'Não foi possível adicionar. Confira se o e-mail já está cadastrado ou se a equipe chegou a 5 pessoas.',
  'dados-invalidos': 'Confira os campos preenchidos e tente novamente.',
};

export function Dashboard({
  currentUser,
  cards,
  employees,
  date,
  dateLabel,
  previousDate,
  nextDate,
  notice,
}: DashboardProps) {
  const isOwner = currentUser.role === 'owner';
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [teamDialogOpen, setTeamDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(employees[0]?.id ?? '');
  const allTasks = cards.flatMap((card) => card.tasks);
  const completed = allTasks.filter((task) => task.status === 'done').length;

  function openTaskDialog(memberId?: string) {
    setSelectedEmployee(memberId ?? employees[0]?.id ?? '');
    setTaskDialogOpen(true);
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-brand/10 bg-background/92 backdrop-blur-xl">
        <div className="mx-auto flex h-[72px] max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-10">
          <div className="flex items-center gap-3">
            <img
              src="/logo-docuras-da-thalita.svg"
              alt="Doçuras da Thalita"
              className="h-12 w-14 object-contain object-center"
            />
            <div className="hidden sm:block">
              <p className="font-heading text-[15px] font-semibold leading-tight text-brand">Doçuras da Thalita</p>
              <p className="text-xs text-muted-foreground">Organização da equipe</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <Badge className="hidden border-brand/15 bg-blush/25 text-brand sm:inline-flex">
              {isOwner ? 'Visão do dono' : currentUser.jobTitle}
            </Badge>
            <div className="group relative">
              <button className="flex items-center gap-2 rounded-full border border-brand/12 bg-white py-1.5 pl-1.5 pr-2 text-sm font-medium shadow-xs transition hover:border-brand/25">
                <span className="grid size-8 place-items-center rounded-full bg-brand text-xs font-semibold text-white">
                  {initials(currentUser.name)}
                </span>
                <span className="hidden max-w-32 truncate sm:inline">{firstName(currentUser.name)}</span>
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
              <div className="invisible absolute right-0 top-full z-30 mt-2 w-56 rounded-xl border border-brand/10 bg-white p-2 opacity-0 shadow-xl transition group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
                <div className="px-2 py-2">
                  <p className="truncate text-sm font-semibold">{currentUser.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{currentUser.email}</p>
                </div>
                <a
                  href="/signout-with-chatgpt?return_to=%2F"
                  className="flex h-9 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="size-4" /> Sair
                </a>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 sm:py-8 lg:px-10">
        {notice && notices[notice] ? (
          <output className="mb-5 block rounded-xl border border-brand/15 bg-blush/15 px-4 py-3 text-sm text-brand">
            {notices[notice]}
          </output>
        ) : null}

        <section className="mb-7 flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-brand">
              <CalendarDays className="size-4" /> {dateLabel}
            </div>
            <h1 className="font-heading text-3xl font-semibold tracking-[-0.035em] sm:text-4xl">
              {isOwner ? 'Tarefas do dia' : 'Minha lista de hoje'}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base">
              {isOwner
                ? 'Distribua o trabalho e acompanhe o andamento de toda a equipe.'
                : 'Todas as tarefas abaixo devem ser concluídas no dia. Marque cada uma ao finalizar.'}
            </p>
          </div>
          {isOwner ? (
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button variant="outline" size="lg" className="h-11 rounded-xl" onClick={() => setTeamDialogOpen(true)}>
                <Users /> Equipe
              </Button>
              <Button
                size="lg"
                className="h-11 rounded-xl px-4 shadow-sm"
                onClick={() => openTaskDialog()}
                disabled={employees.length === 0}
              >
                <Plus /> Nova tarefa
              </Button>
            </div>
          ) : null}
        </section>

        <section className="mb-7 grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-2xl border border-brand/10 bg-white p-4 shadow-[0_8px_24px_rgb(90_45_45/4%)]">
            <span className="grid size-10 place-items-center rounded-xl bg-blush/25 text-brand"><Users className="size-5" /></span>
            <div>
              <p className="text-2xl font-semibold tracking-tight">{isOwner ? `${employees.length}/5` : '1'}</p>
              <p className="text-xs text-muted-foreground">{isOwner ? 'funcionários cadastrados' : 'lista pessoal'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-brand/10 bg-white p-4 shadow-[0_8px_24px_rgb(90_45_45/4%)]">
            <span className="grid size-10 place-items-center rounded-xl bg-[#e8f3ec] text-[#467158]"><CheckCircle2 className="size-5" /></span>
            <div>
              <p className="text-2xl font-semibold tracking-tight">{completed} <span className="text-sm font-normal text-muted-foreground">de {allTasks.length}</span></p>
              <p className="text-xs text-muted-foreground">tarefas concluídas</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-brand/10 bg-white p-4 shadow-[0_8px_24px_rgb(90_45_45/4%)]">
            <span className="grid size-10 place-items-center rounded-xl bg-[#fff0dc] text-[#9b632a]"><Clock3 className="size-5" /></span>
            <div>
              <p className="text-sm font-semibold">07:00 às 16:00</p>
              <p className="text-xs text-muted-foreground">terça a sábado · sujeito à demanda</p>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-lg font-semibold">{isOwner ? 'Equipe' : 'Afazeres'}</h2>
            <div className="flex items-center gap-1 rounded-xl border border-brand/10 bg-white p-1 shadow-xs">
              <a aria-label="Dia anterior" href={`/?date=${previousDate}`} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronLeft className="size-4" /></a>
              <form method="GET" className="flex items-center gap-1">
                <Input aria-label="Escolher data" type="date" name="date" defaultValue={date} className="h-8 w-[138px] border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0" />
                <Button type="submit" variant="ghost" size="xs">Ir</Button>
              </form>
              <a aria-label="Próximo dia" href={`/?date=${nextDate}`} className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"><ChevronRight className="size-4" /></a>
            </div>
          </div>

          {cards.length === 0 ? (
            <div className="grid min-h-72 place-items-center rounded-2xl border border-dashed border-brand/20 bg-white/55 p-6 text-center">
              <div className="max-w-sm">
                <span className="mx-auto mb-4 grid size-12 place-items-center rounded-2xl bg-blush/20 text-brand"><UserPlus className="size-6" /></span>
                <h3 className="font-heading text-xl font-semibold">Cadastre a equipe para começar</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">Adicione os cinco funcionários pelo nome e e-mail. Depois, as tarefas poderão ser distribuídas individualmente.</p>
                <Button className="mt-5" onClick={() => setTeamDialogOpen(true)}><UserPlus /> Adicionar funcionário</Button>
              </div>
            </div>
          ) : (
            <div className={`grid gap-4 ${isOwner ? 'lg:grid-cols-2 xl:grid-cols-3' : 'mx-auto max-w-2xl'}`}>
              {cards.map((member) => (
                <MemberCard key={member.id} member={member} date={date} isOwner={isOwner} onAddTask={() => openTaskDialog(member.id)} />
              ))}
            </div>
          )}
        </section>
      </div>

      {isOwner ? (
        <>
          <TaskDialog
            open={taskDialogOpen}
            onOpenChange={setTaskDialogOpen}
            employees={employees}
            selectedEmployee={selectedEmployee}
            setSelectedEmployee={setSelectedEmployee}
            date={date}
          />
          <TeamDialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen} employees={employees} date={date} />
        </>
      ) : null}
    </main>
  );
}

function MemberCard({ member, date, isOwner, onAddTask }: { member: MemberTasks; date: string; isOwner: boolean; onAddTask: () => void }) {
  const completed = member.tasks.filter((task) => task.status === 'done').length;
  return (
    <article className="overflow-hidden rounded-2xl border border-brand/10 bg-white shadow-[0_12px_32px_rgb(90_45_45/5%)]">
      <div className="flex items-center justify-between border-b border-brand/8 px-4 py-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand text-xs font-semibold text-white">{initials(member.name)}</span>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold">{member.name}</h3>
            <p className="truncate text-xs text-muted-foreground">{member.jobTitle}</p>
          </div>
        </div>
        <Badge variant="outline" className="border-brand/10 text-brand">{completed}/{member.tasks.length}</Badge>
      </div>
      {member.tasks.length ? (
        <ul className="divide-y divide-brand/7 px-4 sm:px-5">
          {member.tasks.map((task) => (
            <li key={task.id} className="flex items-start gap-3 py-4">
              <form action={toggleTaskAction}>
                <input type="hidden" name="taskId" value={task.id} />
                <input type="hidden" name="taskDate" value={date} />
                <button
                  type="submit"
                  aria-label={task.status === 'done' ? `Reabrir ${task.title}` : `Concluir ${task.title}`}
                  className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-md border transition ${task.status === 'done' ? 'border-brand bg-brand text-white' : 'border-input bg-white text-transparent hover:border-brand'}`}
                >
                  <Check className="size-4" />
                </button>
              </form>
              <div className="min-w-0 flex-1">
                <p className={`text-sm leading-5 ${task.status === 'done' ? 'text-muted-foreground line-through decoration-blush' : ''}`}>{task.title}</p>
                {task.details ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{task.details}</p> : null}
              </div>
              {isOwner ? (
                <form action={deleteTaskAction} onSubmit={(event) => { if (!window.confirm('Excluir esta tarefa?')) event.preventDefault(); }}>
                  <input type="hidden" name="taskId" value={task.id} />
                  <input type="hidden" name="taskDate" value={date} />
                  <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Excluir ${task.title}`} className="text-muted-foreground hover:text-destructive"><Trash2 /></Button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-5 py-8 text-center">
          <p className="text-sm font-medium">Nenhuma tarefa neste dia</p>
          <p className="mt-1 text-xs text-muted-foreground">A lista está livre por enquanto.</p>
        </div>
      )}
      {isOwner ? (
        <div className="px-4 pb-4 pt-1 sm:px-5">
          <Button variant="ghost" size="sm" className="w-full justify-start text-brand hover:bg-blush/15" onClick={onAddTask}><Plus /> Adicionar tarefa</Button>
        </div>
      ) : null}
    </article>
  );
}

function TaskDialog({ open, onOpenChange, employees, selectedEmployee, setSelectedEmployee, date }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Member[];
  selectedEmployee: string;
  setSelectedEmployee: (id: string) => void;
  date: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nova tarefa</DialogTitle>
          <DialogDescription>Defina o que precisa ser feito e para quem a tarefa será atribuída.</DialogDescription>
        </DialogHeader>
        <form action={createTaskAction} className="space-y-4">
          <label className="grid gap-1.5 text-sm font-medium">Tarefa<Input name="title" required maxLength={160} placeholder="Ex.: Finalizar bolo da encomenda 118" className="h-10" /></label>
          <label className="grid gap-1.5 text-sm font-medium">Funcionário
            <select name="assignedUserId" value={selectedEmployee} onChange={(event) => setSelectedEmployee(event.target.value)} required className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20">
              {employees.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} — {employee.jobTitle}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-medium">Data<Input name="taskDate" type="date" required defaultValue={date} className="h-10" /></label>
          <label className="grid gap-1.5 text-sm font-medium">Observação <span className="font-normal text-muted-foreground">(opcional)</span><Textarea name="details" maxLength={600} placeholder="Quantidade, encomenda, cuidados ou prioridade..." /></label>
          <DialogFooter className="mt-5">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit"><Plus /> Adicionar tarefa</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TeamDialog({ open, onOpenChange, employees, date }: { open: boolean; onOpenChange: (open: boolean) => void; employees: Member[]; date: string }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Equipe</DialogTitle>
          <DialogDescription>Cadastre até cinco funcionários. O acesso será vinculado ao e-mail informado.</DialogDescription>
        </DialogHeader>
        {employees.length ? (
          <div className="space-y-2">
            {employees.map((employee) => (
              <div key={employee.id} className="flex items-center gap-3 rounded-xl border border-brand/10 p-3">
                <span className="grid size-9 place-items-center rounded-full bg-blush/25 text-xs font-semibold text-brand">{initials(employee.name)}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{employee.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{employee.email} · {employee.jobTitle}</p>
                </div>
                <form action={deactivateEmployeeAction} onSubmit={(event) => { if (!window.confirm(`Remover ${employee.name} da equipe ativa?`)) event.preventDefault(); }}>
                  <input type="hidden" name="memberId" value={employee.id} />
                  <input type="hidden" name="taskDate" value={date} />
                  <Button type="submit" variant="ghost" size="icon-sm" aria-label={`Remover ${employee.name}`} className="text-muted-foreground hover:text-destructive"><Trash2 /></Button>
                </form>
              </div>
            ))}
          </div>
        ) : null}
        <div className="border-t border-brand/10 pt-4">
          <h3 className="mb-3 text-sm font-semibold">Adicionar funcionário <span className="font-normal text-muted-foreground">({employees.length}/5)</span></h3>
          <form action={addEmployeeAction} className="space-y-3">
            <input type="hidden" name="taskDate" value={date} />
            <label className="grid gap-1.5 text-sm font-medium">Nome<Input name="name" required maxLength={80} placeholder="Nome completo" className="h-10" disabled={employees.length >= 5} /></label>
            <label className="grid gap-1.5 text-sm font-medium">E-mail de acesso<Input name="email" type="email" required maxLength={160} placeholder="funcionario@exemplo.com" className="h-10" disabled={employees.length >= 5} /></label>
            <label className="grid gap-1.5 text-sm font-medium">Função
              <select name="jobTitle" className="h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/20" disabled={employees.length >= 5}>
                <option value="Produção">Produção</option>
                <option value="Atendimento + produção">Atendimento + produção</option>
              </select>
            </label>
            <Button type="submit" className="w-full" disabled={employees.length >= 5}><UserPlus /> Adicionar à equipe</Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || 'DT';
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}
