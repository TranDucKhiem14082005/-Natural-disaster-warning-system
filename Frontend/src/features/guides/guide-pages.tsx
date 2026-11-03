import { useState, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../services/api';
import { useFetch } from '../../hooks/use-fetch';
import { useCatalog } from '../../hooks/use-catalog';
import type { EmergencyContact, Guide } from '../../types/api';
import { Badge, Card, Empty, ErrorBox, PageTitle, Spinner, inputClass } from '../../components/ui';
import { fmtDate } from '../../utils/format';

/** Minimal markdown: "## heading", "- item" and paragraphs (content is admin-authored). */
function SimpleMarkdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ul key={blocks.length} className="ml-5 list-disc space-y-1">{list.map((l, i) => <li key={i}>{l}</li>)}</ul>);
    list = [];
  };
  text.split('\n').forEach((line) => {
    const t = line.trim();
    if (t.startsWith('- ')) return list.push(t.slice(2));
    flush();
    if (t.startsWith('## ')) blocks.push(<h2 key={blocks.length} className="mt-4 text-lg font-semibold text-slate-900">{t.slice(3)}</h2>);
    else if (t.startsWith('# ')) blocks.push(<h2 key={blocks.length} className="mt-4 text-xl font-bold text-slate-900">{t.slice(2)}</h2>);
    else if (t) blocks.push(<p key={blocks.length} className="text-slate-700">{t}</p>);
  });
  flush();
  return <div className="space-y-2">{blocks}</div>;
}

export function GuidesPage() {
  const { types } = useCatalog();
  const [typeId, setTypeId] = useState('');
  const { data, error, loading } = useFetch(() => api.get<Guide[]>('/guides', { disaster_type_id: typeId }), [typeId]);

  return (
    <>
      <PageTitle>Cẩm nang ứng phó</PageTitle>
      <select className={`${inputClass} mb-4 max-w-xs`} aria-label="Loại thiên tai" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
        <option value="">Mọi loại thiên tai</option>
        {types.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
      <ErrorBox message={error} />
      {loading && <Spinner />}
      {data && !data.length && <Empty />}
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {data?.map((g) => (
          <Link key={g.id} to={`/guides/${g.slug}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-brand-500">
            {g.type && <Badge tone="blue">{g.type.name}</Badge>}
            <h3 className="mt-2 font-semibold text-slate-900">{g.title}</h3>
            <p className="mt-1 text-xs text-slate-500">Cập nhật {fmtDate(g.updated_at)}</p>
          </Link>
        ))}
      </div>
    </>
  );
}

export function GuideDetailPage() {
  const { slug } = useParams();
  const { data, error, loading } = useFetch(() => api.get<Guide>(`/guides/${slug}`), [slug]);
  if (loading) return <Spinner />;
  if (error || !data) return <ErrorBox message={error ?? 'Không tìm thấy cẩm nang.'} />;

  return (
    <article className="mx-auto max-w-3xl space-y-3">
      <Link to="/guides" className="text-sm text-brand-600 hover:underline">
        ← Cẩm nang
      </Link>
      <h1 className="text-2xl font-bold text-slate-900">{data.title}</h1>
      <Card>
        <SimpleMarkdown text={data.content ?? ''} />
      </Card>
    </article>
  );
}

export function ContactsPage() {
  const { regions } = useCatalog();
  const [regionId, setRegionId] = useState('');
  const { data, error, loading } = useFetch(() => api.get<EmergencyContact[]>('/emergency-contacts', { region_id: regionId }), [regionId]);

  return (
    <>
      <PageTitle>Danh bạ khẩn cấp</PageTitle>
      <select className={`${inputClass} mb-4 max-w-xs`} aria-label="Khu vực" value={regionId} onChange={(e) => setRegionId(e.target.value)}>
        <option value="">Chỉ số toàn quốc</option>
        {regions.map((r) => (
          <option key={r.id} value={r.id}>
            {r.name}
          </option>
        ))}
      </select>
      <ErrorBox message={error} />
      {loading && <Spinner />}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {data?.map((c) => (
          <a key={c.id} href={`tel:${c.phone}`} className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm hover:border-red-500">
            <p className="text-3xl font-bold text-red-600">{c.phone}</p>
            <p className="mt-1 font-medium text-slate-900">{c.name}</p>
            {c.description && <p className="text-sm text-slate-500">{c.description}</p>}
            <p className="mt-2 text-xs font-semibold uppercase text-red-600">Bấm để gọi</p>
          </a>
        ))}
      </div>
    </>
  );
}
