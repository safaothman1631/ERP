import React, { useEffect, useState } from 'react';
import {
 Card, Upload, Button, Space, Tag, message, Row, Col, Descriptions, Typography } from 'antd';
import type { TableProps } from 'antd';
import type { UploadFile, UploadProps } from 'antd';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { InboxOutlined, ReloadOutlined, EyeOutlined, PlusOutlined } from '@ant-design/icons';
import { PageHeader } from '../../design-system';
import api from '../../api';
import { FormDialog } from '../../components/responsive/FormDialog';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const { Dragger } = Upload;
const { Text } = Typography;

interface ExtractedField {
 vendor?: string;
 date?: string;
 total?: number;
 tax?: number;
 subtotal?: number;
 currency?: string;
 items?: Array<{ description: string; amount: number }>;
}

interface OCRJob {
 id: string;
 file_url?: string;
 document_type?: string;
 status?: string;
 extracted_text?: string;
 extracted_fields?: ExtractedField;
 created_at?: string;
 completed_at?: string;
}

const OCRReceiptsAdvanced: React.FC = () => {
 const { t } = useTranslation();
 const navigate = useNavigate();
 const [data, setData] = useState<OCRJob[]>([]);
 const [loading, setLoading] = useState(false);
 const [uploading, setUploading] = useState(false);
 const [fileList, setFileList] = useState<UploadFile[]>([]);
 const [drawerVisible, setDrawerVisible] = useState(false);
 const [selectedJob, setSelectedJob] = useState<OCRJob | null>(null);

 const fetchJobs = async () => {
 setLoading(true);
 try {
 const res = await api.get('/api/ai/ocr', { params: { limit: 500 } });
 setData(res.data.items || []);
 } catch {
 message.error(t('error'));
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 void fetchJobs();
 }, []);

 const uploadProps: UploadProps = {
 name: 'file',
 multiple: true,
 accept: 'image/*',
 fileList,
 onChange(info) {
 setFileList(info.fileList);
 },
 customRequest: async ({ file, onSuccess, onError }) => {
 setUploading(true);
 try {
 // Create job in backend
 const jobPayload = {
 file_url: `uploads/${(file as File).name}`,
 document_type: 'receipt',
 language: 'ar',
 };
 const res = await api.post('/api/ai/ocr', jobPayload);
 const jobId = res.data.id;

 // Simulate processing (in production, upload to storage and trigger OCR)
 setTimeout(async () => {
 try {
 await api.post(`/api/ai/ocr/${jobId}/complete`, {
 text: 'Sample extracted text',
 fields: {
 vendor: 'Sample Vendor',
 date: new Date().toISOString().substring(0, 10),
 total: Math.floor(Math.random() * 100000),
 currency: 'IQD',
 },
 });
 await fetchJobs();
 message.success(t('ai.ocr_completed'));
 } catch {
 message.error(t('error'));
 }
 }, 2000);

 onSuccess?.(res.data);
 message.success(t('ai.ocr_upload_success'));
 } catch (err) {
 onError?.(err as Error);
 message.error(t('error'));
 } finally {
 setUploading(false);
 }
 },
 onRemove: (file) => {
 setFileList((prev) => prev.filter((f) => f.uid !== file.uid));
 },
 };

 const showDetails = (job: OCRJob) => {
 setSelectedJob(job);
 setDrawerVisible(true);
 };

 const createExpense = (job: OCRJob) => {
 const fields = job.extracted_fields;
 if (!fields) {
 message.warning(t('ai.no_extracted_fields'));
 return;
 }
 // Navigate to expense form with pre-filled data
 const params = new URLSearchParams({
 vendor: fields.vendor || '',
 date: fields.date || '',
 amount: String(fields.total || 0),
 });
 navigate(`/expenses?${params.toString()}`);
 };

 const columns: TableProps<OCRJob>['columns'] = [
 {
 title: t('ai.document_type'),
 dataIndex: 'document_type',
 key: 'document_type',
 render: (val?: string) => <Tag color="blue">{val || 'receipt'}</Tag>,
 },
 {
 title: t('ai.vendor'),
 key: 'vendor',
 render: (_, record: OCRJob) => record.extracted_fields?.vendor || '—',
 },
 {
 title: t('ai.total'),
 key: 'total',
 render: (_, record: OCRJob) => {
 const total = record.extracted_fields?.total;
 const currency = record.extracted_fields?.currency || 'IQD';
 return total ? `${total.toLocaleString()} ${currency}` : '—';
 },
 },
 {
 title: t('status'),
 dataIndex: 'status',
 key: 'status',
 render: (val?: string) => {
 const colors: Record<string, string> = {
 'in-progress': 'processing',
 completed: 'success',
 failed: 'error',
 };
 return <Tag color={colors[val || 'in-progress']}>{val || 'in-progress'}</Tag>;
 },
 },
 {
 title: t('ai.created_at'),
 dataIndex: 'created_at',
 key: 'created_at',
 render: (val?: string) => val?.substring(0, 16).replace('T', ' ') || '—',
 },
 {
 title: t('actions'),
 key: 'actions',
 render: (_, record: OCRJob) => (
 <Space>
 <Button icon={<EyeOutlined />} onClick={() => showDetails(record)}>
 {t('view')}
 </Button>
 {record.status === 'completed' && (
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => createExpense(record)}
 >
 {t('ai.create_expense')}
 </Button>
 )}
 </Space>
 ),
 },
 ];

 return (
 <div>
 <PageHeader
 title={t('ai.ocr_advanced_title')}
 subtitle={t('ai.ocr_advanced_subtitle')}
 extra={
 <Button icon={<ReloadOutlined />} onClick={fetchJobs}>
 {t('refresh')}
 </Button>
 }
 />

 <Row gutter={[16, 16]}>
 <Col xs={24} lg={8}>
 <Card title={t('ai.upload_receipts')}>
 <Dragger {...uploadProps} disabled={uploading}>
 <p className="ant-upload-drag-icon">
 <InboxOutlined />
 </p>
 <p className="ant-upload-text">{t('ai.drag_drop_receipt')}</p>
 <p className="ant-upload-hint">
 {t('ai.upload_hint')}
 </p>
 </Dragger>
 </Card>
 </Col>

 <Col xs={24} lg={16}>
 <Card title={t('ai.ocr_jobs')}>
 <ResponsiveTableAdapter
 columns={columns}
 dataSource={data}
 rowKey="id"
 loading={loading}
 pagination={{ pageSize: 10 }}
 />
 </Card>
 </Col>
 </Row>

 <FormDialog
 title={t('ai.ocr_job_details')}
 open={drawerVisible}
 onClose={() => setDrawerVisible(false)}
 >
 {selectedJob && (
 <>
 <Descriptions column={1} bordered>
 <Descriptions.Item label={t('ai.document_type')}>
 <Tag color="blue">{selectedJob.document_type || 'receipt'}</Tag>
 </Descriptions.Item>
 <Descriptions.Item label={t('status')}>
 <Tag
 color={
 selectedJob.status === 'completed'
 ? 'success'
 : selectedJob.status === 'failed'
 ? 'error'
 : 'processing'
 }
 >
 {selectedJob.status || 'in-progress'}
 </Tag>
 </Descriptions.Item>
 <Descriptions.Item label={t('ai.created_at')}>
 {selectedJob.created_at?.substring(0, 16).replace('T', ' ') || '—'}
 </Descriptions.Item>
 {selectedJob.completed_at && (
 <Descriptions.Item label={t('ai.completed_at')}>
 {selectedJob.completed_at.substring(0, 16).replace('T', ' ')}
 </Descriptions.Item>
 )}
 </Descriptions>

 {selectedJob.extracted_fields && (
 <Card
 title={t('ai.extracted_fields')}
 style={{ marginTop: 16 }}
 extra={
 <Button
 type="primary"
 icon={<PlusOutlined />}
 onClick={() => createExpense(selectedJob)}
 >
 {t('ai.create_expense')}
 </Button>
 }
 >
 <Descriptions column={1}>
 {selectedJob.extracted_fields.vendor && (
 <Descriptions.Item label={t('ai.vendor')}>
 {selectedJob.extracted_fields.vendor}
 </Descriptions.Item>
 )}
 {selectedJob.extracted_fields.date && (
 <Descriptions.Item label={t('date')}>
 {selectedJob.extracted_fields.date}
 </Descriptions.Item>
 )}
 {selectedJob.extracted_fields.total !== undefined && (
 <Descriptions.Item label={t('ai.total')}>
 <Text strong>
 {selectedJob.extracted_fields.total.toLocaleString()}{' '}
 {selectedJob.extracted_fields.currency || 'IQD'}
 </Text>
 </Descriptions.Item>
 )}
 {selectedJob.extracted_fields.tax !== undefined && (
 <Descriptions.Item label={t('tax')}>
 {selectedJob.extracted_fields.tax.toLocaleString()}
 </Descriptions.Item>
 )}
 {selectedJob.extracted_fields.subtotal !== undefined && (
 <Descriptions.Item label={t('subtotal')}>
 {selectedJob.extracted_fields.subtotal.toLocaleString()}
 </Descriptions.Item>
 )}
 </Descriptions>

 {selectedJob.extracted_fields.items &&
 selectedJob.extracted_fields.items.length > 0 && (
 <div style={{ marginTop: 12 }}>
 <Text strong>{t('items')}:</Text>
 {selectedJob.extracted_fields.items.map((item, idx) => (
 <div
 key={idx}
 style={{
 padding: '8px 0',
 borderBottom: '1px solid #f0f0f0',
 }}
 >
 <Space style={{ width: '100%', justifyContent: 'space-between' }}>
 <Text>{item.description}</Text>
 <Text>{item.amount.toLocaleString()}</Text>
 </Space>
 </div>
 ))}
 </div>
 )}
 </Card>
 )}

 {selectedJob.extracted_text && (
 <Card title={t('ai.raw_text')} style={{ marginTop: 16 }}>
 <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
 {selectedJob.extracted_text}
 </pre>
 </Card>
 )}
 </>
 )}
 </FormDialog>
 </div>
 );
};

export default OCRReceiptsAdvanced;
