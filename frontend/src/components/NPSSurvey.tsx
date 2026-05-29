/**
 * NPSSurvey — slide-up survey modal (G2 / R2.15).
 *
 * On mount, queries `/api/nps/should-show`. If the backend says yes, a
 * lightweight survey appears at the bottom of the viewport asking
 * "How likely are you to recommend us, 0-10?" followed by an optional
 * comment field.
 *
 * One-shot per window — the backend marks the prompt as shown, so even
 * if the user dismisses we won't re-prompt until the next milestone.
 */
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Input,
  Modal,
  Radio,
  Space,
  Typography,
  message,
} from 'antd';
import { useTranslation } from 'react-i18next';
import api from '../api';

const { Title, Paragraph } = Typography;

interface ShouldShowResponse {
  should_show: boolean;
  prompt_day: number | null;
  days_since_signup: number | null;
}

export const NPSSurvey: React.FC = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  const [promptDay, setPromptDay] = useState<number | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [comment, setComment] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get<ShouldShowResponse>('/api/nps/should-show')
      .then((res) => {
        if (!alive) return;
        if (res.data?.should_show) {
          setVisible(true);
          setPromptDay(res.data.prompt_day);
        }
      })
      .catch(() => {
        /* silent — survey is opportunistic */
      });
    return () => {
      alive = false;
    };
  }, []);

  const submit = async () => {
    if (score === null) return;
    setSubmitting(true);
    try {
      await api.post('/api/nps/submit', {
        score,
        comment: comment.trim() || undefined,
        prompt_day: promptDay,
      });
      message.success(t('nps.thanks', 'Thanks for the feedback!'));
      setVisible(false);
    } catch (e: any) {
      message.error(e?.response?.data?.detail || t('nps.failed', 'Could not save'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      open={visible}
      onCancel={() => setVisible(false)}
      footer={null}
      title={t('nps.title', 'Quick question')}
      width={420}
      data-testid="nps-survey"
      style={{ top: 'auto', insetBlockEnd: 24, marginInlineEnd: 24 }}
    >
      <Paragraph>
        {t(
          'nps.question',
          'How likely are you to recommend Zoho Kurdish to a colleague? (0 = not likely, 10 = extremely likely)',
        )}
      </Paragraph>

      <Radio.Group
        value={score}
        onChange={(e) => setScore(e.target.value)}
        style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}
      >
        {Array.from({ length: 11 }).map((_, i) => (
          <Radio.Button
            key={i}
            value={i}
            data-testid={`nps-score-${i}`}
            style={{ minWidth: 36, textAlign: 'center' }}
          >
            {i}
          </Radio.Button>
        ))}
      </Radio.Group>

      <Input.TextArea
        rows={3}
        placeholder={t('nps.comment', 'Optional — anything you want to share?')}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        style={{ marginTop: 16 }}
        maxLength={2000}
      />

      <Space style={{ marginTop: 16 }}>
        <Button
          type="primary"
          onClick={submit}
          loading={submitting}
          disabled={score === null}
        >
          {t('nps.submit', 'Submit')}
        </Button>
        <Button type="text" onClick={() => setVisible(false)}>
          {t('nps.notNow', 'Not now')}
        </Button>
      </Space>
    </Modal>
  );
};

NPSSurvey.displayName = 'NPSSurvey';

export default NPSSurvey;
