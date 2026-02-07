import { useState, useEffect, useMemo, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Table, Space, Typography, Tag, Button, Select, Row, Col, Modal, message, Input, Form, Tabs, DatePicker } from 'antd'
import { ReloadOutlined, EditOutlined, DownloadOutlined } from '@ant-design/icons'
import { useNavigate, useSearchParams } from 'react-router-dom'
import * as XLSX from 'xlsx'
import dayjs, { Dayjs } from 'dayjs'
import { Resizable } from 'react-resizable'
import 'react-resizable/css/styles.css'
import { apiService } from '@/services/api'
import type { OrderResponse, OrderStatus, FulfillmentType, PaymentMethod } from '@/types/api'

// Title 제거됨 - 통계 테이블로 대체
const { Option } = Select

// Resizable 컬럼 헤더 컴포넌트
const ResizableTitle = (props: any) => {
  const { onResize, width, ...restProps } = props

  if (!width) {
    return <th {...restProps} />
  }

  return (
    <Resizable
      width={width}
      height={0}
      handle={
        <span
          className="react-resizable-handle"
          onClick={(e) => {
            e.stopPropagation()
          }}
        />
      }
      onResize={onResize}
      draggableOpts={{ enableUserSelectHack: false }}
    >
      <th {...restProps} />
    </Resizable>
  )
}

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
  const [pageSize, setPageSize] = useState(10)
  const [searchText, setSearchText] = useState('')
  // 날짜 필터
  const [dateFilterTab, setDateFilterTab] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'quarterly'>('all')
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
  const [selectedWeek, setSelectedWeek] = useState<string>(() => {
    const today = dayjs()
    const weekStart = today.startOf('week')
    return weekStart.format('YYYY-MM-DD')
  })
  const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().format('YYYY-MM'))
  const [isTrackingModalOpen, setIsTrackingModalOpen] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<OrderResponse | null>(null)
  const [trackingForm] = Form.useForm()
  const [isCancelModalOpen, setIsCancelModalOpen] = useState(false)
  const [cancelOrderId, setCancelOrderId] = useState<number | null>(null)
  const [cancelForm] = Form.useForm()
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([])
  const [isBulkStatusModalOpen, setIsBulkStatusModalOpen] = useState(false)
  const tableWrapperRef = useRef<HTMLDivElement>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  
  // 컬럼 너비 상태 관리
  const [columnWidths, setColumnWidths] = useState<{ [key: string]: number }>({
    orderId: 60,
    orderNo: 140,
    customer: 130,
    status: 70,
    actions: 80,
    payment: 100,
    cashReceipt: 110,
    items: 280,
    fulfillmentType: 100,
    address: 200,
    trackingNo: 150,
  })

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
            console.log(`[OrderList] 페이지 ${page} 응답:`, response)
            
            // API 응답 형식 확인 (배열 또는 페이지네이션 객체)
            let orders: OrderResponse[] = []
            let isLastPage = true
            
            if (response.data) {
              // 배열인 경우 (JsonBodyListOrderResponse)
              if (Array.isArray(response.data)) {
                orders = response.data
                isLastPage = true // 배열 응답은 한번에 전체를 반환
                console.log(`[OrderList] 배열 응답: ${orders.length}개`)
              } 
              // 페이지네이션 객체인 경우
              else if (response.data.content) {
                orders = response.data.content
                isLastPage = response.data.last || orders.length < fetchPageSize
                console.log(`[OrderList] 페이지네이션 응답: ${orders.length}개, last: ${response.data.last}`)
              }
            }
            
            if (orders.length > 0) {
              // 첫 번째 주문의 필드 확인 (디버깅용)
              if (page === 0 && orders[0]) {
                console.log('[OrderList] 첫 번째 주문 전체 데이터:', orders[0])
                console.log('[OrderList] orderedAt:', (orders[0] as any).orderedAt)
              }
              allOrders.push(...orders)
              
              if (isLastPage) {
                hasMore = false
              } else {
                page++
              }
            } else {
              hasMore = false
            }
          } catch (err: any) {
            console.error(`[OrderList] 주문 조회 실패 (페이지 ${page}):`, err.message, err)
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
      // 검색 필터 (주문번호, 고객명, 전화번호)
      if (searchText) {
        const searchLower = searchText.toLowerCase().trim()
        const orderNoMatch = order.orderNo?.toLowerCase().includes(searchLower)
        const nameMatch = order.recipientName?.toLowerCase().includes(searchLower)
        const phoneMatch = order.recipientPhone?.replace(/[^0-9]/g, '').includes(searchLower.replace(/[^0-9]/g, ''))
        
        if (!orderNoMatch && !nameMatch && !phoneMatch) {
          return false
        }
      }

      // 날짜 필터
      if (dateFilterTab !== 'all') {
        // orderNo에서 날짜 추출 (예: OD-20260126-xxx)
        const match = order.orderNo?.match(/OD-(\d{4})(\d{2})(\d{2})-/)
        if (!match) return false
        
        const orderDate = dayjs(`${match[1]}-${match[2]}-${match[3]}`)
        
        if (dateFilterTab === 'daily') {
          if (!orderDate.isSame(selectedDate, 'day')) return false
        } else if (dateFilterTab === 'weekly') {
          const weekStart = dayjs(selectedWeek)
          const weekEnd = weekStart.endOf('week')
          if (!orderDate.isAfter(weekStart.subtract(1, 'day')) || !orderDate.isBefore(weekEnd.add(1, 'day'))) {
            return false
          }
        } else if (dateFilterTab === 'monthly') {
          const monthStart = dayjs(selectedMonth).startOf('month')
          const monthEnd = dayjs(selectedMonth).endOf('month')
          if (!orderDate.isAfter(monthStart.subtract(1, 'day')) || !orderDate.isBefore(monthEnd.add(1, 'day'))) {
            return false
          }
        } else if (dateFilterTab === 'quarterly') {
          // 최근 3개월
          const threeMonthsAgo = dayjs().subtract(3, 'month').startOf('day')
          if (!orderDate.isAfter(threeMonthsAgo.subtract(1, 'day'))) {
            return false
          }
        }
      }

      // 상태 필터
      if (statusFilter === 'DELIVERY') {
        // 배송 중인 주문: deliveryStatus가 DELIVERING인 주문
        if (order.deliveryStatus !== 'DELIVERING') {
          return false
        }
      } else if (statusFilter === 'PICKUP_WAITING') {
        // 픽업대기: PICKUP이면서 PAID 상태 (결제완료 후 바로 픽업대기)
        if (order.fulfillmentType !== 'PICKUP' || order.status !== 'PAID') {
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
  }, [ordersData, statusFilter, deliveryTypeFilter, paymentMethodFilter, searchText, dateFilterTab, selectedDate, selectedWeek, selectedMonth])

  // 클라이언트 사이드 페이지네이션
  const totalOrders = filteredOrders.length
  const totalPages = Math.ceil(totalOrders / pageSize)
  const displayedOrders = filteredOrders.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  // 주문 통계 계산 (날짜 필터 적용된 주문 기준)
  const orderStats = useMemo(() => {
    // 날짜 필터만 적용된 주문 목록 (상태/배송방식/결제수단/검색 필터 제외)
    const dateFilteredOrders = ordersData?.data?.filter((order) => {
      // 날짜 필터
      if (dateFilterTab !== 'all') {
        // orderNo에서 날짜 추출 (예: OD-20260126-xxx)
        const match = order.orderNo?.match(/OD-(\d{4})(\d{2})(\d{2})-/)
        if (!match) return false
        
        const orderDate = dayjs(`${match[1]}-${match[2]}-${match[3]}`)
        
        if (dateFilterTab === 'daily') {
          if (!orderDate.isSame(selectedDate, 'day')) return false
        } else if (dateFilterTab === 'weekly') {
          const weekStart = dayjs(selectedWeek)
          const weekEnd = weekStart.endOf('week')
          if (!orderDate.isAfter(weekStart.subtract(1, 'day')) || !orderDate.isBefore(weekEnd.add(1, 'day'))) {
            return false
          }
        } else if (dateFilterTab === 'monthly') {
          const monthStart = dayjs(selectedMonth).startOf('month')
          const monthEnd = dayjs(selectedMonth).endOf('month')
          if (!orderDate.isAfter(monthStart.subtract(1, 'day')) || !orderDate.isBefore(monthEnd.add(1, 'day'))) {
            return false
          }
        } else if (dateFilterTab === 'quarterly') {
          // 최근 3개월
          const threeMonthsAgo = dayjs().subtract(3, 'month').startOf('day')
          if (!orderDate.isAfter(threeMonthsAgo.subtract(1, 'day'))) {
            return false
          }
        }
      }
      return true
    }) || []

    return {
      total: dateFilteredOrders.length,
      waitingPayment: dateFilteredOrders.filter((o) => o.status === 'CREATED').length,
      newOrder: dateFilteredOrders.filter((o) => o.fulfillmentType === 'DELIVERY' && o.status === 'PAID').length,
      pickupWaiting: dateFilteredOrders.filter((o) => o.fulfillmentType === 'PICKUP' && o.status === 'PAID').length,
      deliveryReady: dateFilteredOrders.filter((o) => o.fulfillmentType === 'DELIVERY' && (o.status === 'CONFIRMED' || o.status === 'PAID') && o.deliveryStatus === 'READY').length,
      delivering: dateFilteredOrders.filter((o) => o.deliveryStatus === 'DELIVERING').length,
      completed: dateFilteredOrders.filter((o) => o.status === 'COMPLETED').length,
      canceled: dateFilteredOrders.filter((o) => o.status === 'CANCELED').length,
    }
  }, [ordersData, dateFilterTab, selectedDate, selectedWeek, selectedMonth])

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
    onSuccess: async () => {
      message.success('주문이 결제완료 처리되었습니다.')
      // 모든 관련 쿼리 무효화하고 다시 가져오기
      await queryClient.invalidateQueries({ queryKey: ['allOrders'] })
      await queryClient.invalidateQueries({ queryKey: ['order'] })
      await queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] })
      // 쿼리를 무효화하면 자동으로 다시 가져오므로 refetch() 호출 불필요
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
    onSuccess: async () => {
      message.success('주문이 완료되었습니다.')
      // 모든 관련 쿼리 무효화하고 다시 가져오기
      await queryClient.invalidateQueries({ queryKey: ['allOrders'] })
      await queryClient.invalidateQueries({ queryKey: ['order'] })
      await queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] })
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
    onSuccess: async () => {
      message.success('주문이 취소되었습니다.')
      setIsCancelModalOpen(false)
      cancelForm.resetFields()
      setCancelOrderId(null)
      // 모든 관련 쿼리 무효화하고 다시 가져오기
      await queryClient.invalidateQueries({ queryKey: ['allOrders'] })
      await queryClient.invalidateQueries({ queryKey: ['order'] })
      await queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] })
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

  // 주문 삭제 처리
  const deleteOrderMutation = useMutation({
    mutationFn: (orderId: number) => apiService.deleteOrder(orderId),
    onSuccess: async () => {
      message.success('주문이 삭제되었습니다.')
      await queryClient.invalidateQueries({ queryKey: ['allOrders'] })
    },
    onError: (error: any) => {
      console.error('[OrderList] 주문 삭제 에러:', error)
      const errorMessage = error.response?.data?.message || '주문 삭제에 실패했습니다.'
      message.error({ content: errorMessage, duration: 5 })
    },
  })

  // 일괄 결제 완료 처리
  const bulkMarkPaidMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      const results = []
      for (const orderId of orderIds) {
        try {
          const paymentResponse = await apiService.getPaymentByOrder(orderId)
          if (paymentResponse?.data) {
            await apiService.markPaymentPaid(paymentResponse.data.paymentId, { pgPaymentKey: 'MANUAL_ADMIN' })
            results.push({ orderId, success: true })
          } else {
            results.push({ orderId, success: false, error: '결제 정보 없음' })
          }
        } catch (error) {
          results.push({ orderId, success: false, error })
        }
      }
      return results
    },
    onSuccess: async (results) => {
      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length
      
      if (failCount === 0) {
        message.success(`${successCount}건의 주문이 결제완료 처리되었습니다.`)
      } else {
        message.warning(`${successCount}건 성공, ${failCount}건 실패`)
      }
      
      setSelectedRowKeys([])
      await queryClient.invalidateQueries({ queryKey: ['allOrders'] })
    },
    onError: (error: any) => {
      message.error('일괄 결제완료 처리에 실패했습니다.')
      console.error('[OrderList] 일괄 결제완료 에러:', error)
    },
  })

  // 일괄 완료 처리
  const bulkCompleteMutation = useMutation({
    mutationFn: async (orderIds: number[]) => {
      const results = []
      for (const orderId of orderIds) {
        try {
          const orderResponse = await apiService.getOrder(orderId)
          const currentStatus = orderResponse.data.status
          
          if (currentStatus === 'PAID') {
            await apiService.confirmOrder(orderId)
            await apiService.completeOrder(orderId)
          } else if (currentStatus === 'CONFIRMED') {
            await apiService.completeOrder(orderId)
          }
          results.push({ orderId, success: true })
        } catch (error) {
          results.push({ orderId, success: false, error })
        }
      }
      return results
    },
    onSuccess: async (results) => {
      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length
      
      if (failCount === 0) {
        message.success(`${successCount}건의 주문이 완료 처리되었습니다.`)
      } else {
        message.warning(`${successCount}건 성공, ${failCount}건 실패`)
      }
      
      setSelectedRowKeys([])
      await queryClient.invalidateQueries({ queryKey: ['allOrders'] })
    },
    onError: (error: any) => {
      message.error('일괄 완료 처리에 실패했습니다.')
      console.error('[OrderList] 일괄 완료 에러:', error)
    },
  })

  // 일괄 취소 처리
  const bulkCancelMutation = useMutation({
    mutationFn: async ({ orderIds, reason }: { orderIds: number[]; reason?: string }) => {
      const results = []
      for (const orderId of orderIds) {
        try {
          await apiService.cancelOrder(orderId, { reason })
          results.push({ orderId, success: true })
        } catch (error) {
          results.push({ orderId, success: false, error })
        }
      }
      return results
    },
    onSuccess: async (results) => {
      const successCount = results.filter(r => r.success).length
      const failCount = results.filter(r => !r.success).length
      
      if (failCount === 0) {
        message.success(`${successCount}건의 주문이 취소되었습니다.`)
      } else {
        message.warning(`${successCount}건 성공, ${failCount}건 실패`)
      }
      
      setSelectedRowKeys([])
      setIsBulkStatusModalOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['allOrders'] })
    },
    onError: (error: any) => {
      message.error('일괄 취소 처리에 실패했습니다.')
      console.error('[OrderList] 일괄 취소 에러:', error)
    },
  })

  // 배송 시작 처리 (운송장 번호 입력)
  const startDeliveryMutation = useMutation({
    mutationFn: ({ orderId, trackingNo }: { orderId: number; trackingNo: string }) =>
      apiService.startDelivery(orderId, { trackingNo }),
    onSuccess: async () => {
      message.success('운송장 번호가 등록되었습니다.')
      setIsTrackingModalOpen(false)
      setSelectedOrder(null)
      trackingForm.resetFields()
      // 모든 관련 쿼리 무효화하고 다시 가져오기
      await queryClient.invalidateQueries({ queryKey: ['allOrders'] })
      await queryClient.invalidateQueries({ queryKey: ['order'] })
      await queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] })
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

  const handleDeleteOrder = (orderId: number) => {
    Modal.confirm({
      title: '주문 삭제',
      content: '이 주문을 정말 삭제하시겠습니까? 삭제된 주문은 복구할 수 없습니다.',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: () => deleteOrderMutation.mutate(orderId),
    })
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

  // 일괄 상태 변경 핸들러
  const handleBulkStatusChange = (action: 'paid' | 'complete' | 'cancel') => {
    if (selectedRowKeys.length === 0) {
      message.warning('상태를 변경할 주문을 선택해주세요.')
      return
    }
    
    if (action === 'paid') {
      Modal.confirm({
        title: '일괄 결제완료 처리',
        content: `선택한 ${selectedRowKeys.length}건의 주문을 결제완료 처리하시겠습니까?`,
        okText: '확인',
        cancelText: '취소',
        onOk: () => {
          bulkMarkPaidMutation.mutate(selectedRowKeys as number[])
        },
      })
    } else if (action === 'complete') {
      Modal.confirm({
        title: '일괄 완료 처리',
        content: `선택한 ${selectedRowKeys.length}건의 주문을 완료 처리하시겠습니까?`,
        okText: '확인',
        cancelText: '취소',
        onOk: () => {
          bulkCompleteMutation.mutate(selectedRowKeys as number[])
        },
      })
    } else if (action === 'cancel') {
      setIsBulkStatusModalOpen(true)
    }
  }

  const handleBulkCancelConfirm = () => {
    cancelForm.validateFields().then((values) => {
      bulkCancelMutation.mutate({
        orderIds: selectedRowKeys as number[],
        reason: values.reason || undefined,
      })
      cancelForm.resetFields()
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

  const getStatusText = (status: OrderStatus, fulfillmentType?: FulfillmentType) => {
    switch (status) {
      case 'CREATED':
        return '생성됨'
      case 'PAID':
        // 픽업 주문이면 "픽업대기", 배송 주문이면 "결제완료"
        return fulfillmentType === 'PICKUP' ? '픽업대기' : '결제완료'
      case 'CONFIRMED':
        // 배송 주문만 "배송준비" (픽업은 PAID에서 이미 픽업대기)
        return fulfillmentType === 'PICKUP' ? '확인됨' : '배송준비'
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

  // 엑셀 생성 공통 함수
  const generateExcel = async (orders: OrderResponse[], filePrefix: string) => {
    try {
      // 상품 목록 조회 (매입가 매칭용)
      message.loading({ content: '상품 정보 조회 중...', key: 'excel-products' })
      const productsResponse = await apiService.getProducts()
      console.log('[Excel Debug] 조회된 상품 목록:', productsResponse.data)
      
      // productId로 매칭하는 Map
      const productsMapById = new Map(
        productsResponse.data.map(p => [p.productId, p.purchasePrice || 0])
      )
      // 상품명으로 매칭하는 Map (fallback)
      const productsMapByName = new Map(
        productsResponse.data.map(p => [p.name, p.purchasePrice || 0])
      )
      console.log('[Excel Debug] 상품 Map (by ID):', Array.from(productsMapById.entries()))
      console.log('[Excel Debug] 상품 Map (by Name):', Array.from(productsMapByName.entries()))
      message.destroy('excel-products')
      
      // 엑셀 데이터 준비 - 상품별로 한 줄씩
      const excelData: any[] = []
      
      orders.forEach((order) => {
        const items = order.items || []
        console.log(`[Excel Debug] 주문 ${order.orderNo} items:`, items)
        
        // 주소 합치기 (건물명 포함) + 공동현관 분리
        const fullAddress = `${order.address1 || ''} ${order.address2 || ''} ${order.address3 || ''}`.trim()
        const { address: cleanAddress, entranceCode } = extractEntranceCode(fullAddress)
        
        // 각 상품별로 개별 행 생성
        items.forEach((item) => {
          let purchasePriceUnit = 0
          const productId = item.productId
          const productName = item.productName
          
          // 1차: productId로 매칭 시도
          if (productId) {
            purchasePriceUnit = productsMapById.get(productId) || 0
          }
          
          // 2차: productId가 없거나 매칭 실패시 상품명으로 매칭
          if (purchasePriceUnit === 0 && productName) {
            purchasePriceUnit = productsMapByName.get(productName) || 0
          }
          
          const quantity = item.quantity || 0
          const salesUnitPrice = item.unitPrice || 0  // 매출단가 (판매 단가)
          const itemPurchasePrice = purchasePriceUnit * quantity  // 매입가 = 매입단가 * 수량
          const itemSalesPrice = salesUnitPrice * quantity  // 매출가 = 매출단가 * 수량
          
          console.log(`[Excel Debug] 상품명=${productName}, productId=${productId}, 수량=${quantity}, 매출단가=${salesUnitPrice}, 매출가=${itemSalesPrice}, 매입가=${itemPurchasePrice}`)
          
          excelData.push({
            '년월일': order.orderedAt ? dayjs(order.orderedAt).format('YYYY-MM-DD') : '-',
            '주문번호': order.orderNo || '-',
            '주문상태': getStatusText(order.status, order.fulfillmentType),
            '이름': order.recipientName || '-',
            '전화번호': formatPhoneNumber(order.recipientPhone),
            '상품명': productName || '-',
            '수량': quantity,
            '단가': salesUnitPrice,  // 매출단가
            '매출가': itemSalesPrice,
            '배송비': order.deliveryFee || 0,
            '배송지주소': cleanAddress || '-',
            '공동현관/입구비번': entranceCode || '-',
            '매입가': itemPurchasePrice > 0 ? itemPurchasePrice : '-',
            '결제수단': getPaymentMethodText(order.paymentMethod),
            '배송방식': order.fulfillmentType === 'PICKUP' ? '픽업' : '배송',
          })
        })
    })

    // 워크북 생성
    const wb = XLSX.utils.book_new()
    const ws = XLSX.utils.json_to_sheet(excelData)
    
    // 컬럼 너비 설정
    ws['!cols'] = [
      { wch: 12 },  // 년월일
      { wch: 20 },  // 주문번호
      { wch: 12 },  // 주문상태
      { wch: 12 },  // 이름
      { wch: 15 },  // 전화번호
      { wch: 40 },  // 상품명
      { wch: 8 },   // 수량
      { wch: 12 },  // 단가
      { wch: 12 },  // 매출가
      { wch: 10 },  // 배송비
      { wch: 50 },  // 배송지주소
      { wch: 20 },  // 공동현관/입구비번
      { wch: 12 },  // 매입가
      { wch: 12 },  // 결제수단
      { wch: 10 },  // 배송방식
    ]

    XLSX.utils.book_append_sheet(wb, ws, '주문목록')

    // 파일 다운로드
    const fileName = `${filePrefix}_${new Date().toISOString().split('T')[0]}.xlsx`
    XLSX.writeFile(wb, fileName)

    message.success(`${orders.length}건의 주문이 다운로드되었습니다.`)
    } catch (error: any) {
      console.error('[generateExcel] 엑셀 생성 실패:', error)
      message.error('엑셀 생성 중 오류가 발생했습니다.')
    }
  }

  // 전체 주문 엑셀 다운로드
  const handleExportAllToExcel = async () => {
    if (filteredOrders.length === 0) {
      message.warning('다운로드할 주문이 없습니다.')
      return
    }

    await generateExcel(filteredOrders, '전체주문목록')
  }

  // 선택된 주문 엑셀 다운로드
  const handleExportToExcel = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('다운로드할 주문을 선택해주세요.')
      return
    }

    const selectedOrders = filteredOrders.filter(order => selectedRowKeys.includes(order.orderId))
    
    if (selectedOrders.length === 0) {
      message.warning('다운로드할 주문 데이터가 없습니다.')
      return
    }

    await generateExcel(selectedOrders, '선택주문목록')
    setSelectedRowKeys([]) // 선택 초기화
  }

  // 테이블 체크박스 설정
  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys)
    },
  }

  // 컬럼 리사이즈 핸들러
  const handleResize = (key: string) => (_: any, { size }: any) => {
    setColumnWidths((prev) => ({
      ...prev,
      [key]: size.width,
    }))
  }

  const columns = [
    {
      title: 'ID',
      key: 'orderId',
      width: columnWidths.orderId,
      fixed: 'left' as const,
      onHeaderCell: () => ({
        width: columnWidths.orderId,
        onResize: handleResize('orderId'),
      }),
      render: (_: any, record: OrderResponse) => (
        <Typography.Link 
          style={{ fontSize: 12 }}
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/orders/${record.orderId}`)
          }}
        >
          {record.orderId}
        </Typography.Link>
      ),
    },
    {
      title: '주문번호',
      key: 'orderNo',
      width: columnWidths.orderNo,
      fixed: 'left' as const,
      onHeaderCell: () => ({
        width: columnWidths.orderNo,
        onResize: handleResize('orderNo'),
      }),
      render: (_: any, record: any) => {
        const timestamp = record.orderedAt
        const formatDateTime = (dateStr: string) => {
          const date = new Date(dateStr)
          // 한국 시간대로 변환
          return date.toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
            timeZone: 'Asia/Seoul'
          }).replace(/\.\s/g, '/').replace('.', '')
        }
        const extractDateFromOrderNo = (orderNo: string) => {
          const match = orderNo?.match(/OD-(\d{4})(\d{2})(\d{2})-/)
          if (match) return `${match[2]}/${match[3]}`
          return null
        }
        const displayDate = timestamp ? formatDateTime(timestamp) : extractDateFromOrderNo(record.orderNo)
        // 주문번호에서 날짜 부분 제외한 코드만 표시 (예: OD-20260107-7F3A2C → 7F3A2C)
        const shortOrderNo = record.orderNo?.split('-').pop() || record.orderNo
        return (
          <Space direction="vertical" size={0}>
            <Typography.Text style={{ fontSize: 12 }}>{shortOrderNo}</Typography.Text>
            {displayDate && (
              <Typography.Text type="secondary" style={{ fontSize: 10 }}>{displayDate}</Typography.Text>
            )}
          </Space>
        )
      },
    },
    {
      title: '주문자',
      key: 'customer',
      width: columnWidths.customer,
      fixed: 'left' as const,
      onHeaderCell: () => ({
        width: columnWidths.customer,
        onResize: handleResize('customer'),
      }),
      render: (_: any, record: OrderResponse) => (
        <Space direction="vertical" size={0}>
          <Typography.Text style={{ fontSize: 12 }}>{record.recipientName || '-'}</Typography.Text>
          <Typography.Text type="secondary" style={{ fontSize: 10 }}>
            {formatPhoneNumber(record.recipientPhone)}
          </Typography.Text>
        </Space>
      ),
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: columnWidths.status,
      onHeaderCell: () => ({
        width: columnWidths.status,
        onResize: handleResize('status'),
      }),
      render: (status: OrderStatus, record: OrderResponse) => (
        <Tag color={getStatusColor(status)} style={{ fontSize: 11, margin: 0 }}>{getStatusText(status, record.fulfillmentType)}</Tag>
      ),
    },
    {
      title: '처리',
      key: 'actions',
      width: columnWidths.actions,
      onHeaderCell: () => ({
        width: columnWidths.actions,
        onResize: handleResize('actions'),
      }),
      render: (_: any, record: OrderResponse & { paymentMethod?: PaymentMethod }) => {
        const { status } = record
        const btnStyle = { padding: '4px 8px', height: 'auto', fontSize: 13, fontWeight: 500, minWidth: 50 }
        
        // 완료/취소된 주문은 삭제만 가능
        if (status === 'CANCELED' || status === 'COMPLETED') {
          return (
            <Button size="small" onClick={(e) => { e.stopPropagation(); handleDeleteOrder(record.orderId); }} loading={deleteOrderMutation.isPending} style={{ ...btnStyle, color: '#999', borderColor: '#d9d9d9' }}>삭제</Button>
          )
        }
        
        return (
          <Space direction="vertical" size={4}>
            {status === 'CREATED' && (
              <Button type="primary" size="small" onClick={(e) => { e.stopPropagation(); handleMarkOrderPaid(record.orderId, record.paymentMethod || 'BANK_TRANSFER'); }} loading={markOrderPaidMutation.isPending} style={btnStyle}>결제</Button>
            )}
            {status === 'PAID' && (
              <Button type="primary" size="small" onClick={(e) => { e.stopPropagation(); handleCompleteOrder(record.orderId); }} loading={completeOrderMutation.isPending} style={{ ...btnStyle, backgroundColor: '#52c41a', borderColor: '#52c41a' }}>완료</Button>
            )}
            {status === 'CONFIRMED' && (
              <Button type="primary" size="small" onClick={(e) => { e.stopPropagation(); handleCompleteOrder(record.orderId); }} loading={completeOrderMutation.isPending} style={{ ...btnStyle, backgroundColor: '#52c41a', borderColor: '#52c41a' }}>완료</Button>
            )}
            <Button size="small" danger onClick={(e) => { e.stopPropagation(); handleCancelOrder(record.orderId); }} loading={cancelOrderMutation.isPending} style={btnStyle}>취소</Button>
          </Space>
        )
      },
    },
    {
      title: '결제 방식',
      key: 'payment',
      width: columnWidths.payment,
      onHeaderCell: () => ({
        width: columnWidths.payment,
        onResize: handleResize('payment'),
      }),
      render: (_: any, record: OrderResponse & { paymentMethod?: PaymentMethod }) => (
        <Space direction="vertical" size={2} align="center">
          <Typography.Text strong style={{ color: '#1890ff', fontSize: 12 }}>
            {formatCurrency(record.finalAmount)}
          </Typography.Text>
          {record.paymentMethod ? (
            <Tag color={record.paymentMethod === 'BANK_TRANSFER' ? 'blue' : 'green'} style={{ fontSize: 11 }}>
              {getPaymentMethodText(record.paymentMethod)}
            </Tag>
          ) : (
            <Tag color="default" style={{ fontSize: 11 }}>미결제</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '현금영수증',
      dataIndex: 'cashReceipt',
      key: 'cashReceipt',
      width: columnWidths.cashReceipt,
      onHeaderCell: () => ({
        width: columnWidths.cashReceipt,
        onResize: handleResize('cashReceipt'),
      }),
      render: (cashReceipt: boolean | undefined, record: OrderResponse) => {
        if (cashReceipt && record.cashReceiptNo) {
          return (
            <Space direction="vertical" size={0}>
              <Tag color="green" style={{ fontSize: 11 }}>발급</Tag>
              <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                {record.cashReceiptNo}
              </Typography.Text>
            </Space>
          )
        }
        return (
          <Tag color="default" style={{ fontSize: 11 }}>-</Tag>
        )
      },
    },
    {
      title: '상품',
      key: 'items',
      width: columnWidths.items,
      onHeaderCell: () => ({
        width: columnWidths.items,
        onResize: handleResize('items'),
      }),
      render: (_: any, record: OrderResponse) => {
        if (record.items && record.items.length > 0) {
          return (
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              {record.items.map((item, idx) => (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, flexWrap: 'wrap' }}>
                  <Typography.Text style={{ wordBreak: 'break-word', whiteSpace: 'normal' }}>
                    {item.productName}
                  </Typography.Text>
                  <Typography.Text type="secondary" style={{ marginLeft: 8, flexShrink: 0 }}>
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
      width: columnWidths.fulfillmentType,
      onHeaderCell: () => ({
        width: columnWidths.fulfillmentType,
        onResize: handleResize('fulfillmentType'),
      }),
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
      title: '배송지 주소',
      key: 'address',
      width: columnWidths.address,
      onHeaderCell: () => ({
        width: columnWidths.address,
        onResize: handleResize('address'),
      }),
      render: (_: any, record: OrderResponse) => {
        if (record.fulfillmentType === 'DELIVERY') {
          return (
            <Space direction="vertical" size={2} style={{ width: '100%' }}>
              <Typography.Text style={{ fontSize: 12 }}>
                [{record.zipCode}]
              </Typography.Text>
              <Typography.Text ellipsis style={{ fontSize: 11 }}>
                {record.address1}
              </Typography.Text>
              {record.address2 && (
                <Typography.Text type="secondary" ellipsis style={{ fontSize: 11 }}>
                  {record.address2}
                </Typography.Text>
              )}
            </Space>
          )
        }
        return <Typography.Text type="secondary">-</Typography.Text>
      },
    },
    {
      title: '운송장번호',
      dataIndex: 'trackingNo',
      key: 'trackingNo',
      width: columnWidths.trackingNo,
      onHeaderCell: () => ({
        width: columnWidths.trackingNo,
        onResize: handleResize('trackingNo'),
      }),
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
                onClick={(e) => { e.stopPropagation(); handleOpenTrackingModal(record); }}
              >
                {trackingNo ? '수정' : '입력'}
              </Button>
            </Space>
          )
        }
        return <Typography.Text type="secondary">-</Typography.Text>
      },
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
          <Space wrap>
            <Button 
              icon={<DownloadOutlined />} 
              onClick={handleExportAllToExcel}
              disabled={filteredOrders.length === 0}
              type="default"
            >
              전체 엑셀 ({filteredOrders.length}건)
            </Button>
            <Button 
              icon={<DownloadOutlined />} 
              onClick={handleExportToExcel}
              disabled={selectedRowKeys.length === 0}
              type="primary"
            >
              선택 엑셀 {selectedRowKeys.length > 0 && `(${selectedRowKeys.length}건)`}
            </Button>
            {selectedRowKeys.length > 0 && (
              <>
                <Button 
                  onClick={() => handleBulkStatusChange('paid')}
                  disabled={selectedRowKeys.length === 0}
                  loading={bulkMarkPaidMutation.isPending}
                  style={{ backgroundColor: '#1890ff', color: 'white', borderColor: '#1890ff' }}
                >
                  결제완료 ({selectedRowKeys.length}건)
                </Button>
                <Button 
                  onClick={() => handleBulkStatusChange('complete')}
                  disabled={selectedRowKeys.length === 0}
                  loading={bulkCompleteMutation.isPending}
                  style={{ backgroundColor: '#52c41a', color: 'white', borderColor: '#52c41a' }}
                >
                  완료 ({selectedRowKeys.length}건)
                </Button>
                <Button 
                  onClick={() => handleBulkStatusChange('cancel')}
                  disabled={selectedRowKeys.length === 0}
                  loading={bulkCancelMutation.isPending}
                  danger
                >
                  취소 ({selectedRowKeys.length}건)
                </Button>
              </>
            )}
            <Button 
              icon={<ReloadOutlined spin={isRefreshing} />} 
              onClick={async () => {
                setIsRefreshing(true)
                await Promise.all([
                  queryClient.invalidateQueries({ queryKey: ['allOrders'] }),
                  queryClient.invalidateQueries({ queryKey: ['order'] }),
                  queryClient.invalidateQueries({ queryKey: ['paymentByOrder'] }),
                ])
                await refetch()
                setTimeout(() => {
                  setIsRefreshing(false)
                  message.success({ content: '✅ 새로고침 완료!', duration: 1.5 })
                }, 300)
              }} 
              loading={isRefreshing}
              type="primary"
              style={{ 
                minWidth: 110,
                transition: 'all 0.3s',
                ...(isRefreshing ? { backgroundColor: '#52c41a', borderColor: '#52c41a' } : {})
              }}
            >
              {isRefreshing ? '새로고침 중...' : '새로고침'}
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
        
        {/* 검색창 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Text type="secondary">주문 검색</Typography.Text>
              <Input.Search
                placeholder="주문번호, 고객명, 전화번호로 검색"
                allowClear
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value)
                  setCurrentPage(1)
                }}
                onSearch={(value) => {
                  setSearchText(value)
                  setCurrentPage(1)
                }}
                style={{ width: '100%' }}
                size="large"
              />
            </Space>
          </Col>
        </Row>

        {/* 날짜 필터 */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <Space direction="vertical" size={4} style={{ width: '100%' }}>
              <Typography.Text type="secondary">기간 선택</Typography.Text>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <Tabs
                  activeKey={dateFilterTab}
                  onChange={(key) => {
                    setDateFilterTab(key as 'all' | 'daily' | 'weekly' | 'monthly' | 'quarterly')
                    setCurrentPage(1)
                  }}
                  items={[
                    { key: 'all', label: '전체' },
                    { key: 'daily', label: '일별' },
                    { key: 'weekly', label: '주별' },
                    { key: 'monthly', label: '월별' },
                    { key: 'quarterly', label: '3개월' },
                  ]}
                  style={{ marginBottom: 0 }}
                  size="small"
                />
                {dateFilterTab === 'daily' && (
                  <DatePicker
                    value={selectedDate}
                    onChange={(date) => {
                      if (date) {
                        setSelectedDate(date)
                        setCurrentPage(1)
                      }
                    }}
                    format="YYYY-MM-DD"
                    placeholder="날짜 선택"
                    size="small"
                    style={{ width: 150 }}
                  />
                )}
                {dateFilterTab === 'weekly' && (
                  <DatePicker
                    picker="week"
                    value={dayjs(selectedWeek)}
                    onChange={(date) => {
                      if (date) {
                        setSelectedWeek(date.startOf('week').format('YYYY-MM-DD'))
                        setCurrentPage(1)
                      }
                    }}
                    format="YYYY [W]주"
                    placeholder="주 선택"
                    size="small"
                    style={{ width: 150 }}
                  />
                )}
                {dateFilterTab === 'monthly' && (
                  <DatePicker
                    picker="month"
                    value={dayjs(selectedMonth)}
                    onChange={(date) => {
                      if (date) {
                        setSelectedMonth(date.format('YYYY-MM'))
                        setCurrentPage(1)
                      }
                    }}
                    format="YYYY년 MM월"
                    placeholder="월 선택"
                    size="small"
                    style={{ width: 150 }}
                  />
                )}
              </div>
            </Space>
          </Col>
        </Row>

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
                {(deliveryTypeFilter !== 'ALL' || paymentMethodFilter !== 'ALL' || searchText || dateFilterTab !== 'all') && (
                  <Button
                    type="link"
                    size="small"
                    onClick={() => {
                      setDeliveryTypeFilter('ALL')
                      setPaymentMethodFilter('ALL')
                      setSearchText('')
                      setDateFilterTab('all')
                      setSelectedDate(dayjs())
                      setSelectedWeek(dayjs().startOf('week').format('YYYY-MM-DD'))
                      setSelectedMonth(dayjs().format('YYYY-MM'))
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
        {/* 상단 스크롤바 */}
        <div 
          style={{ 
            overflowX: 'auto', 
            overflowY: 'hidden',
            marginBottom: 8,
          }}
          onScroll={(e) => {
            if (tableWrapperRef.current) {
              tableWrapperRef.current.scrollLeft = e.currentTarget.scrollLeft
            }
          }}
        >
          <div style={{ height: 1, width: 'max-content', minWidth: '100%' }} />
        </div>
        
        {/* 테이블 */}
        <div 
          ref={tableWrapperRef}
          style={{ overflowX: 'auto' }}
          onScroll={(e) => {
            const topScroll = e.currentTarget.previousElementSibling as HTMLDivElement
            if (topScroll) {
              topScroll.scrollLeft = e.currentTarget.scrollLeft
            }
          }}
        >
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
            components={{
              header: {
                cell: ResizableTitle,
              },
            }}
            pagination={{
              current: currentPage,
              pageSize: pageSize,
              total: totalOrders,
              showTotal: (total) => `전체 ${total}개`,
              onChange: (page) => setCurrentPage(page),
              onShowSizeChange: (_, size) => {
                setPageSize(size)
                setCurrentPage(1)
              },
              showSizeChanger: true,
              pageSizeOptions: ['10', '50', '100'],
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

      {/* 일괄 취소 모달 */}
      <Modal
        title={`일괄 주문 취소 (${selectedRowKeys.length}건)`}
        open={isBulkStatusModalOpen}
        onOk={handleBulkCancelConfirm}
        onCancel={() => {
          setIsBulkStatusModalOpen(false)
          cancelForm.resetFields()
        }}
        confirmLoading={bulkCancelMutation.isPending}
        okText="일괄 취소하기"
        cancelText="닫기"
        okButtonProps={{ danger: true }}
      >
        <Typography.Paragraph>
          선택한 {selectedRowKeys.length}건의 주문을 취소하시겠습니까?
        </Typography.Paragraph>
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
