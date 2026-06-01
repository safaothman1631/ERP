import React, { useState, useEffect } from 'react';
import {
 Row, Col, Form, Select, Button, Space,
 Input, message, Divider
} from 'antd';
import { PlayCircleOutlined, SaveOutlined, PlusOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { useNavigate } from 'react-router-dom';
import { PageHeader, SectionCard, StatusTag } from '../../design-system';
import { FormDialog } from '../../components/responsive/FormDialog';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

interface FilterCondition {
 field: string;
 operator: string;
 value: any;
}

const CustomReportBuilder: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [form] = Form.useForm();
 const [saveForm] = Form.useForm();

 const [availableFields, setAvailableFields] = useState<Record<string, string>>({});
 const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
 const [filters, setFilters] = useState<FilterCondition[]>([]);
 const [resultData, setResultData] = useState<any[]>([]);
 const [resultColumns, setResultColumns] = useState<any[]>([]);
 const [loading, setLoading] = useState(false);
 const [saveModalOpen, setSaveModalOpen] = useState(false);
 const [summary, setSummary] = useState<any>({});

 const source = Form.useWatch('source', form);

 useEffect(() => {
 if (source) {
 fetchFields(source);
 }
 }, [source]);

 const fetchFields = async (dataSource: string) => {
 try {
 const response = await api.get(`/api/custom-reports/sources/${dataSource}/fields`);
 setAvailableFields(response.data.fields);
 setSelectedColumns([]);
 setFilters([]);
 setResultData([]);
 setResultColumns([]);
 } catch (error) {
 message.error(t('custom_reports.error_loading_fields'));
 console.error(error);
 }
 };

 const handleAddFilter = () => {
 setFilters([...filters, { field: '', operator: 'eq', value: '' }]);
 };

 const handleRemoveFilter = (index: number) => {
 setFilters(filters.filter((_, i) => i !== index));
 };

 const handleFilterChange = (index: number, key: string, value: any) => {
 const newFilters = [...filters];
 newFilters[index] = { ...newFilters[index], [key]: value };
 setFilters(newFilters);
 };

 const handleRun = async () => {
 if (!source || selectedColumns.length === 0) {
 message.warning(t('custom_reports.select_source_and_columns'));
 return;
 }

 try {
 setLoading(true);
 
 // Create a temporary report config
 const reportConfig = {
 name: 'temp_report',
 source,
 columns: selectedColumns,
 filters: filters.filter(f => f.field && f.operator),
 group_by: form.getFieldValue('group_by'),
 sort_by: form.getFieldValue('sort_by'),
 sort_dir: form.getFieldValue('sort_dir') || 'DESC',
 };

 // Create temp report
 const createResponse = await api.post('/api/custom-reports', reportConfig);
 const reportId = createResponse.data.id;

 // Run the report
 const runResponse = await api.post(`/api/custom-reports/${reportId}/run`, {
 date_from: form.getFieldValue('date_from'),
 date_to: form.getFieldValue('date_to'),
 });

 setResultData(runResponse.data.rows);
 setSummary(runResponse.data.summary);

 // Build columns for table
 const cols = selectedColumns.map(col => ({
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

 // Delete temp report
 await api.delete(`/api/custom-reports/${reportId}`);

 message.success(t('custom_reports.rows_found', { count: runResponse.data.total_count }));
 } catch (error) {
 message.error(t('custom_reports.error_execution'));
 console.error(error);
 } finally {
 setLoading(false);
 }
 };

 const handleSave = async (values: { name: string }) => {
 if (!source || selectedColumns.length === 0) {
 message.warning(t('custom_reports.select_source_and_columns'));
 return;
 }

 try {
 const reportConfig = {
 name: values.name,
 source,
 columns: selectedColumns,
 filters: filters.filter(f => f.field && f.operator),
 group_by: form.getFieldValue('group_by'),
 sort_by: form.getFieldValue('sort_by'),
 sort_dir: form.getFieldValue('sort_dir') || 'DESC',
 };

 await api.post('/api/custom-reports', reportConfig);
 message.success(t('custom_reports.report_saved'));
 setSaveModalOpen(false);
 saveForm.resetFields();
 navigate('/reports/custom-list');
 } catch (error) {
 message.error(t('custom_reports.error'));
 console.error(error);
 }
 };

 const sourceOptions = [
 { label: t('custom_reports.invoices'), value: 'invoices' },
 { label: t('custom_reports.bills'), value: 'bills' },
 { label: t('custom_reports.sales_orders'), value: 'sales_orders' },
 { label: t('custom_reports.contacts'), value: 'contacts' },
 { label: t('custom_reports.items'), value: 'items' },
 { label: t('custom_reports.journals'), value: 'journals' },
 ];

 const operatorOptions = [
 { label: t('custom_reports.equals'), value: 'eq' },
 { label: t('custom_reports.greater_than'), value: 'gt' },
 { label: t('custom_reports.less_than'), value: 'lt' },
 { label: t('custom_reports.contains'), value: 'contains' },
 { label: t('custom_reports.between'), value: 'between' },
 ];

 const fieldOptions = Object.keys(availableFields).map(key => ({
 label: key,
 value: key,
 }));

 return (
 <div>
 <PageHeader title={t('custom_reports.builder_title')} />
 <Row gutter={24}>
 <Col span={8}>
 <SectionCard title={t('custom_reports.configuration')}>
 <Form form={form} layout="vertical">
 <Form.Item name="source" label={t('custom_reports.data_source')}>
 <Select options={sourceOptions} placeholder={t('custom_reports.select_source')} />
 </Form.Item>

 {source && (
 <>
 <Form.Item label={t('custom_reports.columns')}>
 <Select
 mode="multiple"
 value={selectedColumns}
 onChange={setSelectedColumns}
 options={fieldOptions}
 placeholder={t('custom_reports.select_columns')}
 />
 </Form.Item>

 <Divider>{t('custom_reports.filters')}</Divider>

 {filters.map((filter, index) => (
 <Space key={index} style={{ display: 'flex', marginBottom: 8 }} align="baseline">
 <Select
 style={{ width: 120 }}
 value={filter.field}
 onChange={(val) => handleFilterChange(index, 'field', val)}
 options={fieldOptions}
 placeholder={t('custom_reports.field')}
 />
 <Select
 style={{ width: 100 }}
 value={filter.operator}
 onChange={(val) => handleFilterChange(index, 'operator', val)}
 options={operatorOptions}
 />
 <Input
 style={{ width: 120 }}
 value={filter.value}
 onChange={(e) => handleFilterChange(index, 'value', e.target.value)}
 placeholder={t('custom_reports.value')}
 />
 <Button
 icon={<DeleteOutlined />}
 onClick={() => handleRemoveFilter(index)}
 danger
 />
 </Space>
 ))}

 <Button
 type="dashed"
 icon={<PlusOutlined />}
 onClick={handleAddFilter}
 block
 style={{ marginBottom: 16 }}
 >
 {t('custom_reports.new_filter')}
 </Button>

 <Form.Item name="sort_by" label={t('custom_reports.sort_by')}>
 <Select options={fieldOptions} placeholder={t('custom_reports.field')} allowClear />
 </Form.Item>

 <Form.Item name="sort_dir" label={t('custom_reports.direction')}>
 <Select>
 <Select.Option value="DESC">{t('custom_reports.descending')}</Select.Option>
 <Select.Option value="ASC">{t('custom_reports.ascending')}</Select.Option>
 </Select>
 </Form.Item>
 </>
 )}
 </Form>

 <Space style={{ width: '100%' }} direction="vertical">
 <Button
 type="primary"
 icon={<PlayCircleOutlined />}
 onClick={handleRun}
 loading={loading}
 block
 disabled={!source || selectedColumns.length === 0}
 >
 {t('custom_reports.run')}
 </Button>
 <Button
 icon={<SaveOutlined />}
 onClick={() => setSaveModalOpen(true)}
 block
 disabled={!source || selectedColumns.length === 0}
 >
 {t('custom_reports.save')}
 </Button>
 </Space>
 </SectionCard>
 </Col>

 <Col span={16}>
 <SectionCard title={t('custom_reports.results')}>
 {summary.total_rows > 0 && (
 <div style={{ marginBottom: 16 }}>
 <Space wrap size={[4, 4]}>
 <StatusTag status="info" label={t('custom_reports.total_rows', { count: summary.total_rows })} />
 {Object.entries(summary).map(([key, value]) => {
 if (key !== 'total_rows' && typeof value === 'number') {
 return <StatusTag key={key} status="default" label={`${key}: ${value.toLocaleString()}`} />;
 }
 return null;
 })}
 </Space>
 </div>
 )}

 <ResponsiveTableAdapter
 dataSource={resultData}
 columns={resultColumns}
 loading={loading}
 rowKey={(_, idx) => idx?.toString() || '0'}
 pagination={{ pageSize: 20 }}
 scroll={{ x: 'max-content' }}
 />
 </SectionCard>
 </Col>
 </Row>

 <FormDialog
 title={t('custom_reports.save_report')}
 open={saveModalOpen}
 onClose={() => {
 setSaveModalOpen(false);
 saveForm.resetFields();
 }}
 onOk={() => saveForm.submit()}
 >
 <Form form={saveForm} onFinish={handleSave} layout="vertical">
 <Form.Item
 name="name"
 label={t('custom_reports.report_name')}
 rules={[{ required: true, message: t('custom_reports.enter_name') }]}
 >
 <Input placeholder={t('custom_reports.name')} />
 </Form.Item>
 </Form>
 </FormDialog>
 </div>
 );
};

export default CustomReportBuilder;
