import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { CircleStop, ExternalLink, Pencil, Plus, Radio, Waves } from 'lucide-react';
import { api, errorText } from '../../services/api';
import { useCatalog } from '../../hooks/use-catalog';
import { useFetch } from '../../hooks/use-fetch';
import type { LatLng } from '../../hooks/use-geolocation';
import type { DisasterEvent, Paginated } from '../../types/api';
import {
  Badge,
  Button,
  Callout,
  Card,
  Drawer,
  EmptyState,
  Field,
  Input,
  ListSkeleton,
  PageHeader,
  Pagination,
  SegmentedControl,
  Select,
  SeverityBadge,
  Table,
  Td,
  Textarea,
  Th,
  useToast,
} from '../../components/ui';
import { fmtDateTime, toLocalInput } from '../../utils/format';
import { ActionDialog, FieldGroup, MapPointPicker, SeverityPicker, fromLocalInput } from './manage-ui';

type Tab = 'ongoing' | 'ended' | '';

export function EventsManagePage() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('ongoing');
  const [page, setPage] = useState(1);
  const list = useFetch(() => api.get<Paginated<DisasterEvent>>('/events', { status: tab, page }), [tab, page]);
  const [editing, setEditing] = useState<DisasterEvent | 'new' | null>(null);
  const [ending, setEnding] = useState<DisasterEvent | null>(null);
  const rows = list.data?.data ?? [];

  return (
    <>
      <PageHeader
        title="Sự kiện thiên tai"
        description="Gom các cảnh báo cùng một trận bão, lũ... để theo dõi và phát lại diễn biến. Động đất từ USGS được nhập tự động."
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Thêm sự kiện
          </Button>
        }
      />
      <div className="mb-4">
        <SegmentedControl<Tab>
          label="Trạng thái sự kiện"
          value={tab}
          onChange={(v) => {
            setTab(v);
            setPage(1);
          }}
          options={[
            { value: 'ongoing', label: 'Đang diễn ra' },
            { value: 'ended', label: 'Đã kết thúc' },
            { value: '', label: 'Tất cả' },
          ]}
        />
      </div>
      {list.error && <Callout tone="danger" className="mb-4">{list.error}</Callout>}

      <Card flush>
        {list.loading && !list.data ? (
          <div className="p-4">
            <ListSkeleton rows={4} />
          </div>
        ) : !rows.length ? (
          <EmptyState icon={Waves} title="Chưa có sự kiện" description="Tạo sự kiện khi một trận thiên tai bắt đầu để gắn các cảnh báo liên quan." action={<Button variant="soft" icon={Plus} onClick={() => setEditing('new')}>Thêm sự kiện</Button>} />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Sự kiện</Th>
                <Th>Mức độ</Th>
                <Th>Bắt đầu</Th>
                <Th>Cảnh báo</Th>
                <Th>Trạng thái</Th>
                <Th className="text-right">Thao tác</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((ev) => (
                <tr key={ev.id} className="hover:bg-slate-50/60">
                  <Td className="max-w-sm">
                    <Link to={`/events/${ev.id}`} className="inline-flex items-center gap-1 font-semibold text-slate-900 hover:text-brand-700 hover:underline">
                      {ev.name}
                      <ExternalLink className="h-3 w-3 text-slate-400" aria-hidden />
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                      {ev.type?.name} · {ev.region?.name ?? 'Toàn quốc'}
                      {ev.source === 'usgs' && (
                        <Badge tone="violet" icon={Radio}>
                          USGS
                        </Badge>
                      )}
                    </p>
                  </Td>
                  <Td>
                    <SeverityBadge level={ev.severity} />
                  </Td>
                  <Td className="whitespace-nowrap text-xs text-slate-600">{fmtDateTime(ev.started_at)}</Td>
                  <Td className="tabular-nums">{ev.alerts_count ?? 0}</Td>
                  <Td>{ev.status === 'ongoing' ? <Badge tone="red" dot>Đang diễn ra</Badge> : <Badge tone="slate" dot>Đã kết thúc</Badge>}</Td>
                  <Td>
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setEditing(ev)}>
                        Sửa
                      </Button>
                      {ev.status === 'ongoing' && (
                        <Button size="sm" variant="danger" icon={CircleStop} onClick={() => setEnding(ev)}>
                          Kết thúc
                        </Button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
      <Pagination page={list.data} onChange={setPage} />

      <EventDrawer
        event={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          list.reload();
        }}
      />
      <ActionDialog
        open={!!ending}
        title="Kết thúc sự kiện?"
        description={ending ? `"${ending.name}" sẽ chuyển sang lịch sử. Các cảnh báo đang hiệu lực không tự kết thúc.` : ''}
        confirmLabel="Kết thúc sự kiện"
        variant="danger"
        onClose={() => setEnding(null)}
        onConfirm={async () => {
          if (!ending) return;
          try {
            await api.patch(`/manage/events/${ending.id}`, { status: 'ended', ended_at: new Date().toISOString() });
            toast.success('Đã kết thúc sự kiện.');
            setEnding(null);
            list.reload();
          } catch (err) {
            toast.error(errorText(err));
          }
        }}
      />
    </>
  );
}

const BLANK = { name: '', disaster_type_id: '', region_id: '', severity: 3, description: '', started_at: '' };

function EventDrawer({ event, onClose, onSaved }: { event: DisasterEvent | 'new' | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { regions, types } = useCatalog();
  const [form, setForm] = useState(BLANK);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const isNew = event === 'new';

  useEffect(() => {
    setError(null);
    if (!event) return;
    if (event === 'new') {
      setForm({ ...BLANK, started_at: toLocalInput(new Date().toISOString()) });
      setPoint(null);
    } else {
      setForm({
        name: event.name,
        disaster_type_id: String(event.disaster_type_id),
        region_id: event.region_id ? String(event.region_id) : '',
        severity: event.severity,
        description: event.description ?? '',
        started_at: toLocalInput(event.started_at),
      });
      setPoint(event.lat !== null && event.lng !== null ? { lat: event.lat, lng: event.lng } : null);
    }
  }, [event]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const body = {
      ...form,
      started_at: fromLocalInput(form.started_at),
      disaster_type_id: Number(form.disaster_type_id),
      region_id: form.region_id ? Number(form.region_id) : null,
      description: form.description || null,
      lat: point?.lat ?? null,
      lng: point?.lng ?? null,
    };
    try {
      if (isNew) await api.post('/manage/events', body);
      else if (event) await api.patch(`/manage/events/${event.id}`, body);
      toast.success(isNew ? 'Đã tạo sự kiện.' : 'Đã lưu sự kiện.');
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Drawer
      open={!!event}
      onClose={onClose}
      title={isNew ? 'Thêm sự kiện thiên tai' : 'Sửa sự kiện'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="event-form" loading={busy}>
            {isNew ? 'Tạo sự kiện' : 'Lưu thay đổi'}
          </Button>
        </>
      }
    >
      <form id="event-form" onSubmit={submit} className="space-y-4">
        {error && <Callout tone="danger">{error}</Callout>}
        <Field label="Tên sự kiện" required>
          <Input required maxLength={255} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ví dụ: Bão số 7 (Yagi)" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Loại thiên tai" required>
            <Select required value={form.disaster_type_id} onChange={(e) => setForm({ ...form, disaster_type_id: e.target.value })}>
              <option value="">Chọn loại</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Khu vực">
            <Select value={form.region_id} onChange={(e) => setForm({ ...form, region_id: e.target.value })}>
              <option value="">Toàn quốc</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <FieldGroup label="Mức độ">
          <SeverityPicker value={form.severity} onChange={(v) => setForm({ ...form, severity: v })} />
        </FieldGroup>
        <Field label="Thời điểm bắt đầu" required>
          <Input type="datetime-local" required value={form.started_at} onChange={(e) => setForm({ ...form, started_at: e.target.value })} />
        </Field>
        <Field label="Mô tả">
          <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <FieldGroup label="Vị trí tâm sự kiện" hint="Tuỳ chọn, dùng để hiển thị trên bản đồ.">
          <MapPointPicker value={point} onChange={setPoint} className="h-56" />
        </FieldGroup>
      </form>
    </Drawer>
  );
}
