import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Card,
  Descriptions,
  Table,
  Button,
  Tag,
  Space,
  Typography,
  message,
  Modal,
  Form,
  Input,
  Divider,
} from 'antd'
import { ArrowLeftOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons'
import { apiService } from '@/services/api'
import type { OrderStatus, PaymentMethod } from '@/types/api'

const { Title } = Typography

const OrderDetail = () => {
  const { orderId } = useParams<{ orderId: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [trackingForm] = Form.useForm()
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false)
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [cancelForm] = Form.useForm()

  const { data: orderData, isLoading, refetch: refetchOrder } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => apiService.getOrder(Number(orderId)),
    enabled: !!orderId,
  })

  const { data: paymentData, refetch: refetchPayment } = useQuery({
    queryKey: ['paymentByOrder', orderId],
    queryFn: () => apiService.getPaymentByOrder(Number(orderId)),
    enabled: !!orderId,
    retry: false, // 404는 재시도하지 않음
  })

  const handleRefresh = () => {
    // 모든 관련 쿼리 무효화 후 강제로 다시 불러오기
    queryClient.invalidateQueries({ queryKey: ['order', orderId] })
    queryClient.invalidateQueries({ queryKey: ['paymentByOrder', orderId] })
    queryClient.refetchQueries({ queryKey: ['order', orderId] })
    queryClient.refetchQueries({ queryKey: ['paymentByOrder', orderId] })
    refetchOrder()
    refetchPayment()
  }

  // 결제 완료 처리 (CREATED → PAID)
  const markOrderPaidMutation = useMutation({
    mutationFn: async (paymentMethod: PaymentMethod = 'BANK_TRANSFER') => {
      // 먼저 기존 결제가 있는지 확인
      let existingPayment = await apiService.getPaymentByOrder(Number(orderId))
      let paymentId: number
      
      if (existingPayment?.data) {
        // 기존 결제가 있으면 바로 사용 (409 에러 방지)
        paymentId = existingPayment.data.paymentId
        console.log('[OrderDetail] 기존 결제 사용:', paymentId)
      } else {
        // 결제가 없으면 생성 (CREATED 상태에서 결제 생성 필요)
        try {
          const paymentResponse = await apiService.createPayment(Number(orderId), { method: paymentMethod })
          paymentId = paymentResponse.data.paymentId
          console.log('[OrderDetail] 새 결제 생성:', paymentId)
        } catch (createError: any) {
          // 409 Conflict: 이미 결제가 생성된 경우 기존 결제 조회
          if (createError.response?.status === 409) {
            console.log('[OrderDetail] 결제 생성 충돌 (409), 기존 결제 재조회')
            existingPayment = await apiService.getPaymentByOrder(Number(orderId))
            if (existingPayment?.data) {
              paymentId = existingPayment.data.paymentId
              console.log('[OrderDetail] 기존 결제 사용 (충돌 후):', paymentId)
            } else {
              throw new Error('결제 생성에 실패했고 기존 결제도 찾을 수 없습니다.')
            }
          } else {
            throw createError
          }
        }
      }
      
      // 결제 완료 처리 (주문도 PAID로 전이)
      await apiService.markPaymentPaid(paymentId, { pgPaymentKey: 'MANUAL_ADMIN' })
      return { paymentId }
    },
    onSuccess: () => {
      message.success('주문이 결제완료 처리되었습니다.')
      // 모든 관련 쿼리 무효화 후 전체 API 다시 호출
      queryClient.invalidateQueries({ queryKey: ['allOrders'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
      queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] })
      refetchOrder()
      refetchPayment()
    },
    onError: (error: any) => {
      console.error('[OrderDetail] 결제 완료 처리 에러 상세:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        message: error.message,
        fullError: error,
      });
      
      let errorMessage = '결제 완료 처리에 실패했습니다.'
      if (error.response?.status === 409) {
        errorMessage = '이미 결제가 생성되어 있습니다. 페이지를 새로고침한 후 다시 시도해주세요.'
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message
      } else if (error.response?.data?.error) {
        errorMessage = error.response.data.error
      } else if (error.message) {
        errorMessage = error.message
      }
      
      message.error({
        content: errorMessage,
        duration: 5,
      });
    },
  })

  // 주문 확인 처리 (PAID → CONFIRMED)
  const confirmOrderMutation = useMutation({
    mutationFn: () => apiService.confirmOrder(Number(orderId)),
    onSuccess: () => {
      message.success('주문이 확인되었습니다.')
      // 모든 관련 쿼리 무효화 후 전체 API 다시 호출
      queryClient.invalidateQueries({ queryKey: ['allOrders'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
      queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] })
      refetchOrder()
      refetchPayment()
    },
    onError: (error: any) => {
      console.error('[OrderDetail] 주문 확인 에러 상세:', {
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

  // 주문 완료 처리 (CONFIRMED → COMPLETED)
  const completeOrderMutation = useMutation({
    mutationFn: async () => {
      // CONFIRMED 상태에서만 COMPLETED로 변경 가능
      const orderResponse = await apiService.getOrder(Number(orderId))
      const currentStatus = orderResponse.data.status
      
      if (currentStatus === 'CONFIRMED') {
        // CONFIRMED → COMPLETED
        await apiService.completeOrder(Number(orderId))
      } else {
        throw new Error(`주문 상태가 올바르지 않습니다. (현재 상태: ${currentStatus}, 예상: CONFIRMED)`)
      }
    },
    onSuccess: () => {
      message.success('주문이 완료되었습니다.')
      // 모든 관련 쿼리 무효화 후 전체 API 다시 호출
      queryClient.invalidateQueries({ queryKey: ['allOrders'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
      queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] })
      refetchOrder()
      refetchPayment()
    },
    onError: (error: any) => {
      console.error('[OrderDetail] 주문 완료 에러 상세:', {
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
    mutationFn: ({ reason }: { reason?: string }) => 
      apiService.cancelOrder(Number(orderId), { reason }),
    onSuccess: () => {
      message.success('주문이 취소되었습니다.')
      setIsCancelModalOpen(false)
      cancelForm.resetFields()
      // 모든 관련 쿼리 무효화 후 전체 API 다시 호출
      queryClient.invalidateQueries({ queryKey: ['allOrders'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
      queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] })
      refetchOrder()
      refetchPayment()
    },
    onError: (error: any) => {
      console.error('[OrderDetail] 주문 취소 에러 상세:', {
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
  const updateTrackingNumberMutation = useMutation({
    mutationFn: async (trackingNo: string) => {
      return apiService.startDelivery(Number(orderId), { trackingNo })
    },
    onSuccess: () => {
      message.success('운송장 번호가 등록되었습니다.')
      setIsTrackingModalOpen(false)
      trackingForm.resetFields()
      // 모든 관련 쿼리 무효화 후 전체 API 다시 호출
      queryClient.invalidateQueries({ queryKey: ['allOrders'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
      queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] })
      refetchOrder()
      refetchPayment()
    },
    onError: (error: any) => {
      console.error('[OrderDetail] 운송장 번호 등록 에러:', error)
      const errorMessage = error.response?.data?.message || error.response?.data?.error || `운송장 번호 등록에 실패했습니다. (${error.response?.status || '알 수 없는 오류'})`;
      message.error({
        content: errorMessage,
        duration: 5,
      });
    },
  })

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ko-KR').format(amount) + '원'
  }

  const handleMarkOrderPaid = () => {
    const paymentMethod = payment?.method || 'BANK_TRANSFER'
    Modal.confirm({
      title: '결제 완료 처리',
      content: `이 주문을 결제완료 처리하시겠습니까? (CREATED → PAID)\n결제 수단: ${paymentMethod === 'BANK_TRANSFER' ? '무통장 입금' : '카드'}`,
      onOk: () => markOrderPaidMutation.mutate(paymentMethod),
    })
  }

  const handleConfirmOrder = () => {
    Modal.confirm({
      title: '주문 확인',
      content: '이 주문을 확인 처리하시겠습니까? (PAID → CONFIRMED)',
      onOk: () => confirmOrderMutation.mutate(),
    })
  }

  const handleCompleteOrder = () => {
    Modal.confirm({
      title: '주문 완료',
      content: '이 주문을 완료 처리하시겠습니까? (CONFIRMED → COMPLETED)',
      onOk: () => completeOrderMutation.mutate(),
    })
  }

  const handleCancelOrder = () => {
    setIsCancelModalOpen(true)
  }

  const handleCancelModalOk = () => {
    cancelForm.validateFields().then((values) => {
      cancelOrderMutation.mutate({ 
        reason: values.reason || undefined 
      })
    }).catch((error) => {
      console.error('취소 사유 입력 오류:', error)
    })
  }

  const handleTrackingSubmit = (values: { trackingNumber: string }) => {
    updateTrackingNumberMutation.mutate(values.trackingNumber.trim())
  }

  const handleOpenTrackingModal = () => {
    trackingForm.setFieldsValue({ trackingNumber: order?.trackingNo || '' })
    setIsTrackingModalOpen(true)
  }

  if (isLoading) {
    return <div>로딩 중...</div>
  }

  const order = orderData?.data
  const payment = paymentData?.data

  if (!order) {
    return <div>주문을 찾을 수 없습니다.</div>
  }

  const itemColumns = [
    {
      title: '상품명',
      dataIndex: 'productName',
      key: 'productName',
    },
    {
      title: '단가',
      dataIndex: 'unitPrice',
      key: 'unitPrice',
      render: (price: number) => formatCurrency(price),
      align: 'right' as const,
    },
    {
      title: '수량',
      dataIndex: 'quantity',
      key: 'quantity',
      align: 'right' as const,
    },
    {
      title: '합계',
      dataIndex: 'lineTotal',
      key: 'lineTotal',
      render: (total: number) => formatCurrency(total),
      align: 'right' as const,
    },
  ]

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <Space wrap>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>
            뒤로
          </Button>
          <Title level={2} style={{ margin: 0 }}>주문 상세</Title>
        </Space>
        <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={isLoading}>
          새로고침
        </Button>
      </div>

      <Card
        style={{ marginBottom: 24 }}
        extra={
          <Space>
            {order.status === 'CREATED' && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleMarkOrderPaid}
                loading={markOrderPaidMutation.isPending}
              >
                결제 완료
              </Button>
            )}
            {order.status === 'PAID' && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleConfirmOrder}
                loading={confirmOrderMutation.isPending}
              >
                주문 확인 (PAID → CONFIRMED)
              </Button>
            )}
            {order.status === 'CONFIRMED' && (
              <Button
                type="primary"
                icon={<CheckOutlined />}
                onClick={handleCompleteOrder}
                loading={completeOrderMutation.isPending}
              >
                주문 완료 (CONFIRMED → COMPLETED)
              </Button>
            )}
            {order.status !== 'CANCELED' && order.status !== 'COMPLETED' && (
              <Button
                danger
                onClick={handleCancelOrder}
                loading={cancelOrderMutation.isPending}
                style={{ transition: 'all 0.3s ease' }}
              >
                주문 취소
              </Button>
            )}
          </Space>
        }
      >
        <Descriptions title="주문 정보" bordered>
          <Descriptions.Item label="주문 ID">{order.orderId}</Descriptions.Item>
          <Descriptions.Item label="주문번호">{order.orderNo}</Descriptions.Item>
          <Descriptions.Item label="상태">
            <Tag color={getStatusColor(order.status)}>{getStatusText(order.status)}</Tag>
          </Descriptions.Item>
          {order.fulfillmentType && (
            <Descriptions.Item label="배송 방식">
              <Tag color={order.fulfillmentType === 'PICKUP' ? 'blue' : 'green'}>
                {order.fulfillmentType === 'PICKUP' ? '픽업' : order.fulfillmentType === 'DELIVERY' ? '배송' : '-'}
              </Tag>
            </Descriptions.Item>
          )}
          {order.fulfillmentType === 'DELIVERY' && (
            <Descriptions.Item label="운송장번호">
              {order.trackingNo ? (
                <Space>
                  <span>{order.trackingNo}</span>
                  <Button type="link" size="small" onClick={handleOpenTrackingModal}>
                    수정
                  </Button>
                </Space>
              ) : (
                <Button type="link" size="small" onClick={handleOpenTrackingModal}>
                  입력하기
                </Button>
              )}
            </Descriptions.Item>
          )}
          {order.deliveryStatus && (
            <Descriptions.Item label="배송 상태">
              <Tag color={
                order.deliveryStatus === 'DELIVERED' ? 'green' :
                order.deliveryStatus === 'DELIVERING' ? 'blue' :
                order.deliveryStatus === 'READY' ? 'orange' : 'default'
              }>
                {order.deliveryStatus === 'DELIVERED' ? '배송완료' :
                 order.deliveryStatus === 'DELIVERING' ? '배송중' :
                 order.deliveryStatus === 'READY' ? '배송예약' : '없음'}
              </Tag>
            </Descriptions.Item>
          )}
          <Descriptions.Item label="고객 ID">{order.customerId}</Descriptions.Item>
          <Descriptions.Item label="수령인">{order.recipientName}</Descriptions.Item>
          <Descriptions.Item label="수령인 전화번호">{order.recipientPhone}</Descriptions.Item>
          <Descriptions.Item label="우편번호">{order.zipCode}</Descriptions.Item>
          <Descriptions.Item label="주소" span={2}>
            {order.address1} {order.address2}
          </Descriptions.Item>
          <Descriptions.Item label="현금영수증">
            {order.cashReceipt && order.cashReceiptNo ? (
              <Space direction="vertical" size={0}>
                <Tag color="green">발급</Tag>
                <Typography.Text>{order.cashReceiptNo}</Typography.Text>
              </Space>
            ) : (
              <Tag color="default">미발급</Tag>
            )}
          </Descriptions.Item>
        </Descriptions>
      </Card>

      <Card title="주문 상품" style={{ marginBottom: 24 }}>
        <Table
          columns={itemColumns}
          dataSource={order.items}
          rowKey="orderItemId"
          pagination={false}
        />
        <Divider />
        <div style={{ textAlign: 'right', fontSize: 16 }}>
          <Space direction="vertical" align="end" size="small">
            <div>상품 합계: {formatCurrency(order.subtotalAmount)}</div>
            <div>배송비: {formatCurrency(order.deliveryFee)}</div>
            <div>할인금액: {formatCurrency(order.discountAmount)}</div>
            <div style={{ fontWeight: 'bold', fontSize: 18 }}>
              최종금액: {formatCurrency(order.finalAmount)}
            </div>
          </Space>
        </div>
      </Card>

      {payment && (
        <Card title="결제 정보" style={{ marginBottom: 24 }}>
          <Descriptions bordered>
            <Descriptions.Item label="결제 수단">
              {payment.method === 'BANK_TRANSFER' ? '무통장 입금' : '카드'}
            </Descriptions.Item>
            <Descriptions.Item label="상태">
              <Tag
                color={
                  payment.status === 'PAID'
                    ? 'green'
                    : payment.status === 'FAILED'
                    ? 'red'
                    : 'orange'
                }
              >
                {payment.status === 'PAID'
                  ? '결제완료'
                  : payment.status === 'FAILED'
                  ? '실패'
                  : payment.status === 'CANCELED'
                  ? '취소됨'
                  : '대기중'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="결제 금액">{formatCurrency(payment.amount)}</Descriptions.Item>
            {payment.memo && <Descriptions.Item label="메모">{payment.memo}</Descriptions.Item>}
          </Descriptions>
        </Card>
      )}

      <Modal
        title="배송번호 입력"
        open={isTrackingModalOpen}
        onOk={() => trackingForm.submit()}
        onCancel={() => {
          setIsTrackingModalOpen(false)
          trackingForm.resetFields()
        }}
        confirmLoading={updateTrackingNumberMutation.isPending}
      >
        <Form form={trackingForm} layout="vertical" onFinish={handleTrackingSubmit}>
          <Form.Item
            label="배송번호"
            name="trackingNumber"
            rules={[{ required: true, message: '배송번호를 입력해주세요.' }]}
          >
            <Input placeholder="배송번호를 입력하세요" />
          </Form.Item>
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
        }}
        confirmLoading={cancelOrderMutation.isPending}
        okText="취소하기"
        cancelText="닫기"
        okButtonProps={{ 
          danger: true,
          style: { transition: 'all 0.3s ease' }
        }}
        cancelButtonProps={{
          style: { transition: 'all 0.3s ease' }
        }}
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

export default OrderDetail
