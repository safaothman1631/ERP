import { useEffect, useMemo, useState } from 'react';
import { Button, Space, message, DatePicker, Select } from 'antd';
import { ReloadOutlined, LoginOutlined, LogoutOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import api from '../api';
import { PageHeader, DataTable, StatusTag, type ColumnVisibilityItem } from '../design-system';
import type { ColumnDef } from '../design-system/DataTable';
import KitListCard from '../design-system/KitListCard';
import KitListToolbarActions from '../design-system/KitListToolbarActions';
import KitRowActions from '../design-system/KitRowActions';
import KitFiltersButton from '../design-system/KitFiltersButton';
import KitSearchInput from '../design-system/KitSearchInput';
import { downloadCsv } from '../utils/exportCsv';

interface Att { id: string; employee_id: string; check_in?: string; check_out?: string; duration_hours?: number; }
interface Emp { id: string; name: string; }

/** Initials for the kit's avatar cell (first letters of the first two words). */
const initialsOf = (name: string): string =>
  String(name || '?')
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

export default function HRAttendance() {
  const { t } = useTranslation();
  const [list, setList] = useState<Att[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [emp, setEmp] = useState<string | undefined>();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>([dayjs().startOf('month'), dayjs()]);
  const [search, setSearch] = useState('');
  const [hiddenCols, setHiddenCols] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('hr_attendance.hiddenCols') || '[]'); } catch { return []; }
  });

  const load = async () => {
    const params: Record<string, string> = {};
    if (emp) params.employee_id = emp;
    if (range) { params.date_from = range[0].format('YYYY-MM-DD'); params.date_to = range[1].format('YYYY-MM-DD'); }
    const [a, e] = await Promise.all([
      api.get('/api/hr/attendance', { params }),
      api.get('/api/hr/employees'),
    ]);
    setList(a.data.items || []);
    setEmps(e.data.items || []);
  };
  useEffect(() => { load();   }, [emp, range]);

  const checkIn = async () => {
    if (!emp) return message.warning(t('select_employee'));
    try { await api.post('/api/hr/attendance/check-in', { employee_id: emp }); message.success(t('checked_in')); load(); }
    catch { message.error(t('error')); }
  };
  const checkOut = async (id: string) => {
    try { await api.post('/api/hr/attendance/check-out', { attendance_id: id }); message.success(t('checked_out')); load(); }
    catch { message.error(t('error')); }
  };

  const allColumns: ColumnDef<Att>[] = [
    {
      title: t('employee'), dataIndex: 'employee_id', key: 'employee_id',
      render: (id: string) => {
        const name = emps.find((e) => e.id === id)?.name || id;
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{
              width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
              background: 'var(--accent-soft)', color: 'var(--accent-500)',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 11, fontWeight: 700,
            }}>{initialsOf(name)}</span>
            <span style={{ color: 'var(--ink-900)', fontWeight: 500 }}>{name}</span>
          </div>
        );
      },
    },
    {
      title: t('check_in'), dataIndex: 'check_in', key: 'check_in',
      render: (d?: string) => d
        ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-700)' }}>{d.slice(0, 19).replace('T', ' ')}</span>
        : <span style={{ color: 'var(--ink-400)' }}>—</span>,
    },
    {
      title: t('check_out'), dataIndex: 'check_out', key: 'check_out',
      render: (d?: string) => d
        ? <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12.5, color: 'var(--ink-700)' }}>{d.slice(0, 19).replace('T', ' ')}</span>
        : <StatusTag status="open" label={t('open')} />,
    },
    {
      title: t('hours'), dataIndex: 'duration_hours', key: 'duration_hours', align: 'right' as const,
      render: (n?: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--ink-900)' }}>{(n || 0).toFixed(2)}</span>
      ),
    },
    {
      title: '', key: 'actions', width: 56, align: 'center' as const,
      render: (_: unknown, r: Att) => !r.check_out
        ? (
          <KitRowActions
            ariaLabel={t('actions')}
            actions={[
              { key: 'check_out', icon: <LogoutOutlined />, label: t('check_out'), onClick: () => checkOut(r.id) },
            ]}
          />
        )
        : null,
    },
  ];

  const filteredData = useMemo(() => {
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter((row: any) => {
      const empName = emps.find((e) => e.id === row.employee_id)?.name || '';
      return Object.values({ ...row, employee_name: empName }).some(
        (v) => String(v ?? '').toLowerCase().includes(q),
      );
    });
  }, [list, emps, search]);
  const columns = useMemo(() => allColumns.filter((c) => !hiddenCols.includes(c.key as string)), [hiddenCols, emps, t]);
  const columnsMeta: ColumnVisibilityItem[] = allColumns.map((c) => ({
    key: c.key as string,
    label: typeof c.title === 'string' ? c.title : (c.key as string),
    pinned: c.key === 'employee_id' || c.key === 'actions',
  }));
  const persistHidden = (next: string[]) => {
    setHiddenCols(next);
    try { localStorage.setItem('hr_attendance.hiddenCols', JSON.stringify(next)); } catch { /* noop */ }
  };

  const activeFilterCount = (emp ? 1 : 0) + (range ? 1 : 0);

  return (
    <div data-section-id="hr.attendance">
      <PageHeader
        title={t('attendance')}
        sectionId="hr.attendance"
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
            <Button type="primary" icon={<LoginOutlined />} onClick={checkIn} disabled={!emp}>{t('check_in')}</Button>
          </Space>
        }
      />
      <KitListCard
        toolbar={
          <>
            <KitSearchInput
              value={search}
              onChange={(v) => { setSearch(v); }}
              placeholder={t('search')}
            />
            <KitFiltersButton
              activeCount={activeFilterCount}
              onClear={() => { setEmp(undefined); setRange(null); }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--ink-700)' }}>{t('employee')}</div>
                  <Select
                    value={emp}
                    onChange={(v) => setEmp(v || undefined)}
                    options={emps.map((e) => ({ value: e.id, label: e.name }))}
                    placeholder={t('employee')}
                    allowClear
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: 'var(--ink-700)' }}>{t('date_range', 'Date range')}</div>
                  <DatePicker.RangePicker
                    value={range as [Dayjs, Dayjs] | null}
                    onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>
            </KitFiltersButton>
            <div style={{ marginInlineStart: 'auto' }}>
              <KitListToolbarActions
                columns={columnsMeta.filter((c) => c.key !== 'actions')}
                hiddenCols={hiddenCols}
                onColumnsChange={persistHidden}
                onExport={() => {
                  const cols = columnsMeta.filter((c) => !hiddenCols.includes(c.key) && c.key !== 'actions');
                  downloadCsv('hr_attendance', list, cols);
                }}
                onPrint={() => window.print()}
                onImport={() => message.info(t('coming_soon', 'Coming soon'))}
                onSavedViews={() => message.info(t('coming_soon', 'Coming soon'))}
                onArchive={() => message.info(t('coming_soon', 'Coming soon'))}
              />
            </div>
          </>
        }
      >
        <DataTable rowKey="id" dataSource={filteredData} columns={columns} pagination={{ pageSize: 20 }} />
      </KitListCard>
    </div>
  );
}
