import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Steps, Card, Upload, Button, Select, Table, Row, Col, Space, Form, Typography, Tag, Alert, message } from 'antd';
import { InboxOutlined, CloudUploadOutlined, CheckCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import type { RcFile } from 'antd/es/upload';
import api from '../../api';
import { PageHeader } from '../../design-system';

const { Dragger } = Upload;
const { Text, Title } = Typography;

interface ParsedTransaction {
  date: string;
  amount: number;
  description: string;
  reference: string;
  debit_or_credit: string;
}

interface PreviewResult {
  format: string;
  total_parsed: number;
  unique_count: number;
  duplicate_count: number;
  preview: ParsedTransaction[];
}

const ImportStatement: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { accountId } = useParams<{ accountId: string }>();
  
  const [current, setCurrent] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [format, setFormat] = useState<string>('');
  const [mapping, setMapping] = useState<Record<string, string>>({
    date_col: 'Date',
    amount_col: 'Amount',
    description_col: 'Description',
    reference_col: 'Reference',
    sign_col: 'Type',
    credit_label: 'CR',
    date_format: '%Y-%m-%d'
  });
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [csvPreviewRows, setCsvPreviewRows] = useState<string[][]>([]);

  const handleFileSelect = (file: RcFile) => {
    setFile(file);
    const ext = file.name.toLowerCase();
    
    if (ext.endsWith('.csv')) {
      setFormat('csv');
      // Parse first 3 rows for preview
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const lines = text.split('\n').slice(0, 4);
        if (lines.length > 0) {
          const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
          setCsvHeaders(headers);
          const rows = lines.slice(1).map(line => line.split(',').map(c => c.trim().replace(/"/g, '')));
          setCsvPreviewRows(rows);
        }
      };
      reader.readAsText(file);
      setCurrent(1);
    } else if (ext.endsWith('.ofx') || ext.endsWith('.qfx')) {
      setFormat('ofx');
      setCurrent(2);
      handlePreview(file, 'ofx');
    } else if (ext.endsWith('.sta') || ext.endsWith('.mt940')) {
      setFormat('mt940');
      setCurrent(2);
      handlePreview(file, 'mt940');
    } else {
      message.error(t('unsupported_format'));
      return false;
    }
    
    return false;
  };

  const handleMappingNext = () => {
    if (!file) return;
    handlePreview(file, format);
  };

  const handlePreview = async (fileToPreview: File, fileFormat: string) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', fileToPreview);
      formData.append('format', fileFormat);
      if (fileFormat === 'csv') {
        formData.append('mapping_json', JSON.stringify(mapping));
      }
      
      const r = await api.post(`/api/banking/accounts/${accountId}/import-preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setPreview(r.data);
      setCurrent(2);
    } catch {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('format', format);
      if (format === 'csv') {
        formData.append('mapping_json', JSON.stringify(mapping));
      }
      
      const r = await api.post(`/api/banking/accounts/${accountId}/import-statement`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      message.success(`${t('imported')}: ${r.data.imported}, ${t('skipped')}: ${r.data.skipped}`);
      setCurrent(3);
    } catch {
      message.error(t('error'));
    } finally {
      setImporting(false);
    }
  };

  const fmtIQD = (v: number) => `${new Intl.NumberFormat('en-US').format(v || 0)} د.ع`;

  const previewColumns = [
    { title: t('date'), dataIndex: 'date', key: 'date', render: (d: string) => d?.substring(0, 10) },
    { title: t('description'), dataIndex: 'description', key: 'description' },
    { 
      title: t('amount'), 
      dataIndex: 'amount', 
      key: 'amount',
      render: (v: number) => <span style={{ color: v >= 0 ? '#52c41a' : '#f5222d' }}>{fmtIQD(v)}</span>
    },
    { 
      title: t('type'), 
      dataIndex: 'debit_or_credit', 
      key: 'type',
      render: (v: string) => <Tag color={v === 'credit' ? 'green' : 'red'}>{t(v)}</Tag>
    },
  ];

  const steps = [
    { title: t('select_file'), icon: <InboxOutlined /> },
    { title: t('mapping'), icon: <CloudUploadOutlined /> },
    { title: t('preview'), icon: <CheckCircleOutlined /> },
    { title: t('import'), icon: <CheckCircleOutlined /> },
  ];

  return (
    <div>
      <PageHeader
        title={t('import_statement')}
        subtitle={t('import_statement_subtitle', 'هێنانی بیانوویی بانکی')}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(`/banking/${accountId}/reconciliation`)}>
            {t('back_to_reconciliation')}
          </Button>
        }
      />

      <Card style={{ maxWidth: 900, margin: '0 auto' }}>
        <Steps current={current} items={steps} style={{ marginBottom: 32 }} />

        {current === 0 && (
          <Dragger
            name="file"
            multiple={false}
            beforeUpload={handleFileSelect}
            showUploadList={false}
            accept=".csv,.ofx,.qfx,.sta,.mt940"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined style={{ fontSize: 48, color: '#2563eb' }} />
            </p>
            <p className="ant-upload-text">{t('click_or_drag')}</p>
            <p className="ant-upload-hint">{t('supported_formats')}: CSV, OFX, MT940</p>
          </Dragger>
        )}

        {current === 1 && format === 'csv' && (
          <div>
            <Title level={5}>{t('column_mapping')}</Title>
            <Alert
              message={t('csv_mapping_hint')}
              description={t('csv_mapping_description', 'نیشانی بە ستوونەکان بدە')}
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Card title={t('preview_first_rows')} size="small" style={{ marginBottom: 16 }}>
              <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {csvHeaders.map((h, i) => (
                      <th key={i} style={{ border: '1px solid #ddd', padding: 4, background: '#f5f5f5' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {csvPreviewRows.map((row, ri) => (
                    <tr key={ri}>
                      {row.map((cell, ci) => (
                        <td key={ci} style={{ border: '1px solid #ddd', padding: 4 }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Form layout="vertical">
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label={t('date_column')}>
                    <Select
                      value={mapping.date_col}
                      onChange={(v) => setMapping({...mapping, date_col: v})}
                      options={csvHeaders.map(h => ({ label: h, value: h }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('amount_column')}>
                    <Select
                      value={mapping.amount_col}
                      onChange={(v) => setMapping({...mapping, amount_col: v})}
                      options={csvHeaders.map(h => ({ label: h, value: h }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('description_column')}>
                    <Select
                      value={mapping.description_col}
                      onChange={(v) => setMapping({...mapping, description_col: v})}
                      options={csvHeaders.map(h => ({ label: h, value: h }))}
                    />
                  </Form.Item>
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Form.Item label={t('reference_column')}>
                    <Select
                      value={mapping.reference_col}
                      onChange={(v) => setMapping({...mapping, reference_col: v})}
                      allowClear
                      placeholder={t('optional')}
                      options={csvHeaders.map(h => ({ label: h, value: h }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('sign_column')}>
                    <Select
                      value={mapping.sign_col}
                      onChange={(v) => setMapping({...mapping, sign_col: v})}
                      allowClear
                      placeholder={t('optional')}
                      options={csvHeaders.map(h => ({ label: h, value: h }))}
                    />
                  </Form.Item>
                </Col>
                <Col span={8}>
                  <Form.Item label={t('credit_label')}>
                    <Select
                      value={mapping.credit_label}
                      onChange={(v) => setMapping({...mapping, credit_label: v})}
                      options={[
                        { label: 'CR', value: 'CR' },
                        { label: 'Credit', value: 'Credit' },
                        { label: 'C', value: 'C' },
                      ]}
                    />
                  </Form.Item>
                </Col>
              </Row>
            </Form>

            <Space>
              <Button onClick={() => setCurrent(0)}>{t('back')}</Button>
              <Button type="primary" onClick={handleMappingNext} loading={loading}>
                {t('next')}
              </Button>
            </Space>
          </div>
        )}

        {current === 2 && preview && (
          <div>
            <Alert
              message={t('preview_result')}
              description={
                <Space direction="vertical">
                  <Text>{t('format')}: <Tag color="blue">{preview.format.toUpperCase()}</Tag></Text>
                  <Text>{t('total_parsed')}: <strong>{preview.total_parsed}</strong></Text>
                  <Text>{t('unique_transactions')}: <strong style={{ color: '#52c41a' }}>{preview.unique_count}</strong></Text>
                  <Text>{t('duplicates_skipped')}: <strong style={{ color: '#f5222d' }}>{preview.duplicate_count}</strong></Text>
                </Space>
              }
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Table
              dataSource={preview.preview}
              columns={previewColumns}
              rowKey={(r, idx) => idx as number}
              pagination={false}
              size="small"
              scroll={{ y: 300 }}
            />

            <Space style={{ marginTop: 16 }}>
              <Button onClick={() => setCurrent(format === 'csv' ? 1 : 0)}>{t('back')}</Button>
              <Button type="primary" onClick={handleImport} loading={importing}>
                {t('confirm_import')}
              </Button>
            </Space>
          </div>
        )}

        {current === 3 && (
          <div style={{ textAlign: 'center', padding: 32 }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
            <Title level={3}>{t('import_complete')}</Title>
            <Text type="secondary">{t('import_complete_message')}</Text>
            <div style={{ marginTop: 24 }}>
              <Space>
                <Button onClick={() => navigate(`/banking/${accountId}/reconciliation`)}>
                  {t('back_to_reconciliation')}
                </Button>
                <Button type="primary" onClick={() => navigate(`/banking/${accountId}/match`)}>
                  {t('smart_match')}
                </Button>
              </Space>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};

export default ImportStatement;
