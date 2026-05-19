import React, { useState, useEffect } from 'react';
import { Card, Button, InputNumber, Empty, Typography, Row, Col } from 'antd';
import { DeleteOutlined, ShoppingOutlined, LeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import api from '../../api';
import { ResponsiveTableAdapter } from '../../components/responsive/ResponsiveTableAdapter';

const { Title, Text } = Typography;

interface CartLine {
  item_id: string;
  quantity: number;
  name?: string;
  price?: number;
}

const StoreCart: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [cart, setCart] = useState<any>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchCart();
  }, []);

  const fetchCart = async () => {
    try {
      setLoading(true);
      const sessionId = localStorage.getItem('store_session_id');
      const cartId = localStorage.getItem('store_cart_id');

      if (!sessionId || !cartId) {
        setLoading(false);
        return;
      }

      const cartRes = await api.post('/api/storefront/cart', { session_id: sessionId });
      setCart(cartRes.data);

      // Fetch product details for each line
      const cartLines = cartRes.data.lines || [];
      const enrichedLines = await Promise.all(
        cartLines.map(async (line: CartLine) => {
          try {
            const prodRes = await api.get(`/api/storefront/products/${line.item_id}`);
            return {
              ...line,
              name: prodRes.data.name,
              price: prodRes.data.sale_price || prodRes.data.price || 0,
            };
          } catch {
            return line;
          }
        })
      );

      setLines(enrichedLines);
    } catch (err) {
      console.error('Failed to load cart:', err);
    } finally {
      setLoading(false);
    }
  };

  const updateQuantity = async (itemId: string, newQty: number) => {
    try {
      setUpdating(true);
      const updatedLines = lines
        .map(l => (l.item_id === itemId ? { ...l, quantity: newQty } : l))
        .filter(l => l.quantity > 0);

      await api.put(`/api/storefront/cart/${cart.id}`, {
        items: updatedLines.map(l => ({ item_id: l.item_id, quantity: l.quantity })),
      });

      setLines(updatedLines);
      message.success(t('storefront.cart_updated'));
    } catch (err) {
      message.error(t('storefront.update_failed'));
    } finally {
      setUpdating(false);
    }
  };

  const removeLine = async (itemId: string) => {
    await updateQuantity(itemId, 0);
  };

  const getSubtotal = () => {
    return lines.reduce((sum, line) => sum + (line.price || 0) * line.quantity, 0);
  };

  const columns = [
    {
      title: t('storefront.product'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: t('storefront.price'),
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => `${price.toLocaleString()} ${t('currency')}`,
    },
    {
      title: t('storefront.quantity'),
      dataIndex: 'quantity',
      key: 'quantity',
      render: (qty: number, record: CartLine) => (
        <InputNumber
          min={1}
          value={qty}
          onChange={(val) => val && updateQuantity(record.item_id, val)}
          disabled={updating}
          style={{ width: 80 }}
        />
      ),
    },
    {
      title: t('storefront.total'),
      key: 'total',
      render: (_: any, record: CartLine) => (
        <Text strong>
          {((record.price || 0) * record.quantity).toLocaleString()} {t('currency')}
        </Text>
      ),
    },
    {
      title: '',
      key: 'actions',
      render: (_: any, record: CartLine) => (
        <Button
          danger
          icon={<DeleteOutlined />}
          onClick={() => removeLine(record.item_id)}
          disabled={updating}
        />
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => navigate('/store')}
          style={{ marginBottom: 16 }}
        >
          {t('storefront.back_to_store')}
        </Button>

        <Card>
          <Title level={2}>{t('storefront.shopping_cart')}</Title>

          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}>
              <Text>{t('loading')}</Text>
            </div>
          ) : lines.length === 0 ? (
            <Empty
              description={t('storefront.cart_empty')}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Button
                type="primary"
                icon={<ShoppingOutlined />}
                onClick={() => navigate('/store')}
              >
                {t('storefront.continue_shopping')}
              </Button>
            </Empty>
          ) : (
            <>
              <ResponsiveTableAdapter
                dataSource={lines}
                columns={columns}
                rowKey="item_id"
                pagination={false}
                style={{ marginBottom: 24 }}
              />

              <Row justify="end">
                <Col xs={24} md={8}>
                  <Card>
                    <Row justify="space-between" style={{ marginBottom: 16 }}>
                      <Text strong>{t('storefront.subtotal')}:</Text>
                      <Title level={4} style={{ margin: 0 }}>
                        {getSubtotal().toLocaleString()} {t('currency')}
                      </Title>
                    </Row>

                    <Button
                      type="primary"
                      size="large"
                      block
                      onClick={() => navigate('/store/checkout')}
                    >
                      {t('storefront.proceed_to_checkout')}
                    </Button>
                  </Card>
                </Col>
              </Row>
            </>
          )}
        </Card>
      </div>
    </div>
  );
};

export default StoreCart;
