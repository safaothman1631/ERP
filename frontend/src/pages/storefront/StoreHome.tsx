import React, { useState, useEffect } from 'react';
import { Row, Col, Card, Input, Tag, Empty, Typography, Button } from 'antd';
import { SearchOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import api from '../../api';
import { LoadingSkeleton } from '../../design-system/LoadingSkeleton';
import { useLoadingState } from '../../hooks/useLoadingState';

const { Title, Text } = Typography;
const { Search } = Input;

interface Product {
  id: string;
  name: string;
  price?: number;
  sale_price?: number;
  category?: string;
  image_url?: string;
  sku?: string;
}

const StoreHome: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const { showSkeleton } = useLoadingState(loading);

  useEffect(() => {
    fetchData();
  }, [selectedCategory, search]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const params: Record<string, string> = {};
      if (selectedCategory) params.category = selectedCategory;
      if (search) params.search = search;

      const [prodRes, catRes] = await Promise.all([
        api.get('/api/storefront/products', { params }),
        categories.length === 0 ? api.get('/api/storefront/categories') : Promise.resolve(null)
      ]);

      setProducts(prodRes.data.items || []);
      if (catRes) setCategories(catRes.data.categories || []);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPrice = (product: Product) => {
    return product.sale_price || product.price || 0;
  };

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <Row gutter={[16, 16]} align="middle" style={{ marginBottom: 24 }}>
          <Col flex="auto">
            <Title level={2}>{t('storefront.title')}</Title>
          </Col>
          <Col>
            <Button
              icon={<ShoppingCartOutlined />}
              size="large"
              onClick={() => navigate('/store/cart')}
            >
              {t('storefront.cart')}
            </Button>
          </Col>
        </Row>

        <Row gutter={24}>
          <Col xs={24} md={6}>
            <Card title={t('storefront.categories')} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Tag.CheckableTag
                  checked={!selectedCategory}
                  onChange={() => setSelectedCategory('')}
                  style={{ padding: '8px 12px', cursor: 'pointer' }}
                >
                  {t('storefront.all_products')}
                </Tag.CheckableTag>
                {categories.map(cat => (
                  <Tag.CheckableTag
                    key={cat}
                    checked={selectedCategory === cat}
                    onChange={() => setSelectedCategory(cat)}
                    style={{ padding: '8px 12px', cursor: 'pointer' }}
                  >
                    {cat}
                  </Tag.CheckableTag>
                ))}
              </div>
            </Card>

            <Card title={t('storefront.search')}>
              <Search
                placeholder={t('storefront.search_placeholder')}
                onSearch={setSearch}
                enterButton={<SearchOutlined />}
                allowClear
              />
            </Card>
          </Col>

          <Col xs={24} md={18}>
            {showSkeleton ? (
              <div style={{ textAlign: 'center', padding: 48 }}>
                <LoadingSkeleton variant="card" />
              </div>
            ) : products.length === 0 ? (
              <Empty description={t('storefront.no_products')} />
            ) : (
              <Row gutter={[16, 16]}>
                {products.map(product => (
                  <Col xs={24} sm={12} lg={8} key={product.id}>
                    <Card
                      hoverable
                      cover={
                        <div
                          style={{
                            height: 200,
                            background: '#f0f0f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              loading="lazy"
                              decoding="async"
                              style={{ maxHeight: '100%', maxWidth: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <Text type="secondary">{t('storefront.no_image')}</Text>
                          )}
                        </div>
                      }
                      onClick={() => navigate(`/store/product/${product.id}`)}
                    >
                      <Card.Meta
                        title={product.name}
                        description={
                          <>
                            {product.category && (
                              <Tag color="blue" style={{ marginBottom: 8 }}>
                                {product.category}
                              </Tag>
                            )}
                            <div>
                              <Text strong style={{ fontSize: 18, color: '#1890ff' }}>
                                {getPrice(product).toLocaleString()} {t('currency')}
                              </Text>
                            </div>
                          </>
                        }
                      />
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default StoreHome;
