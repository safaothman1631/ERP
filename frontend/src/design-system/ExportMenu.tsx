import React from 'react';
import { Button, Dropdown } from 'antd';
import { ExportOutlined, FileExcelOutlined, FilePdfOutlined, FileTextOutlined, PrinterOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

export type ExportFormat = 'csv' | 'xlsx' | 'pdf' | 'print';

export interface ExportMenuProps {
  /** Provide handler per format. Omit to hide that option. */
  onExport: (format: ExportFormat) => void | Promise<void>;
  formats?: ExportFormat[];
  loading?: boolean;
  size?: 'small' | 'middle' | 'large';
}

/**
 * ExportMenu — Sprint 5 — standardized export dropdown for any list/report.
 */
export const ExportMenu: React.FC<ExportMenuProps> = ({
  onExport, formats = ['csv', 'xlsx', 'pdf', 'print'], loading = false, size = 'middle',
}) => {
  const { t } = useTranslation();

  const ICONS: Record<ExportFormat, React.ReactNode> = {
    csv:   <FileTextOutlined />,
    xlsx:  <FileExcelOutlined />,
    pdf:   <FilePdfOutlined />,
    print: <PrinterOutlined />,
  };
  const LABELS: Record<ExportFormat, string> = {
    csv:   t('export.csv', 'CSV'),
    xlsx:  t('export.xlsx', 'Excel'),
    pdf:   t('export.pdf', 'PDF'),
    print: t('export.print', 'Print'),
  };

  const items = formats.map((f) => ({
    key: f,
    icon: ICONS[f],
    label: LABELS[f],
    onClick: () => { void onExport(f); },
  }));

  return (
    <Dropdown menu={{ items }} trigger={['click']}>
      <Button icon={<ExportOutlined />} loading={loading} size={size} aria-label={t('export.title', 'Export')}>
        {t('export.title', 'Export')}
      </Button>
    </Dropdown>
  );
};

export default ExportMenu;
