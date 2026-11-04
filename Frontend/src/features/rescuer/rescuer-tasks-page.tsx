import { useEffect, useMemo, useState } from 'react';
import { CircleCheck, ClipboardList, Flame, Play, RefreshCw, ShieldCheck } from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../store/auth-context';
import type { RescuerDashboard } from '../../types/api';
import { Callout, EmptyState, IconButton, ListSkeleton, PageHeader, SegmentedControl, StatCard } from '../../components/ui';
import { TaskCard, sortTasks, useAssignedSos, useMyPosition } from './rescuer-shared';

type Filter = 'all' | 'received' | 'rescuing';

export function RescuerTasksPage() {
  const { user } = useAuth();
  const me = useMyPosition();
  const [filter, setFilter] = useState<Filter>('all');
  const [completed, setCompleted] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const { data, error, loading, reload } = useAssignedSos({ open: 1 });

  useEffect(() => {
    api
      .get<RescuerDashboard>('/dashboard')
      .then((d) => setCompleted(d.completed_count))
      .catch(() => {});
  }, [data]);

  // Keep "x phút trước" fresh without refetching.
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(t);
  }, []);

  const tasks = useMemo(() => sortTasks(data ?? []), [data]);
  const waiting = tasks.filter((s) => s.status === 'new' || s.status === 'received');
  const rescuing = tasks.filter((s) => s.status === 'rescuing');
  const urgent = tasks.filter((s) => s.priority >= 4).length;
  const shown = filter === 'all' ? tasks : filter === 'rescuing' ? rescuing : waiting;

  return (
    <>
      <PageHeader title="Nhiệm vụ của đội" description={`Xin chào ${user?.name ?? ''}. Nhiệm vụ khẩn cấp nhất ở trên cùng.`} />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Chờ xuất phát" value={data ? waiting.length : '-'} icon={ClipboardList} tone="amber" />
        <StatCard label="Đang cứu hộ" value={data ? rescuing.length : '-'} icon={Play} tone="blue" />
        <StatCard label="Ưu tiên cao" value={data ? urgent : '-'} icon={Flame} tone="red" hint="Mức 4-5" />
        <StatCard label="Đã hoàn thành" value={completed ?? '-'} icon={CircleCheck} tone="green" to="/rescuer/history" />
      </div>

      {error && <Callout tone="danger" title="Không tải được nhiệm vụ" className="mb-4">{error}</Callout>}

      <div className="mb-4 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {tasks.length > 0 && (
            <SegmentedControl
              label="Lọc nhiệm vụ"
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Tất cả', count: tasks.length },
                { value: 'received', label: 'Chờ xuất phát', count: waiting.length },
                { value: 'rescuing', label: 'Đang cứu hộ', count: rescuing.length },
              ]}
            />
          )}
        </div>
        <IconButton icon={RefreshCw} label="Làm mới danh sách" variant="secondary" size="lg" onClick={reload} />
      </div>

      {loading && !data ? (
        <ListSkeleton rows={3} />
      ) : !tasks.length && !error ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-card">
          <EmptyState
            icon={ShieldCheck}
            title="Chưa có nhiệm vụ nào được giao"
            description="Khi cán bộ điều phối giao yêu cầu SOS cho đội, nhiệm vụ sẽ hiện ở đây ngay lập tức. Giữ ứng dụng mở để không bỏ lỡ."
          />
        </div>
      ) : !shown.length ? (
        <p className="py-8 text-center text-sm text-slate-500">Không có nhiệm vụ ở trạng thái này.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {shown.map((s) => (
            <TaskCard key={s.id} sos={s} me={me} onChanged={reload} now={now} />
          ))}
        </div>
      )}
    </>
  );
}
