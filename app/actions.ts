'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { chatGPTSignOutPath, getChatGPTUser } from '@/app/chatgpt-auth';
import { clearPhoneSession, createPhoneSession, getPhoneSessionMember } from '@/app/phone-auth';
import {
  createEmployee,
  createTask,
  deactivateEmployee,
  deleteTask,
  findActiveMemberByPhone,
  getOrCreateMembership,
  toggleTask,
  updateMemberPhone,
  type Member,
} from '@/db/store';

const JOB_TITLES = new Set(['Produção', 'Atendimento + produção']);

export async function phoneLoginAction(formData: FormData) {
  const phone = normalizePhone(textValue(formData, 'phone'));
  if (!validPhone(phone)) redirect('/?aviso=telefone-nao-encontrado');

  const member = await findActiveMemberByPhone(phone);
  if (!member) redirect('/?aviso=telefone-nao-encontrado');

  await createPhoneSession(member.id);
  redirect('/');
}

export async function logoutAction() {
  await clearPhoneSession();
  const chatGPTUser = await getChatGPTUser();
  if (chatGPTUser) redirect(chatGPTSignOutPath('/?aviso=sessao-encerrada'));
  redirect('/?aviso=sessao-encerrada');
}

export async function createTaskAction(formData: FormData) {
  const owner = await requireOwnerActor();
  const title = textValue(formData, 'title').slice(0, 160);
  const details = textValue(formData, 'details').slice(0, 600);
  const assignedUserId = textValue(formData, 'assignedUserId');
  const taskDate = validDate(textValue(formData, 'taskDate'));
  if (!title || !assignedUserId || !taskDate) redirect('/?aviso=dados-invalidos');

  let notice = 'tarefa-adicionada';
  try {
    await createTask({ title, details: details || null, assignedUserId, taskDate, createdBy: owner.id });
  } catch {
    notice = 'erro-tarefa';
  }
  revalidatePath('/');
  redirect(`/?date=${taskDate}&aviso=${notice}`);
}

export async function toggleTaskAction(formData: FormData) {
  const actor = await requireActor();
  const taskId = textValue(formData, 'taskId');
  const taskDate = validDate(textValue(formData, 'taskDate'));
  if (!taskId || !taskDate) redirect('/');

  await toggleTask(taskId, actor);
  revalidatePath('/');
  redirect(`/?date=${taskDate}`);
}

export async function deleteTaskAction(formData: FormData) {
  await requireOwnerActor();
  const taskId = textValue(formData, 'taskId');
  const taskDate = validDate(textValue(formData, 'taskDate'));
  if (!taskId || !taskDate) redirect('/');

  await deleteTask(taskId);
  revalidatePath('/');
  redirect(`/?date=${taskDate}&aviso=tarefa-excluida`);
}

export async function addEmployeeAction(formData: FormData) {
  await requireOwnerActor();
  const name = textValue(formData, 'name').slice(0, 80);
  const phone = normalizePhone(textValue(formData, 'phone'));
  const jobTitle = textValue(formData, 'jobTitle');
  const taskDate = validDate(textValue(formData, 'taskDate'));
  if (!name || !validPhone(phone) || !JOB_TITLES.has(jobTitle)) {
    redirect(`/?date=${taskDate || ''}&aviso=dados-invalidos`);
  }

  let notice = 'funcionario-adicionado';
  try {
    await createEmployee({ name, phone, jobTitle });
  } catch {
    notice = 'erro-funcionario';
  }
  revalidatePath('/');
  redirect(`/?date=${taskDate || ''}&aviso=${notice}`);
}

export async function updateMemberPhoneAction(formData: FormData) {
  await requireOwnerActor();
  const memberId = textValue(formData, 'memberId');
  const phone = normalizePhone(textValue(formData, 'phone'));
  const taskDate = validDate(textValue(formData, 'taskDate'));
  if (!memberId || !validPhone(phone)) {
    redirect(`/?date=${taskDate || ''}&aviso=dados-invalidos`);
  }

  let notice = 'telefone-atualizado';
  try {
    await updateMemberPhone(memberId, phone);
  } catch {
    notice = 'erro-telefone';
  }
  revalidatePath('/');
  redirect(`/?date=${taskDate || ''}&aviso=${notice}`);
}

export async function deactivateEmployeeAction(formData: FormData) {
  await requireOwnerActor();
  const memberId = textValue(formData, 'memberId');
  const taskDate = validDate(textValue(formData, 'taskDate'));
  if (!memberId) redirect('/');

  await deactivateEmployee(memberId);
  revalidatePath('/');
  redirect(`/?date=${taskDate || ''}&aviso=funcionario-removido`);
}

async function requireActor(): Promise<Member> {
  const sessionMember = await getPhoneSessionMember();
  if (sessionMember) return sessionMember;

  const chatGPTUser = await getChatGPTUser();
  if (chatGPTUser) {
    const member = await getOrCreateMembership(chatGPTUser);
    if (member?.role === 'owner') return member;
  }
  throw new Error('Acesso não autorizado.');
}

async function requireOwnerActor() {
  const actor = await requireActor();
  if (actor.role !== 'owner') throw new Error('Acesso exclusivo do proprietário.');
  return actor;
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, '');
}

function validPhone(value: string) {
  return /^\d{10,13}$/.test(value);
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
