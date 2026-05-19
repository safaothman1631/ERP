import { useEffect, useState } from 'react';
import { Card, Button, Select, Space, message, Tag, DatePicker } from 'antd';
import { ReloadOutlined, LoginOutlined, LogoutOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import { HelpIcon } from '../help/HelpIcon';
import api from '../api';
import { ResponsiveTableAdapter } from '../components/responsive/ResponsiveTableAdapter';

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
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [emp, range]);

  const checkIn = async () => {
    if (!emp) return message.warning(t('select_employee'));
    try { await api.post('/api/hr/attendance/check-in', { employee_id: emp }); message.success(t('checked_in')); load(); }
    catch { message.error(t('error')); }
  };
  const checkOut = async (id: string) => {
    try { await api.post('/api/hr/attendance/check-out', { attendance_id: id }); message.success(t('checked_out')); load(); }
    catch { message.error(t('error')); }
  };

  const cols = [
    { title: t('employee'), dataIndex: 'employee_id',
      render: (id: string) => emps.find(e => e.id === id)?.name || id },
    { title: t('check_in'), dataIndex: 'check_in', render: (d?: string) => d ? d.slice(0, 19).replace('T', ' ') : '—' },
    { title: t('check_out'), dataIndex: 'check_out', render: (d?: string) => d ? d.slice(0, 19).replace('T', ' ') : <Tag color="orange">{t('open')}</Tag> },
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
    <div style={{ padding: 16 }} data-section-id="hr.attendance">
      <Space style={{ marginBottom: 12 }} wrap>
        <h2 style={{ margin: 0 }}>{t('attendance')}</h2>
        <HelpIcon sectionId="hr.attendance" />
        <Select
          placeholder={t('employee')}
          allowClear
          style={{ minWidth: 200 }}
          value={emp}
          onChange={setEmp}
          options={emps.map(e => ({ value: e.id, label: e.name }))}
        />
        <DatePicker.RangePicker value={range as [Dayjs, Dayjs] | null} onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)} />
        <Button icon={<ReloadOutlined />} onClick={load}>{t('refresh')}</Button>
        <Button type="primary" icon={<LoginOutlined />} onClick={checkIn} disabled={!emp}>{t('check_in')}</Button>
      </Space>
      <Card><ResponsiveTableAdapter rowKey="id" dataSource={list} columns={cols} pagination={{ pageSize: 20 }} /></Card>
    </div>
  );
}
