import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Space, Typography, Tag, Button, Select, Row, Col, Modal, message, Input, Form, Tabs } from 'antd'
import { EyeOutlined, ReloadOutlined, EditOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { apiService } from '@/services/api'
import type { OrderResponse, OrderStatus, FulfillmentType, PaymentMethod } from '@/types/api'

const { Title } = Typography
const { Option } = Select

// Note: API에 전체 주문 리스트 엔드포인트가 없어서
// 실제로는 별도의 전체 주문 리스트 API가 필요할 수 있습니다
const OrderList = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<FulfillmentType | 'ALL'>('ALL')
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethod | 'ALL'>('ALL')
  const [activeTab, setActiveTab] = useState<string>('PAID')
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null)
  const [trackingForm] = Form.useForm()
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [cancelOrderId, setCancelOrderId] = useState<number | null>(null)
  const [cancelForm] = Form.useForm()

  // URL 쿼리 파라미터에서 상태 필터 읽기
  useEffect(() => {
    const statusParam = searchParams.get('status')
    if (statusParam) {
      setActiveTab(statusParam)
      // 필터가 설정되면 첫 페이지로 이동
      setCurrentPage(1)
    }
  }, [searchParams])

  // 현재 활성 탭에 따라 주문 상태 필터 결정
  const getStatusFilter = (tab: string): OrderStatus | 'ALL' | 'DELIVERY' => {
    switch (tab) {
      case 'ALL':
        return 'ALL'
      case 'CREATED':
        return 'CREATED'
      case 'PAID':
        return 'PAID'
      case 'CONFIRMED':
        return 'CONFIRMED'
      case 'COMPLETED':
        return 'COMPLETED'
      case 'CANCELED':
        return 'CANCELED'
      case 'DELIVERY':
        return 'DELIVERY' // 배송 중인 주문
      default:
        return 'PAID'
    }
  }

  const statusFilter = getStatusFilter(activeTab)

  // 주문 리스트 조회 (전체 주문을 가져와서 클라이언트에서 필터링 및 페이지네이션)
  const { data: ordersData, isLoading, error, refetch } = useQuery({
    queryKey: ['allOrders'],
    queryFn: async () => {
      try {
        console.log('[OrderList] 전체 주문 조회 시작');
        
        // 모든 주문을 페이징으로 가져오기
        const allOrders: OrderResponse[] = []
        let page = 0
        const fetchPageSize = 100 // 한 번에 많이 가져오기
        let hasMore = true

        while (hasMore) {
          try {
            const response = await apiService.getAllOrdersAdmin({ page, size: fetchPageSize })
            
            if (response.data && response.data.content && response.data.content.length > 0) {
              allOrders.push(...response.data.content)
              
              // 마지막 페이지인지 확인
              if (response.data.last || response.data.content.length < fetchPageSize) {
                hasMore = false
              } else {
                page++
              }
            } else {
              hasMore = false
            }
          } catch (err: any) {
            console.error(`[OrderList] 주문 조회 실패 (페이지 ${page}):`, err.message)
            hasMore = false
          }
        }

        console.log(`[OrderList] 총 ${allOrders.length}개의 주문 조회 완료`)
        
        // 결제 정보 조회 (모든 주문)
        const ordersWithPayment = await Promise.all(
          allOrders.map(async (order: OrderResponse) => {
            let paymentMethod: PaymentMethod | undefined
            try {
              const paymentResponse = await apiService.getPaymentByOrder(order.orderId)
              if (paymentResponse?.data) {
                paymentMethod = paymentResponse.data.method
              }
            } catch {
              // 결제 정보가 없으면 무시
            }
            return { ...order, paymentMethod }
          })
        )

        return { 
          status: 200, 
          message: 'OK', 
          data: ordersWithPayment as (OrderResponse & { paymentMethod?: PaymentMethod })[]
        };
      } catch (err: any) {
        console.error('[OrderList] 주문 리스트 조회 실패:', err);
        message.error('주문 목록을 불러오는데 실패했습니다.');
        return { status: 200, message: 'OK', data: [] as (OrderResponse & { paymentMethod?: PaymentMethod })[] };
      }
    },
    retry: false,
    staleTime: 1000 * 60 * 5, // 5분간 캐시
  })

  // 클라이언트 사이드 필터링
  const filteredOrders = useMemo(() => {
    if (!ordersData?.data) return []

    return ordersData.data.filter((order) => {
      // 상태 필터
      if (statusFilter === 'DELIVERY') {
        // 배송 중인 주문: CONFIRMED 상태이면서 fulfillmentType이 DELIVERY인 주문
        if (order.status !== 'CONFIRMED' || order.fulfillmentType !== 'DELIVERY') {
          return false
        }
      } else if (statusFilter !== 'ALL' && order.status !== statusFilter) {
        return false
      }
      
      // 배송 방식 필터
      if (deliveryTypeFilter !== 'ALL') {
        if (!order.fulfillmentType || order.fulfillmentType !== deliveryTypeFilter) {
          return false
        }
      }
      
      // 결제 수단 필터
      if (paymentMethodFilter !== 'ALL') {
        if (!order.paymentMethod || order.paymentMethod !== paymentMethodFilter) {
          return false
        }
      }
      
      return true
    })
  }, [ordersData, statusFilter, deliveryTypeFilter, paymentMethodFilter])

  // 클라이언트 사이드 페이지네이션
  const totalOrders = filteredOrders.length
  const totalPages = Math.ceil(totalOrders / pageSize)
  const displayedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // 필터가 변경되면 페이지를 1로 리셋
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, deliveryTypeFilter, paymentMethodFilter])

  // 결제 완료 처리 (CREATED → PAID)
  const markOrderPaidMutation = useMutation({
    mutationFn: async ({ orderId, paymentMethod }: { orderId: number; paymentMethod: PaymentMethod }) => {
      // 1. 결제 생성
      const paymentResponse = await apiService.createPayment(orderId, { method: paymentMethod })
      // 2. 결제 완료 처리 (주문도 PAID로 전이)
      await apiService.markPaymentPaid(paymentResponse.data.paymentId, { pgPaymentKey: 'MANUAL_ADMIN' })
      return paymentResponse
    },
    onSuccess: () => {
      message.success('주문이 결제완료 처리되었습니다.')
      // 모든 관련 쿼리 무효화 후 전체 API 다시 호출
      queryClient.invalidateQueries({ queryKey: ['allOrders'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
      queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] })
      refetch()
    },
    onError: (error: any) => {
      console.error('[OrderList] 결제 완료 처리 에러 상세:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        message: error.message,
        fullError: error,
      });
      const errorMessage = error.response?.data?.message || error.response?.data?.error || `결제 완료 처리에 실패했습니다. (${error.response?.status || '알 수 없는 오류'})`;
      message.error({
        content: errorMessage,
        duration: 5,
      });
    },
  })

  // 주문 확인 처리 (PAID → CONFIRMED)
  const confirmOrderMutation = useMutation({
    mutationFn: (orderId: number) => apiService.confirmOrder(orderId),
    onSuccess: () => {
      message.success('주문이 확인되었습니다.')
      // 모든 관련 쿼리 무효화 후 전체 API 다시 호출
      queryClient.invalidateQueries({ queryKey: ['allOrders'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
      queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] })
      refetch()
    },
    onError: (error: any) => {
      console.error('[OrderList] 주문 확인 에러 상세:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        message: error.message,
        fullError: error,
      });
      const errorMessage = error.response?.data?.message || error.response?.data?.error || `주문 확인에 실패했습니다. (${error.response?.status || '알 수 없는 오류'})`;
      message.error({
        content: errorMessage,
        duration: 5,
      });
    },
  })

  // 주문 완료 처리 (PAID → COMPLETED 또는 CONFIRMED → COMPLETED)
  const completeOrderMutation = useMutation({
    mutationFn: async (orderId: number) => {
      // 주문 상태 확인 후 처리
      const orderResponse = await apiService.getOrder(orderId)
      const currentStatus = orderResponse.data.status
      
      if (currentStatus === 'PAID') {
        // PAID → COMPLETED: 먼저 CONFIRMED로 변경 후 COMPLETED로 변경
        await apiService.confirmOrder(orderId)
        await apiService.completeOrder(orderId)
      } else if (currentStatus === 'CONFIRMED') {
        // CONFIRMED → COMPLETED
        await apiService.completeOrder(orderId)
      } else {
        throw new Error(`주문 상태가 올바르지 않습니다. (현재 상태: ${currentStatus})`)
      }
    },
    onSuccess: () => {
      message.success('주문이 완료되었습니다.')
      // 모든 관련 쿼리 무효화 후 전체 API 다시 호출
      queryClient.invalidateQueries({ queryKey: ['allOrders'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
      queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] })
      refetch()
    },
    onError: (error: any) => {
      console.error('[OrderList] 주문 완료 에러 상세:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        message: error.message,
        fullError: error,
      });
      const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message || `주문 완료 처리에 실패했습니다. (${error.response?.status || '알 수 없는 오류'})`;
      message.error({
        content: errorMessage,
        duration: 5,
      });
    },
  })

  // 주문 취소 처리 (어느 단계에서도 취소 가능)
  const cancelOrderMutation = useMutation({
    mutationFn: ({ orderId, reason }: { orderId: number; reason?: string }) => 
      apiService.cancelOrder(orderId, { reason }),
    onSuccess: () => {
      message.success('주문이 취소되었습니다.')
      setIsCancelModalOpen(false)
      cancelForm.resetFields()
      setCancelOrderId(null)
      // 모든 관련 쿼리 무효화 후 전체 API 다시 호출
      queryClient.invalidateQueries({ queryKey: ['allOrders'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
      queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] })
      refetch()
    },
    onError: (error: any) => {
      console.error('[OrderList] 주문 취소 에러 상세:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        message: error.message,
        fullError: error,
      });
      
      // 서버 응답에서 상세 메시지 추출
      let errorMessage = '주문 취소에 실패했습니다.';
      if (error.response?.data) {
        if (error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.data.error) {
          errorMessage = error.response.data.error;
        } else if (typeof error.response.data === 'string') {
          errorMessage = error.response.data;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      // 500 에러인 경우 특별한 메시지 표시
      if (error.response?.status === 500) {
        const serverMessage = error.response?.data?.message || '서버 오류';
        errorMessage = `서버 오류가 발생했습니다: ${serverMessage}\n\n서버 측에서 주문 취소 API가 제대로 구현되지 않았거나, 서버 내부 오류가 발생한 것으로 보입니다. 서버 개발팀에 문의해주세요.`;
      } else {
        errorMessage = `${errorMessage} (${error.response?.status || '알 수 없는 오류'})`;
      }
      
      message.error({
        content: errorMessage,
        duration: 8,
      });
    },
  })

  // 배송 시작 처리 (운송장 번호 입력)
  const startDeliveryMutation = useMutation({
    mutationFn: ({ orderId, trackingNo }: { orderId: number; trackingNo: string }) =>
      apiService.startDelivery(orderId, { trackingNo }),
    onSuccess: () => {
      message.success('운송장 번호가 등록되었습니다.')
      setIsTrackingModalOpen(false)
      setSelectedOrder(null)
      trackingForm.resetFields()
      // 모든 관련 쿼리 무효화 후 전체 API 다시 호출
      queryClient.invalidateQueries({ queryKey: ['allOrders'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
      queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] })
      refetch()
    },
    onError: (error: any) => {
      console.error('[OrderList] 운송장 번호 등록 에러:', error)
      const errorMessage = error.response?.data?.message || error.response?.data?.error || `운송장 번호 등록에 실패했습니다. (${error.response?.status || '알 수 없는 오류'})`;
      message.error({
        content: errorMessage,
        duration: 5,
      });
    },
  })

  const handleOpenTrackingModal = (order: OrderResponse) => {
    setSelectedOrder(order)
    trackingForm.setFieldsValue({
      trackingNo: order.trackingNo || '',
    })
    setIsTrackingModalOpen(true)
  }

  const handleTrackingModalOk = () => {
    trackingForm.validateFields().then((values) => {
      if (selectedOrder) {
        startDeliveryMutation.mutate({
          orderId: selectedOrder.orderId,
          trackingNo: values.trackingNo.trim(),
        })
      }
    })
  }

  const handleMarkOrderPaid = (orderId: number, paymentMethod: PaymentMethod = 'BANK_TRANSFER') => {
    Modal.confirm({
      title: '결제 완료 처리',
      content: `이 주문을 결제완료 처리하시겠습니까? (CREATED → PAID)\n결제 수단: ${paymentMethod === 'BANK_TRANSFER' ? '무통장 입금' : '카드'}`,
      onOk: () => markOrderPaidMutation.mutate({ orderId, paymentMethod }),
    })
  }

  const handleConfirmOrder = (orderId: number) => {
    Modal.confirm({
      title: '주문 확인',
      content: '이 주문을 확인 처리하시겠습니까? (PAID → CONFIRMED)',
      onOk: () => confirmOrderMutation.mutate(orderId),
    })
  }

  const handleCompleteOrder = (orderId: number) => {
    Modal.confirm({
      title: '주문 완료',
      content: '이 주문을 완료 처리하시겠습니까? (PAID/CONFIRMED → COMPLETED)',
      onOk: () => completeOrderMutation.mutate(orderId),
    })
  }

  const handleCancelOrder = (orderId: number) => {
    setCancelOrderId(orderId)
    setIsCancelModalOpen(true)
  }

  const handleCancelModalOk = () => {
    cancelForm.validateFields().then((values) => {
      if (cancelOrderId) {
        cancelOrderMutation.mutate({ 
          orderId: cancelOrderId, 
          reason: values.reason || undefined 
        })
      }
    }).catch((error) => {
      console.error('취소 사유 입력 오류:', error)
    })
  }

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'CREATED':
        return 'orange'
      case 'PAID':
        return 'blue'
      case 'CONFIRMED':
        return 'cyan'
      case 'COMPLETED':
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
      case 'CONFIRMED':
        return '확인됨'
      case 'COMPLETED':
        return '완료됨'
      case 'CANCELED':
        return '취소됨'
      default:
        return status
    }
  }

  const getDeliveryTypeText = (type?: FulfillmentType) => {
    return type === 'PICKUP' ? '픽업' : type === 'DELIVERY' ? '배송' : '-'
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원'
  }

  const getPaymentMethodText = (method?: PaymentMethod) => {
    return method === 'BANK_TRANSFER' ? '무통장 입금' : method === 'CARD' ? '카드' : '-'
  }

  const columns = [
    {
      title: '주문 ID',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 100,
    },
    {
      title: '주문번호',
      dataIndex: 'orderNo',
      key: 'orderNo',
      width: 180,
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (status: OrderStatus, record: OrderResponse & { paymentMethod?: PaymentMethod }) => (
        <Space direction="vertical" size={4}>
          <Tag color={getStatusColor(status)}>{getStatusText(status)}</Tag>
          {status !== 'CANCELED' && status !== 'COMPLETED' && (
            <>
              {status === 'CREATED' && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleMarkOrderPaid(record.orderId, record.paymentMethod || 'BANK_TRANSFER')}
                  loading={markOrderPaidMutation.isPending}
                  style={{ padding: 0, height: 'auto' }}
                >
                  → 결제완료
                </Button>
              )}
              {status === 'PAID' && (
                <>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => handleConfirmOrder(record.orderId)}
                    loading={confirmOrderMutation.isPending}
                    style={{ padding: 0, height: 'auto' }}
                  >
                    → 확인됨
                  </Button>
                  <Button
                    type="link"
                    size="small"
                    onClick={() => handleCompleteOrder(record.orderId)}
                    loading={completeOrderMutation.isPending}
                    style={{ padding: 0, height: 'auto' }}
                  >
                    → 완료됨
                  </Button>
                </>
              )}
              {status === 'CONFIRMED' && (
                <Button
                  type="link"
                  size="small"
                  onClick={() => handleCompleteOrder(record.orderId)}
                  loading={completeOrderMutation.isPending}
                  style={{ padding: 0, height: 'auto' }}
                >
                  → 완료됨
                </Button>
              )}
              <Button
                type="link"
                size="small"
                danger
                onClick={() => handleCancelOrder(record.orderId)}
                loading={cancelOrderMutation.isPending}
                style={{ padding: 0, height: 'auto' }}
              >
                취소
              </Button>
            </>
          )}
        </Space>
      ),
    },
    {
      title: '결제 정보',
      key: 'payment',
      width: 150,
      render: (_: any, record: OrderResponse & { paymentMethod?: PaymentMethod }) => {
        if (record.paymentMethod) {
          return (
            <Tag color={record.paymentMethod === 'BANK_TRANSFER' ? 'blue' : 'green'}>
              {getPaymentMethodText(record.paymentMethod)}
            </Tag>
          )
        }
        return <Tag color="default">미결제</Tag>
      },
    },
    {
      title: '현금영수증',
      dataIndex: 'cashReceipt',
      key: 'cashReceipt',
      width: 150,
      render: (cashReceipt: boolean | undefined, record: OrderResponse) => {
        if (cashReceipt && record.cashReceiptNo) {
          return (
            <Space direction="vertical" size={0}>
              <Tag color="green">발급</Tag>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                {record.cashReceiptNo}
              </Typography.Text>
            </Space>
          )
        }
        return (
          <Tag color="default">미발급</Tag>
        )
      },
    },
    {
      title: '상품',
      key: 'items',
      width: 200,
      render: (_: any, record: OrderResponse) => {
        if (record.items && record.items.length > 0) {
          return (
            <span>
              {record.items[0].productName}
              {record.items.length > 1 && ` 외 ${record.items.length - 1}개`}
            </span>
          )
        }
        return '-'
      },
    },
    {
      title: '배송 방식',
      dataIndex: 'fulfillmentType',
      key: 'fulfillmentType',
      width: 100,
      render: (type?: FulfillmentType) => {
        if (!type) return '-'
        return (
          <Tag color={type === 'PICKUP' ? 'blue' : 'green'}>
            {getDeliveryTypeText(type)}
          </Tag>
        )
      },
    },
    {
      title: '운송장번호',
      dataIndex: 'trackingNo',
      key: 'trackingNo',
      width: 180,
      render: (trackingNo: string | undefined, record: OrderResponse) => {
        // 배송 주문인 경우에만 운송장 번호 입력 가능
        if (record.fulfillmentType === 'DELIVERY') {
          return (
            <Space>
              {trackingNo ? (
                <Tag color="blue">{trackingNo}</Tag>
              ) : (
                <Tag color="default">미입력</Tag>
              )}
              <Button
                type="link"
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleOpenTrackingModal(record)}
              >
                {trackingNo ? '수정' : '입력'}
              </Button>
            </Space>
          )
        }
        return <Typography.Text type="secondary">-</Typography.Text>
      },
    },
    {
      title: '금액',
      dataIndex: 'finalAmount',
      key: 'finalAmount',
      width: 120,
      render: (amount: number) => formatCurrency(amount),
      align: 'right' as const,
    },
    {
      title: '작업',
      key: 'actions',
      width: 120,
      render: (_: any, record: OrderResponse) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => navigate(`/orders/${record.orderId}`)}
        >
          상세보기
        </Button>
      ),
    },
  ]

  return (
    <div>
      <Space 
        direction="vertical" 
        size="middle" 
        style={{ marginBottom: 24, width: '100%' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <Title level={2} style={{ margin: 0 }}>주문 관리</Title>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => {
              // 모든 관련 쿼리 무효화 후 강제로 다시 불러오기
              queryClient.invalidateQueries({ queryKey: ['allOrders'] })
              queryClient.invalidateQueries({ queryKey: ['order'] })
              queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] })
              queryClient.refetchQueries({ queryKey: ['allOrders'] })
              refetch()
            }} 
            loading={isLoading}
          >
            새로고침
          </Button>
        </div>
      </Space>
      
      {/* 탭 섹션 */}
      <Card style={{ marginBottom: 24 }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => {
            setActiveTab(key)
            setCurrentPage(1) // 탭 변경 시 첫 페이지로
          }}
          items={[
            {
              key: 'PAID',
              label: '결제완료',
              children: null,
            },
            {
              key: 'CONFIRMED',
              label: '주문확인',
              children: null,
            },
            {
              key: 'DELIVERY',
              label: '배송중',
              children: null,
            },
            {
              key: 'COMPLETED',
              label: '완료',
              children: null,
            },
            {
              key: 'ALL',
              label: '전체',
              children: null,
            },
            {
              key: 'CREATED',
              label: '생성됨',
              children: null,
            },
            {
              key: 'CANCELED',
              label: '취소',
              children: null,
            },
          ]}
        />
        
        {/* 추가 필터 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} sm={12} md={8}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Text type="secondary">배송 방식</Typography.Text>
              <Select
                value={deliveryTypeFilter}
                onChange={(value) => {
                  setDeliveryTypeFilter(value)
                  setCurrentPage(1) // 필터 변경 시 첫 페이지로
                }}
                style={{ width: '100%' }}
                placeholder="배송 방식 선택"
              >
                <Option value="ALL">전체</Option>
                <Option value="PICKUP">픽업</Option>
                <Option value="DELIVERY">배송</Option>
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Text type="secondary">결제 수단</Typography.Text>
              <Select
                value={paymentMethodFilter}
                onChange={(value) => {
                  setPaymentMethodFilter(value)
                  setCurrentPage(1) // 필터 변경 시 첫 페이지로
                }}
                style={{ width: '100%' }}
                placeholder="결제 수단 선택"
              >
                <Option value="ALL">전체</Option>
                <Option value="BANK_TRANSFER">무통장 입금</Option>
                <Option value="CARD">카드</Option>
              </Select>
            </Space>
          </Col>
          <Col xs={24} sm={12} md={8}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Text type="secondary">필터 결과</Typography.Text>
              <Typography.Text strong>
                {totalOrders > 0 ? `${displayedOrders.length}개 주문` : '주문 없음'}
                {(deliveryTypeFilter !== 'ALL' || paymentMethodFilter !== 'ALL') && (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setDeliveryTypeFilter('ALL')
                      setPaymentMethodFilter('ALL')
                      setCurrentPage(1)
                    }}
                  >
                    필터 초기화
                  </Button>
                )}
              </Typography.Text>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 페이지네이션 정보 */}
      {totalOrders > 0 && (
        <Space wrap style={{ marginBottom: 16 }}>
          <Button 
            disabled={currentPage === 1} 
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
          >
            이전 페이지
          </Button>
          <span>
            페이지 {currentPage} / {totalPages} 
            {(deliveryTypeFilter !== 'ALL' || paymentMethodFilter !== 'ALL')
              ? ` (필터링 결과: ${displayedOrders.length}개)`
              : ` (전체 ${totalOrders}개 중 ${displayedOrders.length}개 표시)`}
          </span>
          <Button 
            disabled={currentPage >= totalPages} 
            onClick={() => setCurrentPage(prev => prev + 1)}
          >
            다음 페이지
          </Button>
        </Space>
      )}

      {error && (
        <Card style={{ marginBottom: 24 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text type="warning">
              ⚠️ 주문 리스트를 불러오는 중 오류가 발생했습니다.
            </Typography.Text>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {error instanceof Error ? error.message : '알 수 없는 오류'}
            </Typography.Text>
          </Space>
        </Card>
      )}
      <Card>
        <div style={{ overflowX: 'auto' }}>
          <Table
            columns={columns}
            dataSource={displayedOrders}
            rowKey="orderId"
            loading={isLoading}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: totalOrders,
              showTotal: (total) => `전체 ${total}개`,
              onChange: (page) => setCurrentPage(page),
            }}
            scroll={{ x: 'max-content' }}
            locale={{
              emptyText: isLoading 
                ? '주문 데이터를 불러오는 중...' 
                : displayedOrders.length === 0 && (deliveryTypeFilter !== 'ALL' || paymentMethodFilter !== 'ALL')
                ? '필터 조건에 맞는 주문이 없습니다.'
                : '주문 데이터가 없습니다.',
            }}
          />
        </div>
      </Card>

      {/* 운송장 번호 입력 모달 */}
      <Modal
        title="운송장 번호 입력"
        open={isTrackingModalOpen}
        onOk={handleTrackingModalOk}
        onCancel={() => {
          setIsTrackingModalOpen(false)
          setSelectedOrder(null)
          trackingForm.resetFields()
        }}
        confirmLoading={startDeliveryMutation.isPending}
      >
        <Form form={trackingForm} layout="vertical">
          <Form.Item
            label="운송장 번호"
            name="trackingNo"
            rules={[
              { required: true, message: '운송장 번호를 입력해주세요.' },
              { min: 1, message: '운송장 번호를 입력해주세요.' },
            ]}
          >
            <Input placeholder="운송장 번호를 입력하세요" />
          </Form.Item>
          {selectedOrder && (
            <div style={{ marginTop: 16, padding: 12, backgroundColor: '#f5f5f5', borderRadius: 4 }}>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                주문번호: {selectedOrder.orderNo}
              </Typography.Text>
              <br />
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                수령인: {selectedOrder.recipientName} ({selectedOrder.recipientPhone})
              </Typography.Text>
            </div>
          )}
        </Form>
      </Modal>

      {/* 주문 취소 모달 */}
      <Modal
        title="주문 취소"
        open={isCancelModalOpen}
        onOk={handleCancelModalOk}
        onCancel={() => {
          setIsCancelModalOpen(false)
          cancelForm.resetFields()
          setCancelOrderId(null)
        }}
        confirmLoading={cancelOrderMutation.isPending}
        okText="취소하기"
        cancelText="닫기"
        okButtonProps={{ danger: true }}
      >
        <Form form={cancelForm} layout="vertical">
          <Form.Item
            label="취소 사유 (선택사항)"
            name="reason"
          >
            <Input.TextArea 
              placeholder="취소 사유를 입력하세요 (예: 단순 변심, 재고 부족 등)"
              rows={4}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default OrderList
