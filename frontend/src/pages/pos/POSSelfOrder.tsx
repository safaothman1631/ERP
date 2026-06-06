import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Card, Row, Col, InputNumber, Typography, Space, Form, Input, App } from 'antd';
import { PlusOutlined, MinusOutlined, ShoppingCartOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { ResponsiveForm } from '../../components/responsive/ResponsiveForm';

const { Title, Text } = Typography;

interface Product {
  id: string;
  name: string;
  price: number;
  image_url?: string;
  category_id?: string;
}

interface Category {
  id: string;
  name: string;
  name_ku?: string;
}

interface CartItem {
  product_id: string;
  product_name: string;
  qty: number;
  price: number;
  discount: number;
  tax_ids: string[];
}

const POSSelfOrder: React.FC = () => {
  const { configId } = useParams<{ configId: string }>();
  const { t, i18n } = useTranslation();
  const { message } = App.useApp();

  const [step, setStep] = useState(1); // 1: welcome, 2: menu, 3: review, 4: checkout, 5: confirm
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selfOrderId, setSelfOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [idleTimer, setIdleTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    resetIdleTimer();
    return () => {
      if (idleTimer) clearTimeout(idleTimer);
    };
  }, []);

  const resetIdleTimer = () => {
    if (idleTimer) clearTimeout(idleTimer);
    const timer = setTimeout(() => {
      // Reset to welcome after 60s idle
      if (step > 1) {
        message.warning(t('session_timeout'));
        handleReset();
      }
    }, 60000);
    setIdleTimer(timer);
  };

  const handleActivity = () => {
    resetIdleTimer();
  };

  const handleReset = () => {
    setStep(1);
    setCart([]);
    setSelfOrderId(null);
    setActiveCategory(null);
  };

  const handleStartOrder = async () => {
    handleActivity();
    setLoading(true);
    try {
      const menuRes = await api.get('/api/pos/self-order/menu', {
        params: { config_id: configId },
      });
      setCategories(menuRes.data.categories || []);
      setProducts(menuRes.data.products || []);

      const startRes = await api.post('/api/pos/self-order/start', {
        config_id: configId,
      });
      setSelfOrderId(startRes.data.id);
      setStep(2);
    } catch (_error) {
      message.error(t('error_loading'));
    } finally {
      setLoading(false);
    }
  };

  const handleAddToCart = (product: Product) => {
    handleActivity();
    const existing = cart.find((item) => item.product_id === product.id);
    if (existing) {
      setCart(
        cart.map((item) =>
          item.product_id === product.id ? { ...item, qty: item.qty + 1 } : item
        )
      );
    } else {
      setCart([
        ...cart,
        {
          product_id: product.id,
          product_name: product.name,
          qty: 1,
          price: product.price,
          discount: 0,
          tax_ids: [],
        },
      ]);
    }
  };

  const handleRemoveFromCart = (productId: string) => {
    handleActivity();
    setCart(cart.filter((item) => item.product_id !== productId));
  };

  const handleUpdateQty = (productId: string, qty: number) => {
    handleActivity();
    if (qty <= 0) {
      handleRemoveFromCart(productId);
    } else {
      setCart(
        cart.map((item) => (item.product_id === productId ? { ...item, qty } : item))
      );
    }
  };

  const handleReviewCart = async () => {
    handleActivity();
    if (cart.length === 0) {
      message.warning(t('cart_is_empty'));
      return;
    }
    setStep(3);
  };

  const handleCheckout = async () => {
    handleActivity();
    if (!selfOrderId) return;

    setLoading(true);
    try {
      // Update cart items
      await api.post(`/api/pos/self-order/${selfOrderId}/items`, { lines: cart });
      setStep(4);
    } catch (_error) {
      message.error(t('error_saving'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitOrder = async (_values: any) => {
    handleActivity();
    if (!selfOrderId) return;

    setLoading(true);
    try {
      // Submit the order
      await api.post(`/api/pos/self-order/${selfOrderId}/submit`);
      setStep(5);
    } catch (_error) {
      message.error(t('error_submitting_order'));
    } finally {
      setLoading(false);
    }
  };

  const total = cart.reduce(
    (sum, item) => sum + item.qty * item.price * (1 - item.discount / 100),
    0
  );

  const filteredProducts = activeCategory
    ? products.filter((p) => p.category_id === activeCategory)
    : products;

  return (
    <div
      onClick={handleActivity}
      style={{
        width: '100vw',
        height: '100vh',
        background: 'var(--surface-2)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <div
        style={{
          background: '#001529',
          color: 'white',
          padding: '16px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Title level={3} style={{ color: 'white', margin: 0 }}>
          {t('self_order_kiosk')}
        </Title>
        <Space>
          <Button onClick={() => i18n.changeLanguage('en')}>English</Button>
          <Button onClick={() => i18n.changeLanguage('ku')}>کوردی</Button>
        </Space>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
        {step === 1 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Title level={1}>{t('welcome')}</Title>
            <Text style={{ fontSize: 18, marginBottom: 32 }}>
              {t('touch_to_start_order')}
            </Text>
            <Button
              type="primary"
              size="large"
              icon={<ShoppingCartOutlined />}
              onClick={handleStartOrder}
              loading={loading}
              style={{ fontSize: 24, height: 80, padding: '0 48px' }}
            >
              {t('start_order')}
            </Button>
          </div>
        )}

        {step === 2 && (
          <Row gutter={16}>
            {/* Categories */}
            <Col span={6}>
              <Card title={t('categories')} style={{ height: '70vh', overflow: 'auto' }}>
                <Space orientation="vertical" style={{ width: '100%' }}>
                  <Button
                    block
                    type={activeCategory === null ? 'primary' : 'default'}
                    onClick={() => setActiveCategory(null)}
                  >
                    {t('all')}
                  </Button>
                  {categories.map((cat) => (
                    <Button
                      key={cat.id}
                      block
                      type={activeCategory === cat.id ? 'primary' : 'default'}
                      onClick={() => setActiveCategory(cat.id)}
                    >
                      {i18n.language === 'ku' && cat.name_ku ? cat.name_ku : cat.name}
                    </Button>
                  ))}
                </Space>
              </Card>
            </Col>

            {/* Products */}
            <Col span={12}>
              <Card
                title={t('menu')}
                style={{ height: '70vh', overflow: 'auto' }}
                extra={
                  <Button type="primary" onClick={handleReviewCart}>
                    {t('review_cart')} ({cart.length})
                  </Button>
                }
              >
                <Row gutter={[16, 16]}>
                  {filteredProducts.map((product) => (
                    <Col span={8} key={product.id}>
                      <Card
                        hoverable
                        onClick={() => handleAddToCart(product)}
                        style={{ textAlign: 'center', minHeight: 150 }}
                      >
                        <Title level={5} ellipsis={{ rows: 2 }}>
                          {product.name}
                        </Title>
                        <Text strong style={{ fontSize: 18, color: 'var(--accent-500)' }}>
                          {product.price.toLocaleString()} {t('currency')}
                        </Text>
                      </Card>
                    </Col>
                  ))}
                </Row>
              </Card>
            </Col>

            {/* Cart */}
            <Col span={6}>
              <Card title={t('cart')} style={{ height: '70vh', overflow: 'auto' }}>
                {cart.length === 0 ? (
                  <Text type="secondary">{t('cart_is_empty')}</Text>
                ) : (
                  <Space orientation="vertical" style={{ width: '100%' }}>
                    {cart.map((item) => (
                      <Card key={item.product_id} size="small">
                        <div>{item.product_name}</div>
                        <Space>
                          <Button
                            size="small"
                            icon={<MinusOutlined />}
                            onClick={() => handleUpdateQty(item.product_id, item.qty - 1)}
                          />
                          <InputNumber
                            size="small"
                            min={1}
                            value={item.qty}
                            onChange={(val) => handleUpdateQty(item.product_id, val || 1)}
                            style={{ width: 60 }}
                          />
                          <Button
                            size="small"
                            icon={<PlusOutlined />}
                            onClick={() => handleUpdateQty(item.product_id, item.qty + 1)}
                          />
                        </Space>
                        <div style={{ marginTop: 8 }}>
                          {(item.qty * item.price).toLocaleString()} {t('currency')}
                        </div>
                      </Card>
                    ))}
                    <Card>
                      <Title level={4}>
                        {t('total')}: {total.toLocaleString()} {t('currency')}
                      </Title>
                    </Card>
                  </Space>
                )}
              </Card>
            </Col>
          </Row>
        )}

        {step === 3 && (
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <Title level={2}>{t('review_your_order')}</Title>
            {cart.map((item) => (
              <Card key={item.product_id} style={{ marginBottom: 8 }}>
                <Row justify="space-between">
                  <Col>
                    {item.product_name} x {item.qty}
                  </Col>
                  <Col>{(item.qty * item.price).toLocaleString()} {t('currency')}</Col>
                </Row>
              </Card>
            ))}
            <Card style={{ marginTop: 16 }}>
              <Title level={3}>
                {t('total')}: {total.toLocaleString()} {t('currency')}
              </Title>
            </Card>
            <Space style={{ marginTop: 24, width: '100%', justifyContent: 'space-between' }}>
              <Button icon={<ArrowLeftOutlined />} onClick={() => setStep(2)}>
                {t('back_to_menu')}
              </Button>
              <Button type="primary" size="large" onClick={handleCheckout}>
                {t('proceed_to_checkout')}
              </Button>
            </Space>
          </div>
        )}

        {step === 4 && (
          <div style={{ maxWidth: 500, margin: '0 auto' }}>
            <Title level={2}>{t('checkout')}</Title>
            <Form layout="vertical" onFinish={handleSubmitOrder}>
              <ResponsiveForm layout="single">
              <Form.Item name="customer_name" label={t('name')}>
                <Input size="large" />
              </Form.Item>
              <Form.Item name="customer_phone" label={t('phone')}>
                <Input size="large" />
              </Form.Item>
              <Form.Item>
                <Button type="primary" size="large" htmlType="submit" block loading={loading}>
                  {t('confirm_order')}
                </Button>
              </Form.Item>
              </ResponsiveForm>
</Form>
          </div>
        )}

        {step === 5 && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
            }}
          >
            <Title level={1} style={{ color: 'var(--success-500)' }}>
              ✓ {t('order_confirmed')}
            </Title>
            <Text style={{ fontSize: 18, marginBottom: 32 }}>
              {t('take_number_to_counter')}
            </Text>
            <Button type="primary" size="large" onClick={handleReset}>
              {t('start_new_order')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default POSSelfOrder;
