import React, { useState, useEffect } from 'react';
import { Card, Form, Input, DatePicker, Button, InputNumber, Space, Select, Typography } from 'antd';
import { PlusOutlined, DeleteOutlined, SaveOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { message } from '../../utils/message';
import vendorApi from '../../api/vendorPortal';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';
import { ResponsiveForm } from '../../components/responsive/ResponsiveForm';

const { TextArea } = Input;
const { Title } = Typography;

interface BillLine {
  key: string;
  description: string;
  qty: number;
  unit_price: number;
  tax_rate: number;
  amount: number;
}

const VendorPortalSubmitBill: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [lines, setLines] = useState<BillLine[]>([]);
  const [selectedPO, setSelectedPO] = useState<any>(null);
  const poId = searchParams.get('po_id');

  useEffect(() => {
    if (poId) {
      loadPO();
    }
  }, [poId]);

  const loadPO = async () => {
    try {
      const res = await vendorApi.get(`/api/vendor-portal/me/purchase-orders/${poId}`);
      setSelectedPO(res.data);
      
      // Pre-fill lines from PO
      const poLines: BillLine[] = (res.data.lines || []).map((line: any, idx: number) => ({
        key: `line-${idx}`,
        description: line.description || '',
        qty: line.quantity || 0,
        unit_price: line.unit_price || 0,
        tax_rate: line.tax_rate || 0,
        amount: (line.quantity || 0) * (line.unit_price || 0),
      }));
      setLines(poLines);
    } catch (err: any) {
      message.error(t('portal.load_failed'));
    }
  };

  const addLine = () => {
    setLines([
      ...lines,
      {
        key: `line-${Date.now()}`,
        description: '',
        qty: 1,
        unit_price: 0,
        tax_rate: 0,
        amount: 0,
      },
    ]);
  };

  const removeLine = (key: string) => {
    setLines(lines.filter((line) => line.key !== key));
  };

  const updateLine = (key: string, field: keyof BillLine, value: any) => {
    setLines(
      lines.map((line) => {
        if (line.key === key) {
          const updated = { ...line, [field]: value };
          if (field === 'qty' || field === 'unit_price') {
            updated.amount = updated.qty * updated.unit_price;
          }
          return updated;
        }
        return line;
      })
    );
  };

  const calculateTotals = () => {
    const subtotal = lines.reduce((sum, line) => sum + line.amount, 0);
    const tax = lines.reduce(
      (sum, line) => sum + (line.amount * line.tax_rate) / 100,
      0
    );
    const total = subtotal + tax;
    return { subtotal, tax, total };
  };

  const handleSubmit = async (values: any) => {
    if (lines.length === 0) {
      message.error(t('at_least_one_line'));
      return;
    }

    try {
      setLoading(true);
      const billData = {
        po_id: poId || undefined,
        bill_number: values.bill_number,
        bill_date: values.bill_date.format('YYYY-MM-DD'),
        due_date: values.due_date.format('YYYY-MM-DD'),
        lines: lines.map((line) => ({
          description: line.description,
          qty: line.qty,
          unit_price: line.unit_price,
          tax_rate: line.tax_rate,
        })),
        notes: values.notes || undefined,
      };

      await vendorApi.post('/api/vendor-portal/me/bills', billData);
      message.success(t('vendor_portal.bill_submitted'));
      navigate('/vendor-portal/bills');
    } catch (err: any) {
      if (err.response?.status === 401) {
        message.error(t('vendor_portal.token_invalid'));
        navigate('/vendor-portal/login');
      } else {
        message.error(t('vendor_portal.submit_failed'));
      }
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      title: t('items.description'),
      dataIndex: 'description',
      key: 'description',
      width: '30%',
      render: (_: any, record: BillLine) => (
        <Input
          value={record.description}
          onChange={(e) => updateLine(record.key, 'description', e.target.value)}
          placeholder={t('items.description')}
        />
      ),
    },
    {
      title: t('items.quantity'),
      dataIndex: 'qty',
      key: 'qty',
      width: '12%',
      render: (_: any, record: BillLine) => (
        <InputNumber
          value={record.qty}
          onChange={(val) => updateLine(record.key, 'qty', val || 0)}
          min={0}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('items.unit_price'),
      dataIndex: 'unit_price',
      key: 'unit_price',
      width: '15%',
      render: (_: any, record: BillLine) => (
        <InputNumber
          value={record.unit_price}
          onChange={(val) => updateLine(record.key, 'unit_price', val || 0)}
          min={0}
          precision={2}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('items.tax_rate') + ' (%)',
      dataIndex: 'tax_rate',
      key: 'tax_rate',
      width: '12%',
      render: (_: any, record: BillLine) => (
        <InputNumber
          value={record.tax_rate}
          onChange={(val) => updateLine(record.key, 'tax_rate', val || 0)}
          min={0}
          max={100}
          style={{ width: '100%' }}
        />
      ),
    },
    {
      title: t('items.amount'),
      dataIndex: 'amount',
      key: 'amount',
      width: '15%',
      render: (amount: number) => amount.toFixed(2),
    },
    {
      title: t('common.actions'),
      key: 'actions',
      width: '10%',
      render: (_: any, record: BillLine) => (
        <Button
          type="text"
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeLine(record.key)}
        />
      ),
    },
  ];

  const totals = calculateTotals();

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2}>{t('vendor_portal.submit_bill')}</Title>
        <Button onClick={() => navigate('/vendor-portal/purchase-orders')}>
          {t('back')}
        </Button>
      </div>

      <Card style={{ marginTop: 24 }}>
        {selectedPO && (
          <div style={{ marginBottom: 16, padding: 12, background: '#f0f2f5', borderRadius: 4 }}>
            <strong>{t('vendor_portal.bill_against_po')}:</strong> {selectedPO.number} (
            {selectedPO.date})
          </div>
        )}

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            bill_date: dayjs(),
            due_date: dayjs().add(30, 'days'),
          }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div>
              <Form.Item
                name="bill_number"
                label={t('vendor_portal.bill_number')}
                rules={[{ required: true, message: t('required') }]}
              >
                <Input placeholder="BILL-001" />
              </Form.Item>

              <Space style={{ width: '100%' }}>
                <Form.Item
                  name="bill_date"
                  label={t('vendor_portal.bill_date')}
                  rules={[{ required: true, message: t('required') }]}
                >
                  <DatePicker style={{ width: 200 }} />
                </Form.Item>

                <Form.Item
                  name="due_date"
                  label={t('vendor_portal.due_date')}
                  rules={[{ required: true, message: t('required') }]}
                >
                  <DatePicker style={{ width: 200 }} />
                </Form.Item>
              </Space>
            </div>

            <div>
              <div style={{ marginBottom: 16 }}>
                <Button type="dashed" onClick={addLine} icon={<PlusOutlined />} block>
                  {t('items.add_line')}
                </Button>
              </div>

              <ResponsiveTableAdapter
                dataSource={lines}
                columns={columns}
                pagination={false}
                bordered
                size="small"
              />

              <div style={{ marginTop: 16, textAlign: 'right' }}>
                <Space direction="vertical" align="end" size="small">
                  <div>
                    <strong>{t('invoices.subtotal')}:</strong> {totals.subtotal.toFixed(2)}
                  </div>
                  <div>
                    <strong>{t('invoices.tax')}:</strong> {totals.tax.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 18 }}>
                    <strong>{t('invoices.total')}:</strong> {totals.total.toFixed(2)}
                  </div>
                </Space>
              </div>
            </div>

            <Form.Item name="notes" label={t('notes')}>
              <TextArea rows={3} placeholder={t('optional')} />
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                loading={loading}
                icon={<SaveOutlined />}
                size="large"
                block
              >
                {t('vendor_portal.submit_bill')}
              </Button>
            </Form.Item>
          </Space>
        </Form>
      </Card>
    </div>
  );
};

export default VendorPortalSubmitBill;
