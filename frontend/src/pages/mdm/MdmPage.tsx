import React, { useEffect, useMemo, useState } from 'react';
import { Button, Select, Space, Modal, Tag, Empty, Spin, message } from 'antd';
import { MergeCellsOutlined, SearchOutlined, ReloadOutlined, DatabaseOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { PageHeader, SectionCard, KpiCard, StatusTag, EmptyState } from '../../design-system';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

/** Master-data entities that the backend MDM engine can deduplicate. */
type Entity = 'contacts' | 'items';

/** A single source master record (loosely typed — fields vary per entity). */
type MasterRecord = Record<string, unknown> & { id?: string };

interface DuplicateGroup {
  size: number;
  ids: string[];
  records: MasterRecord[];
}

interface DedupResponse {
  entity: Entity;
  keys: string[];
  threshold: number;
  record_count: number;
  duplicate_group_count: number;
  groups: DuplicateGroup[];
}

interface GoldenRecord {
  id: string;
  entity: string;
  source_ids: string[];
  golden: MasterRecord;
  merged_at: string;
  merged_by?: string;
}

/** Key-field choices per entity (the fields the dedup engine matches on). */
const KEY_FIELDS: Record<Entity, { value: string; label: string }[]> = {
  contacts: [
    { value: 'name', label: 'ناو' },
    { value: 'email', label: 'ئیمەیڵ' },
    { value: 'phone', label: 'تەلەفۆن' },
    { value: 'tax_id', label: 'ژمارەی باج' },
  ],
  items: [
    { value: 'name', label: 'ناو' },
    { value: 'sku', label: 'SKU' },
    { value: 'barcode', label: 'بارکۆد' },
  ],
};

/** Best-effort human label for a record in a group (name → email → sku → id). */
const recordLabel = (r: MasterRecord): string => {
  const pick = (k: string) => {
    const v = r[k];
    return typeof v === 'string' && v.trim() ? v.trim() : '';
  };
  return pick('name') || pick('email') || pick('sku') || pick('barcode') || String(r.id ?? '—');
};

const MdmPage: React.FC = () => {
  const { t } = useTranslation();

  // ── Find-duplicates panel state ──────────────────────────────────────────
  const [entity, setEntity] = useState<Entity>('contacts');
  const [keys, setKeys] = useState<string[]>(['name']);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<DedupResponse | null>(null);
  const [mergingId, setMergingId] = useState<string | null>(null);

  // ── Golden-records table state ───────────────────────────────────────────
  const [golden, setGolden] = useState<GoldenRecord[]>([]);
  const [goldenLoading, setGoldenLoading] = useState(false);

  const loadGolden = async () => {
    setGoldenLoading(true);
    try {
      const res = await api.get('/api/mdm/golden-records');
      setGolden(Array.isArray(res.data) ? res.data : []);
    } catch {
      message.error(t('error'));
    } finally {
      setGoldenLoading(false);
    }
  };

  useEffect(() => {
    loadGolden();
  }, []);

  // When the entity changes, reset key selection + any prior scan result.
  const onEntityChange = (next: Entity) => {
    setEntity(next);
    setKeys([KEY_FIELDS[next][0].value]);
    setResult(null);
  };

  const runDedup = async () => {
    if (keys.length === 0) {
      message.warning(t('mdm.pickKeyFields', 'تکایە لانیکەم یەک خانەی کلیل هەڵبژێرە'));
      return;
    }
    setScanning(true);
    try {
      const res = await api.post('/api/mdm/dedup', { entity, keys, threshold: 1.0 });
      setResult(res.data as DedupResponse);
    } catch (error: unknown) {
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      message.error(detail || t('error'));
    } finally {
      setScanning(false);
    }
  };

  const mergeGroup = (group: DuplicateGroup) => {
    Modal.confirm({
      title: t('mdm.mergeConfirmTitle', 'یەکخستن بۆ تۆماری زێڕین'),
      icon: <MergeCellsOutlined style={{ color: 'var(--accent-500)' }} />,
      content: t(
        'mdm.mergeConfirmBody',
        'ئەم {{n}} تۆمارە دەکرێنە یەک تۆماری زێڕین. نوێترین بەهای پڕکراوە بۆ هەر خانەیەک دەبردرێتەوە.',
        { n: group.size },
      ),
      okText: t('mdm.merge', 'یەکخستن'),
      cancelText: t('cancel', 'هەڵوەشاندنەوە'),
      onOk: async () => {
        setMergingId(group.ids.join(','));
        try {
          await api.post('/api/mdm/merge', { records: group.records, entity });
          message.success(t('mdm.merged', 'تۆماری زێڕین دروستکرا'));
          // Drop the merged group from the local scan result + refresh golden list.
          setResult((prev) =>
            prev
              ? {
                  ...prev,
                  groups: prev.groups.filter((g) => g.ids.join(',') !== group.ids.join(',')),
                  duplicate_group_count: Math.max(0, prev.duplicate_group_count - 1),
                }
              : prev,
          );
          loadGolden();
        } catch (error: unknown) {
          const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
          message.error(detail || t('error'));
        } finally {
          setMergingId(null);
        }
      },
    });
  };

  const keyOptions = KEY_FIELDS[entity];

  const entityOptions = useMemo(
    () => [
      { value: 'contacts' as Entity, label: t('mdm.entityContacts', 'پەیوەندییەکان') },
      { value: 'items' as Entity, label: t('mdm.entityItems', 'کاڵاکان') },
    ],
    [t],
  );

  const goldenColumns = [
    {
      title: t('mdm.entity', 'جۆر'),
      dataIndex: 'entity',
      key: 'entity',
      width: 130,
      render: (v: string) => (
        <StatusTag
          status="info"
          label={
            v === 'contacts'
              ? t('mdm.entityContacts', 'پەیوەندییەکان')
              : v === 'items'
                ? t('mdm.entityItems', 'کاڵاکان')
                : v || '—'
          }
        />
      ),
    },
    {
      title: t('mdm.goldenRecord', 'تۆماری زێڕین'),
      key: 'golden',
      render: (_: unknown, r: GoldenRecord) => (
        <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{recordLabel(r.golden || {})}</span>
      ),
    },
    {
      title: t('mdm.mergedFrom', 'یەکخراو لە'),
      dataIndex: 'source_ids',
      key: 'source_ids',
      width: 130,
      render: (ids: string[]) => (
        <Tag
          style={{
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            color: 'var(--ink-600)',
            fontWeight: 600,
          }}
        >
          {(ids?.length ?? 0)} {t('mdm.records', 'تۆمار')}
        </Tag>
      ),
    },
    {
      title: t('mdm.mergedAt', 'بەرواری یەکخستن'),
      dataIndex: 'merged_at',
      key: 'merged_at',
      width: 170,
      render: (v: string) =>
        v ? (
          <span style={{ color: 'var(--ink-700)', fontFamily: 'var(--font-mono)', fontSize: 12.5 }}>
            {dayjs(v).format('YYYY-MM-DD HH:mm')}
          </span>
        ) : (
          <span style={{ color: 'var(--ink-400)' }}>—</span>
        ),
    },
  ];

  const groups = result?.groups ?? [];

  return (
    <div>
      <PageHeader
        title={t('mdm.title', 'بەڕێوەبردنی داتای سەرەکی')}
        subtitle={t('mdm.subtitle', 'دۆزینەوەی دووبارەکان و یەکخستنیان بۆ یەک تۆماری زێڕین')}
      />

      {/* ── Find-duplicates panel ───────────────────────────────────────── */}
      <SectionCard
        title={t('mdm.findDuplicates', 'دۆزینەوەی دووبارەکان')}
        subtitle={t('mdm.findDuplicatesHint', 'جۆر و خانە کلیلەکان هەڵبژێرە، پاشان سکان بکە')}
      >
        <Space wrap align="end" size={12} style={{ width: '100%' }}>
          <div style={{ minWidth: 200 }}>
            <div style={{ marginBottom: 6, color: 'var(--ink-600)', fontSize: 12.5, fontWeight: 600 }}>
              {t('mdm.entity', 'جۆر')}
            </div>
            <Select<Entity>
              value={entity}
              onChange={onEntityChange}
              options={entityOptions}
              style={{ width: '100%' }}
            />
          </div>
          <div style={{ minWidth: 280, flex: 1 }}>
            <div style={{ marginBottom: 6, color: 'var(--ink-600)', fontSize: 12.5, fontWeight: 600 }}>
              {t('mdm.keyFields', 'خانە کلیلەکان')}
            </div>
            <Select
              mode="multiple"
              value={keys}
              onChange={(v: string[]) => setKeys(v)}
              options={keyOptions}
              placeholder={t('mdm.pickKeyFields', 'تکایە لانیکەم یەک خانەی کلیل هەڵبژێرە')}
              style={{ width: '100%' }}
              allowClear
            />
          </div>
          <Button type="primary" icon={<SearchOutlined />} loading={scanning} onClick={runDedup}>
            {t('mdm.scan', 'سکانکردن')}
          </Button>
        </Space>

        {/* KPI summary of the last scan. */}
        {result && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 'var(--space-md, 12px)',
              marginBlockStart: 'var(--space-xl, 24px)',
            }}
          >
            <KpiCard
              title={t('mdm.scannedRecords', 'تۆمارە سکانکراوەکان')}
              value={result.record_count}
              icon={<DatabaseOutlined />}
            />
            <KpiCard
              title={t('mdm.duplicateGroups', 'گروپە دووبارەکان')}
              value={result.duplicate_group_count}
              icon={<MergeCellsOutlined />}
            />
          </div>
        )}
      </SectionCard>

      {/* ── Duplicate-group results ─────────────────────────────────────── */}
      {scanning ? (
        <SectionCard>
          <div style={{ textAlign: 'center', padding: 'var(--space-3xl, 48px)' }}>
            <Spin />
          </div>
        </SectionCard>
      ) : result ? (
        groups.length === 0 ? (
          <SectionCard>
            <EmptyState
              icon={<MergeCellsOutlined />}
              title={t('mdm.noDuplicates', 'هیچ دووبارەیەک نەدۆزرایەوە')}
              description={t('mdm.noDuplicatesHint', 'هەموو تۆمارەکان لەسەر بنەمای ئەم خانانە بێهاوتان')}
            />
          </SectionCard>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg, 16px)' }}>
            {groups.map((group) => {
              const groupKey = group.ids.join(',');
              return (
                <SectionCard
                  key={groupKey}
                  title={
                    <Space size={8}>
                      <span>{recordLabel(group.records[0] || {})}</span>
                      <Tag
                        style={{
                          background: 'var(--accent-soft)',
                          border: '1px solid var(--border)',
                          color: 'var(--accent-500)',
                          fontWeight: 600,
                        }}
                      >
                        {group.size} {t('mdm.duplicates', 'دووبارە')}
                      </Tag>
                    </Space>
                  }
                  extra={
                    <Button
                      type="primary"
                      icon={<MergeCellsOutlined />}
                      loading={mergingId === groupKey}
                      onClick={() => mergeGroup(group)}
                    >
                      {t('mdm.mergeToGolden', 'یەکخستن بۆ تۆماری زێڕین')}
                    </Button>
                  }
                >
                  <ul style={{ margin: 0, paddingInlineStart: 'var(--space-lg, 16px)' }}>
                    {group.records.map((r, idx) => (
                      <li
                        key={String(r.id ?? idx)}
                        style={{ color: 'var(--ink-700)', marginBlockEnd: 4, lineHeight: 1.6 }}
                      >
                        <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{recordLabel(r)}</span>
                        {typeof r.email === 'string' && r.email && (
                          <span style={{ color: 'var(--ink-500)' }}> · {r.email}</span>
                        )}
                        {typeof r.phone === 'string' && r.phone && (
                          <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}> · {r.phone}</span>
                        )}
                        {typeof r.sku === 'string' && r.sku && (
                          <span style={{ color: 'var(--ink-500)', fontFamily: 'var(--font-mono)' }}> · {r.sku}</span>
                        )}
                        {r.id && (
                          <span style={{ color: 'var(--ink-400)', fontFamily: 'var(--font-mono)', fontSize: 11.5 }}>
                            {' '}
                            #{String(r.id).slice(0, 8)}
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </SectionCard>
              );
            })}
          </div>
        )
      ) : (
        <SectionCard>
          <EmptyState
            icon={<SearchOutlined />}
            title={t('mdm.runScanTitle', 'سکانێک ئەنجام بدە')}
            description={t('mdm.runScanHint', 'جۆر و خانە کلیلەکان هەڵبژێرە، پاشان سکانکردن دابگرە بۆ دۆزینەوەی دووبارەکان')}
          />
        </SectionCard>
      )}

      {/* ── Golden-records table ────────────────────────────────────────── */}
      <SectionCard
        title={t('mdm.goldenRecords', 'تۆمارە زێڕینەکان')}
        subtitle={t('mdm.goldenRecordsHint', 'تۆمارە یەکخراوەکان')}
        extra={
          <Button icon={<ReloadOutlined />} onClick={loadGolden} loading={goldenLoading}>
            {t('refresh', 'نوێکردنەوە')}
          </Button>
        }
      >
        {golden.length === 0 && !goldenLoading ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={t('mdm.noGoldenRecords', 'هێشتا هیچ تۆمارێکی زێڕین نییە')}
          />
        ) : (
          <ResponsiveTableAdapter
            rowKey="id"
            columns={goldenColumns}
            dataSource={golden}
            loading={goldenLoading}
            pagination={{ pageSize: 20 }}
          />
        )}
      </SectionCard>
    </div>
  );
};

export default MdmPage;
