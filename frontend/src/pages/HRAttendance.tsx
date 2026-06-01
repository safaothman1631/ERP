import { useEffect, useState } from 'react';
import { Button, Space, message, DatePicker } from 'antd';
import { ReloadOutlined, LoginOutlined, LogoutOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import api from '../api';
import { PageHeader, FilterBar, DataTable, StatusTag } from '../design-system';
import type { ColumnDef } from '../design-system/DataTable';

interface Att { id: string; employee_id: string; check_in?: string; check_out?: string; duration_hours?: number; }
interface Emp { id: string; name: string; }

export default function HRAttendance() {
  const { t } = useTranslation();
  const [list, setList] = useState<Att[]>([]);
  const [emps, setEmps] = useState<Emp[]>([]);
  const [emp, setEmp] = useState<string | undefined>();
  const [range, setRange] = useState<[Dayjs, Dayjs] | null>([dayjs().startOf('month'), dayjs()]);

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

  const cols: ColumnDef<Att>[] = [
    { title: t('employee'), dataIndex: 'employee_id',
      render: (id: string) => emps.find(e => e.id === id)?.name || id },
    { title: t('check_in'), dataIndex: 'check_in', render: (d?: string) => d ? d.slice(0, 19).replace('T', ' ') : '—' },
    { title: t('check_out'), dataIndex: 'check_out', render: (d?: string) => d ? d.slice(0, 19).replace('T', ' ') : <StatusTag status="open" label={t('open')} /> },
    { title: t('hours'), dataIndex: 'duration_hours', align: 'right' as const,
      render: (n?: number) => (n || 0).toFixed(2) },
    {
      title: t('actions'),
      render: (_: unknown, r: Att) => !r.check_out
        ? <Button size="small" icon={<LogoutOutlined />} onClick={() => checkOut(r.id)}>{t('check_out')}</Button>
        : null,
    },
  ];

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
      <FilterBar
        filters={[{ key: 'employee', label: t('employee'), options: emps.map(e => ({ value: e.id, label: e.name })) }]}
        values={{ employee: emp }}
        onChange={(v) => setEmp((v.employee as string) || undefined)}
        extra={
          <DatePicker.RangePicker value={range as [Dayjs, Dayjs] | null} onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)} />
        }
      />
      <DataTable rowKey="id" dataSource={list} columns={cols} pagination={{ pageSize: 20 }} />
    </div>
  );
}
