import React from 'react';
import { Row, Col, Card, Skeleton } from 'antd';

interface POSProductGridSkeletonProps {
  count?: number;
}

export default function POSProductGridSkeleton({ count = 12 }: POSProductGridSkeletonProps) {
  return (
    <Row gutter={[16, 16]}>
      {Array.from({ length: count }).map((_, index) => (
        <Col key={index} xs={12} sm={8} md={6} lg={6} xl={4}>
          <Card
            hoverable
            cover={
              <div style={{ padding: 16 }}>
                <Skeleton.Avatar
                  active
                  size={80}
                  shape="square"
                  style={{ width: '100%', height: 80 }}
                />
              </div>
            }
            bodyStyle={{ padding: 12 }}
          >
            <Skeleton active paragraph={{ rows: 2 }} />
          </Card>
        </Col>
      ))}
    </Row>
  );
}
