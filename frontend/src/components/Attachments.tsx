import React, { useEffect, useState } from 'react';
import { List, Button, Space, Upload, message, Card, Modal } from 'antd';
import { UploadOutlined, DownloadOutlined, DeleteOutlined, PaperClipOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../api';
import { space } from '../theme/tokens';

interface AttachmentsProps {
  entityType: string;
  entityId: string;
}

const Attachments: React.FC<AttachmentsProps> = ({ entityType, entityId }) => {
  const { t } = useTranslation();
  const [attachments, setAttachments] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAttachments = async () => {
    if (!entityId) return;
    setLoading(true);
    try {
      const res = await api.get(`/api/attachments/${entityType}/${entityId}`);
      setAttachments(Array.isArray(res.data) ? res.data : []);
    } catch (_error) {
      message.error(t('error'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchAttachments();
  }, [entityType, entityId]);

  const handleUpload = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    try {
      await api.post(`/api/attachments/${entityType}/${entityId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success(t('attachments.uploaded'));
      void fetchAttachments();
    } catch {
      message.error(t('error'));
    }
    return false; // Prevent default upload behavior
  };

  const handleDownload = (attachment: any) => {
    // In production, this would fetch the actual file from storage
    window.open(attachment.storage_path, '_blank');
  };

  const handleDelete = (attachmentId: string) => {
    Modal.confirm({
      title: t('are_you_sure'),
      onOk: async () => {
        try {
          await api.delete(`/api/attachments/${attachmentId}`);
          message.success(t('success'));
          void fetchAttachments();
        } catch {
          message.error(t('error'));
        }
      },
    });
  };

  return (
    <Card
      title={
        <Space>
          <PaperClipOutlined />
          {t('attachments.title')}
        </Space>
      }
      extra={
        <Upload beforeUpload={handleUpload} showUploadList={false}>
          <Button icon={<UploadOutlined />} size="small">
            {t('attachments.upload')}
          </Button>
        </Upload>
      }
      style={{ marginTop: space.md }}
    >
      <List
        loading={loading}
        dataSource={attachments}
        locale={{ emptyText: t('attachments.empty') }}
        renderItem={(item) => (
          <List.Item
            actions={[
              <Button
                key="download"
                icon={<DownloadOutlined />}
                size="small"
                onClick={() => handleDownload(item)}
              />,
              <Button
                key="delete"
                icon={<DeleteOutlined />}
                size="small"
                danger
                onClick={() => handleDelete(item.id)}
              />,
            ]}
          >
            <List.Item.Meta
              title={item.filename}
              description={`${Math.round(item.size / 1024)} KB • ${item.content_type}`}
            />
          </List.Item>
        )}
      />
    </Card>
  );
};

export default Attachments;
