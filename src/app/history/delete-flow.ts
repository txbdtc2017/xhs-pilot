import type { HistoryTaskSummary } from '@/app/create/state';

export interface HistoryDeleteState {
  armedTaskId: string | null;
  modalTaskId: string | null;
  pendingTaskId: string | null;
  errorMessage: string | null;
}

export type HistoryDeleteAction =
  | { type: 'delete_armed'; taskId: string }
  | { type: 'delete_cancelled' }
  | { type: 'delete_modal_opened'; taskId: string }
  | { type: 'delete_requested'; taskId: string }
  | { type: 'delete_succeeded' }
  | { type: 'delete_failed'; taskId: string; message: string };

export function createInitialHistoryDeleteState(): HistoryDeleteState {
  return {
    armedTaskId: null,
    modalTaskId: null,
    pendingTaskId: null,
    errorMessage: null,
  };
}

export function reduceHistoryDeleteState(
  state: HistoryDeleteState,
  action: HistoryDeleteAction,
): HistoryDeleteState {
  switch (action.type) {
    case 'delete_armed':
      return {
        armedTaskId: action.taskId,
        modalTaskId: null,
        pendingTaskId: null,
        errorMessage: null,
      };
    case 'delete_cancelled':
      return {
        armedTaskId: null,
        modalTaskId: null,
        pendingTaskId: null,
        errorMessage: null,
      };
    case 'delete_modal_opened':
      return {
        ...state,
        armedTaskId: action.taskId,
        modalTaskId: action.taskId,
        errorMessage: null,
      };
    case 'delete_requested':
      return {
        ...state,
        modalTaskId: action.taskId,
        pendingTaskId: action.taskId,
        errorMessage: null,
      };
    case 'delete_succeeded':
      return createInitialHistoryDeleteState();
    case 'delete_failed':
      return {
        ...state,
        modalTaskId: action.taskId,
        pendingTaskId: null,
        errorMessage: action.message,
      };
  }
}

export function applyHistoryTaskDeletion(params: {
  tasks: HistoryTaskSummary[];
  selectedTaskId: string | null;
  deletedTaskId: string;
}): {
  tasks: HistoryTaskSummary[];
  nextSelectedTaskId: string | null;
} {
  const deletedIndex = params.tasks.findIndex((task) => task.id === params.deletedTaskId);
  const nextTasks = params.tasks.filter((task) => task.id !== params.deletedTaskId);

  if (params.selectedTaskId !== params.deletedTaskId) {
    return {
      tasks: nextTasks,
      nextSelectedTaskId: params.selectedTaskId,
    };
  }

  const nextSelectedTaskId = nextTasks[deletedIndex]?.id
    ?? nextTasks[deletedIndex - 1]?.id
    ?? null;

  return {
    tasks: nextTasks,
    nextSelectedTaskId,
  };
}
