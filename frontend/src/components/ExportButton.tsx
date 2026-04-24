import { useState } from 'react';
import { Button, Dropdown, message } from 'antd';
import { DownloadOutlined, FileExcelOutlined, FileTextOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';

export interface ExportButtonProps {
  /** Backend export endpoint, e.g. "/api/export/invoices". */
  endpoint: string;
  /** Optional filename stem (server suggests one too, this is a fallback). */
  filename?: string;
  /** Extra query params merged into the request. */
  params?: Record<string, string | number | undefined | null>;
  /** Disable the button. */
  disabled?: boolean;
  /** Button size passthrough. */
  size?: 'small' | 'middle' | 'large';
}

const formatLabels: Record<string, { label: string; icon: React.ReactNode }> = {
  excel: { label: 'Excel (.xlsx)', icon: <FileExcelOutlined /> },
  csv: { label: 'CSV (.csv)', icon: <FileTextOutlined /> },
};

function triggerDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

function filenameFromHeaders(headers: any, fallback: string): string {
  const cd: string | undefined = headers?.['content-disposition'];
  if (cd) {
    const match = cd.match(/filename="?([^";]+)"?/i);
    if (match && match[1]) return match[1];
  }
  return fallback;
}

export default function ExportButton({
  endpoint,
  filename,
  params,
  disabled,
  size = 'middle',
}: ExportButtonProps) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState<string | null>(null);

  const run = async (format: 'excel' | 'csv') => {
    setLoading(format);
    try {
      const cleanParams: Record<string, string | number> = { format };
      if (params) {
        Object.entries(params).forEach(([k, v]) => {
          if (v !== undefined && v !== null && v !== '') cleanParams[k] = v;
        });
      }
      const res = await api.get(endpoint, {
        params: cleanParams,
        responseType: 'blob',
      });
      const fallback = `${filename ?? 'export'}.${format === 'excel' ? 'xlsx' : 'csv'}`;
      const name = filenameFromHeaders(res.headers, fallback);
      triggerDownload(res.data as Blob, name);
      message.success(t('export_success'));
    } catch (err: any) {
      message.error(t('export_failed'));
    } finally {
      setLoading(null);
    }
  };

  return (
    <Dropdown
      disabled={disabled}
      menu={{
        items: (['excel', 'csv'] as const).map((fmt) => ({
          key: fmt,
          icon: formatLabels[fmt].icon,
          label: formatLabels[fmt].label,
          onClick: () => run(fmt),
        })),
      }}
    >
      <Button
        icon={<DownloadOutlined />}
        loading={loading !== null}
        size={size}
      >
        {t('export')}
      </Button>
    </Dropdown>
  );
}
