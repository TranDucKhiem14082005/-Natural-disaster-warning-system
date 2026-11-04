import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookOpen, CalendarClock, ChevronRight, Phone, PhoneCall, Siren } from 'lucide-react';
import { api } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import { useCatalog } from '../../hooks/use-catalog';
import type { EmergencyContact, Guide } from '../../types/api';
import { Badge, Callout, Card, EmptyState, LinkButton, ListSkeleton, PageHeader, Select, Skeleton } from '../../components/ui';
import { fmtDate } from '../../utils/format';
import { DisasterIcon } from '../alerts/disaster-icon';

/** Minimal markdown: "#/## heading", "- item", "1. item" and paragraphs (content is admin-authored). */
function SimpleMarkdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let ordered = false;
  const flush = () => {
    if (list.length) {
      const items = list.map((l, i) => (
        <li key={i} className="pl-1">
          {l}
        </li>
      ));
      blocks.push(
        ordered ? (
          <ol key={blocks.length} className="ml-5 list-decimal space-y-2 marker:font-semibold marker:text-brand-600">
            {items}
          </ol>
        ) : (
          <ul key={blocks.length} className="ml-5 list-disc space-y-2 marker:text-brand-500">
            {items}
          </ul>
        ),
      );
    }
    list = [];
  };
  text.split('\n').forEach((line) => {
    const t = line.trim();
    const num = /^\d+[.)]\s+(.*)$/.exec(t);
    if (t.startsWith('- ') || t.startsWith('* ') || num) {
      const isOrdered = !!num;
      if (list.length && isOrdered !== ordered) flush();
      ordered = isOrdered;
      list.push(num ? num[1]! : t.slice(2));
      return;
    }
    flush();
    if (t.startsWith('## ')) blocks.push(<h2 key={blocks.length} className="pt-4 text-xl font-bold text-slate-900">{t.slice(3)}</h2>);
    else if (t.startsWith('# ')) blocks.push(<h2 key={blocks.length} className="pt-4 text-2xl font-bold text-slate-900">{t.slice(2)}</h2>);
    else if (t) blocks.push(<p key={blocks.length}>{t}</p>);
  });
  flush();
  return <div className="space-y-4 text-[16px] leading-[1.75] text-slate-700 sm:text-[17px]">{blocks}</div>;
}

export function GuidesPage() {
  const { types } = useCatalog();
  const [typeId, setTypeId] = useState('');
  const { data, error, loading } = useFetch(() => api.get<Guide[]>('/guides', { disaster_type_id: typeId }), [typeId]);

  const chip = (active: boolean) =>
    `inline-flex min-h-[40px] shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition ${active ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`;

  return (
    <>
      <PageHeader title="Cẩm nang ứng phó" description="Việc cần làm trước, trong và sau thiên tai. Đọc trước để chủ động khi có cảnh báo." />
      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1" role="radiogroup" aria-label="Loại thiên tai">
        <button type="button" role="radio" aria-checked={!typeId} className={chip(!typeId)} onClick={() => setTypeId('')}>
          Tất cả
        </button>
        {types.map((t) => (
          <button key={t.id} type="button" role="radio" aria-checked={typeId === String(t.id)} className={chip(typeId === String(t.id))} onClick={() => setTypeId(String(t.id))}>
            {t.name}
          </button>
        ))}
      </div>
      {error && <Callout tone="danger" title="Không tải được cẩm nang">{error}</Callout>}
      {loading && <ListSkeleton rows={3} />}
      {data && !data.length && (
        <Card>
          <EmptyState icon={BookOpen} title="Chưa có cẩm nang cho loại thiên tai này" description="Xem các cẩm nang khác hoặc gọi đường dây nóng khi cần hướng dẫn." />
        </Card>
      )}
      {data && data.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.map((g) => (
            <Link key={g.id} to={`/guides/${g.slug}`} className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition hover:shadow-raised">
              <DisasterIcon code={g.type?.code} size="lg" />
              <div className="min-w-0 flex-1">
                {g.type && <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">{g.type.name}</p>}
                <h3 className="mt-0.5 font-semibold leading-snug text-slate-900 group-hover:text-brand-700">{g.title}</h3>
                <p className="mt-1 text-xs text-slate-500">Cập nhật {fmtDate(g.updated_at)}</p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 group-hover:text-slate-500" aria-hidden />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function GuideDetailPage() {
  const { slug } = useParams();
  const { data, error, loading } = useFetch(() => api.get<Guide>(`/guides/${slug}`), [slug]);

  if (loading)
    return (
      <div className="mx-auto max-w-3xl space-y-4" role="status" aria-label="Đang tải">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    );
  if (error || !data)
    return <EmptyState icon={BookOpen} title="Không tìm thấy cẩm nang" description={error ?? undefined} action={<LinkButton to="/guides">Về danh sách cẩm nang</LinkButton>} />;

  return (
    <article className="mx-auto max-w-3xl">
      <PageHeader
        back={{ to: '/guides', label: 'Cẩm nang' }}
        eyebrow={data.type ? <Badge tone="blue">{data.type.name}</Badge> : undefined}
        title={data.title}
        description={
          <span className="inline-flex items-center gap-1 text-sm">
            <CalendarClock className="h-4 w-4" aria-hidden />
            Cập nhật {fmtDate(data.updated_at)}
          </span>
        }
      />
      <div className="rounded-2xl border border-slate-200/80 bg-white px-5 py-6 shadow-card sm:px-8 sm:py-8">
        <SimpleMarkdown text={data.content ?? ''} />
      </div>
      <div className="mt-5 grid gap-2 sm:grid-cols-2">
        <LinkButton to="/sos" variant="danger" size="lg" icon={Siren} block>
          Cần cứu hộ? Gửi SOS
        </LinkButton>
        <LinkButton to="/contacts" variant="secondary" size="lg" icon={Phone} block>
          Danh bạ khẩn cấp
        </LinkButton>
      </div>
    </article>
  );
}

export function ContactsPage() {
  const { regions } = useCatalog();
  const [regionId, setRegionId] = useState('');
  const { data, error, loading } = useFetch(() => api.get<EmergencyContact[]>('/emergency-contacts', { region_id: regionId }), [regionId]);

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Danh bạ khẩn cấp" description="Bấm vào số để gọi ngay. Các đường dây 112-115 miễn phí và hoạt động 24/7." />
      <div className="mb-4 max-w-xs">
        <Select aria-label="Khu vực" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
          <option value="">Số toàn quốc</option>
          {regions.map((r) => (
            <option key={r.id} value={r.id}>
              Toàn quốc + {r.name}
            </option>
          ))}
        </Select>
      </div>
      {error && <Callout tone="danger" title="Không tải được danh bạ">{error}</Callout>}
      {loading && <ListSkeleton rows={4} />}
      {data && !data.length && (
        <Card>
          <EmptyState icon={Phone} title="Chưa có số liên hệ" />
        </Card>
      )}
      <ul className="space-y-2.5">
        {data?.map((c) => (
          <li key={c.id}>
            <a
              href={`tel:${c.phone}`}
              className="group flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card transition hover:border-red-200 hover:shadow-raised active:bg-red-50"
            >
              <span className="min-w-[4.5rem] text-2xl font-extrabold tabular-nums text-red-600 sm:text-3xl">{c.phone}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-slate-900">{c.name}</span>
                {c.description && <span className="block text-sm text-slate-500">{c.description}</span>}
              </span>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm transition group-hover:bg-red-700" aria-hidden>
                <PhoneCall className="h-5 w-5" />
              </span>
              <span className="sr-only">Gọi {c.phone}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
