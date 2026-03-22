const STATUS_LABELS: Record<string, { label: string; tone: string }> = {
  pending: { label: '待处理', tone: 'warning' },
  analyzing: { label: '分析中', tone: 'info' },
  embedding: { label: '向量化', tone: 'info' },
  completed: { label: '已完成', tone: 'success' },
  failed: { label: '失败', tone: 'error' },
  understanding: { label: '任务理解', tone: 'info' },
  searching: { label: '检索中', tone: 'info' },
  strategizing: { label: '策略中', tone: 'info' },
  generating: { label: '生成中', tone: 'info' },
};

export function StatusBadge({
  status,
  className = '',
}: {
  status: string | null | undefined;
  className?: string;
}) {
  const statusMeta = status ? STATUS_LABELS[status] : null;

  if (!statusMeta) {
    return <span className={`badge badgeNeutral ${className}`}>未知</span>;
  }

  return (
    <span className={`badge badge${statusMeta.tone[0].toUpperCase()}${statusMeta.tone.slice(1)} ${className}`}>
      {statusMeta.label}
    </span>
  );
}
