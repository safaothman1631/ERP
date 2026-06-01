import React, { useState, useEffect } from 'react';
import { Card, Button, InputNumber, Typography, Row, Col, Tag, Divider } from 'antd';
import { ShoppingCartOutlined, LeftOutlined } from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { message } from '../../utils/message';
import api from '../../api';
import { LoadingSkeleton } from '../../design-system/LoadingSkeleton';
import { useLoadingState } from '../../hooks/useLoadingState';

const { Title, Text, Paragraph } = Typography;

interface Product {
  id: string;
  name: string;
  description?: string;
  price?: number;
  sale_price?: number;
  category?: string;
  image_url?: string;
  sku?: string;
}

const StoreProduct: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);
  const { showSkeleton } = useLoadingState(loading);

  useEffect(() => {
    fetchProduct();
  }, [id]);

  const fetchProduct = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/storefront/products/${id}`);
      setProduct(res.data);
    } catch (_err) {
      message.error(t('storefront.product_not_found'));
      navigate('/store');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = async () => {
    try {
      setAdding(true);
      let sessionId = localStorage.getItem('store_session_id');
      if (!sessionId) {
        // Cryptographically secure session id (replaces Math.random)
        const buf = new Uint8Array(9);
        crypto.getRandomValues(buf);
        const rand = Array.from(buf, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
        sessionId = `session_${Date.now()}_${rand}`;
        localStorage.setItem('store_session_id', sessionId);
      }

      // Get or create cart
      const cartRes = await api.post('/api/storefront/cart', {
        session_id: sessionId,
      });

      const cartId = cartRes.data.id;
      localStorage.setItem('store_cart_id', cartId);

      // Add item to cart
      const existingLines = cartRes.data.lines || [];
      const existingLine = existingLines.find((l: any) => l.item_id === id);

      const updatedLines = existingLine
        ? existingLines.map((l: any) =>
            l.item_id === id ? { ...l, quantity: l.quantity + quantity } : l
          )
        : [...existingLines, { item_id: id, quantity }];

      await api.put(`/api/storefront/cart/${cartId}`, {
        items: updatedLines,
      });

      message.success(t('storefront.added_to_cart'));
      navigate('/store/cart');
    } catch (_err) {
      message.error(t('storefront.add_to_cart_failed'));
    } finally {
      setAdding(false);
    }
  };

  if (showSkeleton) {
    return (
      <div style={{ textAlign: 'center', padding: 48 }}>
        <LoadingSkeleton variant="card" />
      </div>
    );
  }

  if (!product) return null;

  const price = product.sale_price || product.price || 0;

  return (
    <div style={{ padding: '24px', background: 'var(--surface-2)', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <Button
          icon={<LeftOutlined />}
          onClick={() => navigate('/store')}
          style={{ marginBottom: 16 }}
        >
          {t('storefront.back_to_store')}
        </Button>

        <Card>
          <Row gutter={32}>
            <Col xs={24} md={12}>
              <div
                style={{
                  background: 'var(--surface-2)',
                  height: 400,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 8,
                }}
              >
                {product.image_url ? (
                  <img
                    src={product.image_url}
                    alt={product.name}
                    loading="lazy"
                    decoding="async"
                    style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'contain' }}
                  />
                ) : (
                  <Text type="secondary">{t('storefront.no_image')}</Text>
                )}
              </div>
            </Col>

            <Col xs={24} md={12}>
              <Title level={2}>{product.name}</Title>

              {product.category && (
                <Tag color="blue" style={{ marginBottom: 16 }}>
                  {product.category}
                </Tag>
              )}

              {product.sku && (
                <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                  {t('storefront.sku')}: {product.sku}
                </Text>
              )}

              <Title level={3} style={{ color: 'var(--accent-500)', marginBottom: 16 }}>
                {price.toLocaleString()} {t('currency')}
              </Title>

              {product.description && (
                <>
                  <Divider />
                  <Paragraph>{product.description}</Paragraph>
                </>
              )}

              <Divider />

              <Row gutter={16} align="middle">
                <Col>
                  <Text strong>{t('storefront.quantity')}:</Text>
                </Col>
                <Col>
                  <InputNumber
                    min={1}
                    value={quantity}
                    onChange={(val) => setQuantity(val || 1)}
                    style={{ width: 100 }}
                  />
                </Col>
              </Row>

              <Button
                type="primary"
                size="large"
                icon={<ShoppingCartOutlined />}
                onClick={addToCart}
                loading={adding}
                style={{ marginTop: 24, width: '100%' }}
              >
                {t('storefront.add_to_cart')}
              </Button>
            </Col>
          </Row>
        </Card>
      </div>
    </div>
  );
};

export default StoreProduct;
