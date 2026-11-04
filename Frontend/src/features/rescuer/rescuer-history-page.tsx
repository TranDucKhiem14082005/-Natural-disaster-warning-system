import { Link } from 'react-router-dom';
import { ChevronRight, CircleCheck, History, Timer, Users } from 'lucide-react';
import { Callout, EmptyState, ListSkeleton, PageHeader, StatCard } from '../../components/ui';
import { fmtDateTime } from '../../utils/format';
import { ConditionChips, fmtDuration, useAssignedSos } from './rescuer-shared';

function minutes(from: string | null, to: string | null): number | null {
  if (!from || !to) return null;
  return Math.max(0, (new Date(to).getTime() - new Date(from).getTime()) / 60000);
}

export function RescuerHistoryPage() {
  const { data, error, loading } = useAssignedSos({ status: 'safe' });
  const list = [...(data ?? [])].sort((a, b) => new Date(b.safe_at ?? b.created_at).getTime() - new Date(a.safe_at ?? a.created_at).getTime());

  const rescueTimes = list.map((s) => minutes(s.rescuing_at ?? s.received_at, s.safe_at)).filter((m): m is number => m !== null);
  const avg = rescueTimes.length ? Math.round(rescueTimes.reduce((a, b) => a + b, 0) / rescueTimes.length) : null;
  const people = list.reduce((sum, s) => sum + s.people_count, 0);

  return (
    <>
      <PageHeader title="Nhiệm vụ đã hoàn thành" description="Các yêu cầu đội đã đưa tới nơi an toàn." />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard label="Nhiệm vụ hoàn thành" value={data ? list.length : '-'} icon={CircleCheck} tone="green" />
        <StatCard label="Người được hỗ trợ" value={data ? people : '-'} icon={Users} tone="blue" />
        <StatCard label="Thời gian cứu hộ TB" value={avg !== null ? `${avg} phút` : '-'} icon={Timer} tone="violet" hint="Từ lúc xuất phát tới khi an toàn" />
      </div>

      {error && <Callout tone="danger" className="mb-4">{error}</Callout>}

      {loading && !data ? (
        <ListSkeleton rows={3} />
      ) : !list.length ? (
        <div className="rounded-2xl border border-slate-200/80 bg-white shadow-card">
          <EmptyState icon={History} title="Chưa có nhiệm vụ hoàn thành" description="Nhiệm vụ sẽ xuất hiện ở đây sau khi bạn xác nhận nạn nhân đã an toàn." />
        </div>
      ) : (
        <ul className="space-y-3">
          {list.map((s) => (
            <li key={s.id}>
              <Link to={`/rescuer/sos/${s.id}`} className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition hover:shadow-raised">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                  <CircleCheck className="h-6 w-6" aria-hidden />
                </span>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="font-semibold text-slate-900">
                    #{s.id} · {s.people_count} người · {s.contact_name ?? 'Không rõ tên'}
                  </p>
                  <p className="text-sm text-slate-500">
                    An toàn lúc {fmtDateTime(s.safe_at)} · phản hồi {fmtDuration(s.created_at, s.received_at)} · cứu hộ {fmtDuration(s.rescuing_at ?? s.received_at, s.safe_at)}
                  </p>
                  <ConditionChips conditions={s.conditions} size="sm" />
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
