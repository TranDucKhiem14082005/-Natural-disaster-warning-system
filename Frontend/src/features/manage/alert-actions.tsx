import { useState } from 'react';
import { Ban, CircleStop, Send, Trash2, Megaphone } from 'lucide-react';
import { api, errorText } from '../../services/api';
import type { Alert } from '../../types/api';
import { Button, Callout, useToast, type ButtonSize } from '../../components/ui';
import { ActionDialog } from './manage-ui';

export type AlertAction = 'submit' | 'publish' | 'reject' | 'end' | 'delete';

const SPEC: Record<AlertAction, { label: string; title: string; confirm: string; variant: 'primary' | 'danger' | 'secondary' | 'success'; note: boolean; done: string; describe: (a: Alert) => string }> = {
  submit: {
    label: 'Gửi duyệt',
    title: 'Gửi cảnh báo để duyệt?',
    confirm: 'Gửi duyệt',
    variant: 'secondary',
    note: true,
    done: 'Đã gửi cảnh báo chờ duyệt.',
    describe: (a) => `"${a.title}" sẽ chuyển sang trạng thái Chờ duyệt.`,
  },
  publish: {
    label: 'Phát hành',
    title: 'Phát hành cảnh báo ngay?',
    confirm: 'Phát hành ngay',
    variant: 'danger',
    note: true,
    done: 'Đã phát hành. Người dân trong vùng đang nhận thông báo.',
    describe: (a) => `Mọi người có vị trí quan tâm trong vùng "${a.title}" sẽ nhận thông báo ngay lập tức.`,
  },
  reject: {
    label: 'Từ chối',
    title: 'Từ chối cảnh báo?',
    confirm: 'Trả về nháp',
    variant: 'secondary',
    note: true,
    done: 'Đã trả cảnh báo về bản nháp.',
    describe: () => 'Cảnh báo quay về trạng thái Nháp. Hãy ghi lý do để người tạo chỉnh sửa.',
  },
  end: {
    label: 'Kết thúc',
    title: 'Kết thúc cảnh báo?',
    confirm: 'Kết thúc cảnh báo',
    variant: 'danger',
    note: true,
    done: 'Đã kết thúc cảnh báo.',
    describe: (a) => `"${a.title}" sẽ không còn hiệu lực và biến khỏi bản đồ công khai.`,
  },
  delete: {
    label: 'Xoá',
    title: 'Xoá bản nháp?',
    confirm: 'Xoá vĩnh viễn',
    variant: 'danger',
    note: false,
    done: 'Đã xoá bản nháp.',
    describe: (a) => `Bản nháp "${a.title}" sẽ bị xoá và không khôi phục được.`,
  },
};

const ICONS = { submit: Send, publish: Megaphone, reject: Ban, end: CircleStop, delete: Trash2 };

/** Which lifecycle moves the API accepts from a given status. */
export function actionsFor(a: Alert): AlertAction[] {
  switch (a.status) {
    case 'draft':
      return ['publish', 'submit', 'delete'];
    case 'pending':
      return ['publish', 'reject'];
    case 'published':
    case 'updated':
      return ['end'];
    default:
      return [];
  }
}

export async function runAlertAction(a: Alert, action: AlertAction, note: string | null): Promise<void> {
  if (action === 'delete') await api.delete(`/manage/alerts/${a.id}`);
  else await api.post(`/manage/alerts/${a.id}/${action}`, note ? { note } : undefined);
}

/** Row/toolbar buttons for an alert's next lifecycle steps, each behind a confirm dialog. */
export function AlertActionButtons({ alert, onDone, size = 'sm', only }: { alert: Alert; onDone: (action: AlertAction) => void; size?: ButtonSize; only?: AlertAction[] }) {
  const toast = useToast();
  const [pending, setPending] = useState<AlertAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const actions = actionsFor(alert).filter((a) => !only || only.includes(a));
  if (!actions.length) return null;
  const spec = pending ? SPEC[pending] : null;

  return (
    <>
      <div className="flex flex-wrap justify-end gap-1.5">
        {actions.map((act) => {
          const s = SPEC[act];
          const variant = act === 'publish' ? 'primary' : act === 'end' ? 'danger' : act === 'delete' ? 'ghost' : 'secondary';
          return (
            <Button key={act} size={size} variant={variant} icon={ICONS[act]} onClick={() => { setError(null); setPending(act); }}>
              {s.label}
            </Button>
          );
        })}
      </div>
      {spec && pending && (
        <ActionDialog
          open
          title={spec.title}
          description={spec.describe(alert)}
          confirmLabel={spec.confirm}
          variant={spec.variant}
          withNote={spec.note}
          notePlaceholder={pending === 'reject' ? 'Lý do từ chối' : 'Ví dụ: nước đã rút'}
          onClose={() => setPending(null)}
          onConfirm={async (note) => {
            try {
              await runAlertAction(alert, pending, note);
              toast.success(spec.done);
              setPending(null);
              onDone(pending);
            } catch (err) {
              setError(errorText(err));
            }
          }}
        >
          {error && <Callout tone="danger">{error}</Callout>}
        </ActionDialog>
      )}
    </>
  );
}
