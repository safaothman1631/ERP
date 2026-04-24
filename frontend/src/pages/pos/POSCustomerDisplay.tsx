import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Row, Col, Typography, Spin } from 'antd';
import { posApi } from '../../api';
import { useTranslation } from 'react-i18next';

const { Title, Text } = Typography;

export default function POSCustomerDisplay() {
  const { configId } = useParams<{ configId: string }>();
  const { t } = useTranslation();
  const [display, setDisplay] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchDisplay = async () => {
    try {
      const res = await posApi.hardware.getCustomerDisplay(configId!);
      setDisplay(res.data);
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch customer display:', error);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!configId) return;

    // Initial fetch
    fetchDisplay();

    // Auto-fullscreen
    try {
      document.documentElement.requestFullscreen?.();
    } catch (e) {
      // Fullscreen not supported
    }

    // Poll every 2 seconds
    const interval = setInterval(fetchDisplay, 2000);

    return () => clearInterval(interval);
  }, [configId]);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#001529' }}>
        <Spin size="large" />
      </div>
    );
  }

  const order = display?.current_order_snapshot || {};
  const displayMode = display?.display_mode || 'mixed';
  const hasOrder = order && Object.keys(order).length > 0;

  // Show order if mode is 'order' or 'mixed' with order data
  const showOrder = (displayMode === 'order' || displayMode === 'mixed') && hasOrder;
  
  // Show ads if mode is 'ad' or 'mixed' without order
  const showAds = (displayMode === 'ad' || (displayMode === 'mixed' && !hasOrder));

  return (
    <div dir="rtl" style={{
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px',
      overflow: 'hidden',
    }}>
      {showOrder ? (
        <Card
          bordered={false}
          style={{
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '20px',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
          }}
          bodyStyle={{ flex: 1, display: 'flex', flexDirection: 'column' }}
        >
          <div style={{ textAlign: 'center', marginBottom: '40px' }}>
            <Title level={1} style={{ fontSize: '4rem', margin: 0, color: '#1890ff' }}>
              {t('welcome')}
            </Title>
            <Text style={{ fontSize: '2rem', color: '#666' }}>
              {t('your_order')}
            </Text>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', marginBottom: '40px' }}>
            {order.lines?.map((line: any, idx: number) => (
              <Row
                key={idx}
                style={{
                  padding: '20px',
                  borderBottom: '2px dashed #d9d9d9',
                  fontSize: '2.5rem',
                }}
                justify="space-between"
                align="middle"
              >
                <Col>
                  <Text strong style={{ fontSize: '2.5rem' }}>
                    {line.product_name || line.name}
                  </Text>
                </Col>
                <Col>
                  <Text style={{ fontSize: '2rem', color: '#666', marginLeft: '20px', marginRight: '20px' }}>
                    {line.qty} ×
                  </Text>
                  <Text strong style={{ fontSize: '2.5rem', color: '#1890ff' }}>
                    {(line.price_unit || line.price || 0).toLocaleString()} {t('iqd')}
                  </Text>
                </Col>
              </Row>
            ))}
          </div>

          <div style={{ borderTop: '3px solid #1890ff', paddingTop: '30px' }}>
            <Row justify="space-between" style={{ marginBottom: '15px' }}>
              <Col>
                <Text style={{ fontSize: '2.5rem' }}>{t('subtotal')}:</Text>
              </Col>
              <Col>
                <Text strong style={{ fontSize: '2.5rem' }}>
                  {(order.amount_untaxed || order.subtotal || 0).toLocaleString()} {t('iqd')}
                </Text>
              </Col>
            </Row>

            {(order.tax_total || 0) > 0 && (
              <Row justify="space-between" style={{ marginBottom: '15px' }}>
                <Col>
                  <Text style={{ fontSize: '2.5rem' }}>{t('tax')}:</Text>
                </Col>
                <Col>
                  <Text strong style={{ fontSize: '2.5rem' }}>
                    {(order.tax_total || 0).toLocaleString()} {t('iqd')}
                  </Text>
                </Col>
              </Row>
            )}

            <Row justify="space-between" style={{ marginTop: '20px', padding: '20px', background: '#f0f5ff', borderRadius: '10px' }}>
              <Col>
                <Text style={{ fontSize: '3.5rem', fontWeight: 'bold' }}>{t('total')}:</Text>
              </Col>
              <Col>
                <Text strong style={{ fontSize: '3.5rem', color: '#52c41a' }}>
                  {(order.amount_total || order.total || 0).toLocaleString()} {t('iqd')}
                </Text>
              </Col>
            </Row>
          </div>
        </Card>
      ) : showAds ? (
        <div style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          textAlign: 'center',
        }}>
          <Title level={1} style={{ fontSize: '6rem', color: 'white', marginBottom: '40px' }}>
            {t('welcome')}
          </Title>
          <div style={{
            width: '300px',
            height: '300px',
            background: 'white',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '40px',
          }}>
            <Text style={{ fontSize: '4rem' }}>🛒</Text>
          </div>
          <Title level={2} style={{ fontSize: '3rem', color: 'white' }}>
            {t('pos_system')}
          </Title>
        </div>
      ) : (
        <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" />
        </div>
      )}
    </div>
  );
}
