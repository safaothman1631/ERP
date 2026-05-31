import React, { useState, useEffect } from 'react';
import { 
 Button, Space, message, Popconfirm, Card, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, PlayCircleOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { useNavigate } from 'react-router-dom';
import { FormDialog } from '../../components/responsive/FormDialog';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { ListWithEmptyState } from '../../design-system/empty/ListWithEmptyState';

interface CustomReport {
 id: string;
 name: string;
 source: string;
 columns: string[];
 filters: any[];
 created_at: string;
}

const CustomReportsList: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [data, setData] = useState<CustomReport[]>([]);
 const [loading, setLoading] = useState(false);
 const [runModalOpen, setRunModalOpen] = useState(false);
 const [runningReport, setRunningReport] = useState<CustomReport | null>(null);
 const [resultData, setResultData] = useState<any[]>([]);
 const [resultColumns, setResultColumns] = useState<any[]>([]);

 useEffect(() => {
 fetchData();
 }, []);

 const fetchData = async () => {
 try {
 setLoading(true);
 const response = await api.get('/api/custom-reports');
 setData(response.data.items || []);
 } catch (error) {
 message.error(t('custom_reports.error_loading'));
 console.error(error);
 } finally {
 setLoading(false);
 }
 };

 const handleDelete = async (id: string) => {
 try {
 await api.delete(`/api/custom-reports/${id}`);
 message.success(t('custom_reports.deleted'));
 fetchData();
 } catch (error) {
 message.error(t('custom_reports.error'));
 console.error(error);
 }
 };

 const handleRun = async (report: CustomReport) => {
 try {
 setLoading(true);
 const response = await api.post(`/api/custom-reports/${report.id}/run`, {});
 
 setResultData(response.data.rows);
 
 const cols = report.columns.map(col => ({
 title: col,
 dataIndex: col,
 key: col,
 render: (val: any) => {
 if (val === null || val === undefined) return '-';
 if (typeof val === 'number') return val.toLocaleString();
 return String(val);
 },
 }));
 setResultColumns(cols);
 
 setRunningReport(report);
 setRunModalOpen(true);
 message.success(t('custom_reports.rows_found', { count: response.data.total_count }));
 } catch (error) {
 message.error(t('custom_reports.error_execution'));
 console.error(error);
 } finally {
 setLoading(false);
 }
 };

 const sourceLabels: Record<string, string> = {
 invoices: t('custom_reports.invoices'),
 bills: t('custom_reports.bills'),
 sales_orders: t('custom_reports.sales_orders'),
 contacts: t('custom_reports.contacts'),
 items: t('custom_reports.items'),
 journals: t('custom_reports.journals'),
 };

 const columns = [
 {
 title: t('custom_reports.name'),
 dataIndex: 'name',
 key: 'name',
 },
 {
 title: t('custom_reports.source'),
 dataIndex: 'source',
 key: 'source',
 render: (source: string) => sourceLabels[source] || source,
 },
 {
 title: t('custom_reports.columns'),
 dataIndex: 'columns',
 key: 'columns',
 render: (cols: string[]) => <Tag>{t('custom_reports.columns_count', { count: cols.length })}</Tag>,
 },
 {
 title: t('custom_reports.filters'),
 dataIndex: 'filters',
 key: 'filters',
 render: (filters: any[]) => <Tag>{t('custom_reports.filters_count', { count: filters.length })}</Tag>,
 },
 {
 title: t('custom_reports.created_at'),
 dataIndex: 'created_at',
 key: 'created_at',
 render: (date: string) => new Date(date).toLocaleDateString('ckb'),
 },
 {
 title: t('custom_reports.actions'),
 key: 'actions',
 render: (_: any, record: CustomReport) => (
 <Space>
 <Button
 type="link"
 icon={<PlayCircleOutlined />}
 onClick={() => handleRun(record)}
 >
 {t('custom_reports.execute')}
 </Button>
 <Button
 type="link"
 icon={<EyeOutlined />}
 onClick={() => navigate(`/reports/custom?id=${record.id}`)}
 >
 {t('custom_reports.view')}
 </Button>
 <Popconfirm
 title={t('custom_reports.confirm_delete')}
 onConfirm={() => handleDelete(record.id)}
 >
 <Button type="link" danger icon={<DeleteOutlined />}>
 {t('custom_reports.delete')}
 </Button>
 </Popconfirm>
 </Space>
 ),
 },
 ];

 return (
 <Card>
 <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
 <h2>{t('custom_reports.list_title')}</h2>
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => navigate('/reports/custom')}
 >
 {t('custom_reports.new_report')}
 </Button>
 </div>

 <ListWithEmptyState
 entity="report"
 data={data}
 loading={loading}
 onCreate={() => navigate('/reports/custom')}
 onRetry={fetchData}
 render={(rows) => (
 <ResponsiveTableAdapter
 dataSource={rows}
 columns={columns}
 loading={loading}
 rowKey="id"
 pagination={{ pageSize: 20 }}
 />
 )}
 />

 <FormDialog
 title={runningReport?.name}
 open={runModalOpen}
 onClose={() => {
 setRunModalOpen(false);
 setRunningReport(null);
 }} hideFooter
 >
 <ResponsiveTableAdapter
 dataSource={resultData}
 columns={resultColumns}
 rowKey={(_, idx) => idx?.toString() || '0'}
 pagination={{ pageSize: 10 }}
 scroll={{ x: 'max-content' }}
 />
 </FormDialog>
 </Card>
 );
};

export default CustomReportsList;
