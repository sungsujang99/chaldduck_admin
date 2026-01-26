import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Space, Typography, Tag, Button, Select, Row, Col, Modal, message, Input, Form, Tabs } from 'antd'
import { EyeOutlined, ReloadOutlined, EditOutlined, DownloadOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import { apiService } from '@/services/api'
import type { OrderResponse, OrderStatus, FulfillmentType, PaymentMethod } from '@/types/api'

// Title 제거됨 - 통계 테이블로 대체
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])

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
  const getStatusFilter = (tab: string): OrderStatus | 'ALL' | 'DELIVERY' | 'PICKUP_WAITING' | 'DELIVERY_READY' => {
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
      case 'PICKUP_WAITING':
        return 'PICKUP_WAITING' // 픽업대기
      case 'DELIVERY_READY':
        return 'DELIVERY_READY' // 배송준비
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
              // 첫 번째 주문의 필드 확인 (디버깅용)
              if (page === 0 && response.data.content[0]) {
                const order = response.data.content[0] as any
                console.log('[OrderList] 첫 번째 주문 전체 데이터:', order)
                console.log('[OrderList] 주문의 모든 키:', Object.keys(order))
                console.log('[OrderList] createdAt:', order.createdAt)
                console.log('[OrderList] updatedAt:', order.updatedAt)
                console.log('[OrderList] createDate:', order.createDate)
                console.log('[OrderList] updateDate:', order.updateDate)
              }
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
        // 배송 중인 주문: deliveryStatus가 DELIVERING인 주문
        if (order.deliveryStatus !== 'DELIVERING') {
          return false
        }
      } else if (statusFilter === 'PICKUP_WAITING') {
        // 픽업대기: PICKUP이면서 CONFIRMED 상태
        if (order.fulfillmentType !== 'PICKUP' || order.status !== 'CONFIRMED') {
          return false
        }
      } else if (statusFilter === 'DELIVERY_READY') {
        // 배송준비: DELIVERY이면서 (CONFIRMED 또는 PAID) 상태이고 deliveryStatus가 READY
        if (order.fulfillmentType !== 'DELIVERY' || 
            (order.status !== 'CONFIRMED' && order.status !== 'PAID') || 
            order.deliveryStatus !== 'READY') {
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

  // 주문 통계 계산 (전체 주문 기준)
  const orderStats = useMemo(() => {
    if (!ordersData?.data) {
      return {
        total: 0,
        waitingPayment: 0,
        newOrder: 0,
        pickupWaiting: 0,
        deliveryReady: 0,
        delivering: 0,
        completed: 0,
        canceled: 0,
      }
    }
    const orders = ordersData.data
    return {
      total: orders.length,
      waitingPayment: orders.filter((o) => o.status === 'CREATED').length,
      newOrder: orders.filter((o) => o.status === 'PAID').length,
      pickupWaiting: orders.filter((o) => o.fulfillmentType === 'PICKUP' && o.status === 'CONFIRMED').length,
      deliveryReady: orders.filter((o) => o.fulfillmentType === 'DELIVERY' && (o.status === 'CONFIRMED' || o.status === 'PAID') && o.deliveryStatus === 'READY').length,
      delivering: orders.filter((o) => o.deliveryStatus === 'DELIVERING').length,
      completed: orders.filter((o) => o.status === 'COMPLETED').length,
      canceled: orders.filter((o) => o.status === 'CANCELED').length,
    }
  }, [ordersData])

  // 필터가 변경되면 페이지를 1로 리셋
  useEffect(() => {
    setCurrentPage(1)
  }, [statusFilter, deliveryTypeFilter, paymentMethodFilter])

  // 결제 완료 처리 (CREATED → PAID)
  const markOrderPaidMutation = useMutation({
    mutationFn: async ({ orderId }: { orderId: number; paymentMethod: PaymentMethod }) => {
      // 1. 기존 결제 정보 조회 (주문 생성 시 자동 생성됨)
      const paymentResponse = await apiService.getPaymentByOrder(orderId)
      
      if (!paymentResponse || !paymentResponse.data) {
        throw new Error('결제 정보를 찾을 수 없습니다. 주문이 정상적으로 생성되었는지 확인해주세요.')
      }
      
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

  // 전화번호 포맷팅 (010-1234-5678 형식)
  const formatPhoneNumber = (phone?: string) => {
    if (!phone) return '-'
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`
    } else if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phone
  }

  // 체크된 주문 엑셀 다운로드
  // 주소에서 공동현관/입구비번 분리
  const extractEntranceCode = (address: string) => {
    // 공동현관, 입구비번, 비밀번호 등의 패턴 찾기
    const patterns = [
      /공동현관[:\s]*([#\d\*]+)/i,
      /입구비번[:\s]*([#\d\*]+)/i,
      /비밀번호[:\s]*([#\d\*]+)/i,
      /현관[:\s]*([#\d\*]+)/i,
      /#(\d+#?)/,
    ]
    
    for (const pattern of patterns) {
      const match = address.match(pattern)
      if (match) {
        const code = match[0]
        const cleanedAddress = address.replace(code, '').trim()
        return { address: cleanedAddress, entranceCode: match[1] || code }
      }
    }
    
    return { address, entranceCode: '' }
  }

  const handleExportToExcel = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('다운로드할 주문을 선택해주세요.')
      return
    }

    const selectedOrders = filteredOrders.filter(order => selectedRowKeys.includes(order.orderId))
    
    if (selectedOrders.length === 0) {
      message.warning('다운로드할 주문 데이터가 없습니다.')
      return
    }

    // 엑셀 데이터 준비 - 상품별로 한 줄씩
    const excelData: any[] = []
    
    selectedOrders.forEach((order) => {
      const items = order.items || []
      
      // 주소 합치기 + 공동현관 분리
      const fullAddress = `${order.address1 || ''} ${order.address2 || ''}`.trim()
      const { address: cleanAddress, entranceCode } = extractEntranceCode(fullAddress)
      
      if (items.length === 0) {
        // 상품이 없는 경우 주문 정보만 출력
        excelData.push({
          '이름': order.recipientName || '-',
          '전화번호': formatPhoneNumber(order.recipientPhone),
          '상품명': '-',
          '수량': 0,
          '단가': 0,
          '금액': order.finalAmount || 0,
          '배송지주소': cleanAddress || '-',
          '공동현관/입구비번': entranceCode || '-',
          '매입가': '-',
          '닉네임': order.recipientName || '-',
          '결제수단': getPaymentMethodText(order.paymentMethod),
        })
      } else {
        // 각 상품마다 한 줄씩 출력
        items.forEach((item, index) => {
          excelData.push({
            '이름': order.recipientName || '-',
            '전화번호': formatPhoneNumber(order.recipientPhone),
            '상품명': item.productName || '-',
            '수량': item.quantity || 0,
            '단가': item.unitPrice || 0,
            '금액': index === 0 ? (order.finalAmount || 0) : '', // 첫 번째 상품에만 총액 표시
            '배송지주소': index === 0 ? (cleanAddress || '-') : '', // 첫 번째 상품에만 주소 표시
            '공동현관/입구비번': index === 0 ? (entranceCode || '-') : '',
            '매입가': (item as any).purchasePrice || '-',
            '닉네임': order.recipientName || '-',
            '결제수단': index === 0 ? getPaymentMethodText(order.paymentMethod) : '',
          })
        })
      }
    })

    // 워크북 생성
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)
    
    // 컬럼 너비 설정
    ws['!cols'] = [
      { wch: 12 },  // 이름
      { wch: 15 },  // 전화번호
      { wch: 40 },  // 상품명
      { wch: 8 },   // 수량
      { wch: 12 },  // 단가
      { wch: 12 },  // 금액
      { wch: 50 },  // 배송지주소
      { wch: 20 },  // 공동현관/입구비번
      { wch: 10 },  // 매입가
      { wch: 12 },  // 닉네임
      { wch: 12 },  // 결제수단
    ]

    XLSX.utils.book_append_sheet(wb, ws, '주문목록')

    // 파일 다운로드
    const fileName = `주문목록_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, fileName)

    message.success(`${selectedOrders.length}건의 주문이 다운로드되었습니다.`)
    setSelectedRowKeys([]) // 선택 초기화
  }

  // 테이블 체크박스 설정
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
  }

  const columns = [
    {
      title: '주문 ID',
      key: 'orderId',
      width: 100,
      render: (_: any, record: OrderResponse) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.orderId}</Typography.Text>
          <Typography.Link 
            style={{ fontSize: 11 }}
            onClick={(e) => {
              e.stopPropagation()
              navigate(`/orders/${record.orderId}`)
            }}
          >
            상세보기
          </Typography.Link>
        </Space>
      ),
    },
    {
      title: '주문번호',
      key: 'orderNo',
      width: 180,
      render: (_: any, record: any) => {
        // 다양한 필드명 체크: createdAt, updatedAt, createDate, updateDate
        const timestamp = record.createdAt || record.createDate || record.updatedAt || record.updateDate
        
        const formatDateTime = (dateStr: string) => {
          const date = new Date(dateStr)
          return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
          })
        }
        
        // 주문번호에서 날짜 추출 (예: OD-20260107-7F3A2C → 2026.01.07)
        const extractDateFromOrderNo = (orderNo: string) => {
          const match = orderNo?.match(/OD-(\d{4})(\d{2})(\d{2})-/)
          if (match) {
            return `${match[1]}. ${match[2]}. ${match[3]}.`
          }
          return null
        }
        
        const displayDate = timestamp 
          ? formatDateTime(timestamp)
          : extractDateFromOrderNo(record.orderNo)
        
        return (
          <Space direction="vertical" size={0}>
            <Typography.Text strong>{record.orderNo}</Typography.Text>
            {displayDate && (
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {displayDate}
              </Typography.Text>
            )}
          </Space>
        )
      },
    },
    {
      title: '주문자',
      key: 'customer',
      width: 150,
      render: (_: any, record: OrderResponse) => (
        <Space direction="vertical" size={0}>
          <Typography.Text strong>{record.recipientName || '-'}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {formatPhoneNumber(record.recipientPhone)}
          </Typography.Text>
        </Space>
      ),
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
      title: '결제 방식',
      key: 'payment',
      width: 150,
      render: (_: any, record: OrderResponse & { paymentMethod?: PaymentMethod }) => (
        <Space direction="vertical" size={2} align="center">
          <Typography.Text strong style={{ color: '#1890ff' }}>
            {formatCurrency(record.finalAmount)}
          </Typography.Text>
          {record.paymentMethod ? (
            <Tag color={record.paymentMethod === 'BANK_TRANSFER' ? 'blue' : 'green'}>
              {getPaymentMethodText(record.paymentMethod)}
            </Tag>
          ) : (
            <Tag color="default">미결제</Tag>
          )}
        </Space>
      ),
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
      width: 280,
      render: (_: any, record: OrderResponse) => {
        if (record.items && record.items.length > 0) {
          return (
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              {record.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <Typography.Text ellipsis style={{ maxWidth: 180 }}>
                    {item.productName}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ marginLeft: 8 }}>
                    x{item.quantity}
                  </Typography.Text>
                </div>
              ))}
            </Space>
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
      {/* 주문 통계 테이블 */}
      <Card 
        title={<span style={{ fontWeight: 600 }}>전체주문관리</span>}
        style={{ marginBottom: 24 }}
        styles={{
          header: {
            borderBottom: '2px solid #000',
          }
        }}
        extra={
          <Space>
            <Button 
              icon={<DownloadOutlined />} 
              onClick={handleExportToExcel}
              disabled={selectedRowKeys.length === 0}
            >
              엑셀 다운로드 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length}건)`}
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => {
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
          </Space>
        }
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'center' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #d9d9d9' }}>
              <th style={{ padding: '12px 8px', fontWeight: 600, fontSize: 14 }}>총 주문</th>
              <th 
                style={{ padding: '12px 8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#1890ff' }}
                onClick={() => setActiveTab('CREATED')}
              >
                입금대기
              </th>
              <th 
                style={{ padding: '12px 8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#52c41a' }}
                onClick={() => setActiveTab('PAID')}
              >
                신규주문
              </th>
              <th 
                style={{ padding: '12px 8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#722ed1' }}
                onClick={() => setActiveTab('PICKUP_WAITING')}
              >
                픽업대기
              </th>
              <th 
                style={{ padding: '12px 8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#13c2c2' }}
                onClick={() => setActiveTab('DELIVERY_READY')}
              >
                배송준비
              </th>
              <th 
                style={{ padding: '12px 8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#fa8c16' }}
                onClick={() => setActiveTab('DELIVERY')}
              >
                배송중
              </th>
              <th 
                style={{ padding: '12px 8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#52c41a' }}
                onClick={() => setActiveTab('COMPLETED')}
              >
                완료
              </th>
              <th 
                style={{ padding: '12px 8px', fontWeight: 600, fontSize: 14, cursor: 'pointer', color: '#ff4d4f' }}
                onClick={() => setActiveTab('CANCELED')}
              >
                취소
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td 
                style={{ padding: '16px 8px', fontSize: 20, fontWeight: 700, cursor: 'pointer' }}
                onClick={() => setActiveTab('ALL')}
              >
                {orderStats.total}
              </td>
              <td 
                style={{ padding: '16px 8px', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: '#1890ff' }}
                onClick={() => setActiveTab('CREATED')}
              >
                {orderStats.waitingPayment}
              </td>
              <td 
                style={{ padding: '16px 8px', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: '#52c41a' }}
                onClick={() => setActiveTab('PAID')}
              >
                {orderStats.newOrder}
              </td>
              <td 
                style={{ padding: '16px 8px', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: '#722ed1' }}
                onClick={() => setActiveTab('PICKUP_WAITING')}
              >
                {orderStats.pickupWaiting}
              </td>
              <td 
                style={{ padding: '16px 8px', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: '#13c2c2' }}
                onClick={() => setActiveTab('DELIVERY_READY')}
              >
                {orderStats.deliveryReady}
              </td>
              <td 
                style={{ padding: '16px 8px', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: '#fa8c16' }}
                onClick={() => setActiveTab('DELIVERY')}
              >
                {orderStats.delivering}
              </td>
              <td 
                style={{ padding: '16px 8px', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: '#52c41a' }}
                onClick={() => setActiveTab('COMPLETED')}
              >
                {orderStats.completed}
              </td>
              <td 
                style={{ padding: '16px 8px', fontSize: 20, fontWeight: 700, cursor: 'pointer', color: '#ff4d4f' }}
                onClick={() => setActiveTab('CANCELED')}
              >
                {orderStats.canceled}
              </td>
            </tr>
          </tbody>
        </table>
      </Card>
      
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
              key: 'ALL',
              label: `전체 (${orderStats.total})`,
              children: null,
            },
            {
              key: 'CREATED',
              label: `입금대기 (${orderStats.waitingPayment})`,
              children: null,
            },
            {
              key: 'PAID',
              label: `신규주문 (${orderStats.newOrder})`,
              children: null,
            },
            {
              key: 'PICKUP_WAITING',
              label: `픽업대기 (${orderStats.pickupWaiting})`,
              children: null,
            },
            {
              key: 'DELIVERY_READY',
              label: `배송준비 (${orderStats.deliveryReady})`,
              children: null,
            },
            {
              key: 'DELIVERY',
              label: `배송중 (${orderStats.delivering})`,
              children: null,
            },
            {
              key: 'COMPLETED',
              label: `완료 (${orderStats.completed})`,
              children: null,
            },
            {
              key: 'CANCELED',
              label: `취소 (${orderStats.canceled})`,
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
            rowSelection={rowSelection}
            onRow={(record) => ({
              onClick: () => navigate(`/orders/${record.orderId}`),
              style: { cursor: 'pointer' },
            })}
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
