import Link from 'next/link';

import type { HistoryTaskSummary } from './models';
import { formatHistoryDate } from './view-helpers';

export type TaskContextPickerClassName =
  | 'panel'
  | 'panelHeader'
  | 'panelTitle'
  | 'panelHint'
  | 'emptyState'
  | 'list'
  | 'historyTaskButton'
  | 'historyTaskButtonActive'
  | 'historyTaskHeader'
  | 'historyTaskStatus'
  | 'historyTaskMeta';

export type TaskContextPickerClasses = Record<TaskContextPickerClassName, string>;

interface TaskContextPickerProps {
  classes: TaskContextPickerClasses;
  title: string;
  hint: string;
  emptyMessage: string;
  tasks: HistoryTaskSummary[];
  selectedTaskId: string | null;
  buildHref: (taskId: string) => string;
}

export function TaskContextPicker({
  classes,
  title,
  hint,
  emptyMessage,
  tasks,
  selectedTaskId,
  buildHref,
}: TaskContextPickerProps) {
  return (
    <section className={classes.panel}>
      <div className={classes.panelHeader}>
        <div className={classes.panelTitle}>{title}</div>
        <div className={classes.panelHint}>{hint}</div>
      </div>

      <div className={classes.emptyState}>{emptyMessage}</div>

      {tasks.length > 0 ? (
        <div className={classes.list}>
          {tasks.map((task) => {
            const isActive = task.id === selectedTaskId;
            return (
              <Link
                key={task.id}
                className={`${classes.historyTaskButton} ${isActive ? classes.historyTaskButtonActive : ''}`}
                href={buildHref(task.id)}
                scroll={false}
              >
                <div className={classes.historyTaskHeader}>
                  <strong>{task.topic}</strong>
                  <span className={classes.historyTaskStatus}>{task.status}</span>
                </div>
                <div className={classes.historyTaskMeta}>
                  <span>{task.reference_mode ?? '未记录参考模式'}</span>
                  <span>{formatHistoryDate(task.created_at)}</span>
                </div>
              </Link>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
