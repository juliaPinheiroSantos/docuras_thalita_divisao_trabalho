'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getChatGPTUser } from '@/app/chatgpt-auth';
import {
  createEmployee,
  createTask,
  deactivateEmployee,
  deleteTask,
  getOrCreateMembership,
  requireOwner,
  toggleTask,
} from '@/db/store';

const JOB_TITLES = new Set(['Produção', 'Atendimento + produção']);

export async function createTaskAction(formData: FormData) {
  const user = await getChatGPTUser();
  if (!user) throw new Error('Não autenticado.');
  const owner = await requireOwner(user);
  const title = textValue(formData, 'title').slice(0, 160);
  const details = textValue(formData, 'details').slice(0, 600);
  const assignedUserId = textValue(formData, 'assignedUserId');
  const taskDate = validDate(textValue(formData, 'taskDate'));
  if (!title || !assignedUserId || !taskDate) redirect('/?aviso=dados-invalidos');

  let notice = 'tarefa-adicionada';
  try {
    await createTask({
      title,
      details: details || null,
      assignedUserId,
      taskDate,
      createdBy: owner.id,
    });
  } catch {
    notice = 'erro-tarefa';
  }
  revalidatePath('/');
  redirect(`/?date=${taskDate}&aviso=${notice}`);
}

export async function toggleTaskAction(formData: FormData) {
  const user = await getChatGPTUser();
  if (!user) throw new Error('Não autenticado.');
  const actor = await getOrCreateMembership(user);
  if (!actor) throw new Error('Acesso não autorizado.');
  const taskId = textValue(formData, 'taskId');
  const taskDate = validDate(textValue(formData, 'taskDate'));
  if (!taskId || !taskDate) redirect('/');

  await toggleTask(taskId, actor);
  revalidatePath('/');
  redirect(`/?date=${taskDate}`);
}

export async function deleteTaskAction(formData: FormData) {
  const user = await getChatGPTUser();
  if (!user) throw new Error('Não autenticado.');
  await requireOwner(user);
  const taskId = textValue(formData, 'taskId');
  const taskDate = validDate(textValue(formData, 'taskDate'));
  if (!taskId || !taskDate) redirect('/');

  await deleteTask(taskId);
  revalidatePath('/');
  redirect(`/?date=${taskDate}&aviso=tarefa-excluida`);
}

export async function addEmployeeAction(formData: FormData) {
  const user = await getChatGPTUser();
  if (!user) throw new Error('Não autenticado.');
  await requireOwner(user);
  const name = textValue(formData, 'name').slice(0, 80);
  const email = textValue(formData, 'email').toLowerCase().slice(0, 160);
  const jobTitle = textValue(formData, 'jobTitle');
  const taskDate = validDate(textValue(formData, 'taskDate'));
  if (!name || !email.includes('@') || !JOB_TITLES.has(jobTitle)) {
    redirect(`/?date=${taskDate || ''}&aviso=dados-invalidos`);
  }

  let notice = 'funcionario-adicionado';
  try {
    await createEmployee({ name, email, jobTitle });
  } catch {
    notice = 'erro-funcionario';
  }
  revalidatePath('/');
  redirect(`/?date=${taskDate || ''}&aviso=${notice}`);
}

export async function deactivateEmployeeAction(formData: FormData) {
  const user = await getChatGPTUser();
  if (!user) throw new Error('Não autenticado.');
  await requireOwner(user);
  const memberId = textValue(formData, 'memberId');
  const taskDate = validDate(textValue(formData, 'taskDate'));
  if (!memberId) redirect('/');

  await deactivateEmployee(memberId);
  revalidatePath('/');
  redirect(`/?date=${taskDate || ''}&aviso=funcionario-removido`);
}

function textValue(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function validDate(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : value;
}
