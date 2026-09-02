'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { getChatGPTUser } from '@/app/chatgpt-auth';
import { clearPhoneSession, createPhoneSession, getPhoneSessionMember } from '@/app/phone-auth';
import {
  createEmployee,
  createTask,
  deactivateEmployee,
  deleteTask,
  findCredentialLoginByPhone,
  getOrCreateBootstrapOwner,
  getOrCreateMembership,
  listAccessCredentials,
  setMemberCredential,
  toggleTask,
  type Member,
} from '@/db/store';
import { isOwnerPhone, normalizePhone, validPhone } from '@/lib/access';
import { assertValidPassword, createPasswordRecord, verifyPassword } from '@/lib/password';

const JOB_TITLES = new Set(['Produção', 'Atendimento + produção']);

export async function phoneLoginAction(formData: FormData) {
  const phone = normalizePhone(textValue(formData, 'phone'));
  const password = textValue(formData, 'password');
  if (!validPhone(phone) || !validPassword(password)) redirect('/?aviso=login-invalido');

  const login = await findCredentialLoginByPhone(phone);
  const passwordMatches = await verifyPassword(password, login?.passwordHash, login?.passwordSalt);
  if (!login || !passwordMatches) redirect('/?aviso=login-invalido');

  await createPhoneSession(login.member.id, login.credentialId);
  redirect('/');
}

export async function logoutAction() {
  await clearPhoneSession();
  redirect('/?aviso=sessao-encerrada');
}

export async function setupOwnerPasswordAction(formData: FormData) {
  const phone = normalizePhone(textValue(formData, 'phone'));
  const password = textValue(formData, 'password');
  if (!isOwnerPhone(phone) || !validPassword(password)) {
    redirect('/configurar-acesso?aviso=dados-invalidos');
  }

  const sessionMember = await getPhoneSessionMember();
  let owner = sessionMember?.role === 'owner' ? sessionMember : null;
  let authenticatedOwner = Boolean(owner);
  if (!owner) {
    const chatGPTUser = await getChatGPTUser();
    const chatGPTMember = chatGPTUser ? await getOrCreateMembership(chatGPTUser) : null;
    if (chatGPTMember?.role === 'owner') {
      owner = chatGPTMember;
      authenticatedOwner = true;
    }
  }
  owner ??= await getOrCreateBootstrapOwner();
  if (!owner) throw new Error('Acesso exclusivo do proprietário.');

  const credentials = await listAccessCredentials([owner.id]);
  const credential = credentials.find((item) => item.phone === phone);
  if (!authenticatedOwner && credential?.passwordConfigured) {
    redirect('/?aviso=login-necessario');
  }

  try {
    const record = await createPasswordRecord(password);
    await setMemberCredential({ memberId: owner.id, phone, passwordHash: record.hash, passwordSalt: record.salt });
  } catch {
    redirect('/configurar-acesso?aviso=erro-senha');
  }
  revalidatePath('/configurar-acesso');
  redirect('/configurar-acesso?aviso=senha-atualizada');
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
  const previewEmployeeId = textValue(formData, 'previewEmployeeId');
  if (!taskId || !taskDate) throw new Error('Tarefa inválida.');
  const status = await toggleTask(taskId, actor);
  revalidatePath('/');
  if (actor.role === 'owner' && validMemberId(previewEmployeeId)) {
    revalidatePath(`/funcionario/${previewEmployeeId}`);
  }
  return { status };
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
  const password = textValue(formData, 'password');
  const jobTitle = textValue(formData, 'jobTitle');
  const taskDate = validDate(textValue(formData, 'taskDate'));
  if (!name || !validPhone(phone) || isOwnerPhone(phone) || !validPassword(password) || !JOB_TITLES.has(jobTitle)) {
    redirect(`/?date=${taskDate || ''}&aviso=dados-invalidos`);
  }

  let notice = 'funcionario-adicionado';
  try {
    const record = await createPasswordRecord(password);
    await createEmployee({ name, phone, jobTitle, passwordHash: record.hash, passwordSalt: record.salt });
  } catch {
    notice = 'erro-funcionario';
  }
  revalidatePath('/');
  redirect(`/?date=${taskDate || ''}&aviso=${notice}`);
}

export async function updateMemberAccessAction(formData: FormData) {
  const owner = await requireOwnerActor();
  const memberId = textValue(formData, 'memberId');
  const phone = normalizePhone(textValue(formData, 'phone'));
  const password = textValue(formData, 'password');
  const taskDate = validDate(textValue(formData, 'taskDate'));
  const ownerCredential = memberId === owner.id;
  if (!memberId || !validPhone(phone) || !validPassword(password) || (ownerCredential && !isOwnerPhone(phone))) {
    redirect(`/?date=${taskDate || ''}&aviso=dados-invalidos`);
  }

  let notice = 'acesso-atualizado';
  try {
    const record = await createPasswordRecord(password);
    await setMemberCredential({ memberId, phone, passwordHash: record.hash, passwordSalt: record.salt });
  } catch {
    notice = 'erro-acesso';
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
  if (!sessionMember) throw new Error('Acesso não autorizado.');
  return sessionMember;
}

async function requireOwnerActor() {
  const actor = await requireActor();
  if (actor.role !== 'owner') throw new Error('Acesso exclusivo do proprietário.');
  return actor;
}

function validPassword(value: string) {
  try {
    assertValidPassword(value);
    return true;
  } catch {
    return false;
  }
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

function validMemberId(value: string) {
  return /^[a-zA-Z0-9-]{1,80}$/.test(value);
}
