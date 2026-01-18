import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Button, Tag, Space, Typography, message } from 'antd'
import { EyeOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { apiService } from '@/services/api'
import type { OrderResponse, OrderStatus } from '@/types/api'

const { Title } = Typography

const OrdersByCustomer = () => {
  const { customerId } = useParams<{ customerId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: ordersData, isLoading, refetch } = useQuery({
    queryKey: ['ordersByCustomer', customerId],
    queryFn: async () => {
      const response = await apiService.getOrdersByCustomer(Number(customerId));
      // 주문 ID 기준으로 최신순 정렬 (orderId가 클수록 최신)
      if (response.data) {
        response.data.sort((a, b) => b.orderId - a.orderId);
      }
      return response;
    },
    enabled: !!customerId,
  })

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'CREATED':
        return 'orange'
      case 'PAID':
        return 'green'
      case 'CANCELED':
        return 'red'
      default:
        return 'default'
    }
  }

  const getStatusText = (status: OrderStatus) => {
    switch (status) {
      case 'CREATED':
        return '생성됨'
      case 'PAID':
        return '결제완료'
      case 'CANCELED':
        return '취소됨'
      default:
        return status
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원'
  }

  const columns = [
    {
      title: '주문 ID',
      dataIndex: 'orderId',
      key: 'orderId',
    },
    {
      title: '주문번호',
      dataIndex: 'orderNo',
      key: 'orderNo',
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      render: (status: OrderStatus) => (
        <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
      ),
    },
    {
      title: '수령인',
      dataIndex: 'recipientName',
      key: 'recipientName',
    },
    {
      title: '주소',
      key: 'address',
      render: (_: any, record: OrderResponse) => (
        <span>
          [{record.zipCode}] {record.address1}
        </span>
      ),
    },
    {
      title: '최종금액',
      dataIndex: 'finalAmount',
      key: 'finalAmount',
      render: (amount: number) => formatCurrency(amount),
      align: 'right' as const,
    },
    {
      title: '작업',
      key: 'actions',
      render: (_: any, record: OrderResponse) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/orders/${record.orderId}`)}
        >
          상세보기
        </Button>
      ),
    },
  ]

  const orders = ordersData?.data || []

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Title level={2} style={{ margin: 0 }}>주문 목록 (고객 ID: {customerId})</Title>
        <Space wrap>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => {
              // 모든 관련 쿼리 무효화 후 강제로 다시 불러오기
              queryClient.invalidateQueries({ queryKey: ['ordersByCustomer', customerId] })
              queryClient.refetchQueries({ queryKey: ['ordersByCustomer', customerId] })
              refetch()
            }} 
            loading={isLoading}
          >
            새로고침
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => message.info('주문 생성 기능은 주문 상세 페이지에서 제공됩니다.')}
          >
            새 주문
          </Button>
        </Space>
      </div>

      <Card>
        <div style={{ overflowX: 'auto' }}>
          <Table
            columns={columns}
            dataSource={orders}
            rowKey="orderId"
            loading={isLoading}
            pagination={{ pageSize: 10 }}
            scroll={{ x: 'max-content' }}
          />
        </div>
      </Card>
    </div>
  )
}

export default OrdersByCustomer
