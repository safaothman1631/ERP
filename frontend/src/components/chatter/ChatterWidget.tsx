import React, { useState } from 'react';
import { Button, Empty, Input, List, Space, Tabs, Typography } from 'antd';
import type { TabsProps } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

import api from '../../api';
import { useListQuery } from '../../api/queries/useListQuery';
import { message } from '../../utils/message';
import ChatterPanel from '../ChatterPanel';

const { Text } = Typography;
const { TextArea } = Input;

interface ChatterWidgetProps {
  entityType: string;
  entityId: string;
}

interface ChatterMessage {
  id: string;
  body: string;
  author_name?: string;
  created_at?: string;
  message_type?: string;
}

export default function ChatterWidget({ entityType, entityId }: ChatterWidgetProps) {
  const { t } = useTranslation();
  const [draftMessage, setDraftMessage] = useState('');

  const messagesQuery = useListQuery<ChatterMessage, { items?: ChatterMessage[]; total?: number }>({
    queryKey: ['chatter', 'messages', entityType, entityId],
    queryFn: () => api.get(`/api/chatter/${entityType}/${entityId}/messages`),
    enabled: Boolean(entityType && entityId),
  });

  const messages = messagesQuery.data?.items ?? [];

  const createMessageMutation = useMutation({
    mutationFn: async (body: string) =>
      api.post(`/api/chatter/${entityType}/${entityId}/messages`, {
        body,
      }),
    onSuccess: async () => {
      setDraftMessage('');
      await messagesQuery.refetch();
      message.success(t('saved'));
    },
    onError: () => {
      message.error(t('error'));
    },
  });

  const handlePostMessage = async () => {
    const body = draftMessage.trim();
    if (!body) return;
    await createMessageMutation.mutateAsync(body);
  };

  const messageTab = (
    <Space direction="vertical" style={{ width: '100%' }}>
      <TextArea
        rows={3}
        value={draftMessage}
        onChange={(e) => setDraftMessage(e.target.value)}
        placeholder={t('chatter.write_message', 'Write a message')}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handlePostMessage}
          loading={createMessageMutation.isPending}
          disabled={!draftMessage.trim()}
        >
          {t('send')}
        </Button>
      </div>

      {messages.length === 0 ? (
        <Empty description={t('chatter.no_messages', 'No messages yet')} />
      ) : (
        <List
          loading={messagesQuery.isLoading}
          dataSource={messages}
          renderItem={(item) => (
            <List.Item key={item.id}>
              <List.Item.Meta
                title={
                  <Space>
                    <Text strong>{item.author_name || t('unknown')}</Text>
                    <Text type="secondary">
                      {item.created_at ? dayjs(item.created_at).format('MMM D, YYYY h:mm A') : ''}
                    </Text>
                  </Space>
                }
                description={item.body}
              />
            </List.Item>
          )}
        />
      )}
    </Space>
  );

  const items: TabsProps['items'] = [
    {
      key: 'activities',
      label: t('chatter.activities'),
      children: <ChatterPanel entityType={entityType} entityId={entityId} />,
    },
    {
      key: 'messages',
      label: t('chatter.messages', 'Messages'),
      children: messageTab,
    },
  ];

  return <Tabs items={items} />;
}

