import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { BookOpen, Database, MapPinned, Pencil, Phone, Plus, Search, Trash2, TriangleAlert } from 'lucide-react';
import { api, errorText } from '../../services/api';
import { invalidateCatalog, useCatalog } from '../../hooks/use-catalog';
import { useFetch } from '../../hooks/use-fetch';
import type { DisasterType, EmergencyContact, Guide, Paginated, Region } from '../../types/api';
import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  EmptyState,
  ErrorBox,
  Field,
  IconButton,
  Input,
  ListSkeleton,
  Modal,
  PageHeader,
  SegmentedControl,
  Select,
  Table,
  Td,
  Textarea,
  Th,
  useToast,
} from '../../components/ui';
import { fmtDate } from '../../utils/format';

export type Resource = 'regions' | 'disaster-types' | 'guides' | 'emergency-contacts';

type GuideRow = Guide & { content: string; is_published: boolean };
type Row = Region | DisasterType | GuideRow | EmergencyContact;

interface FieldSpec {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'checkbox' | 'region' | 'type';
  required?: boolean;
  hint?: string;
  wide?: boolean;
}

export const RESOURCES: Record<Resource, { label: string; singular: string; icon: typeof Database; fields: FieldSpec[] }> = {
  regions: {
    label: 'Khu vực',
    singular: 'khu vực',
    icon: MapPinned,
    fields: [
      { key: 'code', label: 'Mã', required: true, hint: 'Viết tắt, ví dụ DN, HUE.' },
      { key: 'name', label: 'Tên khu vực', required: true },
      { key: 'center_lat', label: 'Vĩ độ tâm', type: 'number', required: true, hint: 'Ví dụ 12.2388' },
      { key: 'center_lng', label: 'Kinh độ tâm', type: 'number', required: true, hint: 'Ví dụ 109.1967' },
    ],
  },
  'disaster-types': {
    label: 'Loại thiên tai',
    singular: 'loại thiên tai',
    icon: TriangleAlert,
    fields: [
      { key: 'code', label: 'Mã', required: true, hint: 'Chữ thường, không dấu, ví dụ flood.' },
      { key: 'name', label: 'Tên', required: true },
      { key: 'default_instructions', label: 'Hướng dẫn mẫu cho người dân', type: 'textarea', wide: true, hint: 'Tự điền vào cảnh báo mới thuộc loại này.' },
    ],
  },
  guides: {
    label: 'Cẩm nang',
    singular: 'cẩm nang',
    icon: BookOpen,
    fields: [
      { key: 'title', label: 'Tiêu đề', required: true, wide: true },
      { key: 'slug', label: 'Đường dẫn (slug)', hint: 'Để trống khi tạo mới để hệ thống tự sinh.' },
      { key: 'disaster_type_id', label: 'Loại thiên tai', type: 'type' },
      { key: 'content', label: 'Nội dung', type: 'textarea', required: true, wide: true, hint: 'Dùng "## " cho tiêu đề mục và "- " cho gạch đầu dòng.' },
      { key: 'is_published', label: 'Công khai cho người dân', type: 'checkbox', wide: true },
    ],
  },
  'emergency-contacts': {
    label: 'Danh bạ khẩn cấp',
    singular: 'số khẩn cấp',
    icon: Phone,
    fields: [
      { key: 'name', label: 'Tên', required: true },
      { key: 'phone', label: 'Số điện thoại', required: true },
      { key: 'region_id', label: 'Khu vực', type: 'region', hint: 'Để trống nếu áp dụng toàn quốc.' },
      { key: 'sort_order', label: 'Thứ tự hiển thị', type: 'number' },
      { key: 'description', label: 'Mô tả', wide: true },
    ],
  },
};

const RESOURCE_KEYS = Object.keys(RESOURCES) as Resource[];

function isResource(v: string | null): v is Resource {
  return !!v && v in RESOURCES;
}

function rowTitle(row: Row): string {
  return 'title' in row ? row.title : row.name;
}

export function CatalogPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get('tab');
  const resource: Resource = isResource(tab) ? tab : 'regions';
  const spec = RESOURCES[resource];
  const { regions, types } = useCatalog();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<Row | 'new' | null>(null);
  const [deleting, setDeleting] = useState<Row | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [totals, setTotals] = useState<Partial<Record<Resource, number>>>({});

  const { data, error, loading, reload } = useFetch(() => api.get<Paginated<Row>>(`/admin/catalog/${resource}`), [resource]);

  useEffect(() => {
    Promise.all(RESOURCE_KEYS.map((r) => api.get<Paginated<Row>>(`/admin/catalog/${r}`, { per_page: 1 }).then((p) => [r, p.total] as const)))
      .then((pairs) => setTotals(Object.fromEntries(pairs)))
      .catch(() => {});
  }, [data]);

  const rows = useMemo(() => {
    const all = data?.data ?? [];
    const term = q.trim().toLowerCase();
    if (!term) return all;
    return all.filter((r) => JSON.stringify(r).toLowerCase().includes(term));
  }, [data, q]);

  const regionName = (id: number | null) => (id ? (regions.find((r) => r.id === id)?.name ?? `#${id}`) : 'Toàn quốc');
  const typeName = (id: number | null) => (id ? (types.find((t) => t.id === id)?.name ?? `#${id}`) : 'Chung');

  const switchTab = (r: Resource) => {
    setQ('');
    setParams({ tab: r }, { replace: true });
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await api.delete(`/admin/catalog/${resource}/${deleting.id}`);
      invalidateCatalog();
      toast.success(`Đã xoá "${rowTitle(deleting)}".`);
      setDeleting(null);
      reload();
    } catch (err) {
      setDeleteError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const columns: { head: string; cell: (r: Row) => ReactNode; className?: string }[] = {
    regions: [
      { head: 'Mã', cell: (r: Row) => <Badge>{(r as Region).code}</Badge> },
      { head: 'Tên khu vực', cell: (r: Row) => <span className="font-semibold text-slate-900">{(r as Region).name}</span> },
      { head: 'Toạ độ tâm', cell: (r: Row) => <span className="font-mono text-xs text-slate-600">{`${(r as Region).center_lat}, ${(r as Region).center_lng}`}</span> },
    ],
    'disaster-types': [
      { head: 'Mã', cell: (r: Row) => <Badge>{(r as DisasterType).code}</Badge> },
      { head: 'Tên', cell: (r: Row) => <span className="font-semibold text-slate-900">{(r as DisasterType).name}</span> },
      {
        head: 'Hướng dẫn mẫu',
        cell: (r: Row) => <span className="line-clamp-2 max-w-md text-slate-600">{(r as DisasterType).default_instructions || '-'}</span>,
      },
    ],
    guides: [
      {
        head: 'Tiêu đề',
        cell: (r: Row) => (
          <div className="min-w-0">
            <p className="font-semibold text-slate-900">{(r as GuideRow).title}</p>
            <p className="font-mono text-xs text-slate-500">/{(r as GuideRow).slug}</p>
          </div>
        ),
      },
      { head: 'Loại thiên tai', cell: (r: Row) => <span className="text-slate-600">{typeName((r as GuideRow).disaster_type_id)}</span> },
      {
        head: 'Trạng thái',
        cell: (r: Row) =>
          (r as GuideRow).is_published ? (
            <Badge tone="green" dot>
              Công khai
            </Badge>
          ) : (
            <Badge dot>Nháp</Badge>
          ),
      },
      { head: 'Cập nhật', cell: (r: Row) => <span className="whitespace-nowrap text-slate-500">{fmtDate((r as GuideRow).updated_at)}</span> },
    ],
    'emergency-contacts': [
      { head: 'Tên', cell: (r: Row) => <span className="font-semibold text-slate-900">{(r as EmergencyContact).name}</span> },
      {
        head: 'Số điện thoại',
        cell: (r: Row) => (
          <a href={`tel:${(r as EmergencyContact).phone}`} className="font-semibold text-red-600 hover:underline" onClick={(e) => e.stopPropagation()}>
            {(r as EmergencyContact).phone}
          </a>
        ),
      },
      { head: 'Khu vực', cell: (r: Row) => <span className="text-slate-600">{regionName((r as EmergencyContact).region_id)}</span> },
      { head: 'Mô tả', cell: (r: Row) => <span className="line-clamp-1 max-w-xs text-slate-600">{(r as EmergencyContact).description || '-'}</span> },
      { head: 'Thứ tự', cell: (r: Row) => <span className="tabular-nums text-slate-500">{(r as EmergencyContact).sort_order}</span> },
    ],
  }[resource];

  const subtitle = (r: Row): string => {
    if (resource === 'regions') return (r as Region).code;
    if (resource === 'disaster-types') return (r as DisasterType).code;
    if (resource === 'guides') return `${typeName((r as GuideRow).disaster_type_id)} · ${(r as GuideRow).is_published ? 'Công khai' : 'Nháp'}`;
    return `${(r as EmergencyContact).phone} · ${regionName((r as EmergencyContact).region_id)}`;
  };

  return (
    <>
      <PageHeader
        title="Danh mục"
        description="Dữ liệu nền dùng chung toàn hệ thống: khu vực, loại thiên tai, cẩm nang ứng phó và danh bạ khẩn cấp."
        actions={
          <Button icon={Plus} onClick={() => setEditing('new')}>
            Thêm {spec.singular}
          </Button>
        }
      />

      <div className="mb-4">
        <SegmentedControl<Resource>
          label="Chọn danh mục"
          value={resource}
          onChange={switchTab}
          options={RESOURCE_KEYS.map((r) => ({ value: r, label: RESOURCES[r].label, count: totals[r] }))}
        />
      </div>

      <Card flush>
        <div className="border-b border-slate-100 p-4 sm:px-5">
          <Input icon={Search} className="sm:max-w-sm" placeholder={`Tìm trong ${spec.label.toLowerCase()}`} aria-label="Tìm trong danh mục" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        {error && (
          <div className="p-4">
            <ErrorBox message={error} />
          </div>
        )}
        {loading && !data ? (
          <div className="p-4">
            <ListSkeleton rows={5} />
          </div>
        ) : rows.length === 0 ? (
          <EmptyState
            icon={spec.icon}
            title={q ? 'Không có mục nào khớp' : `Chưa có ${spec.singular} nào`}
            description={q ? 'Thử từ khoá khác.' : `Thêm ${spec.singular} đầu tiên để dùng trong hệ thống.`}
            action={
              !q && (
                <Button icon={Plus} onClick={() => setEditing('new')}>
                  Thêm {spec.singular}
                </Button>
              )
            }
          />
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <thead>
                  <tr>
                    {columns.map((c) => (
                      <Th key={c.head}>{c.head}</Th>
                    ))}
                    <Th className="text-right">
                      <span className="sr-only">Thao tác</span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50">
                      {columns.map((c) => (
                        <Td key={c.head}>{c.cell(row)}</Td>
                      ))}
                      <Td className="whitespace-nowrap text-right">
                        <IconButton icon={Pencil} label={`Sửa ${rowTitle(row)}`} size="sm" onClick={() => setEditing(row)} />
                        <IconButton
                          icon={Trash2}
                          label={`Xoá ${rowTitle(row)}`}
                          size="sm"
                          className="text-red-600 hover:bg-red-50"
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(row);
                          }}
                        />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map((row) => (
                <li key={row.id} className="flex items-center gap-2 px-4 py-3">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setEditing(row)}>
                    <p className="truncate font-semibold text-slate-900">{rowTitle(row)}</p>
                    <p className="truncate text-xs text-slate-500">{subtitle(row)}</p>
                  </button>
                  <IconButton icon={Pencil} label={`Sửa ${rowTitle(row)}`} size="sm" onClick={() => setEditing(row)} />
                  <IconButton
                    icon={Trash2}
                    label={`Xoá ${rowTitle(row)}`}
                    size="sm"
                    className="text-red-600 hover:bg-red-50"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleting(row);
                    }}
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <CatalogEditor
        resource={resource}
        row={editing === 'new' ? null : editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reload();
        }}
      />

      <Modal
        open={!!deleting}
        onClose={() => setDeleting(null)}
        size="sm"
        title={`Xoá ${spec.singular}?`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Huỷ
            </Button>
            <Button variant="danger" icon={Trash2} loading={busy} onClick={remove}>
              Xoá
            </Button>
          </>
        }
      >
        <p className="text-sm text-slate-700">
          Mục <strong>{deleting ? rowTitle(deleting) : ''}</strong> sẽ bị xoá vĩnh viễn. Dữ liệu đang tham chiếu tới mục này (cảnh báo, điểm trú ẩn...) có thể bị ảnh hưởng.
        </p>
        {deleteError && <Callout tone="danger" className="mt-3">{deleteError}</Callout>}
      </Modal>
    </>
  );
}

function CatalogEditor({ resource, row, open, onClose, onSaved }: { resource: Resource; row: Row | null; open: boolean; onClose: () => void; onSaved: () => void }) {
  const spec = RESOURCES[resource];
  const { regions, types } = useCatalog();
  const toast = useToast();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const source = (row ?? {}) as Record<string, unknown>;
    setValues(
      Object.fromEntries(
        spec.fields.map((f) => [f.key, f.type === 'checkbox' ? (row ? !!source[f.key] : true) : (source[f.key] ?? (f.key === 'sort_order' && !row ? 0 : ''))]),
      ),
    );
    setError(null);
  }, [open, row, spec]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const body: Record<string, unknown> = {};
    for (const f of spec.fields) {
      const v = values[f.key];
      if (f.type === 'checkbox') body[f.key] = !!v;
      else if (v === '' || v === undefined || v === null) {
        // Empty slug on create: let the server derive it from the title.
        if (f.key === 'slug') continue;
        body[f.key] = null;
      } else body[f.key] = f.type === 'number' || f.type === 'region' || f.type === 'type' ? Number(v) : v;
    }
    try {
      if (row) await api.patch(`/admin/catalog/${resource}/${row.id}`, body);
      else await api.post(`/admin/catalog/${resource}`, body);
      invalidateCatalog();
      toast.success(row ? 'Đã lưu thay đổi.' : `Đã thêm ${spec.singular}.`);
      onSaved();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const set = (key: string, v: unknown) => setValues((cur) => ({ ...cur, [key]: v }));

  return (
    <Modal
      open={open}
      onClose={onClose}
      size={resource === 'guides' ? 'lg' : 'md'}
      title={row ? `Sửa ${spec.singular}` : `Thêm ${spec.singular}`}
      description={row ? rowTitle(row) : undefined}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="catalog-editor" loading={saving}>
            {row ? 'Lưu thay đổi' : 'Thêm'}
          </Button>
        </>
      }
    >
      <form id="catalog-editor" onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        {spec.fields.map((f) => {
          const v = values[f.key];
          const cls = f.wide ? 'sm:col-span-2' : '';
          if (f.type === 'checkbox') {
            return <Checkbox key={f.key} className={cls} label={f.label} checked={!!v} onChange={(e) => set(f.key, e.target.checked)} />;
          }
          let control: ReactNode;
          if (f.type === 'textarea') {
            control = <Textarea rows={f.key === 'content' ? 12 : 5} required={f.required} value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)} />;
          } else if (f.type === 'region' || f.type === 'type') {
            const options = f.type === 'region' ? regions : types;
            control = (
              <Select value={String(v ?? '')} onChange={(e) => set(f.key, e.target.value)}>
                <option value="">{f.type === 'region' ? 'Toàn quốc' : 'Chung (mọi loại)'}</option>
                {options.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </Select>
            );
          } else {
            control = (
              <Input
                type={f.type === 'number' ? 'number' : 'text'}
                step="any"
                inputMode={f.type === 'number' ? 'decimal' : undefined}
                required={f.required}
                value={String(v ?? '')}
                onChange={(e) => set(f.key, e.target.value)}
              />
            );
          }
          return (
            <Field key={f.key} className={cls} label={f.label} required={f.required} hint={f.hint}>
              {control}
            </Field>
          );
        })}
        {error && (
          <div className="sm:col-span-2">
            <ErrorBox message={error} />
          </div>
        )}
      </form>
    </Modal>
  );
}
