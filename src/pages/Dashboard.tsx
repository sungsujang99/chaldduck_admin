import { useState, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, Tag, Space, Button, Switch, message, Spin, Table, DatePicker, Tabs, Divider } from 'antd'
import { ApiOutlined, ReloadOutlined, SettingOutlined, DownloadOutlined } from '@ant-design/icons'
import * as XLSX from 'xlsx'
import dayjs, { Dayjs } from 'dayjs'
import { useNavigate } from 'react-router-dom'
import { apiService } from '@/services/api'
import type { FeatureFlagResponse, FeatureKey, OrderResponse, SalesStatRow } from '@/types/api'

// const { RangePicker } = DatePicker // 현재 사용하지 않음

const Dashboard = () => {
  const navigate = useNavigate()
  const [apiStatus, setApiStatus] = useState<'checking' | 'online' | 'offline'>('checking')
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [lastAutoRefresh, setLastAutoRefresh] = useState<Date | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const queryClient = useQueryClient()
  const [salesStatsTab, setSalesStatsTab] = useState<'daily' | 'weekly' | 'monthly'>('daily')
  const [selectedDate, setSelectedDate] = useState<Dayjs>(dayjs())
  const [selectedWeek, setSelectedWeek] = useState<string>(() => {
    const today = dayjs()
    const weekStart = today.startOf('week')
    return weekStart.format('YYYY-MM-DD')
  })
  const [selectedMonth, setSelectedMonth] = useState<string>(dayjs().format('YYYY-MM'))
  
  // 주문 통계 필터
  const [orderStatsTab, setOrderStatsTab] = useState<'all' | 'daily' | 'weekly' | 'monthly' | 'quarterly'>('all')
  const [orderSelectedDate, setOrderSelectedDate] = useState<Dayjs>(dayjs())
  const [orderSelectedWeek, setOrderSelectedWeek] = useState<string>(() => {
    const today = dayjs()
    const weekStart = today.startOf('week')
    return weekStart.format('YYYY-MM-DD')
  })
  const [orderSelectedMonth, setOrderSelectedMonth] = useState<string>(dayjs().format('YYYY-MM'))

  // API 상태 확인
  const { refetch: checkApiStatus } = useQuery({
    queryKey: ['apiStatus'],
    queryFn: async () => {
      try {
        // 간단한 API 호출로 상태 확인 (알림 로그 조회)
        const response = await apiService.getNotifications({ page: 0, size: 1 })
        setApiStatus('online')
        setLastCheck(new Date())
        return response
      } catch (error: any) {
        setApiStatus('offline')
        setLastCheck(new Date())
        throw error
      }
    },
    enabled: false, // 수동으로만 실행
    retry: false,
  })

  // 기능 플래그 조회
  const { data: featuresData, isLoading: featuresLoading } = useQuery({
    queryKey: ['features'],
    queryFn: async () => {
      const response = await apiService.getFeatures()
      console.log('[Dashboard] 기능 플래그 조회 응답:', response)
      console.log('[Dashboard] 기능 목록:', response.data?.map(f => ({ key: f.key, enabled: f.enabled, description: f.description })))
      return response
    },
  })

  // 매출 통계 조회
  const { data: dailySalesData, isLoading: dailySalesLoading } = useQuery({
    queryKey: ['dailySales', selectedDate],
    queryFn: () => {
      const dateStr = selectedDate.format('YYYY-MM-DD')
      return apiService.getDailySalesStats(dateStr, dateStr)
    },
    enabled: salesStatsTab === 'daily',
  })

  const { data: weeklySalesData, isLoading: weeklySalesLoading } = useQuery({
    queryKey: ['weeklySales', selectedWeek],
    queryFn: () => {
      const weekStart = dayjs(selectedWeek)
      const weekEnd = weekStart.endOf('week')
      return apiService.getWeeklySalesStats(
        weekStart.format('YYYY-MM-DD'),
        weekEnd.format('YYYY-MM-DD')
      )
    },
    enabled: salesStatsTab === 'weekly',
  })

  const { data: monthlySalesData, isLoading: monthlySalesLoading } = useQuery({
    queryKey: ['monthlySales', selectedMonth],
    queryFn: () => {
      const monthStart = dayjs(selectedMonth).startOf('month')
      const monthEnd = dayjs(selectedMonth).endOf('month')
      return apiService.getMonthlySalesStats(
        monthStart.format('YYYY-MM-DD'),
        monthEnd.format('YYYY-MM-DD')
      )
    },
    enabled: salesStatsTab === 'monthly',
  })

  const currentSalesData = useMemo(() => {
    if (salesStatsTab === 'daily') return dailySalesData
    if (salesStatsTab === 'weekly') return weeklySalesData
    return monthlySalesData
  }, [salesStatsTab, dailySalesData, weeklySalesData, monthlySalesData])

  const currentSalesLoading = useMemo(() => {
    if (salesStatsTab === 'daily') return dailySalesLoading
    if (salesStatsTab === 'weekly') return weeklySalesLoading
    return monthlySalesLoading
  }, [salesStatsTab, dailySalesLoading, weeklySalesLoading, monthlySalesLoading])

  // 주문 통계 조회 (새로운 페이징 API 사용)
  const { data: ordersStatsData, isLoading: ordersStatsLoading } = useQuery({
    queryKey: ['allOrdersForStats'],
    queryFn: async () => {
      try {
        console.log('[Dashboard] 주문 통계 조회 시작')
        
        // 모든 주문을 페이징으로 가져오기
        const allOrders: OrderResponse[] = []
        let page = 0
        const pageSize = 100 // 한 번에 많이 가져오기
        let hasMore = true

        while (hasMore) {
          try {
            const response = await apiService.getAllOrdersAdmin({ page, size: pageSize })
            console.log(`[Dashboard] 페이지 ${page} 응답:`, response)
            
            // API 응답 형식 확인 (배열 또는 페이지네이션 객체)
            let orders: OrderResponse[] = []
            let isLastPage = true
            
            if (response.data) {
              // 배열인 경우 (JsonBodyListOrderResponse)
              if (Array.isArray(response.data)) {
                orders = response.data
                isLastPage = true // 배열 응답은 한번에 전체를 반환
                console.log(`[Dashboard] 배열 응답: ${orders.length}개`)
              } 
              // 페이지네이션 객체인 경우
              else if (response.data.content) {
                orders = response.data.content
                isLastPage = response.data.last || orders.length < pageSize
                console.log(`[Dashboard] 페이지네이션 응답: ${orders.length}개, last: ${response.data.last}`)
              }
            }
            
            if (orders.length > 0) {
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
            console.error(`[Dashboard] 주문 조회 실패 (페이지 ${page}):`, err.message, err)
            hasMore = false
          }
        }

        console.log(`[Dashboard] 총 ${allOrders.length}개의 주문 조회 완료`)
        return { status: 200, message: 'OK', data: allOrders }
      } catch (error: any) {
        console.error('[Dashboard] 주문 통계 조회 실패:', error)
        throw error
      }
    },
    retry: false,
  })

  // 주문 필터링된 데이터
  const filteredOrders = useMemo(() => {
    if (!ordersStatsData?.data) return []
    
    const orders = ordersStatsData.data
    
    if (orderStatsTab === 'all') {
      return orders
    }
    
    return orders.filter((order: any) => {
      // orderNo에서 날짜 추출 (예: OD-20260126-xxx)
      const match = order.orderNo?.match(/OD-(\d{4})(\d{2})(\d{2})-/)
      if (!match) return false
      
      const orderDate = dayjs(`${match[1]}-${match[2]}-${match[3]}`)
      
      if (orderStatsTab === 'daily') {
        return orderDate.isSame(orderSelectedDate, 'day')
      } else if (orderStatsTab === 'weekly') {
        const weekStart = dayjs(orderSelectedWeek)
        const weekEnd = weekStart.endOf('week')
        return orderDate.isAfter(weekStart.subtract(1, 'day')) && orderDate.isBefore(weekEnd.add(1, 'day'))
      } else if (orderStatsTab === 'monthly') {
        const monthStart = dayjs(orderSelectedMonth).startOf('month')
        const monthEnd = dayjs(orderSelectedMonth).endOf('month')
        return orderDate.isAfter(monthStart.subtract(1, 'day')) && orderDate.isBefore(monthEnd.add(1, 'day'))
      } else if (orderStatsTab === 'quarterly') {
        // 최근 3개월
        const threeMonthsAgo = dayjs().subtract(3, 'month').startOf('day')
        return orderDate.isAfter(threeMonthsAgo.subtract(1, 'day'))
      }
      
      return true
    })
  }, [ordersStatsData, orderStatsTab, orderSelectedDate, orderSelectedWeek, orderSelectedMonth])

  // 주문 통계 계산
  const orderStats = useMemo(() => {
    if (!filteredOrders || filteredOrders.length === 0) {
      return {
        total: 0,
        created: 0,
        paid: 0,
        confirmed: 0,
        completed: 0,
        canceled: 0,
        // 추가 통계
        waitingPayment: 0, // 입금대기 (CREATED)
        newOrder: 0, // 신규주문 (PAID)
        pickupWaiting: 0, // 픽업대기 (PICKUP + CONFIRMED)
        deliveryReady: 0, // 배송준비 (DELIVERY + CONFIRMED, deliveryStatus: READY)
        delivering: 0, // 배송중 (deliveryStatus: DELIVERING)
      }
    }

    const orders = filteredOrders
    return {
      total: orders.length,
      created: orders.filter((o) => o.status === 'CREATED').length,
      paid: orders.filter((o) => o.status === 'PAID').length,
      confirmed: orders.filter((o) => o.status === 'CONFIRMED').length,
      completed: orders.filter((o) => o.status === 'COMPLETED').length,
      canceled: orders.filter((o) => o.status === 'CANCELED').length,
      // 추가 통계
      waitingPayment: orders.filter((o) => o.status === 'CREATED').length, // 입금대기
      newOrder: orders.filter((o) => o.status === 'PAID').length, // 신규주문 (결제완료)
      pickupWaiting: orders.filter((o) => o.fulfillmentType === 'PICKUP' && o.status === 'CONFIRMED').length, // 픽업대기
      deliveryReady: orders.filter((o) => o.fulfillmentType === 'DELIVERY' && (o.status === 'CONFIRMED' || o.status === 'PAID') && o.deliveryStatus === 'READY').length, // 배송준비
      delivering: orders.filter((o) => o.deliveryStatus === 'DELIVERING').length, // 배송중
    }
  }, [filteredOrders])

  // 기능 토글
  const toggleFeatureMutation = useMutation({
    mutationFn: ({ key, enabled }: { key: FeatureKey; enabled: boolean }) =>
      apiService.toggleFeature(key, enabled),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['features'] })
      message.success('기능 상태가 변경되었습니다.')
    },
    onError: (error: any) => {
      message.error(`기능 상태 변경에 실패했습니다: ${error.response?.data?.message || error.message}`)
    },
  })

  useEffect(() => {
    // 컴포넌트 마운트 시 API 상태 확인
    checkApiStatus()
  }, [])

  // 10분마다 자동 새로고침
  useEffect(() => {
    const AUTO_REFRESH_INTERVAL = 10 * 60 * 1000 // 10분 (600,000ms)

    // 초기 로드 시간 기록
    setLastAutoRefresh(new Date())

    const intervalId = setInterval(async () => {
      console.log('[Dashboard] 자동 새로고침 실행 (10분마다)')
      
      // 로딩 상태 시작
      setIsRefreshing(true)
      message.loading({ content: '🔄 자동 새로고침 중...', key: 'autoRefresh', duration: 0 })
      
      // 새로고침 시간 업데이트
      const now = new Date()
      setLastAutoRefresh(now)
      
      // 모든 쿼리 무효화 및 재조회
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['features'] }),
        queryClient.invalidateQueries({ queryKey: ['allOrdersForStats'] }),
        queryClient.invalidateQueries({ queryKey: ['dailySales'] }),
        queryClient.invalidateQueries({ queryKey: ['weeklySales'] }),
        queryClient.invalidateQueries({ queryKey: ['monthlySales'] }),
      ])
      
      // API 상태도 다시 확인
      checkApiStatus()
      
      // 완료 표시
      setTimeout(() => {
        setIsRefreshing(false)
        message.success({ content: '✅ 자동 새로고침 완료!', key: 'autoRefresh', duration: 2 })
      }, 500)
    }, AUTO_REFRESH_INTERVAL)

    // 클린업: 컴포넌트 언마운트 시 interval 제거
    return () => {
      clearInterval(intervalId)
    }
  }, [queryClient, checkApiStatus])

  const handleFeatureToggle = (key: FeatureKey, enabled: boolean) => {
    toggleFeatureMutation.mutate({ key, enabled })
  }

  const getFeatureLabel = (key: FeatureKey) => {
    switch (key) {
      case 'ORDER':
        return '무통장'
      case 'DELIVERY_ORDER':
        return '배송'
      default:
        return key
    }
  }

  const handleRefreshStatus = () => {
    setApiStatus('checking')
    checkApiStatus()
  }

  const handleManualRefresh = async () => {
    console.log('[Dashboard] 수동 새로고침 실행')
    setIsRefreshing(true)
    
    // 새로고침 시간 업데이트
    setLastAutoRefresh(new Date())
    
    // 모든 쿼리 무효화 및 재조회
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['features'] }),
      queryClient.invalidateQueries({ queryKey: ['allOrdersForStats'] }),
      queryClient.invalidateQueries({ queryKey: ['dailySales'] }),
      queryClient.invalidateQueries({ queryKey: ['weeklySales'] }),
      queryClient.invalidateQueries({ queryKey: ['monthlySales'] }),
    ])
    
    // API 상태도 다시 확인
    checkApiStatus()
    
    // 최소 0.5초 후에 완료 표시 (시각적 피드백)
    setTimeout(() => {
      setIsRefreshing(false)
      message.success({ content: '✅ 새로고침 완료!', duration: 1.5 })
    }, 500)
  }

  // 주문 상태별 페이지 이동
  const handleGoToOrders = (status: string) => {
    navigate(`/orders?status=${status}`)
  }

  const getApiStatusColor = () => {
    switch (apiStatus) {
      case 'online':
        return 'green'
      case 'offline':
        return 'red'
      case 'checking':
        return 'orange'
      default:
        return 'default'
    }
  }

  const getApiStatusText = () => {
    switch (apiStatus) {
      case 'online':
        return '온라인'
      case 'offline':
        return '오프라인'
      case 'checking':
        return '확인 중...'
      default:
        return '알 수 없음'
    }
  }

  // 전화번호 포맷팅 함수
  const formatPhoneNumber = (phone?: string) => {
    if (!phone) return ''
    const cleaned = phone.replace(/[^0-9]/g, '')
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`
    } else if (cleaned.length === 10) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`
    }
    return phone
  }

  // 주소에서 공동현관/입구비번 분리
  const extractEntranceCode = (address: string) => {
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

  // 결제 수단 텍스트 변환
  const getStatusText = (status: string, fulfillmentType?: string) => {
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

  const getPaymentMethodText = (method?: string) => {
    if (!method) return '미결제'
    if (method === 'BANK_TRANSFER') return '무통장'
    if (method === 'CARD') return '카드'
    return method
  }

  // 주문 엑셀 다운로드 함수
  const handleExportOrdersToExcel = async () => {
    if (!ordersStatsData?.data || ordersStatsData.data.length === 0) {
      message.warning('다운로드할 주문 데이터가 없습니다.')
      return
    }

    try {
      message.loading({ content: '상품 정보 조회 중...', key: 'excel-products' })
      // 상품 목록 조회 (매입가 매칭용)
      const productsResponse = await apiService.getProducts()
      console.log('[Dashboard Excel Debug] 조회된 상품 목록:', productsResponse.data)
      
      // productId로 매칭하는 Map
      const productsMapById = new Map(
        productsResponse.data.map(p => [p.productId, p.purchasePrice || 0])
      )
      // 상품명으로 매칭하는 Map (fallback)
      const productsMapByName = new Map(
        productsResponse.data.map(p => [p.name, p.purchasePrice || 0])
      )
      console.log('[Dashboard Excel Debug] 상품 Map (by ID):', Array.from(productsMapById.entries()))
      console.log('[Dashboard Excel Debug] 상품 Map (by Name):', Array.from(productsMapByName.entries()))
      
      message.loading({ content: '엑셀 파일 생성 중...', key: 'excel' })
      const orders = ordersStatsData.data

      // 각 주문의 결제 정보 조회
      const ordersWithPayment = await Promise.all(
        orders.map(async (order) => {
          let paymentMethod = ''
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

      // 엑셀 데이터 준비 - 상품별로 한 줄씩
      const excelData: any[] = []
      
      ordersWithPayment.forEach((order) => {
        const items = order.items || []
        console.log(`[Dashboard Excel Debug] 주문 ${order.orderNo} items:`, items)
        
        // 주소 합치기 (건물명 포함) + 공동현관 분리
        const fullAddress = `${order.address1 || ''} ${order.address2 || ''} ${(order as any).address3 || ''}`.trim()
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
          
          console.log(`[Dashboard Excel Debug] 상품명=${productName}, productId=${productId}, 수량=${quantity}, 매출단가=${salesUnitPrice}, 매출가=${itemSalesPrice}, 매입가=${itemPurchasePrice}`)
          
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
      const colWidths = [
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
      ws['!cols'] = colWidths

      XLSX.utils.book_append_sheet(wb, ws, '주문 목록')

      // 파일명 생성 (현재 날짜 포함)
      const fileName = `주문목록_${new Date().toISOString().split('T')[0]}.xlsx`

      // 파일 다운로드
      XLSX.writeFile(wb, fileName)
      message.success({ content: '엑셀 파일이 다운로드되었습니다.', key: 'excel' })
    } catch (error: any) {
      console.error('[Dashboard] 엑셀 다운로드 실패:', error)
      message.error({ content: '엑셀 다운로드 중 오류가 발생했습니다.', key: 'excel' })
    }
  }

  // 매출 통계 엑셀 다운로드 함수
  const handleExportSalesToExcel = () => {
    if (!currentSalesData?.data || currentSalesData.data.length === 0) {
      message.warning('다운로드할 매출 데이터가 없습니다.')
      return
    }

    try {
      message.loading({ content: '엑셀 파일 생성 중...', key: 'salesExcel' })

      // 엑셀 데이터 준비
      const excelData = currentSalesData.data.map((row: SalesStatRow) => {
        let periodLabel = ''
        if (salesStatsTab === 'daily') {
          periodLabel = dayjs(row.periodStart).format('YYYY-MM-DD')
        } else if (salesStatsTab === 'weekly') {
          periodLabel = dayjs(row.periodStart).format('YYYY-MM-DD') + ' (주)'
        } else {
          periodLabel = dayjs(row.periodStart).format('YYYY-MM')
        }

        return {
          '기간': periodLabel,
          '카드 건수': row.card.count,
          '카드 금액': row.card.net,
          '무통장 건수': row.bankTransfer.count,
          '무통장 금액': row.bankTransfer.net,
          '총 건수': row.total.count,
          '총 금액': row.total.net,
        }
      })

      // 워크북 생성
      const wb = XLSX.utils.book_new()
      const ws = XLSX.utils.json_to_sheet(excelData)

      // 컬럼 너비 설정
      const colWidths = [
        { wch: 15 }, // 기간
        { wch: 12 }, // 카드 건수
        { wch: 15 }, // 카드 금액
        { wch: 12 }, // 무통장 건수
        { wch: 15 }, // 무통장 금액
        { wch: 12 }, // 총 건수
        { wch: 15 }, // 총 금액
      ]
      ws['!cols'] = colWidths

      const tabLabel = salesStatsTab === 'daily' ? '일별' : salesStatsTab === 'weekly' ? '주별' : '월별'
      XLSX.utils.book_append_sheet(wb, ws, `${tabLabel} 매출`)

      // 파일명 생성 (현재 날짜 포함)
      const fileName = `매출통계_${tabLabel}_${new Date().toISOString().split('T')[0]}.xlsx`

      // 파일 다운로드
      XLSX.writeFile(wb, fileName)
      message.success({ content: '엑셀 파일이 다운로드되었습니다.', key: 'salesExcel' })
    } catch (error: any) {
      console.error('[Dashboard] 매출 엑셀 다운로드 실패:', error)
      message.error({ content: '엑셀 다운로드 중 오류가 발생했습니다.', key: 'salesExcel' })
    }
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 'clamp(18px, 5vw, 24px)' }}>대시보드</h1>
        <Space wrap size="small">
          {lastAutoRefresh && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', backgroundColor: '#f0f0f0', borderRadius: 4 }}>
              <ReloadOutlined spin={false} style={{ color: '#52c41a' }} />
              <span style={{ fontSize: 12, color: '#666' }}>
                {lastAutoRefresh.toLocaleTimeString('ko-KR')}
                <span style={{ marginLeft: 4, color: '#999' }}>(10분)</span>
              </span>
            </div>
          )}
          <Button
            icon={<ReloadOutlined spin={isRefreshing} />}
            onClick={handleManualRefresh}
            type="primary"
            size="middle"
            loading={isRefreshing}
            style={{ 
              minWidth: 110,
              transition: 'all 0.3s',
              ...(isRefreshing ? { backgroundColor: '#52c41a', borderColor: '#52c41a' } : {})
            }}
          >
            {isRefreshing ? '새로고침 중...' : '새로고침'}
          </Button>
        </Space>
      </div>

      {/* 주문 통계 카드 - 최상단 배치 */}
      <Card 
        title={
          <span 
            onClick={() => navigate('/orders')} 
            style={{ cursor: 'pointer', fontWeight: 600, fontSize: 'clamp(14px, 4vw, 16px)' }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#1890ff'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'inherit'}
          >
            전체주문관리 →
          </span>
        }
        style={{ 
          marginBottom: 24,
        }}
        styles={{
          header: {
            borderBottom: '2px solid #000',
            padding: '12px 16px',
          },
          body: {
            padding: 'clamp(12px, 3vw, 24px)',
          }
        }}
        extra={
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportOrdersToExcel}
            disabled={ordersStatsLoading || !ordersStatsData?.data || ordersStatsData.data.length === 0}
            size="small"
          >
            <span className="hide-on-mobile">주문 </span>엑셀
          </Button>
        }
      >
        {/* 기간 필터 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <Tabs
              activeKey={orderStatsTab}
              onChange={(key) => setOrderStatsTab(key as 'all' | 'daily' | 'weekly' | 'monthly' | 'quarterly')}
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
            {orderStatsTab === 'daily' && (
              <DatePicker
                value={orderSelectedDate}
                onChange={(date) => date && setOrderSelectedDate(date)}
                format="YYYY-MM-DD"
                placeholder="날짜 선택"
                size="small"
                style={{ width: 130 }}
              />
            )}
            {orderStatsTab === 'weekly' && (
              <DatePicker
                picker="week"
                value={dayjs(orderSelectedWeek)}
                onChange={(date) => date && setOrderSelectedWeek(date.startOf('week').format('YYYY-MM-DD'))}
                format="YYYY [W]주"
                placeholder="주 선택"
                size="small"
                style={{ width: 130 }}
              />
            )}
            {orderStatsTab === 'monthly' && (
              <DatePicker
                picker="month"
                value={dayjs(orderSelectedMonth)}
                onChange={(date) => date && setOrderSelectedMonth(date.format('YYYY-MM'))}
                format="YYYY년 MM월"
                placeholder="월 선택"
                size="small"
                style={{ width: 130 }}
              />
            )}
          </div>
        </div>
        
        {ordersStatsLoading ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <Spin size="large" />
            <div style={{ marginTop: 16, color: '#666', fontSize: 14 }}>주문 정보를 불러오는 중...</div>
          </div>
        ) : (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', 
            gap: 12,
          }}>
            {/* 총 주문 */}
            <div 
              style={{ 
                padding: 16, 
                borderRadius: 8, 
                backgroundColor: '#f5f5f5',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>총 주문</div>
              <div style={{ fontSize: 24, fontWeight: 700 }}>{orderStats.total}</div>
            </div>
            
            {/* 입금대기 */}
            <div 
              onClick={() => handleGoToOrders('CREATED')}
              style={{ 
                padding: 16, 
                borderRadius: 8, 
                backgroundColor: '#e6f4ff',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(24, 144, 255, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: 13, color: '#1890ff', marginBottom: 8 }}>입금대기</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#1890ff' }}>{orderStats.waitingPayment}</div>
            </div>
            
            {/* 신규주문 */}
            <div 
              onClick={() => handleGoToOrders('PAID')}
              style={{ 
                padding: 16, 
                borderRadius: 8, 
                backgroundColor: '#f6ffed',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(82, 196, 26, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: 13, color: '#52c41a', marginBottom: 8 }}>신규주문</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>{orderStats.newOrder}</div>
            </div>
            
            {/* 픽업대기 */}
            <div 
              onClick={() => handleGoToOrders('PICKUP_WAITING')}
              style={{ 
                padding: 16, 
                borderRadius: 8, 
                backgroundColor: '#f9f0ff',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(114, 46, 209, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: 13, color: '#722ed1', marginBottom: 8 }}>픽업대기</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#722ed1' }}>{orderStats.pickupWaiting}</div>
            </div>
            
            {/* 배송준비 */}
            <div 
              onClick={() => handleGoToOrders('DELIVERY_READY')}
              style={{ 
                padding: 16, 
                borderRadius: 8, 
                backgroundColor: '#e6fffb',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(19, 194, 194, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: 13, color: '#13c2c2', marginBottom: 8 }}>배송준비</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#13c2c2' }}>{orderStats.deliveryReady}</div>
            </div>
            
            {/* 배송중 */}
            <div 
              onClick={() => handleGoToOrders('DELIVERY')}
              style={{ 
                padding: 16, 
                borderRadius: 8, 
                backgroundColor: '#fff7e6',
                textAlign: 'center',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)'
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(250, 140, 22, 0.2)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)'
                e.currentTarget.style.boxShadow = 'none'
              }}
            >
              <div style={{ fontSize: 13, color: '#fa8c16', marginBottom: 8 }}>배송중</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#fa8c16' }}>{orderStats.delivering}</div>
            </div>
            
            {/* 완료 */}
            <div 
              style={{ 
                padding: 16, 
                borderRadius: 8, 
                backgroundColor: '#f6ffed',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 13, color: '#52c41a', marginBottom: 8 }}>완료</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}>{orderStats.completed}</div>
            </div>
            
            {/* 취소 */}
            <div 
              style={{ 
                padding: 16, 
                borderRadius: 8, 
                backgroundColor: '#fff2f0',
                textAlign: 'center',
              }}
            >
              <div style={{ fontSize: 13, color: '#ff4d4f', marginBottom: 8 }}>취소</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#ff4d4f' }}>{orderStats.canceled}</div>
            </div>
          </div>
        )}
      </Card>

      {/* 매출 통계 카드 */}
      <Card 
        style={{ marginBottom: 24 }}
        extra={
          <Button
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleExportSalesToExcel}
            disabled={currentSalesLoading || !currentSalesData?.data || currentSalesData.data.length === 0}
          >
            매출 엑셀 다운로드
          </Button>
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>매출 현황</div>
            {salesStatsTab === 'daily' && (
              <DatePicker
                value={selectedDate}
                onChange={(date) => date && setSelectedDate(date)}
                format="YYYY-MM-DD"
                placeholder="날짜 선택"
              />
            )}
            {salesStatsTab === 'weekly' && (
              <DatePicker
                picker="week"
                value={dayjs(selectedWeek)}
                onChange={(date) => date && setSelectedWeek(date.startOf('week').format('YYYY-MM-DD'))}
                format="YYYY년 [W]주"
                placeholder="주 선택"
              />
            )}
            {salesStatsTab === 'monthly' && (
              <DatePicker
                picker="month"
                value={dayjs(selectedMonth)}
                onChange={(date) => date && setSelectedMonth(date.format('YYYY-MM'))}
                format="YYYY년 MM월"
                placeholder="월 선택"
              />
            )}
          </div>
          <Tabs
            activeKey={salesStatsTab}
            onChange={(key) => setSalesStatsTab(key as 'daily' | 'weekly' | 'monthly')}
            items={[
              { key: 'daily', label: '일별' },
              { key: 'weekly', label: '주별' },
              { key: 'monthly', label: '월별' },
            ]}
          />
          {currentSalesLoading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16, color: '#666', fontSize: 14 }}>매출 통계를 불러오는 중...</div>
            </div>
          ) : currentSalesData?.data && currentSalesData.data.length > 0 ? (
            <Table
              columns={[
                {
                  title: '기간',
                  dataIndex: 'periodStart',
                  key: 'periodStart',
                  width: 120,
                  render: (date: string) => {
                    if (salesStatsTab === 'daily') {
                      return dayjs(date).format('YYYY-MM-DD')
                    } else if (salesStatsTab === 'weekly') {
                      return dayjs(date).format('YYYY-MM-DD') + ' (주)'
                    } else {
                      return dayjs(date).format('YYYY-MM')
                    }
                  },
                },
                {
                  title: '카드',
                  key: 'card',
                  children: [
                    {
                      title: '건수',
                      dataIndex: ['card', 'count'],
                      key: 'cardCount',
                      align: 'right' as const,
                      width: 80,
                    },
                    {
                      title: '금액',
                      dataIndex: ['card', 'net'],
                      key: 'cardNet',
                      render: (amount: number) => new Intl.NumberFormat('ko-KR').format(amount) + '원',
                      align: 'right' as const,
                      width: 120,
                    },
                  ],
                },
                {
                  title: '무통장',
                  key: 'bankTransfer',
                  children: [
                    {
                      title: '건수',
                      dataIndex: ['bankTransfer', 'count'],
                      key: 'bankCount',
                      align: 'right' as const,
                      width: 80,
                    },
                    {
                      title: '금액',
                      dataIndex: ['bankTransfer', 'net'],
                      key: 'bankNet',
                      render: (amount: number) => new Intl.NumberFormat('ko-KR').format(amount) + '원',
                      align: 'right' as const,
                      width: 120,
                    },
                  ],
                },
                {
                  title: '총매출',
                  key: 'total',
                  children: [
                    {
                      title: '건수',
                      dataIndex: ['total', 'count'],
                      key: 'totalCount',
                      align: 'right' as const,
                      width: 80,
                    },
                    {
                      title: '금액',
                      dataIndex: ['total', 'net'],
                      key: 'totalNet',
                      render: (amount: number) => (
                        <strong>{new Intl.NumberFormat('ko-KR').format(amount)}원</strong>
                      ),
                      align: 'right' as const,
                      width: 140,
                    },
                  ],
                },
              ]}
              dataSource={currentSalesData.data}
              rowKey="periodStart"
              pagination={false}
              size="small"
              scroll={{ x: 'max-content' }}
            />
          ) : (
            <div style={{ color: '#999', textAlign: 'center', padding: '40px 0' }}>
              매출 통계 데이터가 없습니다.
            </div>
          )}
        </Space>
      </Card>

      {/* API 상태 카드 */}
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <Space>
              <ApiOutlined style={{ fontSize: 24 }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>API 서버 상태</div>
                <div style={{ fontSize: 14, color: '#666', marginTop: 4, wordBreak: 'break-all' }}>
                  {import.meta.env.VITE_API_BASE_URL || 'https://찰떡상회.com'}
                </div>
              </div>
            </Space>
            <Space wrap>
              <Tag color={getApiStatusColor()} style={{ fontSize: 14, padding: '4px 12px' }}>
                {getApiStatusText()}
              </Tag>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={handleRefreshStatus}
                loading={apiStatus === 'checking'}
              >
                상태 확인
              </Button>
            </Space>
          </div>
          {lastCheck && (
            <div style={{ fontSize: 12, color: '#999' }}>
              마지막 확인: {lastCheck.toLocaleTimeString('ko-KR')}
            </div>
          )}
          
          {/* 기능 On/Off */}
          <Divider style={{ margin: '16px 0' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <SettingOutlined style={{ fontSize: 20 }} />
            <div style={{ fontSize: 16, fontWeight: 600 }}>기능 On/Off</div>
          </div>
          {featuresLoading ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <Spin size="small" />
              <div style={{ marginTop: 8, color: '#666', fontSize: 12 }}>기능 정보를 불러오는 중...</div>
            </div>
          ) : featuresData?.data && featuresData.data.length > 0 ? (
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              {featuresData.data.map((feature: FeatureFlagResponse) => (
                <div
                  key={feature.key}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 0',
                    borderBottom: '1px solid #f0f0f0',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 500 }}>{getFeatureLabel(feature.key)}</div>
                    {feature.description && (
                      <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                        {feature.description}
                      </div>
                    )}
                  </div>
                  <Switch
                    checked={feature.enabled}
                    onChange={(checked) => handleFeatureToggle(feature.key, checked)}
                    loading={toggleFeatureMutation.isPending}
                    checkedChildren="ON"
                    unCheckedChildren="OFF"
                  />
                </div>
              ))}
            </Space>
          ) : (
            <div style={{ color: '#999', fontSize: 12 }}>기능 정보를 불러올 수 없습니다.</div>
          )}
        </Space>
      </Card>

    </div>
  )
}

export default Dashboard
