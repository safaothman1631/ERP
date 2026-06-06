import React, { useState } from 'react';
import { Menu, Typography, Collapse, Card } from 'antd';
import { useTranslation } from 'react-i18next';
import {
 FileTextOutlined,
 ShoppingCartOutlined,
 BankOutlined,
 BookOutlined,
 InboxOutlined,
 ProjectOutlined,
 WalletOutlined,
 SettingOutlined,
} from '@ant-design/icons';
import { FormDialog } from './responsive/FormDialog';

const { Title, Paragraph, Text } = Typography;

interface GuideSection {
 key: string;
 icon: React.ReactNode;
 titleKey: string;
 introKey: string;
 topics: { titleKey: string; stepsKey: string }[];
}

interface GuideDrawerProps {
 open: boolean;
 onClose: () => void;
}

const GuideDrawer: React.FC<GuideDrawerProps> = ({ open, onClose }) => {
 const { t, i18n } = useTranslation();
 const isRTL = i18n.language === 'ku';
 const [selectedSection, setSelectedSection] = useState('sales');

 const sections: GuideSection[] = [
 {
 key: 'sales',
 icon: <FileTextOutlined />,
 titleKey: 'guide_sales',
 introKey: 'guide_sales_intro',
 topics: [
 { titleKey: 'guide_sales_invoice', stepsKey: 'guide_sales_invoice_steps' },
 { titleKey: 'guide_sales_quote', stepsKey: 'guide_sales_quote_steps' },
 { titleKey: 'guide_sales_order', stepsKey: 'guide_sales_order_steps' },
 { titleKey: 'guide_sales_credit', stepsKey: 'guide_sales_credit_steps' },
 { titleKey: 'guide_sales_recurring', stepsKey: 'guide_sales_recurring_steps' },
 ],
 },
 {
 key: 'purchases',
 icon: <ShoppingCartOutlined />,
 titleKey: 'guide_purchases',
 introKey: 'guide_purchases_intro',
 topics: [
 { titleKey: 'guide_purchases_bill', stepsKey: 'guide_purchases_bill_steps' },
 { titleKey: 'guide_purchases_po', stepsKey: 'guide_purchases_po_steps' },
 { titleKey: 'guide_purchases_expense', stepsKey: 'guide_purchases_expense_steps' },
 { titleKey: 'guide_purchases_vendor_credit', stepsKey: 'guide_purchases_vendor_credit_steps' },
 ],
 },
 {
 key: 'banking',
 icon: <BankOutlined />,
 titleKey: 'guide_banking',
 introKey: 'guide_banking_intro',
 topics: [
 { titleKey: 'guide_banking_account', stepsKey: 'guide_banking_account_steps' },
 { titleKey: 'guide_banking_transaction', stepsKey: 'guide_banking_transaction_steps' },
 { titleKey: 'guide_banking_reconciliation', stepsKey: 'guide_banking_reconciliation_steps' },
 ],
 },
 {
 key: 'accounting',
 icon: <BookOutlined />,
 titleKey: 'guide_accounting',
 introKey: 'guide_accounting_intro',
 topics: [
 { titleKey: 'guide_accounting_chart', stepsKey: 'guide_accounting_chart_steps' },
 { titleKey: 'guide_accounting_journal', stepsKey: 'guide_accounting_journal_steps' },
 { titleKey: 'guide_accounting_reports', stepsKey: 'guide_accounting_reports_steps' },
 { titleKey: 'guide_accounting_tax', stepsKey: 'guide_accounting_tax_steps' },
 ],
 },
 {
 key: 'inventory',
 icon: <InboxOutlined />,
 titleKey: 'guide_inventory',
 introKey: 'guide_inventory_intro',
 topics: [
 { titleKey: 'guide_inventory_item', stepsKey: 'guide_inventory_item_steps' },
 { titleKey: 'guide_inventory_warehouse', stepsKey: 'guide_inventory_warehouse_steps' },
 { titleKey: 'guide_inventory_adjustment', stepsKey: 'guide_inventory_adjustment_steps' },
 ],
 },
 {
 key: 'projects',
 icon: <ProjectOutlined />,
 titleKey: 'guide_projects',
 introKey: 'guide_projects_intro',
 topics: [
 { titleKey: 'guide_projects_create', stepsKey: 'guide_projects_create_steps' },
 ],
 },
 {
 key: 'assets',
 icon: <WalletOutlined />,
 titleKey: 'guide_assets',
 introKey: 'guide_assets_intro',
 topics: [
 { titleKey: 'guide_assets_create', stepsKey: 'guide_assets_create_steps' },
 ],
 },
 {
 key: 'settings',
 icon: <SettingOutlined />,
 titleKey: 'guide_settings',
 introKey: 'guide_settings_intro',
 topics: [
 { titleKey: 'guide_settings_profile', stepsKey: 'guide_settings_profile_steps' },
 ],
 },
 ];

 const currentSection = sections.find((s) => s.key === selectedSection) ?? sections[0];

 const menuItems = sections.map((s) => ({
 key: s.key,
 icon: s.icon,
 label: t(s.titleKey),
 }));

 const collapseItems = currentSection.topics.map((topic, idx) => ({
 key: String(idx),
 label: <Text strong>{t(topic.titleKey)}</Text>,
 children: (
 <Card
 style={{
 background: 'var(--guide-card-bg, #f6f8fa)',
 border: 'none',
 whiteSpace: 'pre-line',
 }}
 >
 <Paragraph style={{ margin: 0 }}>{t(topic.stepsKey)}</Paragraph>
 </Card>
 ),
 }));

 return (
 <FormDialog
 title={t('guide_title')}
 open={open}
 onClose={onClose}
 hideFooter
 >
 <div style={{ display: 'flex', height: '100%', direction: isRTL ? 'rtl' : 'ltr' }}>
 {/* Sidebar menu */}
 <div
 style={{
 width: 200,
 minWidth: 200,
 borderInlineEnd: '1px solid var(--border)',
 overflowY: 'auto',
 }}
 >
 <Menu
 mode="inline"
 selectedKeys={[selectedSection]}
 items={menuItems}
 onClick={({ key }) => setSelectedSection(key)}
 style={{ borderInlineEnd: 'none', height: '100%' }}
 />
 </div>

 {/* Content area */}
 <div style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
 <Title level={4}>{t(currentSection.titleKey)}</Title>
 <Paragraph type="secondary" style={{ marginBottom: 20 }}>
 {t(currentSection.introKey)}
 </Paragraph>
 <Paragraph style={{ marginBottom: 16 }}>
 {t('guide_intro')}
 </Paragraph>
 <Collapse
 accordion
 items={collapseItems}
 defaultActiveKey={['0']}
 style={{ background: 'transparent' }}
 />
 </div>
 </div>
 </FormDialog>
 );
};

export default GuideDrawer;
