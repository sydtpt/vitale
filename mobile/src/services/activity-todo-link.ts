/**
 * Liga os treinos sincronizados às tarefas: para cada treino novo, se houver uma
 * série vinculada (`linked_activity_id`) conclui/gera a ocorrência do dia; se não
 * houver, auto-cria uma série 'event' do tipo e já conclui ("gerar e finalizar").
 *
 * Roda no background (a partir do syncDelta), então escreve direto no Supabase —
 * a store Zustand está fria. A conclusão passa pelo seam único `resolveAndAdvance`,
 * para encadeamento/challenge futuros encaixarem sem divergir.
 *
 * Ver docs/specs/tarefas/ e docs/specs/sync-atividades/.
 */
import type { TodoRecurrence } from '@vitale/shared';
import { supabase } from '../lib/supabase';
import { getActivityMeta, type WorkoutItem } from '../lib/healthkit-workouts';
import { toTemplate, type TemplateRow } from '../lib/todo-map';
import { planLink, activityTodoIcon, type LinkOcc } from '../lib/activity-todo-link';
import { resolveAndAdvance, insertOccurrence, hasPendingOccurrence } from './todo-resolve';
import { localDateStr, triggeredDueDate } from '@vitale/shared';

type OnWorkoutRec = Extract<TodoRecurrence, { kind: 'on_workout' }>;

/**
 * Criação por on_workout: séries cuja ocorrência NASCE ao registrar um treino
 * (de um tipo específico ou de qualquer). 1 por vez — pula se já há pendente.
 */
async function createOnWorkoutTodos(workouts: WorkoutItem[], userId: string): Promise<number> {
  const { data } = await supabase
    .from('todo_templates')
    .select('id, recurrence')
    .eq('active', true)
    .eq('recurrence->>kind', 'on_workout');
  const templates = (data ?? []) as { id: string; recurrence: OnWorkoutRec }[];
  if (templates.length === 0) return 0;

  const hasPending = new Set<string>();
  for (const t of templates) {
    if (await hasPendingOccurrence(t.id)) hasPending.add(t.id);
  }

  let created = 0;
  const ordered = [...workouts].sort((a, b) => a.start.localeCompare(b.start));
  for (const w of ordered) {
    const day = localDateStr(new Date(w.start));
    for (const t of templates) {
      const wantActivity = t.recurrence.activityId;
      if (wantActivity != null && wantActivity !== w.activityId) continue;
      if (hasPending.has(t.id)) continue;
      if (await insertOccurrence(userId, t.id, triggeredDueDate(t.recurrence, day))) created++;
      hasPending.add(t.id);
    }
  }
  return created;
}

/** Origem gravada em occurrence.meta — distingue conclusão por treino de manual. */
const SOURCE = 'activity-sync';

/**
 * Vincula treinos a tarefas. Retorna quantas ocorrências PENDENTES novas surgiram
 * (fase A on_workout + próximas geradas por recorrência/encadeamento) — usado para
 * notificar "novas tarefas automáticas". Não conta as auto-criadas-e-já-concluídas.
 */
export async function linkWorkoutsToTodos(workouts: WorkoutItem[], userId: string): Promise<number> {
  if (workouts.length === 0) return 0;

  let created = 0;

  // Fase A — criação por on_workout (independente da conclusão por linked_activity_id).
  created += await createOnWorkoutTodos(workouts, userId);

  // Fase B — conclusão/geração das séries vinculadas por linked_activity_id.
  const activityIds = [...new Set(workouts.map((w) => w.activityId))];

  // 1. Séries vinculadas (ativas OU inativas): inativas sinalizam opt-out do
  //    usuário, precisam ser detectadas pra não auto-criar outra. O unique
  //    partial index (user_id, linked_activity_id) garante 1 linha por tipo.
  const { data: rows } = await supabase
    .from('todo_templates')
    .select('*')
    .in('linked_activity_id', activityIds);

  const hasTemplate = new Set<number>();
  const byActivity = new Map<number, TemplateRow>();
  for (const r of (rows ?? []) as TemplateRow[]) {
    if (r.linked_activity_id == null) continue;
    hasTemplate.add(r.linked_activity_id);
    if (r.active && !byActivity.has(r.linked_activity_id)) {
      byActivity.set(r.linked_activity_id, r);
    }
  }

  // 2. Auto-cria série 'event' apenas para tipos SEM nenhum template — respeita
  //    opt-out (template existente, mesmo inativo, nunca é recriado). Em conflito
  //    de unicidade (23505: outro processo criou em paralelo), lê a linha existente.
  for (const activityId of activityIds) {
    if (hasTemplate.has(activityId)) continue;
    const meta = getActivityMeta(activityId);
    const insert = await supabase
      .from('todo_templates')
      .insert({
        user_id: userId,
        name: meta.label,
        icon: activityTodoIcon(activityId),
        color: 'treino',
        module: 'saude',
        recurrence: { kind: 'event', label: meta.label },
        overdue: 'expire',
        cancel_policy: 'manual',
        linked_activity_id: activityId,
      })
      .select('*')
      .single();
    let tRow: TemplateRow | undefined;
    if (insert.data) {
      tRow = insert.data as TemplateRow;
    } else if (insert.error?.code === '23505') {
      const { data: existing } = await supabase
        .from('todo_templates')
        .select('*')
        .eq('user_id', userId)
        .eq('linked_activity_id', activityId)
        .maybeSingle();
      tRow = (existing as TemplateRow | null) ?? undefined;
    }
    if (tRow) {
      hasTemplate.add(activityId);
      if (tRow.active) byActivity.set(activityId, tRow);
    }
  }

  const templateRows = [...byActivity.values()];
  if (templateRows.length === 0) return created;

  // 3. Ocorrências existentes dessas séries (para decidir resolve/criar/skip).
  const templateIds = templateRows.map((t) => t.id);
  const { data: occRows } = await supabase
    .from('todo_occurrences')
    .select('id, template_id, due_date, status')
    .in('template_id', templateIds);

  // Índice mutável por série — atualizado a cada ação, p/ idempotência no mesmo lote
  // (dois treinos do mesmo tipo no mesmo dia: o 2º vê "concluída hoje" e pula).
  const occsByTemplate = new Map<string, LinkOcc[]>();
  for (const id of templateIds) occsByTemplate.set(id, []);
  for (const o of occRows ?? []) {
    occsByTemplate.get(o.template_id)?.push({ id: o.id, dueDate: o.due_date, status: o.status });
  }

  // 4. Aplica por treino, em ordem cronológica (resolve o passado antes do recente).
  const ordered = [...workouts].sort((a, b) => a.start.localeCompare(b.start));
  for (const w of ordered) {
    const tRow = byActivity.get(w.activityId);
    if (!tRow) continue;
    const template = toTemplate(tRow);
    const day = localDateStr(new Date(w.start));
    const occs = occsByTemplate.get(tRow.id) ?? [];
    const action = planLink(occs, day);
    if (action.kind === 'skip') continue;

    const meta = { activityId: w.id, source: SOURCE };

    if (action.kind === 'resolve') {
      const occ = occs.find((o) => o.id === action.occId);
      created += await resolveAndAdvance({
        userId,
        template,
        occId: action.occId,
        occDueDate: occ?.dueDate ?? null,
        status: 'done',
        meta,
        completedAt: day,
      });
      if (occ) occ.status = 'done';
    } else {
      // create-resolve: cria a ocorrência do dia (idempotente) e conclui.
      // A ocorrência aqui já nasce concluída, então não conta como "tarefa nova".
      await insertOccurrence(userId, tRow.id, day);
      const { data: occ } = await supabase
        .from('todo_occurrences')
        .select('id')
        .eq('template_id', tRow.id)
        .eq('due_date', day)
        .single();
      if (!occ) continue;
      created += await resolveAndAdvance({
        userId,
        template,
        occId: occ.id,
        occDueDate: day,
        status: 'done',
        meta,
        completedAt: day,
      });
      occs.push({ id: occ.id, dueDate: day, status: 'done' });
    }
  }

  return created;
}
