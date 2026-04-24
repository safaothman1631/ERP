import React from 'react';
import { Space, Button, Tag, Divider, Typography, Row, Col, Input } from 'antd';
import {
  PageHeader, KpiCard, StatusTag, EmptyState, MoneyInput, FilterBar,
  DataTable, ConfirmDialog, SectionCard, KeyValueGrid, KbdHint, LoadingSkeleton, cmdKey,
} from '../design-system';
import {
  palette, space, radius, status, typography, dataViz, zIndex,
} from '../theme/tokens';
import { ShoppingOutlined, PlusOutlined, InboxOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

/**
 * UIKit — sandbox بۆ هەموو design-system primitives.
 * Sprint 1 deliverable. /ui-kit route.
 */
const UIKit: React.FC = () => {
  const [confirmOpen, setConfirmOpen] = React.useState(false);

  const sampleColumns = [
    { title: 'ناو', dataIndex: 'name' },
    { title: 'وەزع', dataIndex: 'status', render: (s: string) => <StatusTag status={s as 'success'|'warning'|'danger'|'info'} label={s} /> },
    { title: 'بڕ', dataIndex: 'amount', render: (n: number) => `${n.toFixed(2)} د.ع.` },
  ];
  const sampleData = [
    { key: 1, name: 'فاکتوور ١', status: 'success', amount: 1200 },
    { key: 2, name: 'فاکتوور ٢', status: 'warning', amount: 800 },
    { key: 3, name: 'فاکتوور ٣', status: 'danger', amount: 450 },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space.xl }}>
      <PageHeader
        title="UI Kit"
        subtitle="Sandbox بۆ هەموو design-system primitives — Sprint 1 deliverable"
        breadcrumb={[{ label: 'سەرەکی', to: '/' }, { label: 'UI Kit' }]}
        extra={[
          <Button key="add" type="primary" icon={<PlusOutlined />}>دروستکردنی نوێ</Button>,
        ]}
      />

      {/* Tokens */}
      <SectionCard title="Color Palette" subtitle="Brand + Status + Data Viz">
        <Space direction="vertical" size={space.md} style={{ width: '100%' }}>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Primary scale</Text>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              {[50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map(n => (
                <div key={n} style={{
                  width: 60, height: 40, borderRadius: radius.sm,
                  background: (palette as Record<string, string>)[`primary${n}`],
                  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
                  color: n >= 500 ? '#fff' : palette.ink900, fontSize: 10, padding: 4,
                }}>{n}</div>
              ))}
            </div>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Status</Text>
            <Space style={{ marginTop: 6 }}>
              {(['success','warning','danger','info','neutral'] as const).map(k => (
                <div key={k} style={{
                  padding: `${space.xs}px ${space.md}px`,
                  background: status[k].bg, color: status[k].fg,
                  border: `1px solid ${status[k].border}`, borderRadius: radius.sm, fontSize: 12,
                }}>{k}</div>
              ))}
            </Space>
          </div>
          <div>
            <Text type="secondary" style={{ fontSize: 12 }}>Data Viz (categorical)</Text>
            <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
              {dataViz.categorical.map((c, i) => (
                <div key={i} style={{ width: 36, height: 36, background: c, borderRadius: radius.sm }} />
              ))}
            </div>
          </div>
        </Space>
      </SectionCard>

      {/* Typography */}
      <SectionCard title="Typography Scale">
        <Space direction="vertical" size={space.sm} style={{ width: '100%' }}>
          {(Object.keys(typography) as Array<keyof typeof typography>).map(k => {
            const t = typography[k];
            return (
              <div key={k} style={{ display: 'flex', alignItems: 'baseline', gap: space.lg }}>
                <Text type="secondary" style={{ width: 80, fontSize: 12 }}>{k}</Text>
                <span style={{
                  fontSize: t.size, lineHeight: `${t.lh}px`, fontWeight: t.weight,
                  textTransform: 'uppercase' in t && t.uppercase ? 'uppercase' : undefined,
                }}>
                  نموونەی نووسین — Sample text
                </span>
              </div>
            );
          })}
        </Space>
      </SectionCard>

      {/* KPI Cards */}
      <SectionCard title="MetricCard / KpiCard">
        <Row gutter={[space.md, space.md]}>
          <Col xs={24} sm={12} md={6}><KpiCard title="داهات" value="12,450 د.ع." trend={12.4} /></Col>
          <Col xs={24} sm={12} md={6}><KpiCard title="فاکتوور" value="48" trend={-2.1} /></Col>
          <Col xs={24} sm={12} md={6}><KpiCard title="کڕیار" value="124" trend={5.0} /></Col>
          <Col xs={24} sm={12} md={6}><KpiCard title="پارە لە بانک" value="8,300 د.ع." /></Col>
        </Row>
      </SectionCard>

      {/* Status Tags */}
      <SectionCard title="StatusTag">
        <Space wrap>
          <StatusTag status="success" label="پەسەندکراو" />
          <StatusTag status="warning" label="چاوەڕوان" />
          <StatusTag status="danger" label="ڕەتکراو" />
          <StatusTag status="info" label="زانیاری" />
          <StatusTag status="neutral" label="چالاک نییە" />
        </Space>
      </SectionCard>

      {/* KeyValueGrid */}
      <SectionCard title="KeyValueGrid">
        <KeyValueGrid columns={3} items={[
          { label: 'ژمارەی فاکتوور', value: 'INV-2026-0042', copyable: true },
          { label: 'کڕیار', value: 'کۆمپانیای ئاسۆ' },
          { label: 'بەروار', value: '٢٠٢٦/٠٤/٢٤' },
          { label: 'بڕی گشتی', value: '1,250 د.ع.' },
          { label: 'باج', value: '12 د.ع.' },
          { label: 'وەزع', value: <StatusTag status="success" label="پارەدراو" /> },
          { label: 'تێبینی', value: 'فاکتووری مانگانە بۆ مانگی نیسان', span: 3 },
        ]} />
      </SectionCard>

      {/* KbdHint */}
      <SectionCard title="KbdHint" subtitle="Keyboard shortcut chips">
        <Space>
          <span>کۆمانتەری palette: <KbdHint keys={[cmdKey, 'K']} /></span>
          <Divider type="vertical" />
          <span>داخستن: <KbdHint keys={['Esc']} /></span>
          <Divider type="vertical" />
          <span>tab نوێ: <KbdHint keys={[cmdKey, 'T']} size="md" /></span>
        </Space>
      </SectionCard>

      {/* MoneyInput */}
      <SectionCard title="MoneyInput">
        <Row gutter={space.md}>
          <Col xs={24} md={12}><MoneyInput placeholder="بڕ (د.ع.)" /></Col>
          <Col xs={24} md={12}><Input placeholder="نموونەی AntD ئاسایی" /></Col>
        </Row>
      </SectionCard>

      {/* FilterBar */}
      <SectionCard title="FilterBar / DataToolbar">
        <FilterBar
          searchPlaceholder="گەڕان..."
          onSearchChange={() => {}}
          filters={[
            { key: 'status', label: 'وەزع', options: [
              { value: 'open', label: 'کراوە' }, { value: 'closed', label: 'داخراو' },
            ] },
          ]}
          onReset={() => {}}
        />
      </SectionCard>

      {/* DataTable */}
      <SectionCard title="DataTable" padded={false}>
        <DataTable columns={sampleColumns} dataSource={sampleData} pagination={false} />
      </SectionCard>

      {/* EmptyState */}
      <SectionCard title="EmptyState">
        <EmptyState
          icon={<InboxOutlined />}
          title="هیچ داتایەک نییە"
          description="هیچ تۆمارێک تا ئێستا تۆمار نەکراوە. یەکەم نموونە دروست بکە."
          actionLabel="دروستکردن"
          onAction={() => {}}
        />
      </SectionCard>

      {/* LoadingSkeleton */}
      <SectionCard title="LoadingSkeleton">
        <Space direction="vertical" size={space.lg} style={{ width: '100%' }}>
          <div>
            <Text type="secondary">variant=&quot;kpis&quot;</Text>
            <LoadingSkeleton variant="kpis" count={4} />
          </div>
          <div>
            <Text type="secondary">variant=&quot;table&quot;</Text>
            <LoadingSkeleton variant="table" rows={3} />
          </div>
        </Space>
      </SectionCard>

      {/* ConfirmDialog */}
      <SectionCard title="ConfirmDialog">
        <Space>
          <Button danger onClick={() => setConfirmOpen(true)}>دەستکردن بە سڕینەوە</Button>
          <Text type="secondary">tone=&quot;danger&quot;</Text>
        </Space>
        <ConfirmDialog
          open={confirmOpen}
          danger
          title="سڕینەوەی فاکتوور"
          description="ئایا دڵنیای لە سڕینەوەی ئەم فاکتوورە؟ ئەم کارە ناگەڕێتەوە."
          okText="بەڵێ، بسڕەوە"
          cancelText="پاشگەزبوونەوە"
          onOk={() => setConfirmOpen(false)}
          onCancel={() => setConfirmOpen(false)}
        />
      </SectionCard>

      {/* Z-Index reference */}
      <SectionCard title="Z-Index Scale">
        <Space wrap>
          {(Object.keys(zIndex) as Array<keyof typeof zIndex>).map(k => (
            <Tag key={k}>{k}: {zIndex[k]}</Tag>
          ))}
        </Space>
      </SectionCard>

      <Title level={5} type="secondary" style={{ textAlign: 'center', marginTop: space.xl }}>
        ✨ Sprint 1 — Design System Foundation تەواوە
      </Title>
    </div>
  );
};

export default UIKit;
